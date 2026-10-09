import { Activity, Book, Loan, Request } from "../models/index.js";

const RECENT_WINDOW = 30 * 24 * 60 * 60 * 1000;

export async function decorateBooks(books, reader) {
  if (!books.length) return [];
  const ids = books.map((book) => book._id);
  const since = new Date(Date.now() - RECENT_WINDOW);
  const readerId = reader?._id;
  const [recentLoans, activeLoans, personalLoans, openRequests] = await Promise.all([
    Loan.aggregate([
      { $match: { bookId: { $in: ids }, borrowedOn: { $gte: since } } },
      { $group: { _id: "$bookId", borrowCount30d: { $sum: 1 }, lastBorrowedOn: { $max: "$borrowedOn" } } },
    ]),
    Loan.aggregate([
      { $match: { bookId: { $in: ids }, returnedOn: null } },
      { $group: { _id: "$bookId", dueBackOn: { $min: "$dueOn" } } },
    ]),
    readerId ? Loan.aggregate([
      { $match: { bookId: { $in: ids }, readerId, returnedOn: null } },
      { $group: { _id: "$bookId" } },
    ]) : [],
    readerId ? Request.aggregate([
      { $match: { bookId: { $in: ids }, readerId, status: "open" } },
      { $group: { _id: "$bookId" } },
    ]) : [],
  ]);
  const recentById = new Map(recentLoans.map((item) => [String(item._id), item]));
  const dueById = new Map(activeLoans.map((item) => [String(item._id), item.dueBackOn]));
  const personalIds = new Set(personalLoans.map((item) => String(item._id)));
  const requestIds = new Set(openRequests.map((item) => String(item._id)));

  return books.map((book) => {
    const id = String(book._id);
    const recent = recentById.get(id);
    return {
      bookId: id,
      title: book.title,
      author: book.author,
      shelfId: book.shelfId,
      copiesAvailable: book.copiesAvailable,
      totalCopies: book.totalCopies,
      dueBackOn: book.copiesAvailable === 0 ? dueById.get(id) ?? null : null,
      borrowCount30d: recent?.borrowCount30d ?? 0,
      lastBorrowedOn: recent?.lastBorrowedOn ?? null,
      borrowedByYou: personalIds.has(id),
      requested: requestIds.has(id),
    };
  });
}

export async function getPopularityByBook(books) {
  if (!books.length) return new Map();
  const ids = books.map((book) => book._id);
  const since = new Date(Date.now() - RECENT_WINDOW);
  const [loans, requests, views] = await Promise.all([
    Loan.aggregate([
      { $match: { bookId: { $in: ids }, borrowedOn: { $gte: since } } },
      { $group: { _id: "$bookId", count: { $sum: 1 } } },
    ]),
    Activity.aggregate([
      { $match: { bookId: { $in: ids }, type: "request", createdAt: { $gte: since } } },
      { $group: { _id: "$bookId", count: { $sum: 1 } } },
    ]),
    Activity.aggregate([
      { $match: { bookId: { $in: ids }, type: "view", createdAt: { $gte: since } } },
      { $group: { _id: "$bookId", count: { $sum: 1 } } },
    ]),
  ]);
  const scores = new Map();
  for (const item of loans) scores.set(String(item._id), (scores.get(String(item._id)) ?? 0) + item.count * 3);
  for (const item of requests) scores.set(String(item._id), (scores.get(String(item._id)) ?? 0) + item.count * 2);
  for (const item of views) scores.set(String(item._id), (scores.get(String(item._id)) ?? 0) + item.count);
  return scores;
}

export async function getPopularPicks(shelfId, reader) {
  const books = await Book.find({ shelfId }).lean();
  const scores = await getPopularityByBook(books);
  const decorated = await decorateBooks(books, reader);
  return decorated
    .map((book) => ({ book, popularity: scores.get(book.bookId) ?? 0 }))
    .sort((left, right) => right.popularity - left.popularity || right.book.borrowCount30d - left.book.borrowCount30d)
    .slice(0, 5)
    .map(({ book }) => book);
}