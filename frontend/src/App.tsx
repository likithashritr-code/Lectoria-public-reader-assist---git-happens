import { useEffect, useRef, useState } from "react";
import { api, getReaderId, setReaderId, type BookDto, type CalendarEventDto, type NotificationDto, type PlanItemDto, type ReaderDto } from "./lib/api";

type Book = {
  bookId: string;
  title: string;
  author: string;
  shelf: string;
  copiesAvailable: number;
  totalCopies: number;
  dueBackOn?: string;
  borrowCount30d: number;
  lastBorrowedOn: string;
  borrowedByYou?: boolean;
  requested?: boolean;
  cover: string;
  accent: string;
  reason?: string;
};

type Reader = { id: string; name: string; label: string; seed: string };

type IconName =
  | "book"
  | "bell"
  | "calendar"
  | "camera"
  | "search"
  | "chevron"
  | "sparkles"
  | "clock"
  | "upload"
  | "x"
  | "edit"
  | "trash"
  | "arrow"
  | "check"
  | "plus"
  | "menu"
  | "user"
  | "phone"
  | "home"
  | "settings"
  | "logout";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></>,
    bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></>,
    camera: <><path d="M14.5 4 16 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.5-3Z"/><circle cx="12" cy="13" r="3"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    sparkles: <><path d="m12 3-1.6 4.4L6 9l4.4 1.6L12 15l1.6-4.4L18 9l-4.4-1.6Z"/><path d="m5 15-.8 2.2L2 18l2.2.8L5 21l.8-2.2L8 18l-2.2-.8Z"/><path d="m19 13-.7 1.3L17 15l1.3.7L19 17l.7-1.3L21 15l-1.3-.7Z"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    upload: <><path d="M12 16V4m0 0-4 4m4-4 4 4"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></>,
    x: <path d="m6 6 12 12M18 6 6 18"/>,
    edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></>,
    trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v5M14 11v5"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    plus: <path d="M12 5v14M5 12h14"/>,
    menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    phone: <><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.4 2.1L8.1 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.6 1.9Z"/></>,
    home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10M9 21v-7h6v7"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19 15a2 2 0 0 0 .4 2.2l.1.1-2.2 2.2-.1-.1A2 2 0 0 0 15 19a2 2 0 0 0-1 1.8v.2h-4v-.2A2 2 0 0 0 9 19a2 2 0 0 0-2.2.4l-.1.1-2.2-2.2.1-.1A2 2 0 0 0 5 15a2 2 0 0 0-1.8-1H3v-4h.2A2 2 0 0 0 5 9a2 2 0 0 0-.4-2.2l-.1-.1 2.2-2.2.1.1A2 2 0 0 0 9 5a2 2 0 0 0 1-1.8V3h4v.2A2 2 0 0 0 15 5a2 2 0 0 0 2.2-.4l.1-.1 2.2 2.2-.1.1A2 2 0 0 0 19 9a2 2 0 0 0 1.8 1h.2v4h-.2A2 2 0 0 0 19 15Z"/></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

const coverAccents = ["#273747", "#647D8D", "#496455", "#8A674D", "#536B78"];

function readerFromDto(reader: ReaderDto): Reader {
  return {
    id: reader.id,
    name: reader.name,
    label: reader.avatar.traits.archetype || "New reader",
    seed: reader.avatar.traits.top_subjects.join("-") || reader.id,
  };
}

function bookFromDto(book: BookDto, index = 0): Book {
  const lastBorrowed = book.lastBorrowedOn ? new Date(book.lastBorrowedOn) : null;
  const daysAgo = lastBorrowed ? Math.floor((Date.now() - lastBorrowed.getTime()) / 86400000) : null;
  return {
    bookId: book.bookId,
    title: book.title,
    author: book.author,
    shelf: book.shelfId,
    copiesAvailable: book.copiesAvailable,
    totalCopies: book.totalCopies,
    dueBackOn: book.dueBackOn ? new Date(book.dueBackOn).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : undefined,
    borrowCount30d: book.borrowCount30d,
    lastBorrowedOn: daysAgo === null ? "No recent loans" : daysAgo === 0 ? "Today" : daysAgo === 1 ? "Yesterday" : `${daysAgo} days ago`,
    borrowedByYou: book.borrowedByYou,
    requested: book.requested,
    cover: book.title.toUpperCase(),
    accent: coverAccents[index % coverAccents.length],
  };
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function avatarUrl(reader: Reader) {
  const style = reader.id === "maya" ? "lorelei" : "notionists";
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${reader.seed}&backgroundColor=e9eceb`;
}

function Avatar({ reader, compact = false }: { reader: Reader; compact?: boolean }) {
  return (
    <div className={`avatar ${compact ? "avatar-compact" : ""}`}>
      <img src={avatarUrl(reader)} alt={`${reader.name}'s avatar`} />
    </div>
  );
}

