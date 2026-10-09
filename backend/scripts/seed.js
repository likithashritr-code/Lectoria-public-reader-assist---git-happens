import dotenv from "dotenv";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { connectDatabase } from "../config/db.js";
import { Activity, Book, CalendarEvent, Loan, Notification, Reader, Request, Shelf } from "../models/index.js";

dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

const dayMs = 24 * 60 * 60 * 1000;
const readerPlans = [
  {
    name: "Likhita",
    loans: [
      { book: 0, daysAgo: 8, dueInDays: 1 },
      { book: 1, daysAgo: 12, dueInDays: 4 },
      { book: 2, daysAgo: 18, dueInDays: 7 },
      { book: 3, daysAgo: 40, returnedDaysAgo: 12 },
      { book: 4, daysAgo: 16, returnedDaysAgo: 3 },
      { book: 5, daysAgo: 9, dueInDays: 5 },
      { book: 6, daysAgo: 28, returnedDaysAgo: 2 },
    ],
  },
  {
    name: "Poorvi",
    loans: [
      { book: 0, daysAgo: 17, dueInDays: 5 },
      { book: 10, daysAgo: 9, dueInDays: 6 },
      { book: 11, daysAgo: 15, dueInDays: 10 },
      { book: 12, daysAgo: 25, returnedDaysAgo: 12 },
      { book: 13, daysAgo: 44, returnedDaysAgo: 30 },
      { book: 14, daysAgo: 5, dueInDays: 12 },
      { book: 15, daysAgo: 8, dueInDays: 9 },
    ],
  },
  {
    name: "Namrata",
    loans: [
      { book: 0, daysAgo: 4, dueInDays: 8 },
      { book: 20, daysAgo: 13, dueInDays: 2 },
      { book: 21, daysAgo: 15, dueInDays: 11 },
      { book: 22, daysAgo: 35, returnedDaysAgo: 20 },
      { book: 23, daysAgo: 6, returnedDaysAgo: 1 },
      { book: 24, daysAgo: 50, returnedDaysAgo: 36 },
      { book: 25, daysAgo: 3, dueInDays: 10 },
    ],
  },
];

try {
  await connectDatabase();
  const bookData = JSON.parse(await fs.readFile(new URL("../data/books.json", import.meta.url), "utf8"));
  const shelves = [...new Map(bookData.map((book) => [book.shelfId, {
    shelfId: book.shelfId,
    name: book.shelfId[0].toUpperCase() + book.shelfId.slice(1),
  }])).values()];

  await Promise.all([
    Activity.deleteMany({}),
    CalendarEvent.deleteMany({}),
    Loan.deleteMany({}),
    Notification.deleteMany({}),
    Request.deleteMany({}),
    Reader.deleteMany({}),
    Book.deleteMany({}),
    Shelf.deleteMany({}),
  ]);
  await Shelf.insertMany(shelves);
  const books = await Book.insertMany(bookData.map((book) => ({ ...book, copiesAvailable: book.totalCopies })));
  const readers = await Reader.insertMany(readerPlans.map(({ name }) => ({
    name,
    avatar: { ready: false, traits: { archetype: "", top_subjects: [], mood: "" }, sourceHash: null },
  })));
  const availableCopies = new Map(books.map((book) => [String(book._id), book.totalCopies]));
  const loans = [];
  const calendarEvents = [];
  const activities = [];
  const now = new Date();

  readerPlans.forEach((plan, readerIndex) => {
    for (const entry of plan.loans) {
      const book = books[entry.book];
      const borrowedOn = new Date(now.getTime() - entry.daysAgo * dayMs);
      const dueOn = entry.returnedDaysAgo === undefined
        ? new Date(now.getTime() + entry.dueInDays * dayMs)
        : new Date(borrowedOn.getTime() + 14 * dayMs);
      const returnedOn = entry.returnedDaysAgo === undefined
        ? null
        : new Date(now.getTime() - entry.returnedDaysAgo * dayMs);
      const loan = {
        readerId: readers[readerIndex]._id,
        bookId: book._id,
        borrowedOn,
        dueOn,
        returnedOn,
      };
      loans.push(loan);
      if (!returnedOn) {
        availableCopies.set(String(book._id), availableCopies.get(String(book._id)) - 1);
      }
      activities.push({
        readerId: readers[readerIndex]._id,
        bookId: book._id,
        shelfId: book.shelfId,
        type: "borrow",
        createdAt: borrowedOn,
      });
    }
  });

  for (const [bookId, copiesAvailable] of availableCopies) {
    if (copiesAvailable < 0) throw new Error(`Seed loans exceed total copies for book ${bookId}`);
    await Book.updateOne({ _id: bookId }, { $set: { copiesAvailable } });
  }
  const createdLoans = await Loan.insertMany(loans);
  createdLoans.forEach((loan) => calendarEvents.push({
    readerId: loan.readerId,
    bookId: loan.bookId,
    type: "due",
    date: loan.dueOn,
    status: loan.returnedOn ? "done" : "scheduled",
    loanId: loan._id,
  }));
  await Promise.all([CalendarEvent.insertMany(calendarEvents), Activity.insertMany(activities)]);
  console.log(`Seeded ${shelves.length} shelves, ${books.length} books, ${readers.length} readers, and ${createdLoans.length} loans.`);
} catch (error) {
  console.error("Seed failed:", error.message);
  process.exitCode = 1;
} finally {
  const mongoose = await import("mongoose");
  await mongoose.default.disconnect();
}