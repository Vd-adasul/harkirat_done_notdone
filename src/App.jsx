import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend,
  Line, LineChart, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import CalendarHeatmap from "react-calendar-heatmap";
import "react-calendar-heatmap/dist/styles.css";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";

// ─── Storage helpers (localStorage + optional Firebase) ──────────────────────

const STORAGE_PREFIX = "course:";
const STORAGE_INDEX_KEY = "course:index";
const COURSE_COLORS = [
  { name: "Cyan",   value: "#22d3ee" },
  { name: "Indigo", value: "#818cf8" },
  { name: "Pink",   value: "#f472b6" },
  { name: "Emerald",value: "#34d399" },
  { name: "Amber",  value: "#fbbf24" },
];

// ─── Harkirat 100xDevs cohort seed data ──────────────────────────────────────

const seedCourses = [
  makeCourse("Foundation & JS Basics", "Variables, scope, types, functions — the real fundamentals.", "#22d3ee", [
    "Orientation & Setup",
    "JavaScript Foundations",
    "Variables, Types & Operators",
    "Functions & Scope",
    "Week 1 Assignment",
  ]),
  makeCourse("Advanced JS Concepts", "Async patterns, closures, the event loop — where JS gets interesting.", "#818cf8", [
    "Arrays & Objects Deep Dive",
    "Closures & Prototypes",
    "Async JS: Callbacks",
    "Promises & Async/Await",
    "Event Loop & Concurrency",
    "Week 2 Assignment",
  ]),
  makeCourse("Node.js & Express", "Build HTTP servers from scratch then layer Express on top.", "#34d399", [
    "Node.js Internals",
    "File System & Streams",
    "HTTP Servers from Scratch",
    "Express.js Basics",
    "Middleware & Routing",
    "Week 3 Assignment",
  ]),
  makeCourse("Databases: SQL & NoSQL", "MongoDB, Mongoose, PostgreSQL, Prisma — pick your weapon.", "#fbbf24", [
    "MongoDB Basics",
    "Mongoose ORM",
    "PostgreSQL & SQL Fundamentals",
    "Prisma ORM",
    "Week 4 Assignment",
  ]),
  makeCourse("Auth & Security", "JWT, hashing, OAuth, Zod validation — secure everything.", "#f472b6", [
    "JWT & Sessions",
    "Hashing & Encryption",
    "OAuth & Third-party Auth",
    "Input Validation & Zod",
    "Week 5 Assignment",
  ]),
  makeCourse("React Foundations", "JSX, components, props, state — the mental model that changes everything.", "#22d3ee", [
    "React Mental Model & JSX",
    "Components & Props",
    "State & useState",
    "useEffect & Lifecycle",
    "Conditional Rendering & Lists",
    "Week 6 Assignment",
  ]),
  makeCourse("React Advanced", "Custom hooks, Context, Recoil, Router, Forms.", "#818cf8", [
    "Custom Hooks",
    "Context API",
    "Recoil State Management",
    "React Router",
    "Forms & Controlled Components",
    "Week 7 Assignment",
  ]),
  makeCourse("TypeScript", "Types, interfaces, generics — never ship a runtime TypeError again.", "#34d399", [
    "TypeScript Basics & Types",
    "Interfaces & Generics",
    "TypeScript with React",
    "TypeScript with Express",
    "Week 8 Assignment",
  ]),
  makeCourse("Full Stack Projects", "Wire up a real Paytm-like app end to end.", "#fbbf24", [
    "Architecture Overview",
    "Frontend Integration",
    "Backend API Design",
    "Error Handling & Edge Cases",
    "Week 9 Assignment",
  ]),
  makeCourse("DevOps & Deployment", "Docker, CI/CD, AWS, Nginx — ship it properly.", "#f472b6", [
    "Docker Fundamentals",
    "Docker Compose",
    "CI/CD with GitHub Actions",
    "AWS Basics & EC2",
    "Nginx & Reverse Proxy",
    "Week 10 Assignment",
  ]),
  makeCourse("WebSockets & Real-time", "Socket.io, pub/sub, live chat — make it instant.", "#22d3ee", [
    "WebSocket Protocol",
    "Socket.io",
    "Real-time Chat App",
    "Pub/Sub Pattern",
    "Week 11 Assignment",
  ]),
  makeCourse("Advanced Backend", "Queues, Redis caching, rate limiting, microservices.", "#818cf8", [
    "Queues & Message Brokers",
    "Redis Caching",
    "Rate Limiting & Throttling",
    "Microservices Architecture",
    "Week 12 Assignment",
  ]),
];

