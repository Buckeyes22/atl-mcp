// page-jobs-policy.jsx — S4 Jobs + S6 Policy approvals (ADR 0006).

const JOB_FILTERS = ['all', 'queued', 'running', 'completed', 'failed'];

function JobsPage() {
  const list = useAdmin('admin.jobs.list', { limit: 100 });
  const projects = useAdmin('admin.projects.list');
  const health = useAdmin('admin.health.get');
  const providers = useAdmin('admin.providers.list');
  const sessions = useAdmin('admin.sessions.list');
  const policy = useAdmin('admin.policy.decisions.list', { effect: 'require_approval', limit: 25 });
  const cpTweaks = useCPTweaks();
  const roleLens = cpTweaks.t.roleLens || 'developer';
  const roleCopy = window.ControlSurfaceModel?.roleCopy ?? (() => ({}));
  const copy = roleCopy(roleLens);
  const [filter, setFilter] = useState('all');
  const [selectedJob, setSelectedJob] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2400); };
  const all = list.data?.jobs ?? [];
  const projectRows = projects.data?.projects ?? [];
  const approvals = policy.data?.decisions ?? [];
  const filtered = filter === 'all' ? all : all.filter((j) => j.status === filter);

  const counts = {
    all: all.length,
    queued: all.filter((j) => j.status === 'queued').length,
    running: all.filter((j) => j.status === 'running').length,
    completed: all.filter((j) => j.status === 'completed').length,
    failed: all.filter((j) => j.status === 'failed').length,
  };

  const submitWrite = async ({ tool, args, successLabel }) => {
    const ca = confirmAction;
    setConfirmAction(null);
    try {
      await window.MCP_CLIENT.callTool(tool, args);
      showToast(successLabel);
      void list.refetch();
      if (ca?.kind === 'cancel' || ca?.kind === 'retry') setSelectedJob(null);
    } catch (err) {
      showToast(`Error: ${err.message ?? err}`);
    }
  };

  return (
    <div className="cp-page wide">
      <PageHead
        eyebrow={copy.queueEyebrow ?? 'build · queue'}
        title={copy.queueTitle ?? 'Build queue'}
        right={<>
          <div className="meta-block"><span className="k">queued </span><span className="v">{counts.queued}</span></div>
          <div className="meta-block"><span className="k">running </span><span className="v">{counts.running}</span></div>
          <div className="meta-block"><span className="k">failed </span><span className="v">{counts.failed}</span></div>
        </>}
      />

      <ErrorBlock error={list.error || projects.error || sessions.error || policy.error} />

      <RolePortfolioFocus
        role={roleLens}
        projects={projectRows}
        jobs={all}
        sessions={sessions}
        approvals={approvals}
        loading={list.loading && !list.data}
      />

      <BuildControlRail
        projects={projectRows}
        jobs={all}
        sessions={sessions}
        approvals={approvals}
        loading={list.loading && !list.data}
        scope="queue control"
      />

      <ProviderHealthStrip
        health={health}
        providers={providers}
        loading={(health.loading && !health.data) || (providers.loading && !providers.data)}
      />

      <QueueRunwayPanel
        jobs={all}
        projects={projectRows}
        sessions={sessions}
        approvals={approvals}
        counts={counts}
        onSelectStatus={setFilter}
      />

      <div className="filter-bar">
        <div className="pill-group">
          {JOB_FILTERS.map((f) => (
            <button key={f} className={f === filter ? 'on' : ''} onClick={() => setFilter(f)}>
              {f}<span className="count">{counts[f]}</span>
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn warn" onClick={() => setConfirmAction({
            kind: 'pause-queue',
            title: 'Pause the queue',
            body: 'Stops picking up new jobs. Jobs already running finish.',
            requireReason: true,
            label: 'Pause queue',
            danger: false,
            tool: 'admin.jobs.queue.pause',
          })}>Pause queue</button>
          <button className="btn ghost" onClick={() => setConfirmAction({
            kind: 'resume-queue',
            title: 'Resume the queue',
            body: 'Starts picking up queued jobs again.',
            requireReason: false,
            label: 'Resume queue',
            danger: false,
            tool: 'admin.jobs.queue.resume',
          })}>Resume queue</button>
        </div>
      </div>

      <table className="cp-table">
        <thead><tr><th>id</th><th>project</th><th>status</th><th>queued</th><th>updated</th><th></th></tr></thead>
        <tbody>
          {list.loading && !list.data && <tr><td colSpan="6"><LoadingSkeleton rows={4} /></td></tr>}
          {!list.loading && filtered.length === 0 && (
            <tr><td colSpan="6" style={{ color: 'var(--ink-3)', textAlign: 'center', padding: 20 }}>
              {all.length === 0 ? 'No provisioning jobs yet.' : 'No jobs match the current filter.'}
            </td></tr>
          )}
          {filtered.map((j) => (
            <tr key={j.id} className={'clickable ' + (selectedJob?.id === j.id ? 'is-selected' : '')} onClick={() => setSelectedJob(j)}>
              <td className="mono">{j.id.slice(0, 8)}…</td>
              <td className="mono">{j.projectId.slice(0, 8)}…</td>
              <td><Pill tone={j.status === 'completed' ? 'green' : j.status === 'failed' ? 'red' : 'amber'}>{j.status}</Pill></td>
              <td className="mono">{j.queuedAt.slice(0, 19).replace('T', ' ')}Z</td>
              <td className="mono">{j.updatedAt.slice(0, 19).replace('T', ' ')}Z</td>
              <td>{j.error && <Pill tone="red">err</Pill>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedJob && (
        <Drawer eyebrow="provisioning job" title={selectedJob.id} onClose={() => setSelectedJob(null)}>
          <div className="eyebrow-mono" style={{ marginBottom: 8 }}>full id</div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 16 }}>{selectedJob.id}</div>
          <div className="eyebrow-mono" style={{ marginBottom: 8 }}>project id</div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 16 }}>{selectedJob.projectId}</div>
          <div className="eyebrow-mono" style={{ marginBottom: 8 }}>status</div>
          <div style={{ marginBottom: 16 }}><Pill tone={selectedJob.status === 'completed' ? 'green' : selectedJob.status === 'failed' ? 'red' : 'amber'}>{selectedJob.status}</Pill></div>
          {selectedJob.error && (
            <>
              <div className="eyebrow-mono" style={{ marginBottom: 8 }}>error</div>
              <div className="mono" style={{ fontSize: 12, color: 'var(--sev-p0)', marginBottom: 16 }}>{selectedJob.error}</div>
            </>
          )}
          <DataLimited reason="cancel and retry are logged but don't yet change the job in the BullMQ queue" />
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn warn" onClick={() => setConfirmAction({
              kind: 'cancel', jobId: selectedJob.id,
              title: `Cancel job ${selectedJob.id.slice(0, 8)}…`,
              body: 'Cancels this job (logged). The job in BullMQ is not changed in v1.',
              requireReason: true, label: 'Cancel job', danger: true,
              tool: 'admin.jobs.cancel',
            })}>Cancel job</button>
            <button className="btn ghost" onClick={() => setConfirmAction({
              kind: 'retry', jobId: selectedJob.id,
              title: `Retry job ${selectedJob.id.slice(0, 8)}…`,
              body: 'Retries this job (logged). v1 does not re-enqueue automatically.',
              requireReason: true, label: 'Retry job', danger: false,
              tool: 'admin.jobs.retry',
            })}>Retry job</button>
          </div>
        </Drawer>
      )}

      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          body={confirmAction.body}
          requireReason={confirmAction.requireReason}
          danger={confirmAction.danger}
          confirmLabel={confirmAction.label}
          onCancel={() => setConfirmAction(null)}
          onConfirm={(reason) => {
            const args = { operatorBadge: cpTweaks.t.operatorBadge };
            if (reason) args.reason = reason;
            if (confirmAction.kind === 'cancel' || confirmAction.kind === 'retry') args.jobId = confirmAction.jobId;
            void submitWrite({ tool: confirmAction.tool, args, successLabel: `${confirmAction.label} recorded` });
          }}
        />
      )}

      {toast && <Toast text={toast} />}
    </div>
  );
}