function ModalButton({ children, onClick, variant = "primary" }: { children: React.ReactNode; onClick: () => void; variant?: "primary" | "secondary" }) {
  return <button className={`welcome-button ${variant}`} onClick={onClick}>{children}</button>;
}

function CircularAvatar({ reader, missing }: { reader: Reader; missing?: boolean }) {
  return (
    <div className={`welcome-avatar ${missing ? "missing" : ""}`}>
      <div className="welcome-avatar-ring">
        {missing ? <div className="profile-placeholder"><span /><i /></div> : <img src={avatarUrl(reader)} alt={`${reader.name}'s profile`} />}
      </div>
      <span className="avatar-ornament one">✦</span>
      <span className="avatar-ornament two">✦</span>
    </div>
  );
}

function WelcomeModal({ reader, missing = false, creating = false, onClose, onCreate }: { reader: Reader; missing?: boolean; creating?: boolean; onClose: () => void; onCreate: () => void }) {
  return (
    <div className="welcome-modal-wrap" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="welcome-backdrop" onClick={onClose} />
      <section className="welcome-modal">
        <div className="modal-filigree top" />
        <div className="modal-filigree bottom" />
        <button className="welcome-close" aria-label="Close welcome message" onClick={onClose}><Icon name="x" size={18} /></button>
        <CircularAvatar reader={reader} missing={missing} />
        <p className="welcome-kicker">Your library awaits</p>
        <h2 id="welcome-title">Welcome back, {reader.name}!</h2>
        <p className="welcome-subtitle">Ready to discover your next favourite read?</p>
        {missing ? (
          <>
            {creating ? <p className="welcome-subtitle">Creating your reading avatar…</p> : <ModalButton onClick={onCreate}><Icon name="sparkles" size={17} /> Retry avatar</ModalButton>}
            <button className="welcome-skip" onClick={onClose}>Continue without an avatar</button>
          </>
        ) : (
          <ModalButton onClick={onClose}>Explore My Library <Icon name="arrow" size={17} /></ModalButton>
        )}
        <span className="welcome-rule"><i /> L <i /></span>
      </section>
    </div>
  );
}

function LoginPage({ availableReaders, onLogin, onChooseReader }: { availableReaders: Reader[]; onLogin: (name: string, phone: string) => Promise<void>; onChooseReader: (reader: Reader) => Promise<void> }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setError("Please enter your username and phone number.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onLogin(name.trim(), phone.trim());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not connect to the library.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <div className="login-orbit orbit-one" /><div className="login-orbit orbit-two" />
      <section className="login-intro">
        <div className="login-brand"><span><Icon name="book" /></span><div>LECTORIA<small>Read · Connect · Belong</small></div></div>
        <div className="login-copy"><p className="login-kicker">Your smart library</p><h1>Welcome to<br /><em>Lectoria.</em></h1><p>A thoughtful place to discover books, follow your reading, and join conversations that stay with you.</p></div>
        <div className="login-quote"><span>“</span><p>A library is not a luxury but one of the necessities of life.</p><small>Henry Ward Beecher</small></div>
      </section>
      <section className="login-panel">
        <div className="login-form-wrap">
          <div className="login-seal"><Icon name="book" /></div><p className="eyebrow">Member access</p><h2>Welcome back</h2><p className="login-lead">Sign in to continue to your personal library.</p>
          <form onSubmit={submit}>
            <label>Username<div className="login-input"><Icon name="user" size={18} /><input value={name} onChange={e => setName(e.target.value)} placeholder="Enter your username" autoComplete="name" /></div></label>
            <label>Phone number<div className="login-input"><Icon name="phone" size={18} /><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Enter your phone number" inputMode="tel" autoComplete="tel" /></div></label>
            {error && <p className="login-error">{error}</p>}
            <button className="login-submit" type="submit" disabled={busy}>{busy ? "Connecting…" : "Enter Lectoria"} <Icon name="arrow" size={18} /></button>
          </form>
          {availableReaders.length > 0 && <div className="login-readers"><p>Or continue as a reader</p>{availableReaders.map(existingReader => <button key={existingReader.id} disabled={busy} onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await onChooseReader(existingReader);
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "Could not open this reader.");
            } finally {
              setBusy(false);
            }
          }}><Avatar reader={existingReader} compact /><span><strong>{existingReader.name}</strong><small>{existingReader.label}</small></span><Icon name="chevron" size={16} /></button>)}</div>}
          <p className="login-privacy">By continuing, you agree to Lectoria’s member terms and privacy policy.</p>
        </div>
      </section>
    </main>
  );
}

