// page-audit.jsx — S5 Audit chain viewer (ADR 0006).

function AuditPage() {
  const head = useAdmin('admin.audit.head');
  const cpTweaks = useCPTweaks();
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [limit, setLimit] = useState(100);

  const listArgs = {};
  if (outcomeFilter) listArgs.outcome = outcomeFilter;
  if (projectFilter) listArgs.projectId = projectFilter;
  if (limit) listArgs.limit = limit;
  const list = useAdmin('admin.audit.list', listArgs);

  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);

  const runVerify = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const result = await window.MCP_CLIENT.callTool('admin.audit.verify', {
        operatorBadge: cpTweaks.t.operatorBadge,
      });
      setVerifyResult(result.structuredContent);
      void head.refetch();
      void list.refetch();
    } catch (err) {
      setVerifyResult({ ok: false, error: err.message ?? String(err) });
    } finally {
      setVerifying(false);
    }
  };

  const integrity = head.data?.verification;
  const integrityStatus = integrity ? (integrity.ok ? 'green' : 'red') : 'grey';
  const integrityLabel = integrity ? (integrity.ok ? 'verified' : `${integrity.mismatchCount} mismatch(es)`) : 'unknown';

  return (
    <div className="cp-page wide">
      <PageHead
        eyebrow="audit · chain"
        title="Audit chain viewer"
        right={<>
          <div className="meta-block"><span className="k">length </span><span className="v">{head.data?.systemChainLength ?? '—'}</span></div>
          <div className="meta-block"><span className="k">signing key </span><span className="v mono">{head.data?.signingKeyId ?? '—'}</span></div>
        </>}
      />

      <ErrorBlock error={head.error || list.error} />

      {/* Integrity banner */}
      <div className="status-strip" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
        <div className="status-cell">
          <span className="label">integrity</span>
          <div className="row">
            <StatusDot status={integrityStatus} pulse={integrityStatus === 'red'} />
            <span className="name">{integrityLabel}</span>
          </div>
          <span className="sub">{integrity ? `${integrity.entriesChecked} entries verified` : 'verifier has not run'}</span>
        </div>
        <div className="status-cell">
          <span className="label">last verified</span>
          <div className="row">
            <span className="name mono">{head.data?.lastVerifiedAt?.slice(11, 19) ?? '—'}</span>
          </div>
          <span className="sub">{head.data?.lastVerifiedAt?.slice(0, 10) ?? ''}</span>
        </div>
        <div className="status-cell">
          <span className="label">verifier</span>
          <button className="btn primary sm" disabled={verifying} onClick={runVerify} style={{ marginTop: 6 }}>
            {verifying ? 'Verifying…' : 'Run verify'}
          </button>
          {verifyResult && (
            <div style={{ marginTop: 8, fontSize: 11, color: verifyResult.ok ? 'var(--status-done)' : 'var(--sev-p0)' }}>
              {verifyResult.ok
                ? `verified ${verifyResult.entriesChecked} entries`
                : `failed: ${verifyResult.error ?? `${verifyResult.mismatches?.length ?? '?'} mismatch(es)`}`}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="pill-group">
          {['', 'allow', 'deny', 'failure'].map((o) => (
            <button key={o} className={o === outcomeFilter ? 'on' : ''} onClick={() => setOutcomeFilter(o)}>
              {o || 'all outcomes'}
            </button>
          ))}
        </div>
        <input
          className="search"
          style={{ minWidth: 260, padding: 4, fontFamily: 'var(--font-mono)', fontSize: 11.5, border: '1px solid var(--line-strong)' }}
          placeholder="filter by project id…"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
        />
        <select className="select" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
          <option value={50}>limit 50</option>
          <option value={100}>limit 100</option>
          <option value={200}>limit 200</option>
        </select>
      </div>

      <table className="cp-table">
        <thead><tr><th>timestamp</th><th>actor</th><th>tool</th><th>outcome</th><th>project</th><th>prev hash</th><th>signing key</th></tr></thead>
        <tbody>
          {list.loading && !list.data && <tr><td colSpan="7"><LoadingSkeleton rows={5} /></td></tr>}
          {!list.loading && (list.data?.entries ?? []).length === 0 && (
            <tr><td colSpan="7" style={{ color: 'var(--ink-3)', textAlign: 'center', padding: 20 }}>No entries match the current filters.</td></tr>
          )}
          {(list.data?.entries ?? []).map((e) => (
            <tr key={e.id}>
              <td className="ts mono">{e.timestamp.slice(0, 19).replace('T', ' ')}Z</td>
              <td className="actor mono">{e.actor}</td>
              <td className="op mono">{e.toolName}</td>
              <td><OutcomePill outcome={e.outcome} /></td>
              <td className="mono">{e.projectId ? e.projectId.slice(0, 8) + '…' : '—'}</td>
              <td className="hash mono">{e.prevHash ? e.prevHash.slice(0, 12) + '…' : '—'}</td>
              <td className="hash mono">{e.signatureKeyId || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

Object.assign(window, { AuditPage });
