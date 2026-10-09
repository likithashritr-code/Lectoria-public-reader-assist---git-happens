import { Router } from "express";
import { Activity, Book, CalendarEvent, Loan, Notification, Request } from "../models/index.js";
import { decorateBooks } from "../services/books.js";
import { requireReader } from "../middleware/reader.js";

const router = Router();
const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;

router.post("/borrow", requireReader, async (req, res) => {
  const { bookId } = req.body ?? {};
  if (typeof bookId !== "string") return res.status(400).json({ error: { code: "book_id_required", message: "Book id is required" } });
  const book = await Book.findOneAndUpdate(
    { _id: bookId, copiesAvailable: { $gt: 0 } },
    { $inc: { copiesAvailable: -1 } },
    { new: true },
  );
  if (!book) return res.status(409).json({ error: { code: "unavailable", message: "No copies are available" } });

  const borrowedOn = new Date();
  const dueOn = new Date(borrowedOn.getTime() + twoWeeksMs);
  try {
    const loan = await Loan.create({ readerId: req.reader._id, bookId: book._id, borrowedOn, dueOn, returnedOn: null });
    const [calendarEvent] = await Promise.all([
      CalendarEvent.create({ readerId: req.reader._id, bookId: book._id, type: "due", date: dueOn, status: "scheduled", loanId: loan._id }),
      Activity.create({ readerId: req.reader._id, bookId: book._id, shelfId: book.shelfId, type: "borrow" }),
      req.reader.updateOne({ $set: { "avatar.sourceHash": null } }),
    ]);
    const [decorated] = await decorateBooks([book], req.reader);
    return res.status(201).json({ loan, calendarEvent, book: decorated });
  } catch (error) {
    await Book.updateOne({ _id: book._id }, { $inc: { copiesAvailable: 1 } });
    throw error;
  }
});

router.post("/return", requireReader, async (req, res) => {
  const { bookId } = req.body ?? {};
  if (typeof bookId !== "string") return res.status(400).json({ error: { code: "book_id_required", message: "Book id is required" } });
  const loan = await Loan.findOneAndUpdate(
    { readerId: req.reader._id, bookId, returnedOn: null },
    { $set: { returnedOn: new Date() } },
    { new: true, sort: { borrowedOn: 1 } },
  );
  if (!loan) return res.json({ status: "already_returned" });

  const book = await Book.findOneAndUpdate(
    { _id: bookId, $expr: { $lt: ["$copiesAvailable", "$totalCopies"] } },
    { $inc: { copiesAvailable: 1 } },
    { new: true },
  );
  await CalendarEvent.updateOne({ loanId: loan._id, type: "due" }, { $set: { status: "done" } });
  if (!book) return res.status(409).json({ error: { code: "inventory_inconsistent", message: "Book inventory is inconsistent" } });

  const wasUnavailable = book.copiesAvailable === 1;
  let fulfilledRequests = [];
  if (wasUnavailable) {
    fulfilledRequests = await Request.find({ bookId, status: "open" }).lean();
    const requestIds = fulfilledRequests.map((request) => request._id);
    if (requestIds.length) {
      await Request.updateMany({ _id: { $in: requestIds }, status: "open" }, { $set: { status: "fulfilled", fulfilledAt: new Date() } });
      await CalendarEvent.updateMany({ requestId: { $in: requestIds }, type: "request" }, { $set: { status: "available" } });
      await Notification.insertMany(fulfilledRequests.map((request) => ({
        readerId: request.readerId,
        bookId: request.bookId,
        message: `${book.title}, which you requested, is available now.`,
        isRead: false,
      })));
    }
  }
  const [decorated] = await decorateBooks([book], req.reader);
  return res.json({ status: "returned", loan, book: decorated, fulfilledCount: fulfilledRequests.length });
});

export default router;