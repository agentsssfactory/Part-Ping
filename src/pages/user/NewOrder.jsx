import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api.js";
import { Flash } from "../../components/Common.jsx";

export default function NewOrder() {
  const nav = useNavigate();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    const f = Object.fromEntries(new FormData(e.target));
    try { const { code } = await api("/orders", { method: "POST", body: f }); nav(`/orders/${code}`); }
    catch (ex) { setErr(ex.message); setBusy(false); }
  };
  return (
    <>
      <p className="crumb"><Link to="/orders">My orders</Link> · New request</p>
      <section className="card" style={{ maxWidth: "36rem" }}>
        <h1>Request a part</h1>
        <p className="lede" style={{ marginBottom: "1rem" }}>Once submitted, our team will review and accept your request.</p>
        <form className="stack" onSubmit={submit}>
          <Flash>{err}</Flash>
          <label>Part name *<input name="part_name" required maxLength={200} placeholder="e.g. Condenser fan motor" /></label>
          <label>Part number / model<input name="part_number" maxLength={100} /></label>
          <label>Quantity *<input name="quantity" type="number" min={1} max={1000} defaultValue={1} required /></label>
          <label>Delivery address *<textarea name="delivery_address" rows={3} required maxLength={500} /></label>
          <label>Notes<textarea name="notes" rows={2} maxLength={1000} placeholder="Anything we should know?" /></label>
          <button className="btn" disabled={busy}>{busy ? "Submitting…" : "Submit request"}</button>
        </form>
      </section>
    </>
  );
}
