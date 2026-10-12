import { useState } from "react";
import { Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { Flash } from "../components/Common.jsx";

function useSubmit(fn) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try { await fn(new FormData(e.target)); } catch (ex) { setErr(ex.message); setBusy(false); }
  };
  return { err, busy, run };
}

export function UserLogin() {
  const { user, signIn, demo } = useAuth();
  const nav = useNavigate();
  const from = useLocation().state?.from;
  const { err, busy, run } = useSubmit(async (f) => {
    await signIn("/auth/login", { email: f.get("email"), password: f.get("password") });
    nav(from || "/orders", { replace: true });
  });
  if (user) return <Navigate to={user.role === "admin" ? "/admin" : "/orders"} replace />;
  return (
    <div className="auth-wrap">
      <section className="card">
        <h1>Customer login</h1>
        <p className="lede" style={{ marginBottom: "1rem" }}>Sign in to request parts and track your orders.</p>
        <form className="stack" onSubmit={run}>
          <Flash>{err}</Flash>
          <label>Email<input name="email" type="email" required autoComplete="email" /></label>
          <label>Password<input name="password" type="password" required autoComplete="current-password" /></label>
          <button className="btn" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
        <p className="swap" style={{ marginTop: "1rem" }}>New here? <Link to="/register">Create an account</Link></p>
        {demo && <p className="demo-box">Demo customer: <code>demo@partping.com</code> / <code>demo123</code></p>}
      </section>
      <p className="swap">Staff? <Link to="/admin/login">Admin login</Link></p>
    </div>
  );
}

export function Register() {
  const { user, signIn } = useAuth();
  const nav = useNavigate();
  const { err, busy, run } = useSubmit(async (f) => {
    await signIn("/auth/register", { name: f.get("name"), email: f.get("email"), password: f.get("password") });
    nav("/orders", { replace: true });
  });
  if (user) return <Navigate to="/" replace />;
  return (
    <div className="auth-wrap">
      <section className="card">
        <h1>Create account</h1>
        <form className="stack" onSubmit={run} style={{ marginTop: "0.8rem" }}>
          <Flash>{err}</Flash>
          <label>Full name<input name="name" required autoComplete="name" /></label>
          <label>Email<input name="email" type="email" required autoComplete="email" /></label>
          <label>Password (min 6 characters)<input name="password" type="password" minLength={6} required autoComplete="new-password" /></label>
          <button className="btn" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
        </form>
        <p className="swap" style={{ marginTop: "1rem" }}>Already registered? <Link to="/login">Sign in</Link></p>
      </section>
    </div>
  );
}

export function AdminLogin() {
  const { user, signIn, demo } = useAuth();
  const nav = useNavigate();
  const { err, busy, run } = useSubmit(async (f) => {
    await signIn("/auth/admin/login", { email: f.get("email"), password: f.get("password") });
    nav("/admin", { replace: true });
  });
  if (user) return <Navigate to={user.role === "admin" ? "/admin" : "/orders"} replace />;
  return (
    <div className="auth-wrap admin">
      <section className="card">
        <p className="hint" style={{ margin: 0 }}><span className="pill pill-admin">admin</span></p>
        <h1 style={{ marginTop: "0.4rem" }}>Admin sign in</h1>
        <p className="lede" style={{ marginBottom: "1rem" }}>Manage requests and update delivery milestones.</p>
        <form className="stack" onSubmit={run}>
          <Flash>{err}</Flash>
          <label>Admin email<input name="email" type="email" required autoComplete="username" /></label>
          <label>Password<input name="password" type="password" required autoComplete="current-password" /></label>
          <button className="btn btn-danger" disabled={busy}>{busy ? "Signing in…" : "Sign in as admin"}</button>
        </form>
        {demo && <p className="demo-box">Default admin: <code>admin@partping.com</code> / <code>admin123</code> unless you set ADMIN_EMAIL / ADMIN_PASSWORD</p>}
      </section>
      <p className="swap">Customer? <Link to="/login">Customer login</Link></p>
    </div>
  );
}
