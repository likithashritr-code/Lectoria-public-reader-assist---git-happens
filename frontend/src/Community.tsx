import { useMemo, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router";

export type CommunityReader = { id: string; name: string; label: string; seed: string };

type Community = {
  id: string;
  name: string;
  initials: string;
  members: string;
  description: string;
  joined: boolean;
};

type Post = {
  id: string;
  communityId: string;
  community: string;
  author: string;
  time: string;
  kind: string;
  title: string;
  book: string;
  excerpt: string;
  description: string;
  likes: number;
  replies: number;
};

const communities: Community[] = [
  { id: "environment", name: "The Living Shelf", initials: "LS", members: "2.4k", description: "Nature writing, climate, and the living world.", joined: true },
  { id: "campus", name: "Campus Book Club", initials: "CB", members: "846", description: "Our student-led monthly reading circle.", joined: true },
  { id: "classics", name: "Classics After Class", initials: "CA", members: "1.1k", description: "Old books, new perspectives, no gatekeeping.", joined: true },
  { id: "poetry", name: "Poetry in the Margins", initials: "PM", members: "692", description: "A quiet corner for poems and close reading.", joined: false },
  { id: "speculative", name: "Speculative Futures", initials: "SF", members: "3.2k", description: "Science fiction, fantasy, and imagined worlds.", joined: false },
];

const posts: Post[] = [
  {
    id: "silent-spring-policy",
    communityId: "environment",
    community: "The Living Shelf",
    author: "Amina Yusuf",
    time: "32 min",
    kind: "FEATURED DISCUSSION",
    title: "Can one book really change environmental policy?",
    book: "Silent Spring",
    excerpt: "I’ve been rereading the chapter on pesticides and keep returning to how Carson makes systems visible. Does a book create change itself, or give people the language to demand it?",
    description: "Readers are revisiting Silent Spring and discussing the line between evidence, storytelling, and public action.",
    likes: 64,
    replies: 38,
  },
  {
    id: "braiding-sweetgrass-circle",
    communityId: "campus",
    community: "Campus Book Club",
    author: "Theo Martin",
    time: "2 hr",
    kind: "READING CIRCLE",
    title: "Braiding Sweetgrass: chapters 1–5",
    book: "Braiding Sweetgrass",
    excerpt: "Bring one line from chapters 1–5 that shifted how you think about reciprocity. We’ll begin there before opening the conversation.",
    description: "The campus reading circle meets Thursday. Add your notes before the conversation.",
    likes: 31,
    replies: 17,
  },
  {
    id: "nature-differently",
    communityId: "classics",
    community: "Classics After Class",
    author: "Nora Bell",
    time: "Yesterday",
    kind: "QUESTION OF THE WEEK",
    title: "Which book made you see nature differently?",
    book: "Open question",
    excerpt: "Mine was a slim copy of Walden borrowed on a rainy weekend. It taught me to notice what a narrator leaves out.",
    description: "Share one passage or idea that stayed with you long after you closed the cover.",
    likes: 48,
    replies: 21,
  },
];

function CommunityAvatar({ reader, compact = false }: { reader: CommunityReader; compact?: boolean }) {
  return (
    <span className={`community-avatar ${compact ? "compact" : ""}`}>
      <img src={`https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(reader.seed)}`} alt={`${reader.name}'s avatar`} />
    </span>
  );
}

function BookTile({ title, small = false }: { title: string; small?: boolean }) {
  return <span className={`community-book ${small ? "small" : ""}`} aria-label={title}>{title.toUpperCase()}</span>;
}

function CommunityMark({ children }: { children: string }) {
  return <span className="community-mark" aria-hidden="true">{children}</span>;
}

export function CommunityPage({ reader, readers }: { reader: CommunityReader; readers: CommunityReader[] }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedCommunity, setSelectedCommunity] = useState("all");
  const [joined, setJoined] = useState(() => communities.filter((community) => community.joined).map((community) => community.id));
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: "", book: "", message: "" });
  const [notice, setNotice] = useState("");
  const allPosts = useMemo(() => [...userPosts, ...posts], [userPosts]);
  const visiblePosts = allPosts.filter((post) =>
    (selectedCommunity === "all" || post.communityId === selectedCommunity) &&
    `${post.title} ${post.book} ${post.description} ${post.community} ${post.excerpt}`.toLowerCase().includes(search.toLowerCase()),
  );

  function publishDiscussion(event: FormEvent) {
    event.preventDefault();
    if (!form.title.trim() || !form.book.trim() || !form.message.trim()) return;
    const selected = communities.find((community) => community.id === selectedCommunity) ?? communities[0];
    setUserPosts((current) => [{
      id: `reader-${Date.now()}`,
      communityId: selected.id,
      community: selected.name,
      author: reader.name,
      time: "Just now",
      kind: "READER DISCUSSION",
      title: form.title.trim(),
      book: form.book.trim(),
      excerpt: form.message.trim(),
      description: form.message.trim(),
      likes: 0,
      replies: 0,
    }, ...current]);
    setCreateOpen(false);
    setForm({ title: "", book: "", message: "" });
    setNotice("Discussion added to this session’s feed.");
  }

  return (
    <main className="community-page">
      <header className="community-page-head">
        <div><p className="eyebrow">Your reading network</p><h1>Community</h1><p>Follow thoughtful conversations from every reading community you’ve joined.</p></div>
        <button className="btn primary community-create" onClick={() => setCreateOpen(true)}><CommunityMark>+</CommunityMark> Start a discussion</button>
      </header>
      {notice && <div className="community-success"><CommunityMark>✓</CommunityMark><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}
      <div className="community-app-layout">
        <aside className="community-sidebar">
          <button className={`community-home-link ${selectedCommunity === "all" ? "active" : ""}`} onClick={() => setSelectedCommunity("all")}><CommunityMark>⌂</CommunityMark><div><strong>Home feed</strong><small>From all your communities</small></div></button>
          <div className="sidebar-heading"><span>Your communities</span><b>{joined.length}</b></div>
          <div className="joined-list">
            {communities.filter((community) => joined.includes(community.id)).map((community) => <button className={selectedCommunity === community.id ? "active" : ""} key={community.id} onClick={() => setSelectedCommunity(community.id)}><span className="community-monogram">{community.initials}</span><div><strong>{community.name}</strong><small>{community.members} readers</small></div>{selectedCommunity === community.id && <i />}</button>)}
          </div>
          <button className="browse-link" onClick={() => document.getElementById("discover-communities")?.scrollIntoView({ behavior: "smooth" })}><CommunityMark>◎</CommunityMark> Browse communities</button>
        </aside>

        <section className="community-feed">
          <div className="feed-toolbar"><div><CommunityMark>⌕</CommunityMark><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your community feed" /></div><span>Latest</span></div>
          <div className="feed-intro"><CommunityMark>✦</CommunityMark><p><strong>{selectedCommunity === "all" ? "Your reading feed" : communities.find((community) => community.id === selectedCommunity)?.name}</strong><small>Fresh ideas from the communities you follow.</small></p></div>
          <div className="feed-list">
            {visiblePosts.map((post) => <article className="feed-post" key={post.id}>
              <header><span className="community-monogram small">{communities.find((community) => community.id === post.communityId)?.initials}</span><div><strong>{post.community}</strong><span>{post.author} · {post.time}</span></div><button aria-label={`More options for ${post.title}`}>•••</button></header>
              <div className="post-body"><span className="community-badge">{post.kind}</span><h2>{post.title}</h2><p>{post.excerpt}</p></div>
              <div className="post-book"><BookTile title={post.book} small /><div><span>Featured book</span><strong>{post.book}</strong><small>Reading community</small></div><button onClick={() => navigate(`/community/${post.id}`, { state: post })}>Open discussion <CommunityMark>→</CommunityMark></button></div>
              <footer><span><CommunityMark>♡</CommunityMark> {post.likes}</span><button onClick={() => navigate(`/community/${post.id}`, { state: post })}><CommunityMark>◌</CommunityMark> {post.replies} replies</button><button className="post-open" onClick={() => navigate(`/community/${post.id}`, { state: post })}>Read conversation <CommunityMark>›</CommunityMark></button></footer>
            </article>)}
            {visiblePosts.length === 0 && <div className="community-empty"><CommunityMark>⌕</CommunityMark><h2>No conversations found</h2><p>Try another search or choose a different community.</p></div>}
          </div>
        </section>

        <aside className="community-discovery" id="discover-communities">
          <div className="discovery-card"><p className="eyebrow">Discover</p><h2>Find your next circle</h2><p>Join a community to add its conversations to your home feed.</p>
            <div className="discover-list">{communities.filter((community) => !joined.includes(community.id)).map((community) => <div key={community.id}><span className="community-monogram">{community.initials}</span><div><strong>{community.name}</strong><small>{community.description}</small><span><CommunityMark>◌</CommunityMark> {community.members} readers</span></div><button onClick={() => setJoined((current) => [...current, community.id])}>Join</button></div>)}</div>
            {communities.every((community) => joined.includes(community.id)) && <div className="all-joined"><CommunityMark>✓</CommunityMark> You’ve joined every community.</div>}
          </div>
          <div className="community-profile-card"><CommunityAvatar reader={reader} compact /><div><strong>{reader.name}’s communities</strong><span>{joined.length} joined · {allPosts.length} conversations</span></div><button onClick={() => setSelectedCommunity("all")}>View all</button></div>
          <div className="community-reader-stack" aria-label="Readers in the community">{readers.slice(0, 4).map((item) => <CommunityAvatar reader={item} compact key={item.id} />)}</div>
        </aside>
      </div>

      {createOpen && <div className="modal-wrap" role="dialog" aria-modal="true" aria-labelledby="create-community-title"><div className="modal-backdrop" onClick={() => setCreateOpen(false)} /><form className="discussion-modal" onSubmit={publishDiscussion}><div className="modal-head"><div><p className="eyebrow">New conversation</p><h2 id="create-community-title">Start a discussion</h2></div><button type="button" className="round-btn" onClick={() => setCreateOpen(false)} aria-label="Close"><CommunityMark>×</CommunityMark></button></div><div className="discussion-form"><label>Discussion title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="What would you like to explore?" required /></label><label>Book<input value={form.book} onChange={(event) => setForm({ ...form, book: event.target.value })} placeholder="Book title or author" required /></label><label>Opening message<textarea value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder="Give readers a thoughtful place to begin..." required /></label><div><button type="button" className="btn secondary" onClick={() => setCreateOpen(false)}>Cancel</button><button className="btn primary" type="submit">Publish discussion <CommunityMark>→</CommunityMark></button></div></div></form></div>}
    </main>
  );
}

