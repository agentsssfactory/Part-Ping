import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, fmtWhen } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import { StatusBadge, Flash } from "../../components/Common.jsx";

export default function AdminOrders() {
  const { milestones } = useAuth();
  const nav = useNavigate();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [orders, setOrders] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      api(`/admin/orders?status=${status}&q=${encodeURIComponent(q)}`).then((d) => setOrders(d.orders)).catch((e) => setErr(e.message));
    }, 200);
    return () => clearTimeout(t);
  }, [status, q]);

  const tabs = [["", "All"], ["active", "Active"], ...milestones.map((m) => [m.key, m.label]), ["cancelled", "Cancelled"]];
  return (
    <>
      <div className="page-head"><h1>All orders</h1></div>
      <Flash>{err}</Flash>
      <div className="filters">
        {tabs.map(([k, l]) => <button key={k} className={status === k ? "is-on" : ""} onClick={() => setStatus(k)}>{l}</button>)}
      </div>
      <input className="search" placeholder="Search code, part, customer…" value={q} onChange={(e) => setQ(e.target.value)} />
      <section className="card table-wrap">
        {orders && !orders.length ? <p className="empty">No orders match.</p> : (
          <table>
            <thead><tr><th>Order</th><th>Customer</th><th>Part</th><th>Qty</th><th>Status</th><th>Updated</th></tr></thead>
            <tbody>
              {orders?.map((o) => (
                <tr key={o.code} className="click" onClick={() => nav(`/admin/orders/${o.code}`)}>
                  <td><Link className="mono" to={`/admin/orders/${o.code}`}>{o.code}</Link></td>
                  <td>{o.customer_name}</td><td>{o.part_name}</td><td>{o.quantity}</td>
                  <td><StatusBadge status={o.status} /></td><td>{fmtWhen(o.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
