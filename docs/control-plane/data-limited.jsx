// Two presentations for ADR 0006's data-limited contract:
//   <DataLimited reason="..." />          inline pill (use beside a section title)
//   <DataLimitedBanner reason="..." />    full-width strip (use at the top of a screen)
//
// `reason` should be the string the admin tool returned in `dataLimited.reason`
// — never something the UI invents. If reason is null/undefined the components
// render nothing.

function DataLimited({ reason }) {
  if (!reason) return null;
  return (
    <span className="data-limited-pill" title={reason}>
      <span className="dl-tag">data limited</span>
      <span className="dl-reason">{reason}</span>
    </span>
  );
}

function DataLimitedBanner({ reason }) {
  if (!reason) return null;
  return (
    <div className="data-limited-banner">
      <span className="dl-tag">data limited</span>
      <span className="dl-reason">{reason}</span>
    </div>
  );
}

function LoadingSkeleton({ rows = 3 }) {
  const arr = Array.from({ length: rows });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {arr.map((_, i) => <div className="skel" key={i} style={{ width: `${80 - i * 10}%` }} />)}
    </div>
  );
}

function ErrorBlock({ error }) {
  if (!error) return null;
  return (
    <div className="error-block">
      <div className="eyebrow-mono" style={{ color: "var(--sev-p0)", marginBottom: 6 }}>tool error</div>
      <div className="mono" style={{ fontSize: 12, color: "var(--ink-2)" }}>{String(error.message ?? error)}</div>
    </div>
  );
}

Object.assign(window, { DataLimited, DataLimitedBanner, LoadingSkeleton, ErrorBlock });