function StatusBadge({ book }: { book: Book }) {
  return book.copiesAvailable > 0 ? (
    <span className="status available"><span className="status-dot" />{book.copiesAvailable} of {book.totalCopies} available</span>
  ) : (
    <span className="status unavailable"><span className="status-dot" />{book.dueBackOn ? `Due back ${book.dueBackOn}` : "No copies available"}</span>
  );
}

function BookCover({ book, small = false }: { book: Book; small?: boolean }) {
  return (
    <div className={`book-cover ${small ? "small" : ""}`} style={{ background: book.accent }}>
      <span>{book.cover}</span>
      <i>◆</i>
    </div>
  );
}

function BookCard({ book, rank, onRequest }: { book: Book; rank?: number; onRequest: (id: string) => void }) {
  return (
    <article className="book-card">
      {rank && <span className="rank">{rank}</span>}
      <BookCover book={book} />
      <div className="book-info">
        <div className="book-head">
          <div>
            <h3>{book.title}</h3>
            <p className="author">by {book.author}</p>
          </div>
          <StatusBadge book={book} />
        </div>
        <div className="book-meta">
          <span><Icon name="book" size={15} /> Borrowed {book.borrowCount30d} times this month</span>
          <span><Icon name="clock" size={15} /> Last borrowed {book.lastBorrowedOn}</span>
        </div>
        <div className="book-actions">
          <div>{book.borrowedByYou && <span className="you-tag"><Icon name="check" size={14} /> You borrowed this</span>}</div>
          {!book.borrowedByYou && book.copiesAvailable === 0 && <button className={`btn ${book.requested ? "requested" : "primary"}`} disabled={book.requested} onClick={() => onRequest(book.bookId)}>
            {book.requested ? <><Icon name="check" size={16} /> Requested</> : "Request"}
          </button>}
        </div>
      </div>
    </article>
  );
}

function CalendarPage({ events }: { events: CalendarEventDto[] }) {
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const now = new Date();
  const firstWeekday = (new Date(now.getFullYear(), now.getMonth(), 1).getDay() + 6) % 7;
  const monthLength = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: Math.ceil((firstWeekday + monthLength) / 7) * 7 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day > 0 && day <= monthLength ? day : null;
  });
  const selectedDate = new Date(now.getFullYear(), now.getMonth(), selectedDay);
  const selectedEvents = events.filter((event) => event.date && dayKey(new Date(event.date)) === dayKey(selectedDate));
  const eventDays = new Map<number, string>();
  for (const event of events) {
    if (!event.date) continue;
    const date = new Date(event.date);
    if (date.getFullYear() !== now.getFullYear() || date.getMonth() !== now.getMonth() || event.status === "done") continue;
    const marker = event.type === "request" || event.status === "available" ? "normal" : (event.daysLeft ?? 0) < 0 ? "overdue" : (event.daysLeft ?? 0) <= 2 ? "soon" : "normal";
    eventDays.set(date.getDate(), marker);
  }
  return (
    <main className="page calendar-page">
      <div className="page-title">
        <div><p className="eyebrow">Your schedule</p><h1>Calendar</h1><p>See important library dates at a glance.</p></div>
      </div>
      <div className="calendar-layout">
        <section className="panel calendar-panel">
          <div className="calendar-head"><span /><h2>{now.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2><span /></div>
          <div className="weekdays">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => <span key={d}>{d}</span>)}</div>
          <div className="month-grid">
            {days.map((day, i) => day ? <button key={i} className={`day ${selectedDay === day ? "selected" : ""}`} onClick={() => setSelectedDay(day)}><span>{day}</span>{eventDays.has(day) && <i className={eventDays.get(day)} />}</button> : <span key={i} />)}
          </div>
          <div className="legend"><span><i className="normal" />Due</span><span><i className="soon" />Due soon</span><span><i className="overdue" />Overdue</span></div>
        </section>
        <aside className="panel day-detail">
          <p className="eyebrow">Selected date</p><h2>{selectedDate.toLocaleDateString(undefined, { day: "numeric", month: "long" })}</h2>
          {selectedEvents.length ? <><p className="muted">{selectedEvents.length} library {selectedEvents.length === 1 ? "event" : "events"}</p>{selectedEvents.map((event) => event.book && <div className="mini-loan" key={event.eventId}><BookCover book={bookFromDto(event.book)} small /><div><strong>{event.book.title}</strong><span>{event.book.author}</span><b>{event.type === "due" ? event.status === "done" ? "Returned" : "Due" : event.status === "available" ? "Available now" : "Request"}</b></div></div>)}</> : <div className="empty-mini"><Icon name="calendar" /><p>No library events on this day.</p></div>}
        </aside>
      </div>
    </main>
  );
}

