import { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export default function Home() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [code, setCode] = useState("");
  if (user) return <Navigate to={user.role === "admin" ? "/admin" : "/orders"} replace />;
  return (
    <>
      <section className="hero">
        <h1>Know exactly where your part is.</h1>
        <p className="lede">Every parts order is logged milestone by milestone — accepted, processing, dispatched and on to your door — with the date and time of each step.</p>
        <form className="track-form" onSubmit={(e) => { e.preventDefault(); code.trim() && nav(`/track/${code.trim().toUpperCase()}`); }}>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Tracking code, e.g. PP-AB12CD34" aria-label="Tracking code" />
          <button className="btn">Track</button>
        </form>
        <p className="hint" style={{marginTop:"0.8rem"}}><a href="/simulation/">See how it works: try the interactive simulation →</a></p>
      </section>
      <div className="portals">
        <section className="card">
          <h2>Customers</h2>
          <p className="hint">Request parts, follow every delivery update, and see your full order history.</p>
          <div className="btn-row"><Link className="btn" to="/login">Customer login</Link><Link className="btn btn-quiet" to="/register">Create account</Link></div>
        </section>
        <section className="card">
          <h2>Admin</h2>
          <p className="hint">Accept requests, move orders through each milestone and add notes for the customer.</p>
          <div className="btn-row"><Link className="btn btn-quiet" to="/admin/login">Admin login</Link></div>
        </section>
      </div>
    </>
  );
}
