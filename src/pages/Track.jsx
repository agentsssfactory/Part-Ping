import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import { StatusBadge, Tracker, Flash } from "../components/Common.jsx";

export default function Track() {
  const { code } = useParams();
  const nav = useNavigate();
  const [input, setInput] = useState(code || "");
  const [order, setOrder] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setOrder(null); setErr("");
    if (!code) return;
    let live = true;
    api(`/track/${encodeURIComponent(code)}`).then((d) => live && setOrder(d.order)).catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, [code]);

  return (
    <>
      <div className="page-head"><h1>Track an order</h1><p className="lede">Enter the tracking code from your confirmation.</p></div>
      <form className="track-form" style={{ marginBottom: "1rem" }} onSubmit={(e) => { e.preventDefault(); input.trim() && nav(`/track/${input.trim().toUpperCase()}`); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="PP-XXXXXXXX" aria-label="Tracking code" />
        <button className="btn">Track</button>
      </form>
      <Flash>{err}</Flash>
      {order && (
        <section className="card public-card" style={{ maxWidth: "36rem", margin: 0 }}>
          <div className="seq-head">
            <div><h2>{order.part_name}</h2><p className="hint mono">{order.code} · Qty {order.quantity}</p></div>
            <StatusBadge status={order.status} />
          </div>
          <Tracker order={order} />
        </section>
      )}
    </>
  );
}
