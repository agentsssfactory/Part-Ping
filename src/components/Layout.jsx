import { NavLink, Link, Outlet, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export function Layout() {
  const { user, business, signOut } = useAuth();
  const nav = useNavigate();
  const out = async () => { await signOut(); nav("/"); };
  return (
    <>
      <header className="top">
        <Link className="brand" to="/">{business}</Link>
        <p className="tagline">Parts delivery tracking</p>
        <nav className="top-nav">
          {!user && (<>
            <NavLink to="/track">Track order</NavLink>
            <NavLink to="/login">Customer login</NavLink>
            <NavLink to="/admin/login">Admin</NavLink>
          </>)}
          {user?.role === "user" && (<>
            <NavLink to="/orders" end>My orders</NavLink>
            <NavLink to="/orders/new">Request a part</NavLink>
            <NavLink to="/track">Track</NavLink>
          </>)}
          {user?.role === "admin" && (<>
            <NavLink to="/admin" end>Dashboard</NavLink>
            <NavLink to="/admin/orders">All orders</NavLink>
          </>)}
          {user && (<>
            <span className="who">{user.name}</span>
            <span className={`pill ${user.role === "admin" ? "pill-admin" : ""}`}>{user.role}</span>
            <button className="link" onClick={out}>Sign out</button>
          </>)}
        </nav>
      </header>
      <main><Outlet /></main>
    </>
  );
}

/** Gate a route by role. Wrong role is sent to its own home — never shown the other portal. */
export function RequireRole({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="hint">Loading…</p>;
  if (!user) return <Navigate to={role === "admin" ? "/admin/login" : "/login"} replace />;
  if (user.role !== role) return <Navigate to={user.role === "admin" ? "/admin" : "/orders"} replace />;
  return children;
}
