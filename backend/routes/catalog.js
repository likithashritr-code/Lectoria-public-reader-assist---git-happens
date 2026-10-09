import Fuse from "fuse.js";
import { Router } from "express";
import multer from "multer";
import { Activity, Book, CalendarEvent, Loan, Request, Shelf } from "../models/index.js";
import { sendApiError } from "../middleware/errors.js";
import { decorateBooks, getPopularPicks, getPopularityByBook } from "../services/books.js";
import { extractTitleFromCover, extractTitlesFromImage, extractTitlesFromText, recommendAlternatives } from "../services/gemma.js";
import { requireReader } from "../middleware/reader.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const fuseOptions = { keys: ["title", "author", "subjects"], includeScore: true, threshold: 0.42, ignoreLocation: true };

function apiFailure(res, error) {
  if (sendApiError(res, error)) return;
  console.error(error);
  return res.status(500).json({ error: { code: "internal_error", message: "Something went wrong" } });
}

function fuzzyBooks(books, query) {
  return new Fuse(books, fuseOptions).search(query).map((result) => ({ ...result.item, matchScore: result.score ?? 1 }));
}

async function findAlternativesByBook(book, reader) {
  if (!book) return [];
  const candidates = await Book.find({
    _id: { $ne: book._id },
    copiesAvailable: { $gt: 0 },
    $or: [{ shelfId: book.shelfId }, { subjects: { $in: book.subjects } }],
  }).lean();
  const score = await getPopularityByBook(candidates);
  const sorted = candidates.sort((left, right) =>
    (score.get(String(right._id)) ?? 0) - (score.get(String(left._id)) ?? 0),
  ).slice(0, 5);
  return decorateBooks(sorted, reader);
}

router.get("/shelves/:shelfId", requireReader, async (req, res) => {
  const shelf = await Shelf.findOne({ shelfId: req.params.shelfId }).lean();
  if (!shelf) return res.status(404).json({ error: { code: "shelf_not_found", message: "Shelf was not found" } });
  const books = await Book.find({ shelfId: req.params.shelfId }).lean();
  const decorated = await decorateBooks(books, req.reader);
  const popular = await getPopularPicks(req.params.shelfId, req.reader);
  const topBooks = [...decorated]
    .sort((left, right) => right.borrowCount30d - left.borrowCount30d ||
      (popular.findIndex((book) => book.bookId === right.bookId) - popular.findIndex((book) => book.bookId === left.bookId)))
    .slice(0, 5);
  await Activity.create({ readerId: req.reader._id, shelfId: shelf.shelfId, type: "view" });
  return res.json({ shelf, topBooks, books: decorated });
});

router.get("/search", requireReader, async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const shelfId = typeof req.query.shelfId === "string" ? req.query.shelfId : "";
  if (!query) return res.status(400).json({ error: { code: "query_required", message: "Search query is required" } });
  const allBooks = await Book.find().lean();
  const matched = fuzzyBooks(allBooks, query);
  matched.sort((left, right) => Number(right.shelfId === shelfId) - Number(left.shelfId === shelfId) || left.matchScore - right.matchScore);
  const matchedIds = new Set(matched.map((book) => String(book._id)));
  const results = await decorateBooks(matched.map(({ matchScore, ...book }) => book), req.reader);
  const resultById = new Map(results.map((book) => [book.bookId, book]));
  const recommendationsRequired = !matched.length || matched.every((book) => book.copiesAvailable === 0);
  let recommendations = [];
  if (recommendationsRequired) {
    const popularity = await getPopularityByBook(allBooks);
    const queryTerms = query.toLowerCase().split(/\W+/).filter(Boolean);
    const matchedSubjects = matched
      .filter((book) => book.copiesAvailable === 0)
      .flatMap((book) => book.subjects.map((subject) => subject.toLowerCase()));
    const rankedCandidates = [...allBooks]
      .filter((book) => book.copiesAvailable > 0)
      .map((book) => ({
        book,
        score: (popularity.get(String(book._id)) ?? 0) + book.subjects.reduce((total, subject) => {
          const normalized = subject.toLowerCase();
          const queryOverlap = queryTerms.some((term) => normalized.includes(term)) ? 2 : 0;
          const matchedBookOverlap = matchedSubjects.includes(normalized) ? 4 : 0;
          return total + queryOverlap + matchedBookOverlap;
        }, 0),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, 30)
      .map(({ book }) => ({ bookId: String(book._id), title: book.title, author: book.author, subjects: book.subjects, copiesAvailable: book.copiesAvailable }));
    const candidates = rankedCandidates.slice(0, 3);
    if (candidates.length) {
      try {
        const { picks } = await recommendAlternatives({ query, candidates });
        const candidateIds = new Set(candidates.map((candidate) => candidate.bookId));
        const validIds = [...new Set(picks.map((pick) => pick.bookId))]
          .filter((id) => candidateIds.has(id));
        const validBooks = await Book.find({ _id: { $in: validIds }, copiesAvailable: { $gt: 0 } }).lean();
        const decoratedPicks = await decorateBooks(validBooks, req.reader);
        const reasons = new Map(picks.map((pick) => [pick.bookId, pick.reason]));
        recommendations = decoratedPicks.map((book) => ({ ...book, reason: reasons.get(book.bookId) ?? "" }));
      } catch (error) {
        apiFailure(res, error);
        return;
      }
    }
  }
  const inShelf = results.some((book) => book.shelfId === shelfId &&
    (book.copiesAvailable > 0 || matched.some((match) => String(match._id) === book.bookId && match.matchScore < 0.12)));
  const popularPicks = shelfId ? await getPopularPicks(shelfId, req.reader) : [];
  const activity = { readerId: req.reader._id, type: "search" };
  if (shelfId) activity.shelfId = shelfId;
  const firstMatchedId = matched.find((book) => matchedIds.has(String(book._id)))?._id;
  if (firstMatchedId) activity.bookId = firstMatchedId;
  await Activity.create(activity);
  return res.json({ query, inShelf, results, recommendations, popularPicks });
});

router.post("/photo/book", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: { code: "image_required", message: "An image is required" } });
  try {
    const extracted = await extractTitleFromCover(req.file.buffer);
    const allBooks = await Book.find().lean();
    const query = `${extracted.title} ${extracted.author}`.trim();
    const matches = query ? fuzzyBooks(allBooks, query).filter((item) => item.matchScore <= 0.35).slice(0, 5) : [];
    const decorated = await decorateBooks(matches.map(({ matchScore, ...book }) => book), null);
    return res.json({ extracted, matches: decorated });
  } catch (error) {
    return apiFailure(res, error);
  }
});

