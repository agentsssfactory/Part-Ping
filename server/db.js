import "./env.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import fs from "fs";

/**
 * Database layer.
 *  - Production / Vercel: Neon Postgres over HTTP (set DATABASE_URL).
 *  - Local dev without DATABASE_URL: embedded Postgres (PGlite) stored in ./data/pglite.
 * Every query is plain Postgres SQL with $1,$2 placeholders, so both behave the same.
 */
export const ON_VERCEL = !!process.env.VERCEL;

export class ConfigError extends Error {
  constructor(msg) { super(msg); this.name = "ConfigError"; }
}

let driverPromise;
function driver() {
  if (!driverPromise) {
    driverPromise = (async () => {
      if (process.env.DATABASE_URL) {
        const { neon } = await import("@neondatabase/serverless");
        const sql = neon(process.env.DATABASE_URL);
        return (text, params = []) => sql.query(text, params);
      }
      if (ON_VERCEL) {
        throw new ConfigError("DATABASE_URL is not set. In Vercel add a Neon Postgres database (Storage tab) and redeploy.");
      }
      const mod = "@electric-sql/pglite"; // variable specifier: never bundled into the Vercel function
      const { PGlite } = await import(mod);
      fs.mkdirSync("./data", { recursive: true }); // PGlite does not create the parent folder
      const pg = new PGlite("./data/pglite");
      await pg.waitReady;
      return async (text, params = []) => (await pg.query(text, params)).rows;
    })();
    driverPromise.catch(() => { driverPromise = null; }); // allow retry after a config fix
  }
  return driverPromise;
}

export async function q(text, params = []) {
  return (await driver())(text, params);
}

/** Delivery milestones, in order. `cancelled` is a terminal side-branch. */
export const MILESTONES = [
  { key: "requested", label: "Request placed" },
  { key: "accepted", label: "Request accepted" },
  { key: "processing", label: "Processing" },
  { key: "dispatched", label: "Dispatched" },
  { key: "in_transit", label: "In transit" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
];
export const STATUS_KEYS = [...MILESTONES.map((m) => m.key), "cancelled"];
export const nowIso = () => new Date().toISOString();

/** Hints (demo logins on the sign-in pages) are for local use; off on Vercel unless SEED_DEMO=1. */
export const demoEnabled = () => (ON_VERCEL ? process.env.SEED_DEMO === "1" : process.env.SEED_DEMO !== "0");

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user','admin')),
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    part_name TEXT NOT NULL,
    part_number TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    delivery_address TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS order_logs (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    note TEXT,
    actor TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS login_attempts (
    key TEXT NOT NULL,
    at BIGINT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_logs_order ON order_logs(order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_attempts_key ON login_attempts(key, at)`,
];

export async function newOrderCode() {
  // PP-XXXXXXXX, unambiguous characters only
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (;;) {
    const bytes = crypto.randomBytes(8);
    const code = "PP-" + [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
    if (!(await q("SELECT 1 FROM orders WHERE code = $1", [code])).length) return code;
  }
}

// Each write is ONE statement (CTE), so the order row and its log entry are always saved together.
export async function createOrder(userId, data, actor) {
  const now = nowIso();
  const code = await newOrderCode();
  await q(
    `WITH o AS (
       INSERT INTO orders (code, user_id, part_name, part_number, quantity, delivery_address, notes, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'requested', $8::text, $8::text) RETURNING id
     )
     INSERT INTO order_logs (order_id, status, note, actor, created_at)
     SELECT id, 'requested', 'Parts request submitted', $9::text, $8::text FROM o`,
    [code, userId, data.part_name, data.part_number || null, data.quantity, data.delivery_address, data.notes || null, now, actor]
  );
  return code;
}

export async function addStatus(orderId, status, note, actor) {
  const now = nowIso();
  await q(
    `WITH u AS (UPDATE orders SET status = $1::text, updated_at = $2::text WHERE id = $3 RETURNING id)
     INSERT INTO order_logs (order_id, status, note, actor, created_at)
     SELECT id, $1::text, $4::text, $5::text, $2::text FROM u`,
    [status, now, orderId, note || null, actor]
  );
}

export const getLogs = (orderId) =>
  q("SELECT status, note, actor, created_at FROM order_logs WHERE order_id = $1 ORDER BY id ASC", [orderId]);

// ---- schema + seeding (once per server instance) ------------------------------
let readyPromise;
export function ready() {
  if (!readyPromise) {
    readyPromise = (async () => {
      if (ON_VERCEL) {
        if (!process.env.JWT_SECRET) throw new ConfigError("JWT_SECRET is not set. Add it in Vercel → Settings → Environment Variables.");
        if (!process.env.ADMIN_PASSWORD) throw new ConfigError("ADMIN_PASSWORD is not set. Add it in Vercel → Settings → Environment Variables.");
      }
      for (const stmt of SCHEMA) await q(stmt);
      await seed();
    })();
    readyPromise.catch(() => { readyPromise = null; });
  }
  return readyPromise;
}

async function seed() {
  const clean = (v) => String(v ?? "").trim();
  const adminEmail = clean(process.env.ADMIN_EMAIL || "admin@partping.com").toLowerCase();
  const adminPass = clean(process.env.ADMIN_PASSWORD || "admin123");

  // .env / Vercel env vars are the source of truth for the admin account.
  const [existing] = await q("SELECT * FROM users WHERE role = 'admin' ORDER BY id LIMIT 1");
  const [clash] = await q("SELECT 1 FROM users WHERE email = $1 AND role <> 'admin'", [adminEmail]);
  if (clash) {
    console.warn(`[seed] ADMIN_EMAIL ${adminEmail} is already a customer account — pick another admin email.`);
  } else if (!existing) {
    await q(
      "INSERT INTO users (name, email, password_hash, role, created_at) VALUES ('Parts Admin', $1, $2, 'admin', $3) ON CONFLICT (email) DO NOTHING",
      [adminEmail, bcrypt.hashSync(adminPass, 10), nowIso()]
    );
    console.log(`[seed] admin created: ${adminEmail}`);
  } else if (existing.email !== adminEmail || !bcrypt.compareSync(adminPass, existing.password_hash)) {
    await q("UPDATE users SET email = $1, password_hash = $2 WHERE id = $3", [adminEmail, bcrypt.hashSync(adminPass, 10), existing.id]);
    console.log(`[seed] admin login updated from env: ${adminEmail}`);
  }

  if (demoEnabled()) {
    const [anyUser] = await q("SELECT 1 FROM users WHERE role = 'user' LIMIT 1");
    if (!anyUser) {
      const [u] = await q(
        "INSERT INTO users (name, email, password_hash, role, created_at) VALUES ('Demo Customer', 'demo@partping.com', $1, 'user', $2) ON CONFLICT (email) DO NOTHING RETURNING id",
        [bcrypt.hashSync("demo123", 10), nowIso()]
      );
      if (u) {
        const code = await createOrder(
          u.id,
          { part_name: "Condenser fan motor", part_number: "CFM-1075", quantity: 1, delivery_address: "42 Harbor Road, Mumbai 400001", notes: "Call on arrival" },
          "Demo Customer"
        );
        const [o] = await q("SELECT id FROM orders WHERE code = $1", [code]);
        await addStatus(o.id, "accepted", "Order confirmed with distributor", "Parts Admin");
        await addStatus(o.id, "processing", "Part picked and being packed", "Parts Admin");
        await addStatus(o.id, "dispatched", "Handed to courier — AWB 77120934", "Parts Admin");
        console.log("[seed] demo customer: demo@partping.com / demo123");
      }
    }
  }
}