function makeCourse(name, description, color, lectures) {
  return {
    id: createId(),
    name,
    description,
    color,
    createdAt: Date.now(),
    videos: lectures.map((title, i) => makeVideo(String(i + 1), title)),
  };
}

// ─── Utility functions ───────────────────────────────────────────────────────

function createId() {
  return Math.random().toString(36).slice(2, 10);
}

function makeVideo(lectureNumber, title, done = false, completedAt = null) {
  return { id: createId(), lectureNumber: String(lectureNumber), title, done, completedAt };
}

function calculateProgress(course) {
  const total = course.videos.length;
  const done = course.videos.filter((v) => v.done).length;
  return { total, done, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

function buildTimeline(courses) {
  const completions = courses
    .flatMap((c) => c.videos.filter((v) => v.done && v.completedAt).map((v) => ({
      time: v.completedAt, course: c.name, title: v.title,
    })))
    .sort((a, b) => a.time - b.time);
  let cum = 0;
  return completions.map((e) => ({
    date: new Date(e.time).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    completed: ++cum,
    label: `${e.course}: ${e.title}`,
  }));
}

function buildHeatmap(courses) {
  const map = {};
  courses.forEach((c) => {
    c.videos.forEach((v) => {
      if (v.done && v.completedAt) {
        const d = new Date(v.completedAt).toISOString().slice(0, 10);
        map[d] = (map[d] || 0) + 1;
      }
    });
  });
  return Object.entries(map).map(([date, count]) => ({ date, count }));
}

function calcStreak(courses) {
  const days = new Set();
  courses.forEach((c) => {
    c.videos.forEach((v) => {
      if (v.done && v.completedAt) days.add(new Date(v.completedAt).toISOString().slice(0, 10));
    });
  });
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (days.has(d.toISOString().slice(0, 10))) streak++;
    else break;
  }
  return streak;
}

// ─── Persistence ─────────────────────────────────────────────────────────────

async function storageGet(key) {
  if (typeof window === "undefined") return null;
  const ext = window.storage;
  if (ext) {
    if (typeof ext.getItem === "function") return ext.getItem(key);
    if (typeof ext.get === "function") return ext.get(key);
  }
  return window.localStorage.getItem(key);
}

async function storageSet(key, value) {
  const ext = window.storage;
  if (ext) {
    if (typeof ext.setItem === "function") return ext.setItem(key, value);
    if (typeof ext.set === "function") return ext.set(key, value);
  }
  window.localStorage.setItem(key, value);
}

async function storageRemove(key) {
  const ext = window.storage;
  if (ext) {
    if (typeof ext.removeItem === "function") return ext.removeItem(key);
    if (typeof ext.delete === "function") return ext.delete(key);
  }
  window.localStorage.removeItem(key);
}

async function loadCourses() {
  // Try Firebase first
  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDoc(doc(db, "tracker", "courses"));
      if (snap.exists()) {
        const { courses } = snap.data();
        if (Array.isArray(courses) && courses.length > 0) return courses;
      }
    } catch { /* fall through to localStorage */ }
  }

  const rawIndex = await storageGet(STORAGE_INDEX_KEY);
  if (!rawIndex) {
    await saveCourses(seedCourses);
    return seedCourses;
  }
  try {
    const ids = JSON.parse(rawIndex);
    const items = await Promise.all(ids.map(async (id) => {
      const raw = await storageGet(`${STORAGE_PREFIX}${id}`);
      return raw ? JSON.parse(raw) : null;
    }));
    const courses = items.filter(Boolean);
    if (courses.length > 0) return courses;
  } catch { /* ignore */ }
  await saveCourses(seedCourses);
  return seedCourses;
}

