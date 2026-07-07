require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");
const PORT = process.env.PORT || 5000;
const MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS) || 30000;
const MAX_RETRIES = 2;
const MAX_EVENTS_LENGTH = 4000;

const VALID_STATES = [
  "Browser",
  "Comparer",
  "Discount Seeker",
  "Cart Abandoner",
  "Loyal Customer",
];

if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY not found in .env");
  process.exit(1);
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: "100kb" }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(
      `${new Date().toISOString()} ${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - start}ms)`
    );
  });
  next();
});

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const hits = new Map();

function rateLimit(req, res, next) {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const entry = hits.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }
  entry.count += 1;
  hits.set(ip, entry);

  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({
      error: "Too many requests. Please slow down and try again shortly.",
    });
  }
  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of hits.entries()) {
    if (now > entry.resetAt) hits.delete(ip);
  }
}, RATE_LIMIT_WINDOW_MS).unref();

function buildPrompt(events) {
  return `
You are an Ecommerce Personalization Expert.

Analyze the following shopper event stream.

Shopper Events:
${events}

Classify the shopper into ONLY ONE of these states:

- Browser
- Comparer
- Discount Seeker
- Cart Abandoner
- Loyal Customer

Rules:

1. State must be one of the above, spelled exactly as shown.
2. Confidence must be a percentage string like "92%".
3. Evidence should contain 3-5 bullet points, each a short phrase.
4. Recommendation should contain ONE personalized, actionable next step.
5. Reason should explain in 1-3 sentences why this state was chosen.

Return ONLY valid JSON, no markdown fences, matching exactly this shape:

{
  "state": "",
  "confidence": "",
  "evidence": [],
  "recommendation": "",
  "reason": ""
}
`;
}

function sanitizeResult(raw) {
  const state = VALID_STATES.includes(raw?.state) ? raw.state : "Browser";
  const confidence =
    typeof raw?.confidence === "string" && /\d/.test(raw.confidence)
      ? raw.confidence
      : "50%";
  const evidence = Array.isArray(raw?.evidence) && raw.evidence.length
    ? raw.evidence.slice(0, 5).map(String)
    : ["No specific evidence returned."];
  const recommendation = typeof raw?.recommendation === "string" && raw.recommendation.trim()
    ? raw.recommendation.trim()
    : "Re-run the analysis with a richer event stream for a tailored recommendation.";
  const reason = typeof raw?.reason === "string" && raw.reason.trim()
    ? raw.reason.trim()
    : "The model did not return a detailed explanation for this classification.";

  return { state, confidence, evidence, recommendation, reason };
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Gemini request timed out")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function callGemini(prompt, attempt = 1) {
  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          temperature: 0.2,
          responseMimeType: "application/json",
        }
      }),
      REQUEST_TIMEOUT_MS
    );

    return response.text;

  } catch (err) {
    if (attempt < MAX_RETRIES) {
      const backoff = 500 * attempt;
      await new Promise((r) => setTimeout(r, backoff));
      return callGemini(prompt, attempt + 1);
    }

    console.error(
      "Gemini API Error:",
      err.status,
      err.message
    );

    throw err;
  }
}

function parseModelJSON(text) {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

app.get("/", (req, res) => {
  res.send("🚀 Ecommerce Personalization Engine Backend Running");
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    model: MODEL,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.post("/analyze", rateLimit, async (req, res) => {
  const { events } = req.body || {};

  if (!events || typeof events !== "string" || events.trim() === "") {
    return res.status(400).json({ error: "Events are required." });
  }

  if (events.length > MAX_EVENTS_LENGTH) {
    return res.status(400).json({
      error: `Events payload is too long (max ${MAX_EVENTS_LENGTH} characters).`,
    });
  }

  try {
    const prompt = buildPrompt(events.trim());
    const text = await callGemini(prompt);
    const parsed = parseModelJSON(text);

    if (!parsed) {
      console.warn("Invalid JSON returned by Gemini:", text.slice(0, 300));
      return res.json({
        state: "Browser",
        confidence: "50%",
        evidence: ["Unable to parse AI response."],
        recommendation: "Retry the analysis; the model response was malformed.",
        reason: "Gemini returned an unexpected response format.",
      });
    }

    res.json(sanitizeResult(parsed));
  } catch (error) {
    const timedOut = /timed out/i.test(error.message || "");
    console.error("Analyze Error:", error);
    res.status(timedOut ? 504 : 500).json({
      error: timedOut
        ? "AI analysis timed out. Please try again."
        : "AI analysis failed. Please try again shortly.",
    });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found." });
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Unexpected server error." });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} (model: ${MODEL})`);
});

function shutdown(signal) {
  console.log(`\n${signal} received, shutting down gracefully...`);
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));