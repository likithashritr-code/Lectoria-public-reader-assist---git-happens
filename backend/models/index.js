import mongoose from "mongoose";

const { Schema, model } = mongoose;

const bookSchema = new Schema({
  title: { type: String, required: true, trim: true },
  author: { type: String, required: true, trim: true },
  shelfId: { type: String, required: true, index: true },
  subjects: { type: [String], default: [] },
  language: { type: String, default: "English" },
  description: { type: String, default: "" },
  totalCopies: { type: Number, required: true, min: 1 },
  copiesAvailable: { type: Number, required: true, min: 0 },
});
bookSchema.index({ title: "text", author: "text", subjects: "text" });

const shelfSchema = new Schema({
  shelfId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
});

const readerSchema = new Schema({
  name: { type: String, required: true, trim: true },
  avatar: {
    ready: { type: Boolean, default: false },
    traits: {
      archetype: { type: String, default: "" },
      top_subjects: { type: [String], default: [] },
      mood: { type: String, default: "" },
    },
    sourceHash: { type: String, default: null },
  },
  createdAt: { type: Date, default: Date.now },
});

const loanSchema = new Schema({
  readerId: { type: Schema.Types.ObjectId, ref: "Reader", required: true, index: true },
  bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true, index: true },
  borrowedOn: { type: Date, required: true },
  dueOn: { type: Date, required: true },
  returnedOn: { type: Date, default: null },
});

const requestSchema = new Schema({
  readerId: { type: Schema.Types.ObjectId, ref: "Reader", required: true },
  bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true },
  status: { type: String, enum: ["open", "fulfilled"], default: "open" },
  createdAt: { type: Date, default: Date.now },
  fulfilledAt: { type: Date, default: null },
});
requestSchema.index(
  { readerId: 1, bookId: 1 },
  { unique: true, partialFilterExpression: { status: "open" } },
);

const calendarEventSchema = new Schema({
  readerId: { type: Schema.Types.ObjectId, ref: "Reader", required: true, index: true },
  bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true },
  type: { type: String, enum: ["due", "request"], required: true },
  date: { type: Date, default: null },
  status: { type: String, enum: ["scheduled", "available", "done"], default: "scheduled" },
  loanId: { type: Schema.Types.ObjectId, ref: "Loan", default: null },
  requestId: { type: Schema.Types.ObjectId, ref: "Request", default: null },
});

const notificationSchema = new Schema({
  readerId: { type: Schema.Types.ObjectId, ref: "Reader", required: true, index: true },
  bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const activitySchema = new Schema({
  readerId: { type: Schema.Types.ObjectId, ref: "Reader", required: true, index: true },
  bookId: { type: Schema.Types.ObjectId, ref: "Book", default: null },
  shelfId: { type: String, default: null },
  type: { type: String, enum: ["view", "search", "request", "borrow"], required: true },
  createdAt: { type: Date, default: Date.now },
});

export const Book = model("Book", bookSchema);
export const Shelf = model("Shelf", shelfSchema);
export const Reader = model("Reader", readerSchema);
export const Loan = model("Loan", loanSchema);
export const Request = model("Request", requestSchema);
export const CalendarEvent = model("CalendarEvent", calendarEventSchema);
export const Notification = model("Notification", notificationSchema);
export const Activity = model("Activity", activitySchema);