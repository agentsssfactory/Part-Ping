import "./env.js";
import express from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { q, ready, ConfigError, ON_VERCEL, demoEnabled, MILESTONES, STATUS_KEYS, createOrder, addStatus, getLogs } from "./db.js";

const BUSINESS = process.env.BUSINESS_NAME || "PartPing";
// On Vercel every request may hit a different instance, so the secret must be fixed (checked in ready()).
const SECRET = process.env.JWT_SECRET || (ON_VERCEL ? "" : crypto.randomBytes(32).toString("hex"));
if (!process.env.JWT_SECRET && !ON_VERCEL) console.warn("[warn] JWT_SECRET not set — using a random one; everyone is logged out on restart.");

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "50kb" }));
app.use(cookieParser());

// every async route goes through this so errors reach the error handler
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// schema + seeding happen once per instance, before the first request is served
app.use("/api", ah(async (_req, _res, next) => { await ready(); next(); }));

// ---- auth helpers -----------------------------------------------------------
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });
const userById = async (id) => (await q("SELECT * FROM users WHERE id = $1", [id]))[0];

function issueCookie(req, res, user) {
  const token = jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: "7d" });
  res.cookie("pp_token", token, { httpOnly: true, sameSite: "lax", secure: req.secure, maxAge: 7 * 864e5 });
}

const auth = ah(async (req, res, next) => {
  try {
    const { id } = jwt.verify(req.cookies.pp_token, SECRET);
    const user = await userById(id);
    if (!user) throw new Error("gone");
    req.user = user;
  } catch {
    return res.status(401).json({ error: "Please sign in." });
  }
  next();
});
const requireRole = (role) => (req, res, next) =>
  req.user.role === role ? next() : res.status(403).json({ error: "You don't have access to this." });

// login throttle: 10 failures / 15 min per (ip + email). Stored in the DB because serverless instances don't share memory.
const WINDOW = 15 * 60e3;
async function throttled(key) {
  const [r] = await q("SELECT COUNT(*)::int AS n FROM login_attempts WHERE key = $1 AND at > $2", [key, Date.now() - WINDOW]);
  return r.n >= 10;
}
async function noteFail(key) {
  await q("INSERT INTO login_attempts (key, at) VALUES ($1, $2)", [key, Date.now()]);
  if (Math.random() < 0.05) await q("DELETE FROM login_attempts WHERE at < $1", [Date.now() - WINDOW]);
}

const login = (role) =>
  ah(async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const key = req.ip + "|" + email;
    if (await throttled(key)) return res.status(429).json({ error: "Too many attempts. Try again in a few minutes." });
    const user = (await q("SELECT * FROM users WHERE email = $1", [email]))[0];
    // same message for wrong email / password / portal — don't leak which
    if (!user || user.role !== role || !bcrypt.compareSync(password, user.password_hash)) {
      await noteFail(key);
      return res.status(401).json({ error: "Invalid email or password." });
    }
    issueCookie(req, res, user);
    res.json({ user: publicUser(user) });
  });

app.post("/api/auth/login", login("user"));
app.post("/api/auth/admin/login", login("admin"));

app.post("/api/auth/register", ah(async (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 100);
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "Enter your name and a valid email." });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
  const rows = await q(
    "INSERT INTO users (name, email, password_hash, role, created_at) VALUES ($1, $2, $3, 'user', $4) ON CONFLICT (email) DO NOTHING RETURNING *",
    [name, email, bcrypt.hashSync(password, 10), new Date().toISOString()]
  );
  if (!rows.length) return res.status(409).json({ error: "An account with that email already exists." });
  issueCookie(req, res, rows[0]);
  res.status(201).json({ user: publicUser(rows[0]) });
}));

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie("pp_token");
  res.json({ ok: true });
});

app.get("/api/auth/me", ah(async (req, res) => {
  let user = null;
  try {
    const { id } = jwt.verify(req.cookies.pp_token, SECRET);
    user = (await userById(id)) || null;
  } catch {}
  res.json({ user: user ? publicUser(user) : null, business: BUSINESS, milestones: MILESTONES, demo: demoEnabled() });
}));

// ---- order helpers ----------------------------------------------------------
const ORDER_SQL = `SELECT o.*, u.name AS customer_name, u.email AS customer_email FROM orders o JOIN users u ON u.id = o.user_id`;
const orderRow = async (where, args) => (await q(`${ORDER_SQL} WHERE ${where} LIMIT 1`, args))[0];

async function present(o, { admin = false, logs = true } = {}) {
  const base = {
    code: o.code, part_name: o.part_name, part_number: o.part_number, quantity: o.quantity,
    status: o.status, created_at: o.created_at, updated_at: o.updated_at,
  };
  if (logs) base.logs = await getLogs(o.id);
  return admin
    ? { ...base, notes: o.notes, delivery_address: o.delivery_address, customer_name: o.customer_name, customer_email: o.customer_email }
    : base;
}

// ---- public tracking (no address / names exposed) -----------------------------
app.get("/api/track/:code", ah(async (req, res) => {
  const o = await orderRow("o.code = $1", [String(req.params.code).trim().toUpperCase()]);
  if (!o) return res.status(404).json({ error: "No order found with that tracking code." });
  const order = await present(o);
  order.logs = order.logs.map(({ actor, ...l }) => l);
  res.json({ order });
}));

