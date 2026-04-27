// page-tier23.jsx — Tier 2/3 screens (S7-S15) wired to admin.* MCP tools (ADR 0006).
// Screens with missing backends render a DataLimitedBanner; their writes record
// operator intent in the audit chain via Phase 4 record-only tools.

// ───── S7 Providers ─────

function ProvidersPage() {
  const list = useAdmin('admin.providers.list');
  const projects = useAdmin('admin.projects.list');
  const health = useAdmin('admin.health.get');
  const jobs = useAdmin('admin.jobs.list', { limit: 100 });
  const sessions = useAdmin('admin.sessions.list');
  const policy = useAdmin('admin.policy.decisions.list', { effect: 'require_approval', limit: 25 });
  const cpTweaks = useCPTweaks();
  const roleLens = cpTweaks.t.roleLens || 'developer';
  const roleCopy = window.ControlSurfaceModel?.roleCopy ?? (() => ({}));
  const copy = roleCopy(roleLens);
  const [confirmAction, setConfirmAction] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2400); };

  const probe = async (id) => {
    try {
      const r = await window.MCP_CLIENT.callTool('admin.providers.probe', { id, operatorBadge: cpTweaks.t.operatorBadge });
      const sc = r.structuredContent;
      showToast(`${id}: ${sc.reachable ? 'reachable' : 'unreachable'}${sc.latencyMs ? ` · ${sc.latencyMs}ms` : ''}`);
      void list.refetch();
    } catch (err) {
      showToast(`Error: ${err.message ?? err}`);
    }
  };

  const submitRotate = async (reason) => {
    const ca = confirmAction;
    setConfirmAction(null);
    try {
      // We don't know the logical key; this is recorded-only. Use the provider id as the logical key suffix.
      await window.MCP_CLIENT.callTool('admin.secrets.rotate.token', {
        logicalKey: ca.providerId,
        reason,
        operatorBadge: cpTweaks.t.operatorBadge,
      });
      showToast(`Token rotation request recorded for ${ca.providerId}`);
    } catch (err) {
      showToast(`Error: ${err.message ?? err}`);
    }
  };

  return (
    <div className="cp-page wide">
      <PageHead
        eyebrow={copy.providersEyebrow ?? 'providers · health'}
        title={copy.providersTitle ?? 'Provider connections'}
        right={<>
          <div className="meta-block"><span className="k">configured </span><span className="v">{(list.data?.providers ?? []).filter((p) => p.configured).length}</span></div>
        </>}
      />

      <ErrorBlock error={list.error} />
      {list.dataLimited && <DataLimited reason={list.dataLimited.rateLimitHeadroom ?? list.dataLimited.reason} />}

      <RolePortfolioFocus
        role={roleLens}
        projects={projects.data?.projects ?? []}
        jobs={jobs.data?.jobs ?? []}
        sessions={sessions}
        approvals={policy.data?.decisions ?? []}
        loading={list.loading && !list.data}
      />

      {list.loading && !list.data && <LoadingSkeleton rows={3} />}

      <div className="grid-3" style={{ marginTop: 24 }}>
        {(list.data?.providers ?? []).map((p) => (
          <div key={p.id} className="surf">
            <div className="head">
              <span>{p.id}</span>
              <span className="right">
                {p.configured
                  ? <Pill tone={p.reachable ? 'green' : 'red'}>{p.reachable ? 'reachable' : 'unreachable'}</Pill>
                  : <Pill tone="grey">not configured</Pill>}
              </span>
            </div>
            <div style={{ padding: 16, fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-3)' }}>
              <div>kind <strong style={{ color: 'var(--ink-2)' }}>{p.kind}</strong></div>
              <div>latency <strong style={{ color: 'var(--ink-2)' }}>{p.latencyMs !== null ? `${p.latencyMs}ms` : '—'}</strong></div>
              <div>headroom <strong style={{ color: 'var(--ink-2)' }}>—</strong> <span className="muted-mono">(not wired)</span></div>
              {p.details && <div style={{ marginTop: 8, color: 'var(--ink-2)' }}>{p.details}</div>}
            </div>
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line)', display: 'flex', gap: 8 }}>
              <button className="btn sm ghost" onClick={() => probe(p.id)}>Probe</button>
              <button className="btn sm warn" onClick={() => setConfirmAction({
                providerId: p.id,
                title: `Rotate ${p.id} token`,
                body: 'Logs the rotation request. You still need to swap the credential by hand.',
                requireReason: true,
                label: 'Rotate token', danger: false,
              })}>Rotate token</button>
            </div>
          </div>
        ))}
      </div>

      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          body={confirmAction.body}
          requireReason={confirmAction.requireReason}
          danger={confirmAction.danger}
          confirmLabel={confirmAction.label}
          onCancel={() => setConfirmAction(null)}
          onConfirm={submitRotate}
        />
      )}
      {toast && <ToastEl text={toast} />}
    </div>
  );
}

