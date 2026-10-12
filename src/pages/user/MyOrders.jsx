import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, fmtWhen } from "../../api.js";
import { StatusBadge, Flash } from "../../components/Common.jsx";

export default function MyOrders() {
  const [orders, setOrders] = useState(null);
  const [err, setErr] = useState("");
  const nav = useNavigate();
  useEffect(() => { api("/orders").then((d) => setOrders(d.orders)).catch((e) => setErr(e.message)); }, []);
  return (
    <>
      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
        <div><h1>My orders</h1><p className="lede">Open an order to see every delivery milestone.</p></div>
        <Link className="btn" to="/orders/new">Request a part</Link>
      </div>
      <Flash>{err}</Flash>
      {orders && !orders.length && <section className="card"><p className="empty">No orders yet. Request your first part.</p></section>}
      {orders?.length > 0 && (
        <section className="card table-wrap">
          <table>
            <thead><tr><th>Order</th><th>Part</th><th>Qty</th><th>Status</th><th>Last update</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.code} className="click" onClick={() => nav(`/orders/${o.code}`)}>
                  <td><Link className="mono" to={`/orders/${o.code}`}>{o.code}</Link></td>
                  <td>{o.part_name}</td><td>{o.quantity}</td>
                  <td><StatusBadge status={o.status} /></td>
                  <td>{fmtWhen(o.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
