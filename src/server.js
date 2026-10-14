const express = require("express");
const cors = require("cors");
const path = require("node:path");
const rateLimit = require("express-rate-limit");
const db = require("./db");
const { validateSubmission } = require("./middleware/validate");
const { authenticateTenant } = require("./middleware/auth");
const { resolveGeo } = require("./services/geo");
const { triggerSideEffects } = require("./services/notifier");

const app = express();

// Global body parser with 50KB safety limit
app.use(express.json({ limit: "50kb" }));

// Configure CORS for cross-origin widget embeds and submissions
app.use(
  cors({
    origin: "*", // Public embeddable widget accepts submissions from any customer domain
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-api-key"],
  })
);

// Rate limiter for public submission endpoint: 10 requests per minute per IP
const submissionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too Many Requests",
    message: "Rate limit exceeded. Please try again after 60 seconds.",
  },
});

// Liveness health endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// 1. Deliver versioned widget bundle with strong caching headers
app.get("/v1/widget.v1.js", (req, res) => {
  res.setHeader("Content-Type", "application/javascript");
  res.setHeader("Cache-Control", "public, max-age=86400, immutable");
  res.sendFile(path.resolve(__dirname, "../public/widget.v1.js"));
});

// 2. Deliver widget config with moderate caching
app.get("/v1/widgets/:id/config", (req, res) => {
  const { id } = req.params;
  const stmt = db.prepare("SELECT * FROM widgets WHERE id = ?");
  const widget = stmt.get(id);

  if (!widget) {
    return res.status(404).json({ error: "Widget not found" });
  }

  res.setHeader("Cache-Control", "public, max-age=60");
  res.status(200).json({
    id: widget.id,
    title: widget.title,
    button_text: widget.button_text,
    color: widget.color,
    fields: JSON.parse(widget.fields),
  });
});

// 3. Public hardened submission API
app.post("/v1/submissions", submissionLimiter, validateSubmission, async (req, res) => {
  const { widget_id, _website_hp, data } = req.validatedData;

  // Spam defense: silently drop or reject if honeypot is filled
  if (_website_hp && _website_hp.trim() !== "") {
    console.warn(`[SPAM DETECTED] Honeypot triggered for widget ${widget_id}. Bot submission discarded.`);
    return res.status(400).json({
      error: "Spam Detected",
      message: "Automated submission rejected.",
    });
  }

  // Find widget to associate tenant
  const widgetStmt = db.prepare("SELECT tenant_id FROM widgets WHERE id = ?");
  const widget = widgetStmt.get(widget_id);
  if (!widget) {
    return res.status(404).json({ error: "Widget not found" });
  }

  // Extract client IP
  const rawIp =
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket.remoteAddress ||
    "127.0.0.1";
  const ip = rawIp.replace(/^.*:/, ""); // strip ipv6 prefix if any

  // Resilient Geo-enrichment fallback chain
  const geo = await resolveGeo(ip);

  // Store in database
  const subId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const insertStmt = db.prepare(`
    INSERT INTO submissions (id, widget_id, tenant_id, data, ip_address, country, city, geo_provider, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertStmt.run(
    subId,
    widget_id,
    widget.tenant_id,
    JSON.stringify(data),
    ip,
    geo.country,
    geo.city,
    geo.provider,
    now
  );

  // Safe side effect (async confirmation email/webhook)
  triggerSideEffects({
    id: subId,
    widget_id,
    data,
  });

  return res.status(201).json({
    success: true,
    id: subId,
    message: "Lead submission captured successfully",
  });
});

// 4. Authenticated Dashboard Endpoints (Multi-tenant isolated)
app.get("/v1/dashboard/widgets", authenticateTenant, (req, res) => {
  const stmt = db.prepare("SELECT * FROM widgets WHERE tenant_id = ? ORDER BY created_at DESC");
  const widgets = stmt.all(req.tenant.id);
  const formatted = widgets.map((w) => ({
    ...w,
    fields: JSON.parse(w.fields),
    embed_snippet: `<script src="http://localhost:3000/v1/widget.v1.js" data-widget-id="${w.id}"></script>`,
  }));
  res.status(200).json(formatted);
});

app.post("/v1/dashboard/widgets", authenticateTenant, (req, res) => {
  const { title, button_text, color, fields } = req.body;
  if (!title || !fields) {
    return res.status(400).json({ error: "title and fields are required" });
  }

  const widgetId = `wid_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const insert = db.prepare(`
    INSERT INTO widgets (id, tenant_id, title, button_text, color, fields, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(
    widgetId,
    req.tenant.id,
    title,
    button_text || "Submit",
    color || "#2563eb",
    JSON.stringify(fields),
    now
  );

  res.status(201).json({
    id: widgetId,
    title,
    embed_snippet: `<script src="http://localhost:3000/v1/widget.v1.js" data-widget-id="${widgetId}"></script>`,
  });
});

app.get("/v1/dashboard/submissions", authenticateTenant, (req, res) => {
  const stmt = db.prepare("SELECT * FROM submissions WHERE tenant_id = ? ORDER BY created_at DESC");
  const rows = stmt.all(req.tenant.id);
  const parsed = rows.map((r) => ({
    ...r,
    data: JSON.parse(r.data),
  }));
  res.status(200).json(parsed);
});

app.get("/v1/dashboard/stats", authenticateTenant, (req, res) => {
  const countStmt = db.prepare("SELECT COUNT(*) AS total_submissions FROM submissions WHERE tenant_id = ?");
  const widgetStmt = db.prepare("SELECT COUNT(*) AS total_widgets FROM widgets WHERE tenant_id = ?");
  const geoStmt = db.prepare(`
    SELECT country, COUNT(*) as count
    FROM submissions
    WHERE tenant_id = ? AND country IS NOT NULL
    GROUP BY country
    ORDER BY count DESC
    LIMIT 5
  `);

  res.status(200).json({
    total_submissions: countStmt.get(req.tenant.id).total_submissions,
    total_widgets: widgetStmt.get(req.tenant.id).total_widgets,
    top_countries: geoStmt.all(req.tenant.id),
  });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Widget Platform API running on http://localhost:${PORT}`);
  });
}

module.exports = app;