export function CommunityDetail({ id, reader, readers }: { id: string; reader: CommunityReader; readers: CommunityReader[] }) {
  const navigate = useNavigate();
  const location = useLocation();
  const routedPost = location.state as Post | null;
  const post = (routedPost?.id === id ? routedPost : posts.find((item) => item.id === id)) ?? posts[0];
  const [reply, setReply] = useState("");
  const [replies, setReplies] = useState([
    { name: readers[2]?.name ?? "Reader", text: "The science and the storytelling strengthen each other.", reader: readers[2] ?? reader },
    { name: readers[1]?.name ?? "Reader", text: "It gave people a shared language to talk about public action.", reader: readers[1] ?? reader },
  ]);

  function submitReply(event: FormEvent) {
    event.preventDefault();
    if (!reply.trim()) return;
    setReplies((current) => [...current, { name: reader.name, text: reply.trim(), reader }]);
    setReply("");
  }

  return (
    <main className="community-page detail-page">
      <button className="community-back" onClick={() => navigate("/community")}><CommunityMark>←</CommunityMark> Back to community</button>
      <section className="detail-hero"><div><span className="community-badge">{post.kind}</span><h1>{post.title}</h1><p>{post.description}</p><div className="detail-meta"><span className="avatar-stack">{readers.slice(0, 3).map((item) => <CommunityAvatar key={item.id} reader={item} compact />)}</span><strong>{post.community} · {post.replies + replies.length} replies</strong></div></div><BookTile title={post.book} /></section>
      <section className="conversation"><div className="conversation-heading"><div><p className="eyebrow">The conversation</p><h2>Reader replies</h2></div><span>{replies.length} replies</span></div>
        <div className="reply-list">{replies.map((item, index) => <article className="reply" key={`${item.name}-${index}`}><CommunityAvatar reader={item.reader} compact /><div><div><strong>{item.name}</strong><span>{index === replies.length - 1 ? "Just now" : "Earlier"}</span></div><p>{item.text}</p></div></article>)}</div>
        <form className="reply-box" onSubmit={submitReply}><CommunityAvatar reader={reader} compact /><textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Add your perspective to the conversation..." /><button className="btn primary" type="submit" disabled={!reply.trim()}>Post reply <CommunityMark>→</CommunityMark></button></form>
      </section>
    </main>
  );
}