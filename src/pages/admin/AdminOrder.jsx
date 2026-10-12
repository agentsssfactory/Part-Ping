import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, fmtWhen } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import { StatusBadge, Tracker, Flash } from "../../components/Common.jsx";

export default function AdminOrder() {
  const { code } = useParams();
  const { milestones, labels } = useAuth();
  const [order, setOrder] = useState(null);
  const [next, setNext] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api(`/admin/orders/${code}`).then((d) => setOrder(d.order)).catch((e) => setErr(e.message)), [code]);
  useEffect(() => { load(); }, [load]);

  // Only forward milestones are offered; default to the very next one.
  const idx = order ? milestones.findIndex((m) => m.key === order.status) : -1;
  const forward = order && order.status !== "cancelled" ? milestones.slice(idx + 1) : [];
  useEffect(() => { setNext(forward[0]?.key || ""); }, [order?.status, milestones.length]); // eslint-disable-line

  const submit = async (status) => {
    setErr(""); setOk(""); setBusy(true);
    try {
      const d = await api(`/admin/orders/${code}/status`, { method: "POST", body: { status, note } });
      setOrder(d.order); setNote(""); setOk(`Logged “${labels[status]}” at ${fmtWhen(d.order.updated_at)}.`);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  if (!order) return <><Flash>{err}</Flash>{!err && <p className="hint">Loading…</p>}<p><Link to="/admin/orders">← All orders</Link></p></>;
  const closed = ["delivered", "cancelled"].includes(order.status);

  return (
    <>
      <p className="crumb"><Link to="/admin/orders">All orders</Link> · <span className="mono">{order.code}</span></p>
      <div className="two-col">
        <div>
          <section className="card">
            <div className="seq-head"><div><h1 style={{ fontSize: "1.6rem" }}>{order.part_name}</h1><p className="lede">Qty {order.quantity}{order.part_number ? ` · ${order.part_number}` : ""}</p></div><StatusBadge status={order.status} /></div>
            <dl className="facts" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div><dt>Customer</dt><dd>{order.customer_name}</dd></div>
              <div><dt>Email</dt><dd><a href={`mailto:${order.customer_email}`}>{order.customer_email}</a></dd></div>
              <div style={{ gridColumn: "1 / -1" }}><dt>Delivery address</dt><dd className="body">{order.delivery_address}</dd></div>
              {order.notes && <div style={{ gridColumn: "1 / -1" }}><dt>Customer notes</dt><dd className="body">{order.notes}</dd></div>}
              <div><dt>Requested</dt><dd>{fmtWhen(order.created_at)}</dd></div>
              <div><dt>Updated</dt><dd>{fmtWhen(order.updated_at)}</dd></div>
            </dl>
          </section>

          <section className="card">
            <h2>Update delivery status</h2>
            <Flash>{err}</Flash><Flash kind="ok">{ok}</Flash>
            {closed ? <p className="hint">This order is {order.status} — no further updates.</p> : (
              <div className="update-form stack">
                <label>Next milestone
                  <select value={next} onChange={(e) => setNext(e.target.value)}>
                    {forward.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                </label>
                <label>Note for the customer (optional)
                  <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="e.g. Courier AWB 77120934, ETA tomorrow" />
                </label>
                <div className="next-btns">
                  <button className="btn" disabled={busy || !next} onClick={() => submit(next)}>Log “{labels[next] || "…"}”</button>
                  <button className="btn btn-danger" disabled={busy} onClick={() => confirm("Cancel this order?") && submit("cancelled")}>Cancel order</button>
                </div>
                <p className="hint" style={{ margin: 0 }}>The date and time are recorded automatically when you save.</p>
              </div>
            )}
          </section>
        </div>
        <section className="card"><h2>Milestone log</h2><Tracker order={order} /></section>
      </div>
    </>
  );
}
