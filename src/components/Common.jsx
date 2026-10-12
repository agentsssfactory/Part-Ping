import { useAuth } from "../auth.jsx";
import { fmtWhen } from "../api.js";

export function StatusBadge({ status }) {
  const { labels } = useAuth();
  return <span className={`badge badge-${status}`}>{labels[status] || status}</span>;
}

export function Flash({ kind = "error", children }) {
  if (!children) return null;
  return <div className={`flash flash-${kind === "ok" ? "ok" : "error"}`} role={kind === "ok" ? "status" : "alert"}>{children}</div>;
}

/**
 * Delivery milestone log. Completed steps show the real date/time they were logged;
 * upcoming steps are greyed out. Admin notes show under each step.
 */
export function Tracker({ order }) {
  const { milestones } = useAuth();
  const byStatus = new Map();
  for (const l of order.logs) byStatus.set(l.status, l); // latest log per status
  const cancelled = order.status === "cancelled";
  const reached = milestones.filter((m) => byStatus.has(m.key));
  const lastIdx = reached.length ? milestones.findIndex((m) => m.key === reached[reached.length - 1].key) : -1;

  const steps = milestones.map((m, i) => {
    const log = byStatus.get(m.key);
    let cls = "todo";
    if (log) cls = !cancelled && i === lastIdx && order.status !== "delivered" ? "current" : "done";
    return { m, log, cls };
  });
  // Show only reached steps when cancelled, then the cancel entry
  const shown = cancelled ? steps.filter((s) => s.log) : steps;
  const cancelLog = byStatus.get("cancelled");

  return (
    <ol className="tracker">
      {shown.map(({ m, log, cls }) => (
        <li key={m.key} className={cls}>
          <span className="dot">{cls === "done" ? "✓" : ""}</span>
          <div>
            <div className="t-label">{m.label}</div>
            {log ? <div className="t-when">{fmtWhen(log.created_at)}</div> : <div className="t-when">Pending</div>}
          </div>
          {log?.note && <div className="t-note">{log.note}{log.actor && <span className="t-by"> — {log.actor}</span>}</div>}
        </li>
      ))}
      {cancelled && cancelLog && (
        <li className="cancelled">
          <span className="dot">✕</span>
          <div>
            <div className="t-label">Cancelled</div>
            <div className="t-when">{fmtWhen(cancelLog.created_at)}</div>
          </div>
          {cancelLog.note && <div className="t-note">{cancelLog.note}</div>}
        </li>
      )}
    </ol>
  );
}