function QueueRunwayPanel({ jobs, projects, sessions, approvals, counts, onSelectStatus }) {
  const activeAgents = sessions.data?.totalActive ?? 0;
  const readyProjects = (projects ?? []).filter((project) => project.state === 'READY_FOR_BUILD').length;
  const rows = [
    { id: 'queued', label: 'Queued', count: counts.queued, tone: counts.queued > 0 ? 'amber' : 'grey' },
    { id: 'running', label: 'Running', count: counts.running, tone: counts.running > 0 ? 'amber' : 'grey' },
    { id: 'completed', label: 'Completed', count: counts.completed, tone: 'green' },
    { id: 'failed', label: 'Failed', count: counts.failed, tone: counts.failed > 0 ? 'red' : 'grey' },
  ];
  const stageRows = queueStageRows(jobs);

  return (
    <div className="queue-runway-panel">
      <div className="queue-runway-head">
        <div>
          <span className="label-sm">queue runway</span>
          <strong>{counts.running + counts.queued} active jobs</strong>
          <p>{readyProjects} projects are ready for build handoff; {activeAgents} agents are connected.</p>
        </div>
        <div className="queue-runway-meta">
          <Pill tone={(approvals ?? []).length > 0 ? 'amber' : 'green'}>{(approvals ?? []).length} approvals</Pill>
          <a className="btn sm ghost" href="#/sessions">Open agents</a>
        </div>
      </div>
      <div className="queue-status-grid">
        {rows.map((row) => (
          <button key={row.id} type="button" className={`queue-status-card ${row.tone}`} onClick={() => onSelectStatus(row.id)}>
            <span>{row.label}</span>
            <strong>{row.count}</strong>
            <small>{row.id === 'failed' ? 'needs operator review' : row.id === 'completed' ? 'finished work' : 'agent runway'}</small>
          </button>
        ))}
      </div>
      <div className="queue-stage-grid">
        {stageRows.map((row) => (
          <div key={row.id} className="queue-stage-row">
            <Icon name={row.icon} />
            <div>
              <strong>{row.label}</strong>
              <span>{row.detail}</span>
            </div>
            <Pill tone={row.tone}>{row.count}</Pill>
          </div>
        ))}
      </div>
    </div>
  );
}

