export type ReaderDto = {
  id: string;
  name: string;
  avatar: { ready: boolean; traits: { archetype: string; top_subjects: string[]; mood: string } };
};

export type BookDto = {
  bookId: string;
  title: string;
  author: string;
  shelfId: string;
  copiesAvailable: number;
  totalCopies: number;
  dueBackOn: string | null;
  borrowCount30d: number;
  lastBorrowedOn: string | null;
  borrowedByYou: boolean;
  requested: boolean;
};

export type CalendarEventDto = {
  eventId: string;
  type: "due" | "request";
  date: string | null;
  status: "scheduled" | "available" | "done";
  book: BookDto | null;
  daysLeft: number | null;
};

export type NotificationDto = {
  id: string;
  bookId: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export type PlanItemDto = {
  title: string;
  status: "available" | "unavailable" | "not_found";
  book: BookDto | null;
  alternatives: BookDto[];
};

type ApiError = { error?: { message?: string; code?: string } };

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const READER_STORAGE_KEY = "shelf-whisper-reader-id";

export function getReaderId() {
  return window.localStorage.getItem(READER_STORAGE_KEY);
}

export function setReaderId(readerId: string | null) {
  if (readerId) window.localStorage.setItem(READER_STORAGE_KEY, readerId);
  else window.localStorage.removeItem(READER_STORAGE_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const readerId = getReaderId();
  if (readerId) headers.set("X-Reader-Id", readerId);
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = payload as ApiError;
    throw new Error(error.error?.message || `Request failed (${response.status})`);
  }
  return payload as T;
}

export const api = {
  listReaders: () => request<ReaderDto[]>("/readers"),
  getReader: (id: string) => request<ReaderDto & { unreadCount: number }>(`/readers/${id}`),
  createReader: (name: string) => request<ReaderDto>("/readers", { method: "POST", body: JSON.stringify({ name }) }),
  getShelf: (shelfId: string) => request<{ shelf: { shelfId: string; name: string }; topBooks: BookDto[]; books: BookDto[] }>(`/shelves/${encodeURIComponent(shelfId)}`),
  search: (query: string, shelfId: string) => request<{ query: string; inShelf: boolean; results: BookDto[]; recommendations: (BookDto & { reason: string })[]; popularPicks: BookDto[] }>(`/search?q=${encodeURIComponent(query)}&shelfId=${encodeURIComponent(shelfId)}`),
  borrow: (bookId: string) => request<{ status?: string; book?: BookDto }>("/demo/borrow", { method: "POST", body: JSON.stringify({ bookId }) }),
  returnBook: (bookId: string) => request<{ status: string }>("/demo/return", { method: "POST", body: JSON.stringify({ bookId }) }),
  requestBook: (bookId: string) => request<{ status: string }>("/requests", { method: "POST", body: JSON.stringify({ bookId }) }),
  calendar: (readerId: string) => request<CalendarEventDto[]>(`/readers/${readerId}/calendar`),
  notifications: (readerId: string) => request<{ unread: number; items: NotificationDto[] }>(`/readers/${readerId}/notifications`),
  markNotificationsRead: (ids: string[]) => request<{ updated: number }>("/notifications/read", { method: "POST", body: JSON.stringify({ ids }) }),
  generateAvatar: (readerId: string) => request<ReaderDto["avatar"]>(`/readers/${readerId}/avatar`, { method: "POST" }),
  extractTextSyllabus: (text: string) => request<{ titles: { title: string; author: string }[] }>("/text/syllabus", { method: "POST", body: JSON.stringify({ text }) }),
  extractImageSyllabus: (file: File) => upload<{ titles: { title: string; author: string }[] }>("/photo/syllabus", file),
  extractCover: (file: File) => upload<{ extracted: { title: string; author: string }; matches: BookDto[] }>("/photo/book", file),
  planSyllabus: (titles: { title: string; author: string }[]) => request<{ items: PlanItemDto[] }>("/syllabus/plan", { method: "POST", body: JSON.stringify({ titles }) }),
};

function upload<T>(path: string, file: File) {
  const form = new FormData();
  form.set("image", file);
  return request<T>(path, { method: "POST", body: form });
}