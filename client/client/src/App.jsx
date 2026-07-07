import { useState, useEffect, useRef, useMemo } from "react";
import "./App.css";

/* ────────────────────────────────────────────────────────────────
   CONFIG
   ──────────────────────────────────────────────────────────────── */

const STATE_CONFIG = {
  "Browser":         { color: "#6C8EBF", icon: "👁" },
  "Comparer":        { color: "#82B366", icon: "⚖" },
  "Discount Seeker": { color: "#D6A35A", icon: "🏷" },
  "Cart Abandoner":  { color: "#E07070", icon: "🛒" },
  "Loyal Customer":  { color: "#9B72CF", icon: "★" },
};
const DEFAULT_SI = { color: "#8A93A0", icon: "◆" };

const SAMPLES = {
  "Browser":         ["Visited Homepage", "Viewed Collections", "Viewed Product", "Exited Website"],
  "Comparer":        ["Visited Homepage", "Viewed Shoes A", "Viewed Shoes B", "Viewed Shoes C", "Opened Compare Tab"],
  "Discount Seeker": ["Visited Homepage", "Searched Coupon Codes", "Applied Promo Code", "Viewed Sale Items"],
  "Cart Abandoner":  ["Visited Homepage", "Viewed Shoes", "Viewed Product", "Added To Cart", "Exited Website"],
  "Loyal Customer":  ["Login", "Purchased Shoes", "Purchased Jacket", "Reviewed Product", "Visited Again"],
};

const RECOMMENDATIONS = {
  "Browser":         "Surface a low-friction welcome offer to encourage a first deeper look.",
  "Comparer":        "Show a side-by-side spec/price comparison to help them decide faster.",
  "Discount Seeker": "Present a time-boxed discount to convert price-sensitivity into a sale.",
  "Cart Abandoner":  "Send a cart-recovery nudge with a small incentive within the hour.",
  "Loyal Customer":  "Invite them into a loyalty tier or early-access program to deepen retention.",
};

const RULES = [
  { state: "Loyal Customer",  weight: 3, match: ["purchas", "login", "review", "visited again", "sign in"] },
  { state: "Cart Abandoner",  weight: 3, match: ["added to cart", "cart"], exclude: ["purchas", "checkout", "order placed"] },
  { state: "Discount Seeker", weight: 3, match: ["coupon", "discount", "promo", "sale"] },
  { state: "Comparer",        weight: 2, match: ["compare", "viewed shoes", "viewed product"] },
  { state: "Browser",         weight: 1, match: ["visited", "viewed", "exited"] },
];

const ENDPOINT_KEY = "si_endpoint";
const HISTORY_KEY  = "si_history";
const THEME_KEY    = "si_theme";
const DEFAULT_ENDPOINT = "http://localhost:5000/analyze";

/* ────────────────────────────────────────────────────────────────
   HELPERS
   ──────────────────────────────────────────────────────────────── */

const getConf = (c) => {
  if (c === undefined || c === null) return 0;
  if (typeof c === "number") return Math.round(c <= 1 ? c * 100 : c);
  const t = c.toString().toLowerCase();
  if (t.includes("%")) return parseInt(t);
  if (t.includes("high")) return 90;
  if (t.includes("medium")) return 60;
  if (t.includes("low")) return 30;
  return 50;
};

function classifyLocally(eventLines) {
  const text = eventLines.join(" | ").toLowerCase();
  let best = { state: "Browser", score: 0 };
  const scored = RULES.map((r) => {
    let score = 0;
    r.match.forEach((m) => { if (text.includes(m)) score += r.weight; });
    if (r.exclude?.some((m) => text.includes(m))) score = 0;
    return { ...r, score };
  });
  scored.forEach((r) => { if (r.score > best.score) best = r; });
  const matchedEvidence = eventLines.filter((line) =>
    best.match?.some((m) => line.toLowerCase().includes(m))
  );
  const evidence = matchedEvidence.length ? matchedEvidence.slice(0, 5) : eventLines.slice(0, 3);
  const confidence = Math.min(95, 45 + best.score * 12);
  return {
    state: best.state,
    confidence: `${confidence}%`,
    evidence,
    recommendation: RECOMMENDATIONS[best.state],
    reason: `Local demo classifier matched ${evidence.length} event(s) most strongly associated with "${best.state}" behavior patterns. Connect a live backend in Settings for model-based classification.`,
    _demo: true,
  };
}