function SettingsPage({ reader, name, phone, onSave }: { reader: Reader; name: string; phone: string; onSave: (name: string, phone: string) => void }) {
  const [nextName, setNextName] = useState(name);
  const [nextPhone, setNextPhone] = useState(phone);
  return (
    <main className="page settings-page">
      <div className="page-title"><div><p className="eyebrow">Your account</p><h1>Settings</h1><p>Manage your profile and notification preferences.</p></div></div>
      <div className="settings-layout">
        <aside className="settings-profile"><Avatar reader={{ ...reader, name }} /><h2>{name}</h2><p>{reader.label}</p><button className="btn secondary">Change avatar</button></aside>
        <section className="settings-card"><div><p className="eyebrow">Profile details</p><h2>Personal information</h2></div>
          <label>Username<input value={nextName} onChange={e => setNextName(e.target.value)} /></label>
          <label>Phone number<input value={nextPhone} onChange={e => setNextPhone(e.target.value)} /></label>
          <div className="settings-toggle"><div><strong>Due-date notifications</strong><span>Get an urgent alert when a book is due tomorrow.</span></div><button className="toggle on"><i /></button></div>
          <div className="settings-toggle"><div><strong>Community updates</strong><span>Hear about replies and reading-circle activity.</span></div><button className="toggle on"><i /></button></div>
          <button className="btn primary settings-save" onClick={() => onSave(nextName, nextPhone)}>Save changes</button>
        </section>
      </div>
    </main>
  );
}

