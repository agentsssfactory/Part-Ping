import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, fmtWhen } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import { StatusBadge, Flash } from "../../components/Common.jsx";

export default function Dashboard() {
  const { labels } = useAuth();
  const nav = useNavigate();
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [err, setErr] = useState("");
  useEffect(() => {
    Promise.all([api("/admin/stats"), api("/admin/orders?status=active")])
      .then(([s, o]) => { setStats(s); setRecent(o.orders.slice(0, 8)); })
      .catch((e) => setErr(e.message));
  }, []);
  const c = stats?.counts || {};
  const inFlight = (c.dispatched || 0) + (c.in_transit || 0) + (c.out_for_delivery || 0);
  return (
    <>
      <div className="page-head"><h1>Admin dashboard</h1><p className="lede">Orders waiting on you, and everything in motion.</p></div>
      <Flash>{err}</Flash>
      {stats && (
        <div className="stats">
          <div className="stat"><b>{c.requested || 0}</b><span>New requests</span></div>
          <div className="stat"><b>{(c.accepted || 0) + (c.processing || 0)}</b><span>Accepted / processing</span></div>
          <div className="stat"><b>{inFlight}</b><span>On the way</span></div>
          <div className="stat"><b>{c.delivered || 0}</b><span>Delivered</span></div>
        </div>
      )}
      <section className="card table-wrap">
        <div className="seq-head" style={{ marginBottom: 0 }}><h2>Active orders</h2><Link to="/admin/orders">View all →</Link></div>
        {recent.length === 0 ? <p className="empty">Nothing active right now.</p> : (
          <table>
            <thead><tr><th>Order</th><th>Customer</th><th>Part</th><th>Status</th><th>Updated</th></tr></thead>
            <tbody>
              {recent.map((o) => (
                <tr key={o.code} className="click" onClick={() => nav(`/admin/orders/${o.code}`)}>
                  <td><Link className="mono" to={`/admin/orders/${o.code}`}>{o.code}</Link></td>
                  <td>{o.customer_name}</td><td>{o.part_name}</td>
                  <td><StatusBadge status={o.status} /></td><td>{fmtWhen(o.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <p className="hint">{stats?.customers ?? 0} registered customers · {stats?.total ?? 0} orders total{labels.cancelled && c.cancelled ? ` · ${c.cancelled} cancelled` : ""}</p>
    </>
  );
}
