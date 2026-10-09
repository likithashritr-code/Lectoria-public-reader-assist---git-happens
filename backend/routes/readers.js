import crypto from "node:crypto";
import { Router } from "express";
import { Activity, Book, CalendarEvent, Loan, Notification, Reader, Request } from "../models/index.js";
import { generateAvatarTraits } from "../services/gemma.js";
import { decorateBooks } from "../services/books.js";
import { requireMatchingReader, requireReader } from "../middleware/reader.js";

const router = Router();
const dayMs = 24 * 60 * 60 * 1000;
const readerShape = (reader) => ({
  id: String(reader._id),
  name: reader.name,
  avatar: { ready: reader.avatar.ready, traits: reader.avatar.traits },
});

router.get("/", async (req, res) => {
  const readers = await Reader.find().sort({ createdAt: 1 }).lean();
  return res.json(readers.map(readerShape));
});

router.post("/", async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) return res.status(400).json({ error: { code: "name_required", message: "Reader name is required" } });
  const reader = await Reader.create({ name, avatar: { ready: false, traits: { archetype: "", top_subjects: [], mood: "" }, sourceHash: null } });
  return res.status(201).json(readerShape(reader));
});

router.get("/:id", requireReader, requireMatchingReader, async (req, res) => {
  const unreadCount = await Notification.countDocuments({ readerId: req.reader._id, isRead: false });
  return res.json({ ...readerShape(req.reader), unreadCount });
});

router.get("/:id/loans", requireReader, requireMatchingReader, async (req, res) => {
  const loans = await Loan.find({ readerId: req.reader._id, returnedOn: null }).sort({ dueOn: 1 }).lean();
  const books = await Book.find({ _id: { $in: loans.map((loan) => loan.bookId) } }).lean();
  const decorated = await decorateBooks(books, req.reader);
  const booksById = new Map(decorated.map((book) => [book.bookId, book]));
  const now = Date.now();
  return res.json(loans.map((loan) => ({
    loanId: String(loan._id),
    book: booksById.get(String(loan.bookId)) ?? null,
    borrowedOn: loan.borrowedOn,
    dueOn: loan.dueOn,
    daysLeft: Math.ceil((new Date(loan.dueOn).getTime() - now) / dayMs),
  })));
});

router.get("/:id/calendar", requireReader, requireMatchingReader, async (req, res) => {
  const [loans, requests] = await Promise.all([
    Loan.find({ readerId: req.reader._id }).sort({ dueOn: 1 }).lean(),
    Request.find({ readerId: req.reader._id }).sort({ createdAt: 1 }).lean(),
  ]);
  const loanIds = loans.map((loan) => loan._id);
  const requestIds = requests.map((request) => request._id);
  const conditions = [];
  if (loanIds.length) conditions.push({ loanId: { $in: loanIds } });
  if (requestIds.length) conditions.push({ requestId: { $in: requestIds } });
  const events = conditions.length
    ? await CalendarEvent.find({ readerId: req.reader._id, $or: conditions }).lean()
    : [];
  const eventByLoan = new Map(events.filter((event) => event.loanId).map((event) => [String(event.loanId), event]));
  const eventByRequest = new Map(events.filter((event) => event.requestId).map((event) => [String(event.requestId), event]));
  const ids = [...loans.map((loan) => loan.bookId), ...requests.map((request) => request.bookId)];
  const books = await Book.find({ _id: { $in: ids } }).lean();
  const decorated = await decorateBooks(books, req.reader);
  const booksById = new Map(decorated.map((book) => [book.bookId, book]));
  const now = Date.now();
  const dueEvents = loans.map((loan) => {
    const event = eventByLoan.get(String(loan._id));
    const date = event?.date ?? loan.dueOn;
    const status = event?.status ?? (loan.returnedOn ? "done" : "scheduled");
    return {
      eventId: String(event?._id ?? loan._id),
      type: "due",
      date,
      status,
      book: booksById.get(String(loan.bookId)) ?? null,
      daysLeft: status === "done" ? null : Math.ceil((new Date(date).getTime() - now) / dayMs),
    };
  });
  const requestEvents = requests.map((request) => {
    const event = eventByRequest.get(String(request._id));
    const date = event?.date ?? null;
    const status = event?.status ?? (request.status === "fulfilled" ? "available" : "scheduled");
    return {
      eventId: String(event?._id ?? request._id),
      type: "request",
      date,
      status,
      book: booksById.get(String(request.bookId)) ?? null,
      daysLeft: date && status === "scheduled" ? Math.ceil((new Date(date).getTime() - now) / dayMs) : null,
    };
  });
  return res.json([...dueEvents, ...requestEvents].sort((left, right) =>
    (left.date ? new Date(left.date).getTime() : Infinity) - (right.date ? new Date(right.date).getTime() : Infinity),
  ));
});

router.get("/:id/notifications", requireReader, requireMatchingReader, async (req, res) => {
  const [unread, items] = await Promise.all([
    Notification.countDocuments({ readerId: req.reader._id, isRead: false }),
    Notification.find({ readerId: req.reader._id }).sort({ createdAt: -1 }).lean(),
  ]);
  return res.json({ unread, items: items.map((item) => ({
    id: String(item._id),
    bookId: String(item.bookId),
    message: item.message,
    isRead: item.isRead,
    createdAt: item.createdAt,
  })) });
});

router.post("/:id/avatar", requireReader, requireMatchingReader, async (req, res) => {
  const loans = await Loan.find({ readerId: req.reader._id }).sort({ borrowedOn: 1 }).lean();
  const sourceHash = crypto.createHash("sha256").update(loans.map((loan) => String(loan._id)).join(":" )).digest("hex");
  if (!loans.length) {
    const traits = { archetype: "newcomer", top_subjects: [], mood: "curious" };
    req.reader.avatar = { ready: true, traits, sourceHash };
    await req.reader.save();
    return res.json({ ready: true, traits });
  }
  if (req.reader.avatar.ready && req.reader.avatar.sourceHash === sourceHash) {
    return res.json({ ready: true, traits: req.reader.avatar.traits });
  }

  const books = await Book.find({ _id: { $in: loans.map((loan) => loan.bookId) } }).lean();
  const booksById = new Map(books.map((book) => [String(book._id), book]));
  const history = loans.map((loan) => {
    const book = booksById.get(String(loan.bookId));
    return book ? { title: book.title, subjects: book.subjects } : null;
  }).filter(Boolean);
  let traits;
  try {
    traits = await generateAvatarTraits(history);
  } catch {
    const subjectCounts = new Map();
    for (const book of history) {
      for (const subject of new Set(book.subjects)) subjectCounts.set(subject, (subjectCounts.get(subject) ?? 0) + 1);
    }
    const topSubjects = [...subjectCounts]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 3)
      .map(([subject]) => subject);
    traits = {
      archetype: `${topSubjects[0] ?? "general"} reader`,
      top_subjects: topSubjects,
      mood: topSubjects.length > 1 ? "curious" : "focused",
    };
  }
  req.reader.avatar = { ready: true, traits, sourceHash };
  await req.reader.save();
  return res.json({ ready: true, traits });
});

export default router;