async function saveCourses(courses) {
  await storageSet(STORAGE_INDEX_KEY, JSON.stringify(courses.map((c) => c.id)));
  await Promise.all(courses.map((c) => storageSet(`${STORAGE_PREFIX}${c.id}`, JSON.stringify(c))));
  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, "tracker", "courses"), { courses }, { merge: true });
    } catch { /* offline, that's ok */ }
  }
}

// ─── Parsers (unchanged from original) ───────────────────────────────────────

function parseVideoText(videoText) {
  const trimmed = videoText.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed);
    const list = Array.isArray(parsed) ? parsed : parsed.videos;
    if (!Array.isArray(list)) throw new Error("JSON must be an array or an object with a videos array.");
    return list.map((entry, index) => {
      if (Array.isArray(entry) && entry.length >= 2) return makeVideo(entry[0], entry[1]);
      if (entry && typeof entry === "object") {
        const n = entry.lecture_number ?? entry.lectureNumber ?? entry.number ?? entry.id ?? index + 1;
        const t = entry.lecture_name ?? entry.lectureName ?? entry.title ?? entry.name;
        if (!t) throw new Error("Each JSON item needs a lecture name/title.");
        return makeVideo(n, t);
      }
      throw new Error("Unsupported JSON lecture format.");
    });
  }
  return trimmed.split("\n").map((l) => l.trim()).filter(Boolean).map((line, i) => {
    const m = line.match(/^(\d+)[\].:-\s]+(.+)$/);
    return m ? makeVideo(m[1], m[2]) : makeVideo(i + 1, line);
  });
}

function parseCourseJsonImport(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const parsed = JSON.parse(trimmed);
  const courseList = Array.isArray(parsed) ? parsed : parsed.courses;
  if (!Array.isArray(courseList)) throw new Error('Expected JSON like {"courses":[...]} or a direct array.');
  return courseList.map((course, index) => {
    const name = course.course_name ?? course.courseName ?? course.name;
    const lectures = course.lectures ?? course.videos ?? [];
    if (!name) throw new Error("Each imported course needs course_name.");
    if (!Array.isArray(lectures)) throw new Error(`Course "${name}" must include a lectures array.`);
    return {
      id: createId(),
      name,
      description: course.description?.trim?.() ?? "",
      color: course.color ?? COURSE_COLORS[index % COURSE_COLORS.length].value,
      createdAt: Date.now() + index,
      videos: lectures.map((l, li) => makeVideo(
        l.lecture_number ?? l.lectureNumber ?? li + 1,
        l.lecture_name ?? l.lectureName ?? l.title ?? `Lecture ${li + 1}`,
      )),
    };
  });
}

// ─── Shared UI atoms ─────────────────────────────────────────────────────────

function ProgressRing({ percent, size = 92, color = "#22d3ee", glow = false }) {
  return (
    <div
      className={`progress-ring ${glow ? "progress-ring--glow" : ""}`}
      style={{ width: size, height: size, "--ring-fill": `${percent}%`, "--ring-color": color }}
    >
      <div className="progress-ring__inner">
        <span>{percent}%</span>
      </div>
    </div>
  );
}

function ConfettiBurst({ color }) {
  return (
    <div className="confetti-burst" aria-hidden="true">
      {Array.from({ length: 24 }, (_, i) => (
        <span
          key={i}
          className="confetti-burst__piece"
          style={{
            "--confetti-rotate": `${i * 15}deg`,
            "--confetti-delay": `${i * 0.03}s`,
            "--confetti-x": `${(i - 12) * 18}px`,
            "--confetti-color": COURSE_COLORS[i % COURSE_COLORS.length].value ?? color,
          }}
        />
      ))}
    </div>
  );
}

// ─── Add Course Modal ─────────────────────────────────────────────────────────