const uid = () => Math.random().toString(36).slice(2, 9);

/* ────────────────────────────────────────────────────────────────
   SMALL UI PRIMITIVES
   ──────────────────────────────────────────────────────────────── */

function Toast({ toasts, dismiss }) {
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`} onClick={() => dismiss(t.id)}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

function Sparkline({ points, accent }) {
  if (!points.length) return null;
  const w = 160, h = 40, pad = 4;
  const max = 100, min = 0;
  const step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const x = pad + i * step;
    const y = h - pad - ((p.value - min) / (max - min)) * (h - pad * 2);
    return `${x},${y}`;
  });
  return (
    <svg className="sparkline" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={coords.join(" ")} className="sparkline-line" style={{ "--spark-color": accent }} />
      {points.map((p, i) => (
        <circle key={i} cx={pad + i * step} cy={h - pad - ((p.value - min) / (max - min)) * (h - pad * 2)}
          r="2.5" fill={p.color} />
      ))}
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────────
   MAIN APP
   ──────────────────────────────────────────────────────────────── */

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "dark");
  const [eventList, setEventList] = useState(["Visited Homepage", "Viewed Product"]);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; }
  });
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [endpoint, setEndpoint] = useState(() => localStorage.getItem(ENDPOINT_KEY) || DEFAULT_ENDPOINT);
  const [endpointDraft, setEndpointDraft] = useState(endpoint);
  const [online, setOnline] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [historyFilter, setHistoryFilter] = useState("All");
  const [historySearch, setHistorySearch] = useState("");
  const [pulse, setPulse] = useState(false);
  const pulseTimer = useRef(null);

  const si = result ? (STATE_CONFIG[result.state] || DEFAULT_SI) : DEFAULT_SI;
  const confVal = result ? getConf(result.confidence) : 0;

  /* persist */
  useEffect(() => { localStorage.setItem(THEME_KEY, theme); }, [theme]);
  useEffect(() => { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50))); }, [history]);
  useEffect(() => { localStorage.setItem(ENDPOINT_KEY, endpoint); }, [endpoint]);

  /* connection check */
  const checkConnection = async () => {
    try {
      const base = endpoint.replace(/\/analyze\/?$/, "");
      const res = await fetch(base + "/health", { method: "GET" }).catch(() => null);
      setOnline(!!res && res.ok);
    } catch { setOnline(false); }
  };
  useEffect(() => { checkConnection(); /* eslint-disable-next-line */ }, [endpoint]);

  /* keyboard shortcut */
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); analyse(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line
  }, [eventList, bulkText, bulkMode, endpoint]);

  const pushToast = (message, type = "info") => {
    const id = uid();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3200);
  };

  const currentEvents = () =>
    bulkMode ? bulkText.split("\n").map((s) => s.trim()).filter(Boolean) : eventList.filter(Boolean);

  /* event list editing */
  const addEvent = () => setEventList((p) => [...p, ""]);
  const updateEvent = (i, val) => setEventList((p) => p.map((e, idx) => (idx === i ? val : e)));
  const removeEvent = (i) => setEventList((p) => p.filter((_, idx) => idx !== i));
  const moveEvent = (i, dir) => {
    setEventList((p) => {
      const arr = [...p];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
  };
  const loadSample = (key) => {
    setEventList(SAMPLES[key]);
    setBulkText(SAMPLES[key].join("\n"));
    setResult(null);
  };
  const clearEvents = () => { setEventList([""]); setBulkText(""); setResult(null); };

  /* analyse */
  const analyse = async () => {
    const events = currentEvents();
    if (!events.length) { pushToast("Add at least one event first.", "warn"); return; }
    setLoading(true);
    let data;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: events.join("\n") }),
      });
      if (!res.ok) throw new Error("bad status");
      data = await res.json();
      setOnline(true);
    } catch {
      setOnline(false);
      data = classifyLocally(events);
      pushToast("Backend unreachable — showing demo classification.", "warn");
    }
    setResult(data);
    setPulse(true);
    clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(() => setPulse(false), 900);
    setHistory((p) => [
      { id: uid(), state: data.state, confidence: data.confidence, time: new Date().toLocaleTimeString(),
        events, recommendation: data.recommendation, evidence: data.evidence, reason: data.reason, demo: !!data._demo },
      ...p,
    ]);
    setLoading(false);
  };

  const reportText = () => result
    ? `State: ${result.state}\nConfidence: ${result.confidence}\n\nEvidence:\n${(result.evidence || []).join("\n")}\n\nRecommendation:\n${result.recommendation}\n\nReason:\n${result.reason}`
    : "";

  const copyResult = () => {
    if (!result) return;
    navigator.clipboard.writeText(reportText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const download = () => {
    if (!result) return;
    const blob = new Blob([reportText()], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `shopper-report-${Date.now()}.txt`;
    a.click();
  };
  const exportHistoryCSV = () => {
    const rows = [["state", "confidence", "time", "events"], ...history.map((h) =>
      [h.state, h.confidence, h.time, h.events.join(" > ")])];
    const csv = rows.map((r) => r.map((c) => `"${(c || "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `shopper-history-${Date.now()}.csv`;
    a.click();
  };

  const reload = (h) => {
    setResult({ state: h.state, confidence: h.confidence, evidence: h.evidence, recommendation: h.recommendation, reason: h.reason });
    setEventList(h.events);
    setBulkText(h.events.join("\n"));
  };
  const deleteHistoryItem = (id) => setHistory((p) => p.filter((h) => h.id !== id));
  const clearHistory = () => setHistory([]);

  const stats = useMemo(() => {
    if (!history.length) return null;
    const counts = {};
    let confSum = 0;
    history.forEach((h) => {
      counts[h.state] = (counts[h.state] || 0) + 1;
      confSum += getConf(h.confidence);
    });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return {
      total: history.length,
      topState: top?.[0],
      avgConf: Math.round(confSum / history.length),
      spark: history.slice(0, 10).reverse().map((h) => ({
        value: getConf(h.confidence),
        color: (STATE_CONFIG[h.state] || DEFAULT_SI).color,
      })),
    };
  }, [history]);

  const filteredHistory = history.filter((h) => {
    const matchesState = historyFilter === "All" || h.state === historyFilter;
    const matchesSearch = !historySearch || h.events.join(" ").toLowerCase().includes(historySearch.toLowerCase());
    return matchesState && matchesSearch;
  });

  const saveEndpoint = () => {
    setEndpoint(endpointDraft.trim() || DEFAULT_ENDPOINT);
    setShowSettings(false);
    pushToast("Endpoint updated.", "success");
  };

  return (
    <div className={`app ${theme}`} style={{ "--pulse-color": si.color }}>
      <div className={`bg-scan ${pulse ? "bg-scan-pulse" : ""}`} aria-hidden="true">
        <div className="bg-grid" />
        <div className="bg-sweep" />
        <div className="bg-blob bg-blob-a" />
        <div className="bg-blob bg-blob-b" />
      </div>

      <Toast toasts={toasts} dismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />

      {/* NAV */}
      <nav className="nav">
        <div className="nav-brand">
          <span className={`status-dot ${online ? "status-on" : online === false ? "status-off" : "status-unknown"}`} />
          <span className="nav-title">Shopper Intelligence</span>
        </div>
        <div className="nav-actions">
          <button className="nav-icon-btn" onClick={checkConnection} title="Check connection">↻</button>
          <button className="nav-icon-btn" onClick={() => setShowSettings(true)} title="Settings">⚙</button>
          <button className="nav-toggle" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? "☀ Light" : "☾ Dark"}
          </button>
        </div>
      </nav>

      {/* HERO */}
      <div className="hero">
        <span className="hero-eyebrow">Behavioral signal engine</span>
        <h1>Read the shopper. Act on the signal.</h1>
        <p>Feed in a session · the engine classifies intent · you get a targeted, ready-to-send nudge</p>
      </div>

      {/* STATS BAR */}
      {stats && (
        <div className="stats-bar">
          <div className="stat-chip">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Sessions analysed</span>
          </div>
          <div className="stat-chip">
            <span className="stat-value" style={{ color: (STATE_CONFIG[stats.topState] || DEFAULT_SI).color }}>
              {stats.topState}
            </span>
            <span className="stat-label">Most frequent state</span>
          </div>
          <div className="stat-chip">
            <span className="stat-value">{stats.avgConf}%</span>
            <span className="stat-label">Avg. confidence</span>
          </div>
          <div className="stat-chip stat-chip-spark">
            <Sparkline points={stats.spark} accent={si.color} />
            <span className="stat-label">Confidence trend</span>
          </div>
        </div>
      )}

      {/* GRID */}
      <div className="main-grid">

        {/* LEFT PANEL */}
        <div className="panel">
          <div>
            <p className="section-label">Load sample session</p>
            <div className="preset-row">
              {Object.keys(SAMPLES).map((k) => (
                <button key={k} className="preset-btn" onClick={() => loadSample(k)}
                  style={{ "--chip-color": STATE_CONFIG[k].color }}>
                  <span className="preset-icon">{STATE_CONFIG[k].icon}</span>{k}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="textarea-header">
              <p className="section-label">Shopper events</p>
              <div className="mode-switch">
                <button className={!bulkMode ? "mode-btn active" : "mode-btn"} onClick={() => setBulkMode(false)}>List</button>
                <button className={bulkMode ? "mode-btn active" : "mode-btn"}
                  onClick={() => { setBulkText(eventList.filter(Boolean).join("\n")); setBulkMode(true); }}>Bulk</button>
              </div>
              <span className="event-count">{currentEvents().length} events</span>
            </div>

            {bulkMode ? (
              <textarea className="events-textarea" rows={10} value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={"Visited Homepage\nViewed Product\nAdded To Cart\n..."} />
            ) : (
              <div className="event-editor">
                {eventList.map((ev, i) => (
                  <div className="event-row" key={i}>
                    <span className="event-index">{i + 1}</span>
                    <input className="event-input" value={ev} placeholder="Describe the event…"
                      onChange={(e) => updateEvent(i, e.target.value)} />
                    <button className="event-mini-btn" onClick={() => moveEvent(i, -1)} disabled={i === 0} title="Move up">↑</button>
                    <button className="event-mini-btn" onClick={() => moveEvent(i, 1)} disabled={i === eventList.length - 1} title="Move down">↓</button>
                    <button className="event-mini-btn event-mini-danger" onClick={() => removeEvent(i)} title="Remove">✕</button>
                  </div>
                ))}
                <button className="btn-ghost btn-add-row" onClick={addEvent}>＋ Add event</button>
              </div>
            )}
          </div>

          <div className="action-row">
            <button className="btn-ghost" onClick={clearEvents}>🗑 Clear</button>
            <button className="btn-primary" onClick={analyse} disabled={loading || !currentEvents().length}>
              {loading ? "Analysing…" : "▶ Analyse session"}
            </button>
            <span className="kbd-hint">⌘/Ctrl + Enter</span>
          </div>

          {history.length > 0 && (
            <div>
              <div className="textarea-header">
                <p className="section-label">Session history</p>
                <div className="history-tools">
                  <button className="nav-icon-btn" onClick={exportHistoryCSV} title="Export CSV">⬇</button>
                  <button className="nav-icon-btn" onClick={clearHistory} title="Clear history">🗑</button>
                </div>
              </div>
              <div className="history-filters">
                <select className="history-select" value={historyFilter} onChange={(e) => setHistoryFilter(e.target.value)}>
                  <option>All</option>
                  {Object.keys(STATE_CONFIG).map((k) => <option key={k}>{k}</option>)}
                </select>
                <input className="history-search" placeholder="Search events…" value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)} />
              </div>
              <div className="history-list">
                {filteredHistory.slice(0, 12).map((item) => {
                  const hsi = STATE_CONFIG[item.state] || DEFAULT_SI;
                  return (
                    <div key={item.id} className="history-item" onClick={() => reload(item)}>
                      <div className="history-state">
                        <span>{hsi.icon}</span>
                        <span className="history-name" style={{ color: hsi.color }}>{item.state}</span>
                        {item.demo && <span className="demo-badge">demo</span>}
                      </div>
                      <span className="history-time">{item.time}</span>
                      <button className="event-mini-btn event-mini-danger"
                        onClick={(e) => { e.stopPropagation(); deleteHistoryItem(item.id); }}>✕</button>
                    </div>
                  );
                })}
                {!filteredHistory.length && <p className="empty-text small">No sessions match this filter.</p>}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div className="panel">
          {!result ? (
            <div className="empty-state">
              <div className="empty-icon">◈</div>
              <p className="empty-text">Add events and run analysis<br />to see the classification</p>
            </div>
          ) : (
            <>
              <div className="state-card" style={{ "--accent": si.color }}>
                <div className="state-card-top">
                  <div>
                    <div className="state-name-row">
                      <span className="state-icon">{si.icon}</span>
                      <span className="state-name">{result.state}</span>
                    </div>
                    <p className="state-sublabel">
                      Primary shopper state {result._demo && <span className="demo-badge">demo mode</span>}
                    </p>
                  </div>
                  <div className="conf-box">
                    <div className="conf-value">{confVal}%</div>
                    <div className="conf-label">Confidence</div>
                  </div>
                </div>
                <div className="conf-bar-track">
                  <div className="conf-bar-fill" style={{ "--conf-width": `${confVal}%` }} />
                </div>
              </div>

              <div className="result-section neutral">
                <p className="result-section-label">Evidence</p>
                <div className="evidence-list">
                  {(result.evidence || []).map((pt, i) => (
                    <div key={i} className="evidence-item" style={{ "--accent": si.color }}>
                      <div className="evidence-num">{i + 1}</div>
                      <span className="evidence-text">{pt}</span>
                      <button className="event-mini-btn" title="Copy"
                        onClick={() => { navigator.clipboard.writeText(pt); pushToast("Copied evidence line.", "success"); }}>⧉</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="result-section accent-tint" style={{ "--accent": si.color }}>
                <p className="result-section-label">Recommended nudge</p>
                <p className="nudge-quote">{result.recommendation}</p>
              </div>

              <div className="result-section neutral">
                <p className="result-section-label">Explanation</p>
                <p className="reason-text">{result.reason}</p>
              </div>

              <div className="result-actions">
                <button className="btn-ghost" onClick={copyResult}>{copied ? "✓ Copied" : "⧉ Copy"}</button>
                <button className="btn-ghost" onClick={download}>⬇ Download</button>
                <span className="powered-by">{result._demo ? "Local demo classifier" : "Live backend"}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Settings</h3>
            <p className="section-label">Analysis endpoint</p>
            <input className="event-input modal-input" value={endpointDraft}
              onChange={(e) => setEndpointDraft(e.target.value)} placeholder={DEFAULT_ENDPOINT} />
            <p className="modal-hint">
              If this endpoint can't be reached, sessions are classified locally with a lightweight
              rule-based demo model so the app stays usable offline.
            </p>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowSettings(false)}>Cancel</button>
              <button className="btn-primary" onClick={saveEndpoint}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}