function UploadModal({ onClose, onToast }: { onClose: () => void; onToast: (s: string) => void }) {
  const [tab, setTab] = useState<"cover" | "photo" | "text">("text");
  const [step, setStep] = useState<"input" | "extract" | "plan">("input");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [items, setItems] = useState<{ id: number; title: string; author: string }[]>([]);
  const [plan, setPlan] = useState<PlanItemDto[]>([]);
  const [requested, setRequested] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function beginExtract() {
    setBusy(true);
    setError("");
    try {
      let titles: { title: string; author: string }[];
      if (tab === "text") {
        titles = (await api.extractTextSyllabus(text)).titles;
      } else {
        if (!file) throw new Error("Choose an image first.");
        titles = tab === "cover"
          ? [(await api.extractCover(file)).extracted]
          : (await api.extractImageSyllabus(file)).titles;
      }
      setItems(titles.map((item, id) => ({ ...item, id })));
      setStep("extract");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not extract titles.");
    } finally {
      setBusy(false);
    }
  }

  async function checkAvailability() {
    setBusy(true);
    setError("");
    try {
      const result = await api.planSyllabus(items.map(({ title, author }) => ({ title, author })));
      setPlan(result.items);
      setStep("plan");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not check availability.");
    } finally {
      setBusy(false);
    }
  }

  async function request(bookId: string) {
    try {
      await api.requestBook(bookId);
      setRequested((current) => [...new Set([...current, bookId])]);
      onToast("Request placed. We’ll let you know when it’s available.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not place the request.");
    }
  }

  async function requestAll() {
    const bookIds = plan
      .filter((item) => item.status === "unavailable" && item.book && !requested.includes(item.book.bookId))
      .map((item) => item.book!.bookId);
    const outcomes = await Promise.allSettled(bookIds.map((bookId) => api.requestBook(bookId)));
    const successful = bookIds.filter((_, index) => outcomes[index].status === "fulfilled");
    setRequested((current) => [...new Set([...current, ...successful])]);
    onToast(`${successful.length} request${successful.length === 1 ? "" : "s"} placed.`);
  }
  return (
    <div className="modal-wrap" role="dialog" aria-modal="true">
      <div className="modal-backdrop" onClick={onClose} />
      <section className="upload-modal">
        <div className="modal-head"><div><p className="eyebrow">Gemma-powered search</p><h2>Build your reading plan</h2></div><button className="round-btn" onClick={onClose}><Icon name="x" /></button></div>
        {step !== "plan" && <div className="tab-bar">
          <button className={tab === "cover" ? "active" : ""} onClick={() => { setTab("cover"); setStep("input"); setFile(null); setError(""); }}><Icon name="camera" /> Book cover</button>
          <button className={tab === "photo" ? "active" : ""} onClick={() => { setTab("photo"); setStep("input"); setFile(null); setError(""); }}><Icon name="upload" /> Reading list photo</button>
          <button className={tab === "text" ? "active" : ""} onClick={() => { setTab("text"); setStep("input"); setError(""); }}><Icon name="edit" /> Paste text</button>
        </div>}

        {step === "input" && tab === "text" && <div className="modal-body paste-view">
          <div className="paste-intro"><span className="ai-mark"><Icon name="sparkles" /></span><div><h3>Paste any syllabus or reading list</h3><p>Neat list or messy notes—Gemma will identify the books for you.</p></div></div>
          <label className="text-label">Syllabus text<textarea value={text} onChange={e => setText(e.target.value)} /></label>
          <div className="privacy"><Icon name="check" size={15} /> Your text is only used to find book titles.</div>
          {error && <p className="login-error">{error}</p>}
          <button className="btn primary wide" disabled={busy || !text.trim()} onClick={beginExtract}>{busy ? "Reading list…" : "Find books"} <Icon name="arrow" size={18} /></button>
        </div>}
        {step === "input" && tab !== "text" && <div className="modal-body">
          <div className="dropzone">
            <span className="upload-icon"><Icon name={tab === "cover" ? "camera" : "upload"} /></span>
            <h3>{tab === "cover" ? "Photograph a book cover" : "Upload your reading list"}</h3>
            <p>Use a clear, well-lit image for the best match.</p>
            <label className="btn primary file-btn">{file ? file.name : "Choose image"}<input type="file" accept="image/*" capture={tab === "cover" ? "environment" : undefined} onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError(""); }} /></label>
            {error && <p className="login-error">{error}</p>}
            <button className="btn secondary" disabled={busy || !file} onClick={beginExtract}>{busy ? "Reading image…" : <><Icon name="sparkles" /> Extract titles</>}</button>
          </div>
        </div>}
        {step === "extract" && <div className="modal-body extracted">
          <div className="step-line"><span><Icon name="check" /></span><i /><b>Review titles</b><i /><em>Check availability</em></div>
          <div className="extract-title"><div><p className="eyebrow"><Icon name="sparkles" size={15} /> Extracted by Gemini</p><h3>We found {items.length} books</h3></div><button className="btn text-btn" onClick={() => setStep("input")}>Start over</button></div>
          <p className="muted">Check the details before we search the library catalogue.</p>
          {error && <p className="login-error">{error}</p>}
          <div className="edit-list">{items.map((item, i) => <div className="edit-row" key={item.id}><span>{String(i + 1).padStart(2, "0")}</span><div><input value={item.title} onChange={e => setItems(v => v.map(x => x.id === item.id ? { ...x, title: e.target.value } : x))} /><p>{item.author || "Author not shown"}</p></div><button onClick={() => setItems(v => v.filter(x => x.id !== item.id))}><Icon name="trash" size={17} /></button></div>)}</div>
          <button className="btn primary wide" disabled={busy || !items.length} onClick={checkAvailability}>{busy ? "Checking catalog…" : "Check availability"} <Icon name="arrow" size={18} /></button>
        </div>}
        {step === "plan" && <div className="modal-body plan-view">
          <div className="plan-title"><button className="round-btn back" onClick={() => setStep("extract")}><Icon name="chevron" /></button><div><p className="eyebrow">Your reading plan</p><h2>{plan.length} titles checked</h2></div><span className="ai-pill"><Icon name="sparkles" size={15} /> Catalog matches</span></div>
          <div className="summary-strip"><div><strong>{plan.filter(item => item.status === "available").length}</strong><span>Available now</span></div><div><strong>{plan.filter(item => item.status === "unavailable").length}</strong><span>Unavailable</span></div><div><strong>{plan.filter(item => item.status === "not_found").length}</strong><span>Not in library</span></div></div>
          <div className="plan-list">{plan.map((item, i) => {
            const status = item.status === "not_found" ? "missing" : item.status;
            const bookId = item.book?.bookId;
            const isRequested = Boolean(bookId && requested.includes(bookId));
            return <div className="plan-row" key={`${item.title}-${i}`}><span className={`plan-status ${status}`}>{item.status === "available" ? "Available" : item.status === "unavailable" ? item.book?.dueBackOn ? `Due ${new Date(item.book.dueBackOn).toLocaleDateString(undefined, { day: "numeric", month: "short" })}` : "Unavailable" : "Not in library"}</span><div><h3>{item.title}</h3><p>{item.book?.author || "No catalog match"}</p>{item.alternatives.length > 0 && <div className="alternatives"><span>Alternatives:</span>{item.alternatives.map((alternative) => <span key={alternative.bookId}>{alternative.title}</span>)}</div>}</div>{item.status === "unavailable" && bookId ? <button className={`btn ${isRequested ? "requested" : "primary"}`} disabled={isRequested} onClick={() => request(bookId)}>{isRequested ? <><Icon name="check" size={15} /> Requested</> : "Request"}</button> : item.status === "available" ? <span /> : null}</div>;
          })}</div>
          {error && <p className="login-error">{error}</p>}
          {plan.some(item => item.status === "unavailable" && item.book && !requested.includes(item.book.bookId)) && <button className="btn primary wide" onClick={requestAll}><Icon name="check" size={17} /> Request all unavailable</button>}
        </div>}
      </section>
    </div>
  );
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [reader, setReader] = useState<Reader | null>(null);
  const [readerRecords, setReaderRecords] = useState<ReaderDto[]>([]);
  const [userName, setUserName] = useState("");
  const [phone, setPhone] = useState("");
  const [page, setPage] = useState<"shelf" | "calendar" | "settings">("shelf");
  const [books, setBooks] = useState<Book[]>([]);
  const [topBooks, setTopBooks] = useState<Book[]>([]);
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [recommendations, setRecommendations] = useState<(Book & { reason: string })[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventDto[]>([]);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readerOpen, setReaderOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(true);
  const [avatarMissing, setAvatarMissing] = useState(false);
  const [avatarCreating, setAvatarCreating] = useState(false);
  const avatarAttemptedFor = useRef(new Set<string>());
  const [toast, setToast] = useState("");
  const [apiError, setApiError] = useState("");
  const filtered = searchResults;
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 3200); return () => clearTimeout(timer); }, [toast]);

  useEffect(() => {
    let active = true;
    api.listReaders().then((records) => {
      if (!active) return;
      setReaderRecords(records);
      const savedId = getReaderId();
      if (savedId) {
        return api.getReader(savedId).then((savedReader) => {
          if (!active) return;
          setReader(readerFromDto(savedReader));
          setUserName(savedReader.name);
          setAuthenticated(true);
          setAvatarMissing(!savedReader.avatar.ready);
        }).catch(() => setReaderId(null));
      }
      return undefined;
    }).catch((cause) => {
      if (active) setApiError(cause instanceof Error ? cause.message : "Could not load the library.");
    });
    return () => { active = false; };
  }, []);

  const activateReader = (record: ReaderDto) => {
    const nextReader = readerFromDto(record);
    setReaderId(record.id);
    setReader(nextReader);
    setUserName(record.name);
    setAvatarMissing(!record.avatar.ready);
    setAuthenticated(true);
    setWelcomeOpen(true);
  };

  async function createReader(name: string, nextPhone: string) {
    const record = await api.createReader(name);
    setPhone(nextPhone);
    setReaderRecords((current) => [...current, record]);
    activateReader(record);
  }

  async function chooseReader(selected: Reader) {
    setReaderId(selected.id);
    const record = await api.getReader(selected.id);
    activateReader(record);
  }

  async function refreshShelf() {
    const shelf = await api.getShelf("ecology");
    setBooks(shelf.books.map(bookFromDto));
    setTopBooks(shelf.topBooks.map(bookFromDto));
  }

  async function refreshReaderData(readerId: string) {
    const [events, result] = await Promise.all([api.calendar(readerId), api.notifications(readerId)]);
    setCalendarEvents(events);
    setNotifications(result.items);
    setUnreadCount(result.unread);
  }

  useEffect(() => {
    if (!authenticated || !reader) return;
    let active = true;
    Promise.all([api.getShelf("ecology"), api.calendar(reader.id), api.notifications(reader.id)])
      .then(([shelf, events, notificationResult]) => {
        if (!active) return;
        setBooks(shelf.books.map(bookFromDto));
        setTopBooks(shelf.topBooks.map(bookFromDto));
        setCalendarEvents(events);
        setNotifications(notificationResult.items);
        setUnreadCount(notificationResult.unread);
      })
      .catch((cause) => {
        if (active) setApiError(cause instanceof Error ? cause.message : "Could not load your library.");
      });
    return () => { active = false; };
  }, [authenticated, reader?.id]);

  async function requestBook(id: string) {
    if (!reader) return;
    try {
      await api.requestBook(id);
      await Promise.all([refreshShelf(), refreshReaderData(reader.id)]);
      setToast("Request placed. We’ll notify you when it’s available.");
    } catch (cause) {
      setToast(cause instanceof Error ? cause.message : "Could not place the request.");
    }
  }

  async function runSearch(searchQuery: string) {
    if (!searchQuery.trim()) return;
    try {
      const result = await api.search(searchQuery, "ecology");
      setSearchResults(result.results.map(bookFromDto));
      setRecommendations(result.recommendations.map((book) => ({ ...bookFromDto(book), reason: book.reason })));
      setSearched(true);
      setApiError("");
    } catch (cause) {
      setToast(cause instanceof Error ? cause.message : "Search failed.");
    }
  }

  function doSearch(e: React.FormEvent) {
    e.preventDefault();
    void runSearch(query);
  }

  async function markNotificationsRead() {
    const ids = notifications.filter((item) => !item.isRead).map((item) => item.id);
    if (!ids.length || !reader) return;
    await api.markNotificationsRead(ids);
    await refreshReaderData(reader.id);
  }

  async function createAvatar() {
    if (!reader || avatarCreating) return;
    setAvatarCreating(true);
    try {
      const avatar = await api.generateAvatar(reader.id);
      setReader({ ...reader, label: avatar.traits.archetype || "New reader", seed: avatar.traits.top_subjects.join("-") || reader.id });
      setAvatarMissing(false);
      setToast("Your reading avatar is ready.");
    } catch (cause) {
      setToast(cause instanceof Error ? cause.message : "Could not create your avatar.");
    } finally {
      setAvatarCreating(false);
    }
  }

  useEffect(() => {
    if (!authenticated || !reader || !avatarMissing || avatarAttemptedFor.current.has(reader.id)) return;
    avatarAttemptedFor.current.add(reader.id);
    void createAvatar();
  }, [authenticated, reader?.id, avatarMissing]);

  if (!authenticated || !reader) {
    return <>
      {apiError && <p className="login-error">{apiError}</p>}
      <LoginPage availableReaders={readerRecords.map(readerFromDto)} onLogin={createReader} onChooseReader={chooseReader} />
    </>;
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand" onClick={() => { setPage("shelf"); setSearched(false); }}><span><Icon name="book" /></span><div>LECTORIA<small>Read · Connect · Belong</small></div></button>
        <nav>
          <button className={page === "shelf" ? "active" : ""} onClick={() => setPage("shelf")}>Top books</button>
          <button onClick={() => { setPage("shelf"); window.setTimeout(() => document.getElementById("community")?.scrollIntoView({ behavior: "smooth" }), 50); }}>Community</button>
          <button className={page === "calendar" ? "active" : ""} onClick={() => setPage("calendar")}>Calendar</button>
        </nav>
        <div className="header-actions">
          <button className="header-icon" aria-label="Calendar" onClick={() => setPage("calendar")}><Icon name="calendar" /></button>
          <div className="popover-wrap">
            <button className="header-icon" aria-label="Notifications" onClick={() => setNotificationsOpen(v => !v)}><Icon name="bell" />{unreadCount > 0 && <b>{unreadCount}</b>}</button>
            {notificationsOpen && <div className="popover notifications"><div><h3>Notifications</h3><button onClick={() => void markNotificationsRead()}>Mark all read</button></div>
              {notifications.length ? notifications.map((item) => <button key={item.id} onClick={() => { setNotificationsOpen(false); setPage("shelf"); }}><span className="notif-icon"><Icon name="book" /></span><p><strong>{item.message}</strong><small>{new Date(item.createdAt).toLocaleString()}</small></p>{!item.isRead && <i />}</button>) : <p className="muted" style={{ padding: "12px 18px" }}>No notifications.</p>}
            </div>}
          </div>
          <div className="reader-wrap">
            <button className="reader-button" onClick={() => setReaderOpen(v => !v)}><Avatar reader={reader} compact /><span><small>Welcome,</small><strong>{reader.name}</strong></span><Icon name="chevron" size={16} /></button>
            {readerOpen && <div className="popover profile-menu"><div className="profile-summary"><Avatar reader={reader} compact /><span><strong>{reader.name}</strong><small>{reader.label}</small></span></div><button onClick={() => { setPage("shelf"); setReaderOpen(false); }}><Icon name="home" size={18} /><span><strong>Home page</strong><small>Return to your library</small></span></button><button onClick={() => { setPage("settings"); setReaderOpen(false); }}><Icon name="settings" size={18} /><span><strong>Settings</strong><small>Profile and notifications</small></span></button><button className="profile-logout" onClick={() => { setReaderId(null); setReader(null); setAuthenticated(false); setReaderOpen(false); setWelcomeOpen(true); }}><Icon name="logout" size={18} /><span><strong>Log out</strong></span></button></div>}
          </div>
        </div>
      </header>

      {apiError && <div className="content"><p className="login-error">{apiError}</p></div>}
      {page === "calendar" ? <CalendarPage events={calendarEvents} /> : page === "settings" ? <SettingsPage reader={reader} name={userName} phone={phone} onSave={(name, nextPhone) => { setUserName(name); setPhone(nextPhone); setToast("Settings updated for this session."); }} /> : (
        <main>
          <section className="hero">
            <div className="hero-shape one" /><div className="hero-shape two" />
            <div className="hero-content">
              <div className="hero-copy"><p className="eyebrow light">Shelf · Ecology</p><h1>Explore the living world.</h1><p>Discover what readers are reaching for, check what’s available, and find your next essential read.</p>
                <div className="profile-note"><Avatar reader={reader} /><div><strong>Welcome back, {reader.name}</strong><span>{reader.label}</span></div></div>
              </div>
              <div className="search-panel">
                <p>What are you looking for?</p>
                <form onSubmit={doSearch}><Icon name="search" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by title, author, or subject" /><button className="btn primary">Search</button><span>or</span><button type="button" className="camera-btn" onClick={() => setUploadOpen(true)}><Icon name="camera" /><b>Search by photo or list</b></button></form>
                <div className="search-hints"><span>Try:</span>{["climate", "Rachel Carson", "forests"].map(x => <button key={x} onClick={() => { setQuery(x); void runSearch(x); }}>{x}</button>)}</div>
              </div>
            </div>
          </section>

          <div className="content">
            {searched ? <section className="search-results">
              <div className="section-heading"><div><p className="eyebrow">Search results</p><h2>{filtered.length ? `${filtered.length} matches for “${query}”` : `Nothing on this shelf for “${query}”`}</h2></div><button className="btn text-btn" onClick={() => { setSearched(false); setQuery(""); }}>Clear search</button></div>
              {filtered.length ? <div className="book-grid">{filtered.map(book => <BookCard key={book.bookId} book={book} onRequest={requestBook} />)}</div> : <div className="not-found"><span><Icon name="search" /></span><h3>No matching books</h3><p>{recommendations.length ? "Here are Gemini’s catalog-validated alternatives." : "No matching books were found."}</p></div>}
              {recommendations.length > 0 && <div className="recommend-block"><div className="section-heading"><div><p className="eyebrow gemma"><Icon name="sparkles" size={15} /> Gemini recommends</p><h2>Explore something related</h2></div></div><div className="suggestion-grid">{recommendations.map((book) => <div className="suggestion" key={book.bookId}><BookCover book={book} small /><div><h3>{book.title}</h3><p>{book.author}</p><span>{book.reason}</span></div></div>)}</div></div>}
            </section> : <>
              <section className="section-block">
                <div className="section-heading"><div><p className="eyebrow">Reader favourites</p><h2>Top books on this shelf</h2><p>Most borrowed in the last 30 days</p></div><button className="view-all">View all <Icon name="arrow" size={16} /></button></div>
                <div className="book-grid top-books">{topBooks.slice(0, 5).map((book, i) => <BookCard key={book.bookId} book={book} rank={i + 1} onRequest={requestBook} />)}</div>
              </section>
              <section className="section-block community-section" id="community">
                <div className="section-heading"><div><p className="eyebrow">Read together</p><h2>Community</h2><p>Discuss books, exchange ideas, and see what other readers are saying.</p></div><button className="btn primary"><Icon name="plus" size={16} /> Start a discussion</button></div>
                <div className="community-grid">
                  <article className="discussion featured-discussion"><div className="discussion-cover">{topBooks[0] && <BookCover book={topBooks[0]} />}</div><div><span className="topic-label">Featured discussion</span><h3>Can one book really change environmental policy?</h3><p>Readers are revisiting books on this shelf and discussing evidence, storytelling, and public action.</p><div className="discussion-meta"><span className="avatar-stack">{readerRecords.map(record => <Avatar key={record.id} reader={readerFromDto(record)} compact />)}</span><span><strong>{readerRecords.length} readers</strong></span><button>Join discussion <Icon name="arrow" size={15} /></button></div></div></article>
                  <article className="discussion"><div className="discussion-top"><span className="community-icon"><Icon name="sparkles" /></span><span className="topic-label">Question of the week</span></div><h3>Which book made you see nature differently?</h3><p>Share one passage or idea that stayed with you long after you closed the cover.</p><div className="discussion-meta"><span><strong>16 readers</strong> · 21 replies</span><button>Read replies <Icon name="chevron" size={15} /></button></div></article>
                  <article className="discussion"><div className="discussion-top"><span className="community-icon"><Icon name="book" /></span><span className="topic-label">Reading circle</span></div><h3>Braiding Sweetgrass: chapters 1–5</h3><p>The campus reading circle meets Thursday. Add your notes before the conversation.</p><div className="discussion-meta"><span><strong>8 attending</strong> · Thursday, 6 PM</span><button>View circle <Icon name="chevron" size={15} /></button></div></article>
                </div>
              </section>
            </>}
          </div>
        </main>
      )}
      {uploadOpen && <UploadModal onClose={() => setUploadOpen(false)} onToast={setToast} />}
      {welcomeOpen && <WelcomeModal reader={reader} missing={avatarMissing} creating={avatarCreating} onClose={() => setWelcomeOpen(false)} onCreate={() => void createAvatar()} />}
      {toast && <div className="toast"><span><Icon name="check" /></span><p>{toast}</p><button onClick={() => setToast("")}><Icon name="x" size={17} /></button></div>}
    </div>
  );
}