function queueStageRows(jobs) {
  if (window.ControlSurfaceModel) {
    return window.ControlSurfaceModel.queuePhaseRows(jobs).map((row) => ({
      ...row,
      detail: `${row.active} active, ${row.failed} failed`,
    }));
  }
  return [];
}

function PolicyPage() {
  const list = useAdmin('admin.policy.decisions.list', { limit: 100 });
  const projects = useAdmin('admin.projects.list');
  const health = useAdmin('admin.health.get');
  const providers = useAdmin('admin.providers.list');
  const jobs = useAdmin('admin.jobs.list', { limit: 100 });
  const sessions = useAdmin('admin.sessions.list');
  const cpTweaks = useCPTweaks();
  const roleLens = cpTweaks.t.roleLens || 'developer';
  const roleCopy = window.ControlSurfaceModel?.roleCopy ?? (() => ({}));
  const copy = roleCopy(roleLens);
  const [filter, setFilter] = useState('require_approval');
  const [confirmAction, setConfirmAction] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2400); };
  const all = list.data?.decisions ?? [];
  const projectRows = projects.data?.projects ?? [];
  const jobRows = jobs.data?.jobs ?? [];
  const filtered = filter === 'all' ? all : all.filter((d) => d.effect === filter);

  const submitDecision = async (reason) => {
    const ca = confirmAction;
    setConfirmAction(null);
    try {
      const tool = ca.kind === 'approve' ? 'admin.policy.approve' : 'admin.policy.deny';
      await window.MCP_CLIENT.callTool(tool, { decisionId: ca.id, reason, operatorBadge: cpTweaks.t.operatorBadge });
      showToast(`${ca.kind === 'approve' ? 'Approved' : 'Denied'} ${ca.id.slice(0, 8)}`);
      void list.refetch();
    } catch (err) {
      showToast(`Error: ${err.message ?? err}`);
    }
  };

  return (
    <div className="cp-page wide">
      <PageHead
        eyebrow={copy.approvalsEyebrow ?? 'policy · decisions'}
        title={copy.approvalsTitle ?? 'Approvals and decision history'}
        right={<>
          <div className="meta-block"><span className="k">total </span><span className="v">{all.length}</span></div>
        </>}
      />

      <ErrorBlock error={list.error || projects.error || jobs.error || sessions.error} />

      <RolePortfolioFocus
        role={roleLens}
        projects={projectRows}
        jobs={jobRows}
        sessions={sessions}
        approvals={all.filter((decision) => decision.effect === 'require_approval')}
        loading={list.loading && !list.data}
      />

      <BuildControlRail
        projects={projectRows}
        jobs={jobRows}
        sessions={sessions}
        approvals={all.filter((decision) => decision.effect === 'require_approval')}
        loading={list.loading && !list.data}
        scope="approval gates"
      />

      <ProviderHealthStrip
        health={health}
        providers={providers}
        loading={(health.loading && !health.data) || (providers.loading && !providers.data)}
      />

      <ApprovalGatePanel decisions={all} projects={projectRows} jobs={jobRows} />

      <div className="filter-bar">
        <div className="pill-group">
          {['all', 'require_approval', 'allow', 'deny'].map((f) => (
            <button key={f} className={f === filter ? 'on' : ''} onClick={() => setFilter(f)}>
              {f}<span className="count">{f === 'all' ? all.length : all.filter((d) => d.effect === f).length}</span>
            </button>
          ))}
        </div>
      </div>

      {list.loading && !list.data && <LoadingSkeleton rows={5} />}
      {!list.loading && filtered.length === 0 && (
        <p style={{ color: 'var(--ink-3)', fontSize: 13, marginTop: 24 }}>
          {all.length === 0 ? 'No policy decisions in the database yet.' : 'No decisions match the current filter.'}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
        {filtered.map((a) => (
          <div key={a.id} className={'approval ' + (a.confidenceScore < 0.5 ? 'red-flag' : a.confidenceScore < 0.8 ? 'amber-flag' : '')}>
            <div className="head">
              <span className="id">{a.id.slice(0, 8)}…</span>
              <span className="intent">{a.toolName}</span>
              <Pill tone={a.effect === 'allow' ? 'green' : a.effect === 'deny' ? 'red' : 'amber'}>{a.effect}</Pill>
              <span className="ago">{a.evaluatedAt.slice(0, 19).replace('T', ' ')}Z</span>
            </div>
            <div className="body">
              <div>
                <div className="muted-mono" style={{ marginBottom: 8 }}>
                  {a.projectId ? <>project <strong style={{ color: 'var(--ink-2)' }}>{a.projectId.slice(0, 8)}…</strong></> : 'no project scope'}
                </div>
                <div className="muted-mono" style={{ color: 'var(--ink-2)', fontSize: 12 }}>
                  confidence — {a.confidenceCategorical} · {a.confidenceScore.toFixed(2)}
                </div>
              </div>
              <div className="conf">
                <div className="num">{a.confidenceScore.toFixed(2)}</div>
                <div className="gauge"><div className="fill" style={{ width: `${a.confidenceScore * 100}%`, background: a.confidenceScore < 0.5 ? 'var(--sev-p0)' : a.confidenceScore < 0.8 ? 'var(--sev-p1)' : 'var(--status-done)' }}></div></div>
              </div>
            </div>
            {a.effect === 'require_approval' && (
              <div className="actions">
                <button className="btn sm success" onClick={() => setConfirmAction({ kind: 'approve', id: a.id, title: 'Approve this request', body: 'Allows the request. The decision is logged in the audit chain.', requireReason: true, label: 'Approve', danger: false })}>Approve</button>
                <button className="btn sm danger" onClick={() => setConfirmAction({ kind: 'deny', id: a.id, title: 'Deny this request', body: 'Denies the request. The requester gets a refusal. The decision is logged.', requireReason: true, label: 'Deny', danger: true })}>Deny</button>
                <span className="meta">decision id {a.id.slice(0, 8)}…</span>
              </div>
            )}
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
          onConfirm={submitDecision}
        />
      )}
      {toast && <Toast text={toast} />}
    </div>
  );
}

function ApprovalGatePanel({ decisions, projects, jobs }) {
  const pending = (decisions ?? []).filter((decision) => decision.effect === 'require_approval');
  const projectScoped = pending.filter((decision) => decision.projectId).length;
  const failedJobs = (jobs ?? []).filter((job) => job.status === 'failed').length;
  const readyProjects = (projects ?? []).filter((project) => project.state === 'READY_FOR_BUILD').length;
  const stageRows = approvalStageRows(pending);

  return (
    <div className="approval-gate-panel">
      <div className="approval-gate-copy">
        <span className="label-sm">operator gate board</span>
        <strong>{pending.length} pending approvals</strong>
        <p>{projectScoped} project-scoped requests, {failedJobs} failed jobs, {readyProjects} ready handoff lanes.</p>
      </div>
      <div className="approval-stage-grid">
        {stageRows.map((row) => (
          <div key={row.id} className={`approval-stage-card ${row.tone}`}>
            <Icon name={row.icon} />
            <span>{row.label}</span>
            <strong>{row.count}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function approvalStageRows(decisions) {
  const stages = [
    { id: 'jira', label: 'Jira', icon: 'jira', match: 'jira' },
    { id: 'docs', label: 'Docs', icon: 'docs', match: 'confluence' },
    { id: 'repo', label: 'Repo', icon: 'repo', match: 'vcs' },
    { id: 'handoff', label: 'Handoff', icon: 'handoff', match: 'handoff' },
    { id: 'other', label: 'Other', icon: 'audit', match: null },
  ];
  return stages.map((stage) => {
    const count = (decisions ?? []).filter((decision) => {
      const tool = String(decision.toolName ?? '').toLowerCase();
      if (stage.match) return tool.includes(stage.match);
      return !['jira', 'confluence', 'vcs', 'handoff'].some((part) => tool.includes(part));
    }).length;
    return {
      ...stage,
      count,
      tone: count > 0 ? 'amber' : 'grey',
    };
  });
}

function Toast({ text }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: 'var(--ink)', color: '#fff', padding: '10px 18px',
      fontFamily: 'var(--font-mono)', fontSize: 12, zIndex: 200,
    }}>{text}</div>
  );
}

Object.assign(window, { JobsPage, PolicyPage, QueueRunwayPanel, ApprovalGatePanel });