// ───── S8 Sessions ─────

function SessionsPage() {
  const list = useAdmin('admin.sessions.list');
  const projects = useAdmin('admin.projects.list');
  const health = useAdmin('admin.health.get');
  const providers = useAdmin('admin.providers.list');
  const jobs = useAdmin('admin.jobs.list', { limit: 100 });
  const policy = useAdmin('admin.policy.decisions.list', { effect: 'require_approval', limit: 25 });
  const cpTweaks = useCPTweaks();
  const roleLens = cpTweaks.t.roleLens || 'developer';
  const roleCopy = window.ControlSurfaceModel?.roleCopy ?? (() => ({}));
  const copy = roleCopy(roleLens);
  const [confirmAction, setConfirmAction] = useState(null);
  const [toast, setToast] = useState(null);

  const sessions = list.data?.sessions ?? [];
  const projectRows = projects.data?.projects ?? [];
  const jobRows = jobs.data?.jobs ?? [];
  const running = jobRows.filter((j) => j.status === 'running');
  const queued = jobRows.filter((j) => j.status === 'queued');
  const failed = jobRows.filter((j) => j.status === 'failed');
  const approvals = policy.data?.decisions ?? [];
  const enabledCount = sessions.reduce((sum, s) => sum + s.featuresEnabled.length, 0);
  const disabledCount = sessions.reduce((sum, s) => sum + s.featuresDisabled.length, 0);

  const submitTerminate = async (reason) => {
    const ca = confirmAction;
    setConfirmAction(null);
    try {
      await window.MCP_CLIENT.callTool('admin.sessions.terminate', {
        sessionId: ca.sessionId, reason, operatorBadge: cpTweaks.t.operatorBadge,
      });
      setToast(`Terminated session ${ca.sessionId.slice(0, 8)}…`);
      void list.refetch();
    } catch (err) {
      setToast(`Error: ${err.message ?? err}`);
    }
    setTimeout(() => setToast(null), 2400);
  };

  return (
    <div className="cp-page wide">
      <PageHead
        eyebrow={copy.agentsEyebrow ?? 'agents · public MCP'}
        title={copy.agentsTitle ?? 'Agent monitor'}
        right={<>
          <div className="meta-block"><span className="k">active </span><span className="v">{list.data?.totalActive ?? '—'}</span></div>
          <div className="meta-block"><span className="k">cap </span><span className="v">{list.data?.cap ?? '—'}</span></div>
          <div className="meta-block"><span className="k">running </span><span className="v">{running.length}</span></div>
          <div className="meta-block"><span className="k">queued </span><span className="v">{queued.length}</span></div>
        </>}
      />

      <ErrorBlock error={list.error || projects.error || jobs.error || policy.error} />

      <RolePortfolioFocus
        role={roleLens}
        projects={projectRows}
        jobs={jobRows}
        sessions={list}
        approvals={approvals}
        loading={list.loading && !list.data}
      />

      <BuildControlRail
        projects={projectRows}
        jobs={jobRows}
        sessions={list}
        approvals={approvals}
        loading={list.loading && !list.data}
        scope="agent runway"
      />

      <ProviderHealthStrip
        health={health}
        providers={providers}
        loading={(health.loading && !health.data) || (providers.loading && !providers.data)}
      />

      <AgentRunwayPanel
        sessions={sessions}
        jobs={jobRows}
        projects={projectRows}
        approvals={approvals}
      />

      <AgentRoleCatalogPanel />

      <div className="status-strip agent-status-strip" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="status-cell">
          <span className="label">connected agents</span>
          <div className="row"><StatusDot status={sessions.length > 0 ? 'green' : 'grey'} /><span className="name mono">{sessions.length}</span></div>
          <span className="sub">{list.data?.cap !== undefined ? `session cap ${list.data.cap}` : 'waiting for transport'}</span>
        </div>
        <div className="status-cell">
          <span className="label">capabilities</span>
          <div className="row"><StatusDot status={disabledCount > 0 ? 'amber' : 'green'} /><span className="name mono">{enabledCount}</span></div>
          <span className="sub">{disabledCount} disabled</span>
        </div>
        <div className="status-cell">
          <span className="label">build jobs</span>
          <div className="row"><StatusDot status={failed.length > 0 ? 'red' : queued.length > 0 ? 'amber' : 'green'} pulse={failed.length > 0} /><span className="name mono">{running.length + queued.length}</span></div>
          <span className="sub">{running.length} running · {queued.length} queued</span>
        </div>
        <div className="status-cell">
          <span className="label">operator blockers</span>
          <div className="row"><StatusDot status={approvals.length > 0 ? 'amber' : 'green'} /><span className="name mono">{approvals.length}</span></div>
          <span className="sub">pending approvals</span>
        </div>
      </div>

      <div className="grid-2 agent-page-grid">
        <div className="surf">
          <div className="head">
            <span>connected build agents</span>
            <span className="right">{sessions.length} active</span>
          </div>
          {list.loading && !list.data && <div style={{ padding: 16 }}><LoadingSkeleton rows={5} /></div>}
          {!list.loading && sessions.length === 0 && <div className="empty-copy">No active sessions on the agent transport.</div>}
          <div className="agent-session-grid">
            {sessions.map((s) => (
              <div key={s.sessionId} className="agent-card large">
                <div className="agent-card-main">
                  <div className="agent-name">{s.clientName ?? 'unnamed agent'} {s.clientVersion ? `v${s.clientVersion}` : ''}</div>
                  <div className="muted-mono">{s.sessionId.slice(0, 12)}... · protocol {s.protocolVersion}</div>
                  <div className="agent-chip-row">
                    <Pill tone="green">{s.featuresEnabled.length} enabled</Pill>
                    {s.featuresDisabled.length > 0 && <Pill tone="amber">{s.featuresDisabled.length} disabled</Pill>}
                  </div>
                  {s.featuresDisabled.slice(0, 2).map((f) => (
                    <div key={f.feature} className="agent-disabled">
                      <span>{f.feature}</span>
                      <span>{f.reason}</span>
                    </div>
                  ))}
                </div>
                <button className="btn sm danger" onClick={() => setConfirmAction({
                  sessionId: s.sessionId,
                  title: `Terminate session ${s.sessionId.slice(0, 8)}...`,
                  body: 'Removes the session from the registry. Underlying transport closes on next reaper tick (60s).',
                  requireReason: true, label: 'Terminate', danger: true,
                })}>Terminate</button>
              </div>
            ))}
          </div>
        </div>

        <div className="surf">
          <div className="head">
            <span>build queue load</span>
            <span className="right"><a href="#/jobs">open jobs</a></span>
          </div>
          {jobs.loading && !jobs.data && <div style={{ padding: 16 }}><LoadingSkeleton rows={5} /></div>}
          {!jobs.loading && running.length + queued.length === 0 && <div className="empty-copy">No running or queued build jobs.</div>}
          <div className="agent-queue-list roomy">
            {running.concat(queued).slice(0, 8).map((j) => (
              <a key={j.id} href="#/jobs" className="agent-job-row">
                <span className="mono">{j.id.slice(0, 12)}...</span>
                <Pill tone={j.status === 'running' ? 'amber' : 'grey'}>{j.status}</Pill>
                <span className="mono">{j.projectId.slice(0, 8)}...</span>
                <span className="mono">{j.updatedAt.slice(0, 19).replace('T', ' ')}Z</span>
              </a>
            ))}
          </div>
          {failed.length > 0 && (
            <div className="agent-failed-block">
              <div className="label-sm">failed jobs</div>
              {failed.slice(0, 3).map((j) => (
                <a key={j.id} href="#/jobs" className="agent-failed-row">
                  <span className="mono">{j.id.slice(0, 12)}...</span>
                  <span>{j.error ?? 'failed without recorded error'}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="cp-section-head" style={{ marginTop: 36 }}>
        <span className="cp-section-num">sessions</span>
        <h2 className="cp-section-title">MCP negotiation detail</h2>
        <span className="cp-section-blurb">The public transport controls which build agents can read context, call tools, and receive handoff resources.</span>
      </div>
      <table className="cp-table">
        <thead><tr><th>session id</th><th>client</th><th>protocol</th><th>negotiated</th><th>features enabled</th><th>features disabled</th><th></th></tr></thead>
        <tbody>
          {list.loading && !list.data && <tr><td colSpan="7"><LoadingSkeleton rows={3} /></td></tr>}
          {!list.loading && sessions.length === 0 && (
            <tr><td colSpan="7" style={{ color: 'var(--ink-3)', textAlign: 'center', padding: 20 }}>No active sessions on the agent transport.</td></tr>
          )}
          {sessions.map((s) => (
            <tr key={s.sessionId}>
              <td className="mono">{s.sessionId.slice(0, 12)}...</td>
              <td className="mono">{s.clientName ?? '—'} {s.clientVersion ? `v${s.clientVersion}` : ''}</td>
              <td className="mono">{s.protocolVersion}</td>
              <td className="mono">{s.negotiatedAt.slice(0, 19).replace('T', ' ')}Z</td>
              <td className="mono">{s.featuresEnabled.length}</td>
              <td className="mono">{s.featuresDisabled.length}</td>
              <td>
                <button className="btn sm danger" onClick={() => setConfirmAction({
                  sessionId: s.sessionId,
                  title: `Terminate session ${s.sessionId.slice(0, 8)}...`,
                  body: 'Removes the session from the registry. Underlying transport closes on next reaper tick (60s).',
                  requireReason: true, label: 'Terminate', danger: true,
                })}>Terminate</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          body={confirmAction.body}
          requireReason={confirmAction.requireReason}
          danger={confirmAction.danger}
          confirmLabel={confirmAction.label}
          onCancel={() => setConfirmAction(null)}
          onConfirm={submitTerminate}
        />
      )}
      {toast && <ToastEl text={toast} />}
    </div>
  );
}

function AgentRoleCatalogPanel() {
  const catalog = window.ControlSurfaceModel?.agentRoleCatalog?.() ?? [];
  const sourceRepos = [...new Set(catalog.flatMap((agent) => agent.sourceRepos ?? []))];

  if (catalog.length === 0) return null;

  return (
    <section className="agent-role-catalog">
      <div className="agent-role-catalog-head">
        <div>
          <span className="label-sm">agent role catalog</span>
          <strong>{catalog.length} analyzed agents</strong>
          <p>Role definitions from the analyzed code-engine and ops-engine catalogs, mapped to assignment work classes.</p>
        </div>
        <div className="agent-role-source-strip">
          <span>source repos</span>
          {sourceRepos.map((source) => <Pill key={source} tone="blue">{source}</Pill>)}
        </div>
      </div>
      <div className="agent-role-grid">
        {catalog.map((agent) => (
          <article key={agent.id} className="agent-role-card">
            <div className="agent-role-card-head">
              <Icon name="agent" />
              <div>
                <strong>{agent.label}</strong>
                <span className="mono">{agent.id}</span>
              </div>
            </div>
            <p>{agent.description}</p>
            <div className="agent-role-field">
              <span>best for</span>
              <strong>{(agent.bestFor ?? []).join(' · ')}</strong>
            </div>
            <div className="agent-role-chip-row">
              {(agent.workClasses ?? []).map((workClass) => (
                <span key={workClass} className="agent-role-chip">{workClass}</span>
              ))}
            </div>
            <div className="agent-role-avoid">
              <span>avoid</span>
              <small>{agent.avoidFor}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AgentRunwayPanel({ sessions, jobs, projects, approvals }) {
  const readyProjects = (projects ?? []).filter((project) => project.state === 'READY_FOR_BUILD');
  const activeJobs = (jobs ?? []).filter((job) => job.status === 'queued' || job.status === 'running');
  const failedJobs = (jobs ?? []).filter((job) => job.status === 'failed');
  const capabilityRows = agentCapabilityRows(sessions);
  const lanes = window.ControlSurfaceModel
    ? window.ControlSurfaceModel.agentOperationLanes(sessions, jobs, projects, approvals)
    : [];

  return (
    <div className="agent-runway-panel">
      <div className="agent-runway-copy">
        <span className="label-sm">agent runway board</span>
        <strong>{readyProjects.length} handoff lanes</strong>
        <p>{activeJobs.length} active jobs, {failedJobs.length} failed jobs, {(approvals ?? []).length} operator gates.</p>
      </div>
      <div className="agent-runway-grid">
        <div className="agent-runway-card">
          <Icon name="handoff" />
          <span>Ready projects</span>
          <strong>{readyProjects.length}</strong>
          <small>{readyProjects.slice(0, 3).map((project) => project.key).join(', ') || 'none ready'}</small>
        </div>
        <div className="agent-runway-card">
          <Icon name="queue" />
          <span>Active queue</span>
          <strong>{activeJobs.length}</strong>
          <small>{failedJobs.length} failed jobs</small>
        </div>
        <div className="agent-runway-card">
          <Icon name="agent" />
          <span>Connected agents</span>
          <strong>{(sessions ?? []).length}</strong>
          <small>{capabilityRows.enabled} enabled capabilities</small>
        </div>
        <div className="agent-runway-card">
          <Icon name="audit" />
          <span>Gates</span>
          <strong>{(approvals ?? []).length}</strong>
          <small>operator approvals</small>
        </div>
      </div>
      <div className="agent-ops-lanes">
        {lanes.map((lane) => (
          <div key={lane.id} className={`agent-ops-lane ${lane.tone}`}>
            <span>{lane.label}</span>
            <strong>{lane.count}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function agentCapabilityRows(sessions) {
  return (sessions ?? []).reduce((acc, session) => ({
    enabled: acc.enabled + (session.featuresEnabled?.length ?? 0),
    disabled: acc.disabled + (session.featuresDisabled?.length ?? 0),
  }), { enabled: 0, disabled: 0 });
}

// ───── S9 Alerts ─────

function AlertsPage() {
  const list = useAdmin('admin.alerts.list');
  return (
    <div className="cp-page wide">
      <PageHead eyebrow="alerts · firing" title="Active alerts" />
      <DataLimitedBanner reason={list.dataLimited?.reason ?? list.data?.dataLimited?.reason} />
      {(list.data?.alerts ?? []).length === 0 && (
        <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>No alerts firing — alerting layer not wired.</p>
      )}
    </div>
  );
}

// ───── S10 Migrations ─────

function MigrationsPage() {
  const list = useAdmin('admin.migrations.list');
  const cpTweaks = useCPTweaks();
  const [confirmAction, setConfirmAction] = useState(null);
  const [toast, setToast] = useState(null);

  const submitApply = async (reason) => {
    setConfirmAction(null);
    try {
      const r = await window.MCP_CLIENT.callTool('admin.migrations.apply', { reason, operatorBadge: cpTweaks.t.operatorBadge });
      const sc = r.structuredContent;
      setToast(`Applied: ${sc.applied.length}, skipped: ${sc.skipped.length}`);
      void list.refetch();
    } catch (err) {
      setToast(`Error: ${err.message ?? err}`);
    }
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="cp-page wide">
      <PageHead
        eyebrow="schema · migrations"
        title="DB migrations"
        right={<>
          <div className="meta-block"><span className="k">applied </span><span className="v">{list.data?.appliedCount ?? '—'}</span></div>
          <div className="meta-block"><span className="k">pending </span><span className="v">{list.data?.pendingCount ?? '—'}</span></div>
        </>}
      />

      <ErrorBlock error={list.error} />

      <div style={{ marginBottom: 18 }}>
        <button className="btn warn" disabled={(list.data?.pendingCount ?? 0) === 0} onClick={() => setConfirmAction({
          title: 'Apply pending migrations',
          body: `Runs db.migrate() — applies all pending versions in lexical order. Idempotent: already-applied versions are skipped.`,
          requireReason: true, label: 'Apply', danger: true,
        })}>Apply pending</button>
      </div>

      <table className="cp-table">
        <thead><tr><th>version</th><th>status</th><th>size</th><th>primary ops</th></tr></thead>
        <tbody>
          {list.loading && !list.data && <tr><td colSpan="4"><LoadingSkeleton rows={3} /></td></tr>}
          {(list.data?.migrations ?? []).map((m) => (
            <tr key={m.version}>
              <td className="mono">{m.version}</td>
              <td><Pill tone={m.applied ? 'green' : 'amber'}>{m.applied ? 'applied' : 'pending'}</Pill></td>
              <td className="mono num">{m.sizeBytes} B</td>
              <td className="mono">{m.primaryOps.join(', ') || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          body={confirmAction.body}
          requireReason={confirmAction.requireReason}
          danger={confirmAction.danger}
          confirmLabel={confirmAction.label}
          onCancel={() => setConfirmAction(null)}
          onConfirm={submitApply}
        />
      )}
      {toast && <ToastEl text={toast} />}
    </div>
  );
}

// ───── S11 Secrets ─────

function SecretsPage() {
  const list = useAdmin('admin.secrets.list');
  const cpTweaks = useCPTweaks();
  const [confirmAction, setConfirmAction] = useState(null);
  const [drillResult, setDrillResult] = useState(null);
  const [toast, setToast] = useState(null);

  const startDrill = async (kind) => {
    const reason = window.prompt(`Reason for ${kind} rotation drill:`);
    if (!reason || reason.length < 4) return;
    try {
      const tool = kind === 'master' ? 'admin.secrets.rotate.master.start' : 'admin.secrets.rotate.audit.start';
      const r = await window.MCP_CLIENT.callTool(tool, { reason, operatorBadge: cpTweaks.t.operatorBadge });
      setDrillResult(r.structuredContent);
    } catch (err) {
      setToast(`Error: ${err.message ?? err}`);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const submitTokenRotate = async (reason) => {
    const ca = confirmAction;
    setConfirmAction(null);
    try {
      await window.MCP_CLIENT.callTool('admin.secrets.rotate.token', { logicalKey: ca.logicalKey, reason, operatorBadge: cpTweaks.t.operatorBadge });
      setToast(`Rotation request recorded for ${ca.logicalKey}`);
    } catch (err) {
      setToast(`Error: ${err.message ?? err}`);
    }
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="cp-page wide">
      <PageHead
        eyebrow="secrets · metadata"
        title="Tokens + key fingerprints"
        right={<>
          <div className="meta-block"><span className="k">tokens </span><span className="v">{list.data?.tokens?.length ?? '—'}</span></div>
        </>}
      />

      <ErrorBlock error={list.error} />

      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="surf">
          <div className="head"><span>master encryption key</span></div>
          <div style={{ padding: 16, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            <div>id <strong>{list.data?.masterKeyId ?? '—'}</strong></div>
            <DataLimited reason="automated master-key rotation is not implemented; the drill returns a manual checklist" />
            <div style={{ marginTop: 12 }}>
              <button className="btn warn sm" onClick={() => startDrill('master')}>Start rotation drill</button>
            </div>
          </div>
        </div>
        <div className="surf">
          <div className="head"><span>audit signing key</span></div>
          <div style={{ padding: 16, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            <div>id <strong>{list.data?.auditSigningKey?.id ?? '—'}</strong></div>
            <DataLimited reason="automated audit-key rotation is not implemented; the drill returns a manual checklist" />
            <div style={{ marginTop: 12 }}>
              <button className="btn warn sm" onClick={() => startDrill('audit')}>Start rotation drill</button>
            </div>
          </div>
        </div>
      </div>

      <div className="cp-section-head">
        <span className="cp-section-num">tokens</span>
        <h2 className="cp-section-title">Stored tokens (metadata only)</h2>
        <span className="cp-section-blurb">Plaintext is never returned. Only metadata.</span>
      </div>
      <table className="cp-table">
        <thead><tr><th>logical key</th><th>algo</th><th>master key id</th><th>age</th><th>updated</th><th></th></tr></thead>
        <tbody>
          {(list.data?.tokens ?? []).length === 0 && (
            <tr><td colSpan="6" style={{ color: 'var(--ink-3)', textAlign: 'center', padding: 20 }}>No tokens stored.</td></tr>
          )}
          {(list.data?.tokens ?? []).map((t) => (
            <tr key={t.id}>
              <td className="mono">{t.logicalKey}</td>
              <td className="mono">{t.algo}</td>
              <td className="mono">{t.masterKeyId}</td>
              <td className="mono num">{t.ageDays}d</td>
              <td className="mono">{t.updatedAt.slice(0, 19).replace('T', ' ')}Z</td>
              <td>
                <button className="btn sm warn" onClick={() => setConfirmAction({
                  logicalKey: t.logicalKey,
                  title: `Rotate token ${t.logicalKey}`,
                  body: 'Logs the rotation request. Supply the new credential separately.',
                  requireReason: true, label: 'Rotate', danger: false,
                })}>Rotate</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {drillResult && (
        <Modal title={`Rotation drill (${drillResult.drillId.slice(0, 8)}…)`} onClose={() => setDrillResult(null)} footer={
          <button className="btn primary" onClick={() => setDrillResult(null)}>Close</button>
        }>
          <DataLimited reason={drillResult.dataLimited?.reason} />
          <h4>steps</h4>
          <ol style={{ paddingLeft: 20, fontSize: 12.5 }}>
            {(drillResult.steps ?? []).map((s) => (
              <li key={s.index} style={{ marginBottom: 8 }}>
                <strong>{s.title}</strong>
                <div className="muted-mono" style={{ marginTop: 2 }}>{s.action}</div>
              </li>
            ))}
          </ol>
        </Modal>
      )}

      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          body={confirmAction.body}
          requireReason={confirmAction.requireReason}
          danger={confirmAction.danger}
          confirmLabel={confirmAction.label}
          onCancel={() => setConfirmAction(null)}
          onConfirm={submitTokenRotate}
        />
      )}
      {toast && <ToastEl text={toast} />}
    </div>
  );
}

// ───── S12 SLO ─────

function SloPage() {
  const list = useAdmin('admin.slos.list');
  return (
    <div className="cp-page wide">
      <PageHead eyebrow="SLOs · targets" title="Service level objectives" />
      <DataLimitedBanner reason={list.data?.dataLimited?.reason} />
      <table className="cp-table">
        <thead><tr><th>name</th><th>target</th><th>window</th><th>current</th><th>state</th><th>consequence</th></tr></thead>
        <tbody>
          {(list.data?.slos ?? []).map((s) => (
            <tr key={s.name}>
              <td className="mono">{s.name}</td>
              <td className="mono">{s.target}</td>
              <td className="mono">{s.window}</td>
              <td className="mono">—</td>
              <td>—</td>
              <td>{s.consequence}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: 16, color: 'var(--ink-3)', fontSize: 12 }}>
        Source: <span className="mono">{list.data?.source ?? '—'}</span>
      </p>
    </div>
  );
}

// ───── S13 Capacity ─────

function CapacityPage() {
  const cap = useAdmin('admin.capacity.get');
  return (
    <div className="cp-page wide">
      <PageHead eyebrow="capacity" title="Capacity + cost" />
      <ErrorBlock error={cap.error} />
      <div className="status-strip" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="status-cell">
          <span className="label">sessions</span>
          <div className="row">
            <span className="name mono">{cap.data?.sessions?.current ?? '—'} / {cap.data?.sessions?.cap ?? '—'}</span>
          </div>
          <span className="sub">{cap.data?.sessions?.pctUsed ?? '—'}% used</span>
        </div>
        <div className="status-cell">
          <span className="label">queue</span>
          <div className="row"><span className="name mono">{cap.data?.jobs?.queued ?? '—'} queued</span></div>
          <span className="sub">{cap.data?.jobs?.running ?? '—'} running</span>
        </div>
        <div className="status-cell">
          <span className="label">cost</span>
          <div className="row"><span className="name mono">—</span></div>
          <span className="sub">data limited</span>
        </div>
      </div>
      <DataLimitedBanner reason={cap.data?.dataLimited?.reason} />
    </div>
  );
}

// ───── S14 DR ─────

function DrPage() {
  const upcoming = useAdmin('admin.dr.upcoming.list');
  const past = useAdmin('admin.dr.drills.list');
  const cpTweaks = useCPTweaks();
  const [scheduling, setScheduling] = useState(false);
  const [toast, setToast] = useState(null);

  const submit = async (reason) => {
    const scenario = window.prompt('DR scenario name:');
    if (!scenario) { setScheduling(false); return; }
    setScheduling(false);
    try {
      await window.MCP_CLIENT.callTool('admin.dr.drills.schedule', { scenario, reason, operatorBadge: cpTweaks.t.operatorBadge });
      setToast(`DR drill request recorded for "${scenario}"`);
    } catch (err) {
      setToast(`Error: ${err.message ?? err}`);
    }
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="cp-page wide">
      <PageHead eyebrow="DR · drills" title="Disaster recovery drills" />
      <DataLimitedBanner reason={upcoming.data?.dataLimited?.reason} />
      <button className="btn warn" onClick={() => setScheduling(true)}>Schedule drill</button>
      <div className="cp-section-head" style={{ marginTop: 24 }}>
        <span className="cp-section-num">upcoming</span>
        <h2 className="cp-section-title">Scheduled drills</h2>
      </div>
      <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>{(upcoming.data?.items ?? []).length === 0 ? 'No drills scheduled.' : ''}</p>
      <div className="cp-section-head">
        <span className="cp-section-num">history</span>
        <h2 className="cp-section-title">Past drills</h2>
      </div>
      <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>{(past.data?.items ?? []).length === 0 ? 'No drill history.' : ''}</p>

      {scheduling && (
        <ConfirmModal
          title="Schedule DR drill"
          body="Logs the drill request. The DR scheduler is not wired yet."
          requireReason
          confirmLabel="Schedule"
          onCancel={() => setScheduling(false)}
          onConfirm={submit}
        />
      )}
      {toast && <ToastEl text={toast} />}
    </div>
  );
}

// ───── S15 Settings ─────

function SettingsPage() {
  const env = useAdmin('admin.config.env.get');
  const flags = useAdmin('admin.config.flags.list');
  const cpTweaks = useCPTweaks();
  const [confirmAction, setConfirmAction] = useState(null);
  const [toast, setToast] = useState(null);

  const submitToggle = async (reason) => {
    const ca = confirmAction;
    setConfirmAction(null);
    try {
      await window.MCP_CLIENT.callTool('admin.config.flags.toggle', {
        flagEnvVar: ca.envVar,
        to: ca.to,
        reason,
        operatorBadge: cpTweaks.t.operatorBadge,
      });
      setToast(`Toggle recorded for ${ca.envVar} → ${ca.to}`);
    } catch (err) {
      setToast(`Error: ${err.message ?? err}`);
    }
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="cp-page wide">
      <PageHead
        eyebrow="settings · config"
        title="Environment + feature flags"
        right={<>
          <div className="meta-block"><span className="k">tier </span><span className="v">{env.data?.deployment?.tier ?? '—'}</span></div>
        </>}
      />
      <ErrorBlock error={env.error || flags.error} />

      <div className="cp-section-head">
        <span className="cp-section-num">env config</span>
        <h2 className="cp-section-title">Effective configuration</h2>
        <span className="cp-section-blurb">Non-sensitive only. Secrets are never returned.</span>
      </div>
      {env.data && (
        <table className="cp-table">
          <tbody>
            <tr><th>service</th><td className="mono">{env.data.serverInfo.name} v{env.data.serverInfo.version}</td></tr>
            <tr><th>transport</th><td className="mono">{env.data.transport}</td></tr>
            <tr><th>http</th><td className="mono">{env.data.http.host}:{env.data.http.port} (max {env.data.http.maxConcurrentSessions} sessions, ttl {env.data.http.sessionTtlSeconds}s)</td></tr>
            <tr><th>mgmt</th><td className="mono">{env.data.mgmt.host}:{env.data.mgmt.port}</td></tr>
            <tr><th>tier</th><td className="mono">{env.data.deployment.tier}</td></tr>
            <tr><th>NODE_ENV</th><td className="mono">{env.data.deployment.nodeEnv}</td></tr>
            <tr><th>log level</th><td className="mono">{env.data.logging.level}</td></tr>
            <tr><th>log file</th><td className="mono">{env.data.logging.filePath}</td></tr>
          </tbody>
        </table>
      )}

      <div className="cp-section-head" style={{ marginTop: 32 }}>
        <span className="cp-section-num">feature flags</span>
        <h2 className="cp-section-title">Milestone flags</h2>
        <span className="cp-section-blurb">Toggling logs the request. To make it stick, edit the env file and restart.</span>
      </div>
      <DataLimited reason="feature flags come from env vars; toggles are logged but won't take effect until restart" />
      <table className="cp-table">
        <thead><tr><th>flag</th><th>env var</th><th>state</th><th>description</th><th></th></tr></thead>
        <tbody>
          {(flags.data?.flags ?? []).map((f) => (
            <tr key={f.name}>
              <td className="mono">{f.name}</td>
              <td className="mono">{f.envVar}</td>
              <td><Pill tone={f.enabled ? 'green' : 'grey'}>{f.enabled ? 'on' : 'off'}</Pill></td>
              <td>{f.description}</td>
              <td>
                <button className="btn sm ghost" onClick={() => setConfirmAction({
                  envVar: f.envVar, to: !f.enabled,
                  title: `Toggle ${f.envVar} → ${!f.enabled}`,
                  body: `Logs the toggle. To make it stick, edit the env file and restart the orchestrator.`,
                  requireReason: true, label: 'Toggle', danger: false,
                })}>Toggle</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          body={confirmAction.body}
          requireReason={confirmAction.requireReason}
          danger={confirmAction.danger}
          confirmLabel={confirmAction.label}
          onCancel={() => setConfirmAction(null)}
          onConfirm={submitToggle}
        />
      )}
      {toast && <ToastEl text={toast} />}
    </div>
  );
}

function ToastEl({ text }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: 'var(--ink)', color: '#fff', padding: '10px 18px',
      fontFamily: 'var(--font-mono)', fontSize: 12, zIndex: 200,
    }}>{text}</div>
  );
}

Object.assign(window, {
  ProvidersPage, SessionsPage, AlertsPage, MigrationsPage, SecretsPage,
  SloPage, CapacityPage, DrPage, SettingsPage, AgentRunwayPanel, AgentRoleCatalogPanel,
});