function AddCourseModal({ onClose, onSubmit, onBulkImport }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COURSE_COLORS[0].value);
  const [mode, setMode] = useState("manual");
  const [videoInput, setVideoInput] = useState(
    '[\n  {"lecture_number": 1, "lecture_name": "Welcome"},\n  {"lecture_number": 2, "lecture_name": "Setup"}\n]',
  );
  const [bulkJsonInput, setBulkJsonInput] = useState(
    '{\n  "courses": [\n    {\n      "course_name": "DSA",\n      "lectures": [\n        { "lecture_number": 1, "lecture_name": "Basics" }\n      ]\n    }\n  ]\n}',
  );
  const [error, setError] = useState("");

  const handleManualSubmit = (e) => {
    e.preventDefault();
    setError("");
    try {
      const videos = parseVideoText(videoInput);
      if (!name.trim()) throw new Error("Course name is required.");
      onSubmit({ id: createId(), name: name.trim(), description: description.trim(), color, videos, createdAt: Date.now() });
    } catch (err) { setError(err.message); }
  };

  const handleBulkImport = () => {
    setError("");
    try {
      const imported = parseCourseJsonImport(bulkJsonInput);
      if (imported.length === 0) throw new Error("Add at least one course to import.");
      onBulkImport(imported);
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="modal-shell" role="dialog" aria-modal="true">
      <button className="modal-shell__backdrop" onClick={onClose} />
      <motion.div
        className="modal-card"
        initial={{ opacity: 0, y: 48 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 48 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
      >
        <div className="modal-card__header">
          <div>
            <p className="eyebrow">New course</p>
            <h2>Build a course card.</h2>
          </div>
          <button className="ghost-button" onClick={onClose}>Close</button>
        </div>

        <div className="mode-toggle">
          <button className={mode === "manual" ? "tab-button is-active" : "tab-button"} onClick={() => setMode("manual")} type="button">Manual</button>
          <button className={mode === "bulk" ? "tab-button is-active" : "tab-button"} onClick={() => setMode("bulk")} type="button">Multi-course JSON</button>
        </div>

        <form className="modal-form" onSubmit={handleManualSubmit}>
          {mode === "manual" && (
            <>
              <label><span>Course name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Deep Work for Developers" /></label>
              <label><span>Description</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional note." rows={3} /></label>
              <div className="color-picker">
                <span>Accent color</span>
                <div className="color-picker__swatches">
                  {COURSE_COLORS.map((opt) => (
                    <button key={opt.value} type="button" className={color === opt.value ? "is-active" : ""} style={{ "--swatch-color": opt.value }} onClick={() => setColor(opt.value)} aria-label={opt.name} />
                  ))}
                </div>
              </div>
              <label>
                <span>Videos or JSON import</span>
                <textarea value={videoInput} onChange={(e) => setVideoInput(e.target.value)} rows={8} placeholder={'Paste newline titles or JSON like [{"lecture_number":1,"lecture_name":"Intro"}]'} />
              </label>
              <p className="helper-text">Accepts newline-separated titles, tuples <code>[[1,"Intro"]]</code>, or objects <code>{"{"}"lecture_number":1{"}"}.</code></p>
              {error && <p className="error-text">{error}</p>}
              <button type="submit" className="primary-button">Create course</button>
            </>
          )}
          {mode === "bulk" && (
            <>
              <label>
                <span>Multi-course JSON</span>
                <textarea value={bulkJsonInput} onChange={(e) => setBulkJsonInput(e.target.value)} rows={16} />
              </label>
              <p className="helper-text">Shape: <code>{'{"courses":[{"course_name":"DSA","lectures":[...]}]}'}</code></p>
              {error && <p className="error-text">{error}</p>}
              <button type="button" className="primary-button" onClick={handleBulkImport}>Import courses JSON</button>
            </>
          )}
        </form>
      </motion.div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ courses, onOpenCourse, onOpenStats, onAddCourse }) {
  const total = courses.reduce((a, c) => a + c.videos.length, 0);
  const done = courses.reduce((a, c) => a + c.videos.filter((v) => v.done).length, 0);
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <section className="page page--dashboard">
      <header className="topbar">
        <div>
          <p className="eyebrow">100xDevs · Harkirat Singh Cohort</p>
          <h1>Finish what you start.</h1>
        </div>
        <div className="topbar__actions">
          <button className="tab-button" onClick={onOpenStats}>Stats</button>
          <button className="primary-button" onClick={onAddCourse}>+ Add Course</button>
        </div>
      </header>

      {/* Global progress bar */}
      <div className="global-progress">
        <div className="global-progress__labels">
          <span>{done} of {total} lectures done</span>
          <span className="global-progress__pct">{pct}%</span>
        </div>
        <div className="global-progress__track">
          <motion.div
            className="global-progress__fill"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
      </div>

      <div className="course-grid">
        {courses.map((course, index) => {
          const progress = calculateProgress(course);
          return (
            <motion.button
              key={course.id}
              className="course-card"
              onClick={() => onOpenCourse(course.id)}
              style={{ "--card-accent": course.color }}
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06, duration: 0.4, ease: "easeOut" }}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
            >
              <div className="course-card__content">
                <div>
                  <p className="course-card__name">{course.name}</p>
                  <p className="course-card__description">{course.description || "Open the course to start tracking."}</p>
                </div>
                <ProgressRing percent={progress.percent} color={course.color} glow />
                <div className="course-card__footer">
                  <span className="mono-label">{progress.done} / {progress.total} done</span>
                  {progress.percent === 100 && <span className="done-badge">✓ Done!</span>}
                </div>
              </div>
              <div className="course-card__bar">
                <motion.span
                  style={{ width: `${progress.percent}%` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.percent}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}

// ─── Course Detail ────────────────────────────────────────────────────────────

function CourseDetail({ course, onBack, onToggleVideo, onAddVideo, onDeleteVideo, onDeleteCourse, celebrate }) {
  const [videoInput, setVideoInput] = useState("");
  const [error, setError] = useState("");
  const progress = calculateProgress(course);

  const handleAdd = () => {
    try {
      const videos = parseVideoText(videoInput);
      if (videos.length === 0) return;
      onAddVideo(course.id, videos);
      setVideoInput("");
      setError("");
    } catch (err) { setError(err.message); }
  };

  return (
    <section className="page page--detail">
      {celebrate && <ConfettiBurst color={course.color} />}

      <header className="detail-header">
        <button className="ghost-button" onClick={onBack}>← Back</button>
        <div className="detail-header__summary">
          <div>
            <p className="eyebrow">Course detail</p>
            <h2>{course.name}</h2>
            <p>{course.description || "Keep stacking completed lectures to build momentum."}</p>
          </div>
          <ProgressRing percent={progress.percent} size={130} color={course.color} glow />
        </div>
      </header>

      <div className="video-list">
        <AnimatePresence>
          {course.videos.map((video, i) => (
            <motion.div
              key={video.id}
              className={`video-row ${video.done ? "is-done" : ""}`}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03, duration: 0.3 }}
              layout
            >
              <label className="video-row__main">
                <input type="checkbox" checked={video.done} onChange={() => onToggleVideo(course.id, video.id)} />
                <span className="video-number">{video.lectureNumber}</span>
                <span className="video-title">{video.title}</span>
                <span className="video-checkmark">✓</span>
              </label>
              <button className="icon-button" onClick={() => onDeleteVideo(course.id, video.id)} aria-label={`Delete ${video.title}`}>🗑</button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="composer">
        <div>
          <p className="eyebrow">Add video</p>
          <p className="composer__hint">Paste one title, many lines, or JSON objects/tuples.</p>
        </div>
        <div className="composer__row">
          <textarea value={videoInput} onChange={(e) => setVideoInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAdd(); }} rows={5} placeholder={"Intro to hooks\nState machines\nor [{\"lecture_number\":3,\"lecture_name\":\"Async flows\"}]"} />
          <button className="primary-button" onClick={handleAdd}>Add</button>
        </div>
        {error && <p className="error-text">{error}</p>}
      </div>

      <div className="danger-zone">
        <button className="danger-button" onClick={() => { if (window.confirm(`Delete ${course.name}? This cannot be undone.`)) onDeleteCourse(course.id); }}>
          Delete Course
        </button>
      </div>
    </section>
  );
}

// ─── Stats Page ───────────────────────────────────────────────────────────────

const CHART_TOOLTIP_STYLE = { background: "#0d1426", border: "1px solid #1e293b", borderRadius: 14 };

function StatsPage({ courses, onBack }) {
  const totals = courses.reduce((acc, c) => {
    const p = calculateProgress(c);
    return { courses: acc.courses + 1, videos: acc.videos + p.total, done: acc.done + p.done };
  }, { courses: 0, videos: 0, done: 0 });

  const overallPct = totals.videos === 0 ? 0 : Math.round((totals.done / totals.videos) * 100);
  const streak = calcStreak(courses);

  const courseBars = courses.map((c) => ({ name: c.name.split(" ").slice(0, 2).join(" "), percent: calculateProgress(c).percent, color: c.color }));
  const pieData = [
    { name: "Completed", value: totals.done, color: "#22d3ee" },
    { name: "Remaining", value: Math.max(totals.videos - totals.done, 0), color: "#1e293b" },
  ];
  const timeline = buildTimeline(courses);
  const heatValues = buildHeatmap(courses);

  const today = new Date();
  const heatStart = new Date(today);
  heatStart.setMonth(heatStart.getMonth() - 5);

  return (
    <section className="page page--stats">
      <header className="topbar">
        <div>
          <p className="eyebrow">Analytics</p>
          <h1>See the trend.</h1>
        </div>
        <button className="ghost-button" onClick={onBack}>← Back</button>
      </header>

      <div className="stats-grid">
        {[
          { label: "Total courses", value: totals.courses },
          { label: "Total lectures", value: totals.videos },
          { label: "Completed", value: totals.done },
          { label: "Overall", value: `${overallPct}%` },
          { label: "🔥 Day streak", value: streak },
        ].map((s, i) => (
          <motion.div key={s.label} className="stat-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <span>{s.label}</span>
            <strong>{s.value}</strong>
          </motion.div>
        ))}
      </div>

      <div className="chart-grid">
        <article className="chart-card">
          <div className="chart-card__header"><p className="eyebrow">Completion by course</p><h3>Bar chart</h3></div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={courseBars}>
              <CartesianGrid stroke="#1e293b" vertical={false} />
              <XAxis dataKey="name" stroke="#475569" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis stroke="#475569" tickLine={false} axisLine={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="percent" radius={[8, 8, 0, 0]} animationDuration={900}>
                {courseBars.map((e) => <Cell key={e.name} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </article>

        <article className="chart-card">
          <div className="chart-card__header"><p className="eyebrow">Overall distribution</p><h3>Donut chart</h3></div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={pieData} dataKey="value" innerRadius={78} outerRadius={108} paddingAngle={4} animationDuration={1000}>
                {pieData.map((e) => <Cell key={e.name} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 13 }} />
            </PieChart>
          </ResponsiveContainer>
        </article>

        <article className="chart-card chart-card--wide">
          <div className="chart-card__header"><p className="eyebrow">Momentum over time</p><h3>Cumulative completions</h3></div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeline}>
              <CartesianGrid stroke="#1e293b" vertical={false} />
              <XAxis dataKey="date" stroke="#475569" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis stroke="#475569" tickLine={false} axisLine={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="completed" stroke="#22d3ee" strokeWidth={3} dot={{ r: 4, fill: "#22d3ee" }} activeDot={{ r: 6 }} animationDuration={1100} />
            </LineChart>
          </ResponsiveContainer>
        </article>

        {/* Heatmap */}
        <article className="chart-card chart-card--wide">
          <div className="chart-card__header"><p className="eyebrow">Daily activity</p><h3>Contribution heatmap</h3></div>
          <div className="heatmap-wrap">
            <CalendarHeatmap
              startDate={heatStart}
              endDate={today}
              values={heatValues}
              classForValue={(v) => {
                if (!v || v.count === 0) return "color-empty";
                if (v.count === 1) return "color-scale-1";
                if (v.count === 2) return "color-scale-2";
                if (v.count === 3) return "color-scale-3";
                return "color-scale-4";
              }}
              showWeekdayLabels
            />
          </div>
        </article>
      </div>
    </section>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [courses, setCourses] = useState([]);
  const [view, setView] = useState({ name: "dashboard", courseId: null });
  const [showModal, setShowModal] = useState(false);
  const [celebrationCourseId, setCelebrationCourseId] = useState(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    loadCourses().then((loaded) => { setCourses(loaded); loadedRef.current = true; });
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    saveCourses(courses);
  }, [courses]);

  useEffect(() => {
    if (!celebrationCourseId) return undefined;
    const id = window.setTimeout(() => setCelebrationCourseId(null), 2400);
    return () => window.clearTimeout(id);
  }, [celebrationCourseId]);

  const activeCourse = useMemo(() => courses.find((c) => c.id === view.courseId) ?? null, [courses, view.courseId]);

  const addCourse = (course) => { setCourses((cur) => [course, ...cur]); setShowModal(false); };
  const addBulkCourses = (incoming) => { setCourses((cur) => [...incoming, ...cur]); setShowModal(false); };

  const addVideos = (courseId, videos) => {
    setCourses((cur) => cur.map((c) => {
      if (c.id !== courseId) return c;
      const nextLecture = c.videos.length;
      return { ...c, videos: [...c.videos, ...videos.map((v, i) => ({ ...v, lectureNumber: v.lectureNumber || String(nextLecture + i + 1) }))] };
    }));
  };

  const toggleVideo = (courseId, videoId) => {
    setCourses((cur) => cur.map((c) => {
      if (c.id !== courseId) return c;
      const prev = calculateProgress(c).percent;
      const videos = c.videos.map((v) => v.id === videoId ? { ...v, done: !v.done, completedAt: !v.done ? Date.now() : null } : v);
      const next = { ...c, videos };
      if (prev < 100 && calculateProgress(next).percent === 100 && videos.length > 0) setCelebrationCourseId(courseId);
      return next;
    }));
  };

  const deleteVideo = (courseId, videoId) => {
    setCourses((cur) => cur.map((c) => c.id === courseId ? { ...c, videos: c.videos.filter((v) => v.id !== videoId) } : c));
  };

  const deleteCourse = async (courseId) => {
    setCourses((cur) => cur.filter((c) => c.id !== courseId));
    await storageRemove(`${STORAGE_PREFIX}${courseId}`);
    setView({ name: "dashboard", courseId: null });
  };

  return (
    <div className="app-shell">
      <div className="ambient ambient--one" />
      <div className="ambient ambient--two" />

      {/* Firebase sync indicator */}
      {isFirebaseConfigured && (
        <div className="sync-badge">☁ cloud sync on</div>
      )}

      <AnimatePresence mode="wait">
        <motion.main
          key={view.name}
          className={`view-frame view-frame--${view.name}`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.25 }}
        >
          {view.name === "dashboard" && (
            <Dashboard courses={courses} onOpenCourse={(id) => setView({ name: "detail", courseId: id })} onOpenStats={() => setView({ name: "stats", courseId: null })} onAddCourse={() => setShowModal(true)} />
          )}
          {view.name === "detail" && activeCourse && (
            <CourseDetail course={activeCourse} onBack={() => setView({ name: "dashboard", courseId: null })} onToggleVideo={toggleVideo} onAddVideo={addVideos} onDeleteVideo={deleteVideo} onDeleteCourse={deleteCourse} celebrate={celebrationCourseId === activeCourse.id} />
          )}
          {view.name === "stats" && (
            <StatsPage courses={courses} onBack={() => setView({ name: "dashboard", courseId: null })} />
          )}
        </motion.main>
      </AnimatePresence>

      <AnimatePresence>
        {showModal && (
          <AddCourseModal onClose={() => setShowModal(false)} onSubmit={addCourse} onBulkImport={addBulkCourses} />
        )}
      </AnimatePresence>
    </div>
  );
}
