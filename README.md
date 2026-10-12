# PartPing (React) — Vercel-ready

Parts delivery tracking. Customers request a part and follow each delivery milestone
(Request placed → Request accepted → Processing → Dispatched → In transit → Out for delivery → Delivered)
with the date and time of every step. Admins accept requests and log each milestone.

**Stack:** React 18 + React Router (Vite) · Vercel serverless API (Express) · Postgres (Neon) · cookie JWT auth (bcrypt)
Interactive simulation (no login/setup needed): `/simulation/`

## Deploy to Vercel
1. **Push to GitHub:** `git init && git add . && git commit -m "PartPing" && git branch -M main`, create a repo, then `git remote add origin <url> && git push -u origin main`.
2. **Import in Vercel:** Add New → Project → pick the repo. The Vite preset is detected automatically.
3. **Add a database:** in the project, Storage → Create Database → **Neon (Postgres)** → connect it to this project. This adds `DATABASE_URL` for you. (If your integration names it differently, add `DATABASE_URL` yourself with the Neon connection string.)
4. **Add environment variables** (Settings → Environment Variables):
   | Name | Value |
   |---|---|
   | `JWT_SECRET` | a long random string (e.g. run `openssl rand -hex 32`) |
   | `ADMIN_EMAIL` | your admin login email |
   | `ADMIN_PASSWORD` | a strong password |
   | `BUSINESS_NAME` | optional, shown in the header |
   | `SEED_DEMO` | optional; `1` creates demo@partping.com / demo123 |
5. **Deploy** (or Redeploy after adding the variables). Tables and the admin account are created automatically on the first request.
6. Open `https://<your-app>.vercel.app/admin/login` and sign in.

If something is missing, the API answers with a plain message naming it (e.g. "DATABASE_URL is not set").
Changing `ADMIN_EMAIL` / `ADMIN_PASSWORD` later and redeploying updates the admin login.

## Run locally
```bash
npm install
cp .env.example .env     # Windows: copy .env.example .env
npm run dev              # web http://localhost:5173, API :4000
```
No database install needed: without `DATABASE_URL` it uses an embedded Postgres stored in `./data/pglite`.
Local logins: customer `demo@partping.com` / `demo123`, admin `admin@partping.com` / `admin123` (from `.env`).
To test against your real Neon database locally, put its connection string in `DATABASE_URL`.

## Pages
**Customer** `/login`: My orders · Request a part (type the part name) · Order timeline (auto-refreshes) · Cancel before processing
**Admin** `/admin/login`: Dashboard · All orders (filter/search) · Log next milestone with a note
**Public** `/track/PP-XXXXXXXX`: milestone log by code (no address or names)

## Rules
Milestones only move forward; delivered/cancelled orders are locked. Each portal rejects the other role's credentials,
and the API enforces roles server-side. Timestamps are stored in UTC and shown in the viewer's local time.
Failed logins are rate-limited (10 per 15 minutes per IP + email), stored in the database.
