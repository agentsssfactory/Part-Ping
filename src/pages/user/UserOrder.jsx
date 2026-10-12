import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, fmtWhen } from "../../api.js";
import { StatusBadge, Tracker, Flash } from "../../components/Common.jsx";

export default function UserOrder() {
  const { code } = useParams();
  const [order, setOrder] = useState(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => api(`/orders/${code}`).then((d) => setOrder(d.order)).catch((e) => setErr(e.message)), [code]);
  useEffect(() => {
    load();
    const t = setInterval(load, 15000); // pick up admin updates without a refresh
    return () => clearInterval(t);
  }, [load]);

  const cancel = async () => {
    if (!confirm("Cancel this request?")) return;
    setErr("");
    try { await api(`/orders/${code}/cancel`, { method: "POST" }); load(); } catch (e) { setErr(e.message); }
  };

  if (!order) return <><Flash>{err}</Flash>{!err && <p className="hint">Loading…</p>}<p><Link to="/orders">← My orders</Link></p></>;
  const canCancel = ["requested", "accepted"].includes(order.status);
  return (
    <>
      <p className="crumb"><Link to="/orders">My orders</Link> · <span className="mono">{order.code}</span></p>
      <Flash>{err}</Flash>
      <div className="two-col">
        <section className="card">
          <h2>Delivery progress</h2>
          <Tracker order={order} />
        </section>
        <section className="card">
          <div className="seq-head"><div><h2>{order.part_name}</h2><p className="hint mono">{order.code}</p></div><StatusBadge status={order.status} /></div>
          <dl className="facts" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {order.part_number && <div><dt>Part no.</dt><dd>{order.part_number}</dd></div>}
            <div><dt>Quantity</dt><dd>{order.quantity}</dd></div>
            <div><dt>Requested</dt><dd>{fmtWhen(order.created_at)}</dd></div>
            <div><dt>Last update</dt><dd>{fmtWhen(order.updated_at)}</dd></div>
            <div style={{ gridColumn: "1 / -1" }}><dt>Delivery address</dt><dd className="body">{order.delivery_address}</dd></div>
            {order.notes && <div style={{ gridColumn: "1 / -1" }}><dt>Notes</dt><dd className="body">{order.notes}</dd></div>}
          </dl>
          <p className="hint">Share tracking: <Link to={`/track/${order.code}`}>/track/{order.code}</Link></p>
          {canCancel && <div className="btn-row"><button className="btn btn-quiet" onClick={cancel}>Cancel request</button></div>}
        </section>
      </div>
    </>
  );
}