router.post("/photo/syllabus", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: { code: "image_required", message: "An image is required" } });
  try {
    return res.json(await extractTitlesFromImage(req.file.buffer));
  } catch (error) {
    return apiFailure(res, error);
  }
});

router.post("/text/syllabus", async (req, res) => {
  if (typeof req.body?.text !== "string" || !req.body.text.trim()) {
    return res.status(400).json({ error: { code: "text_required", message: "Syllabus text is required" } });
  }
  try {
    return res.json(await extractTitlesFromText(req.body.text));
  } catch (error) {
    return apiFailure(res, error);
  }
});

router.post("/syllabus/plan", requireReader, async (req, res) => {
  const titles = req.body?.titles;
  if (!Array.isArray(titles) || titles.some((item) => !item || typeof item.title !== "string" || typeof item.author !== "string")) {
    return res.status(400).json({ error: { code: "invalid_titles", message: "Titles must be an array of title and author strings" } });
  }
  const allBooks = await Book.find().lean();
  const popularity = await getPopularityByBook(allBooks);
  const items = await Promise.all(titles.map(async (item) => {
    const query = `${item.title} ${item.author}`.trim();
    const match = query ? fuzzyBooks(allBooks, query).find((result) => result.matchScore <= 0.35) : null;
    if (!match) return { title: item.title, status: "not_found", book: null, alternatives: [] };
    const [book] = await decorateBooks([match], req.reader);
    if (book.copiesAvailable > 0) return { title: item.title, status: "available", book, alternatives: [] };
    const candidates = allBooks.filter((candidate) => String(candidate._id) !== book.bookId && candidate.copiesAvailable > 0 &&
      (candidate.shelfId === match.shelfId || candidate.subjects.some((subject) => match.subjects.includes(subject))))
      .sort((left, right) => (popularity.get(String(right._id)) ?? 0) - (popularity.get(String(left._id)) ?? 0))
      .slice(0, 5);
    return { title: item.title, status: "unavailable", book, alternatives: await decorateBooks(candidates, req.reader) };
  }));
  return res.json({ items });
});

router.post("/requests", requireReader, async (req, res) => {
  const { bookId } = req.body ?? {};
  if (typeof bookId !== "string") return res.status(400).json({ error: { code: "book_id_required", message: "Book id is required" } });
  let book;
  try {
    book = await Book.findById(bookId).lean();
  } catch (error) {
    if (error.name === "CastError") book = null;
    else throw error;
  }
  if (!book) return res.status(404).json({ error: { code: "book_not_found", message: "Book was not found" } });
  const [decorated] = await decorateBooks([book], req.reader);
  if (book.copiesAvailable > 0) {
    return res.status(409).json({ error: { code: "available_now", message: "This book is available now" }, book: decorated });
  }
  if (await Request.exists({ readerId: req.reader._id, bookId: book._id, status: "open" })) {
    return res.status(409).json({ error: { code: "already_requested", message: "You already requested this book" } });
  }
  const dueBackOn = await Loan.findOne({ bookId: book._id, returnedOn: null }).sort({ dueOn: 1 }).select({ dueOn: 1 }).lean();
  try {
    const request = await Request.create({ readerId: req.reader._id, bookId: book._id, status: "open" });
    const [calendarEvent] = await Promise.all([
      CalendarEvent.create({
        readerId: req.reader._id,
        bookId: book._id,
        type: "request",
        date: dueBackOn?.dueOn ?? null,
        status: "scheduled",
        requestId: request._id,
      }),
      Activity.create({ readerId: req.reader._id, bookId: book._id, type: "request" }),
    ]);
    return res.status(201).json({ status: "requested", request, calendarEvent });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: { code: "already_requested", message: "You already requested this book" } });
    throw error;
  }
});

export default router;