// ---- customer ---------------------------------------------------------------
app.get("/api/orders", auth, requireRole("user"), ah(async (req, res) => {
  const rows = await q(`${ORDER_SQL} WHERE o.user_id = $1 ORDER BY o.id DESC`, [req.user.id]);
  res.json({ orders: await Promise.all(rows.map((o) => present(o, { admin: true, logs: false }))) });
}));

app.post("/api/orders", auth, requireRole("user"), ah(async (req, res) => {
  const b = req.body || {};
  const part_name = String(b.part_name || "").trim();
  const delivery_address = String(b.delivery_address || "").trim();
  const quantity = Math.floor(Number(b.quantity || 1));
  if (!part_name || !delivery_address) return res.status(400).json({ error: "Part name and delivery address are required." });
  if (!(quantity >= 1 && quantity <= 1000)) return res.status(400).json({ error: "Quantity must be between 1 and 1000." });
  const code = await createOrder(
    req.user.id,
    {
      part_name: part_name.slice(0, 200),
      part_number: String(b.part_number || "").trim().slice(0, 100),
      quantity,
      delivery_address: delivery_address.slice(0, 500),
      notes: String(b.notes || "").trim().slice(0, 1000),
    },
    req.user.name
  );
  res.status(201).json({ code });
}));

app.get("/api/orders/:code", auth, requireRole("user"), ah(async (req, res) => {
  const o = await orderRow("o.code = $1 AND o.user_id = $2", [req.params.code, req.user.id]);
  if (!o) return res.status(404).json({ error: "Order not found." });
  res.json({ order: await present(o, { admin: true }) });
}));

app.post("/api/orders/:code/cancel", auth, requireRole("user"), ah(async (req, res) => {
  const o = await orderRow("o.code = $1 AND o.user_id = $2", [req.params.code, req.user.id]);
  if (!o) return res.status(404).json({ error: "Order not found." });
  if (!["requested", "accepted"].includes(o.status))
    return res.status(409).json({ error: "This order is already being processed and can no longer be cancelled here. Please contact us." });
  await addStatus(o.id, "cancelled", "Cancelled by customer", req.user.name);
  res.json({ ok: true });
}));

// ---- admin ------------------------------------------------------------------
const admin = express.Router();
admin.use(auth, requireRole("admin"));

admin.get("/stats", ah(async (_req, res) => {
  const counts = Object.fromEntries(STATUS_KEYS.map((k) => [k, 0]));
  for (const r of await q("SELECT status, COUNT(*)::int AS n FROM orders GROUP BY status")) counts[r.status] = r.n;
  const [{ n: customers }] = await q("SELECT COUNT(*)::int AS n FROM users WHERE role = 'user'");
  res.json({ counts, total: Object.values(counts).reduce((a, b) => a + b, 0), customers });
}));

admin.get("/orders", ah(async (req, res) => {
  const status = String(req.query.status || "");
  const term = String(req.query.q || "").trim();
  const where = [];
  const args = [];
  if (status === "active") where.push("o.status NOT IN ('delivered','cancelled')");
  else if (STATUS_KEYS.includes(status)) { args.push(status); where.push(`o.status = $${args.length}`); }
  if (term) {
    args.push(`%${term}%`);
    const p = `$${args.length}`;
    where.push(`(o.code ILIKE ${p} OR o.part_name ILIKE ${p} OR u.name ILIKE ${p} OR u.email ILIKE ${p} OR o.part_number ILIKE ${p})`);
  }
  const rows = await q(`${ORDER_SQL} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY o.id DESC LIMIT 500`, args);
  res.json({ orders: await Promise.all(rows.map((o) => present(o, { admin: true, logs: false }))) });
}));

admin.get("/orders/:code", ah(async (req, res) => {
  const o = await orderRow("o.code = $1", [req.params.code]);
  if (!o) return res.status(404).json({ error: "Order not found." });
  res.json({ order: await present(o, { admin: true }) });
}));

admin.post("/orders/:code/status", ah(async (req, res) => {
  const o = await orderRow("o.code = $1", [req.params.code]);
  if (!o) return res.status(404).json({ error: "Order not found." });
  const status = String(req.body.status || "");
  const note = String(req.body.note || "").trim().slice(0, 500);
  if (!STATUS_KEYS.includes(status)) return res.status(400).json({ error: "Unknown status." });
  if (["delivered", "cancelled"].includes(o.status))
    return res.status(409).json({ error: `This order is already ${o.status} and can't be changed.` });
  if (status === o.status) return res.status(409).json({ error: "Order is already at that status." });
  const idx = (k) => MILESTONES.findIndex((m) => m.key === k);
  if (status !== "cancelled" && idx(status) < idx(o.status))
    return res.status(409).json({ error: "Milestones can only move forward." });
  await addStatus(o.id, status, note, req.user.name);
  res.json({ order: await present(await orderRow("o.id = $1", [o.id]), { admin: true }) });
}));

app.use("/api/admin", admin);
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found." }));

// ---- errors: always JSON, config problems spelled out ---------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof ConfigError) return res.status(500).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: "Server error. Check the server logs." });
});

export default app;
