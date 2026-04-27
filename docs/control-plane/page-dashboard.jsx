// page-dashboard.jsx - Pipeline command surface wired to admin.* MCP tools.
// All data flows from useAdmin hooks; no fake fixtures.

function DashboardPage() {
  const health = useAdmin('admin.health.get');
  const providers = useAdmin('admin.providers.list');
  const projects = useAdmin('admin.projects.list');
  const audit = useAdmin('admin.audit.head');
  const sessions = useAdmin('admin.sessions.list');
  const jobs = useAdmin('admin.jobs.list', { limit: 75 });
  const policy = useAdmin('admin.policy.decisions.list', { effect: 'require_approval', limit: 8 });
  const recentAudit = useAdmin('admin.audit.list', { limit: 8 });
  const alerts = useAdmin('admin.alerts.list');

  const cpTweaks = useCPTweaks();
  const operatorBadge = cpTweaks.t.operatorBadge;
  const roleLens = cpTweaks.t.roleLens || 'developer';
  const roleCopy = window.ControlSurfaceModel?.roleCopy ?? (() => ({}));
  const copy = roleCopy(roleLens);

  const [confirmAction, setConfirmAction] = useState(null);
  const [toast, setToast] = useState(null);
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2400); };

  const onApprove = (id) => setConfirmAction({
    kind: 'approve', id, title: `Approve ${id.slice(0, 8)}...`,
    body: 'Allows this request. The decision is logged in the audit chain.',
    requireReason: true, label: 'Approve', danger: false,
  });
  const onDeny = (id) => setConfirmAction({
    kind: 'deny', id, title: `Deny ${id.slice(0, 8)}...`,
    body: 'Denies this request. The requester gets a refusal. The decision is logged.',
    requireReason: true, label: 'Deny', danger: true,
  });

  const submitDecision = async (reason) => {
    if (!confirmAction) return;
    const tool = confirmAction.kind === 'approve' ? 'admin.policy.approve' : 'admin.policy.deny';
    const ca = confirmAction;
    setConfirmAction(null);
    try {
      await window.MCP_CLIENT.callTool(tool, {
        decisionId: ca.id,
        reason,
        operatorBadge,
      });
      showToast(`${ca.kind === 'approve' ? 'Approved' : 'Denied'} ${ca.id.slice(0, 8)}`);
      void policy.refetch();
      void recentAudit.refetch();
    } catch (err) {
      showToast(`Error: ${err.message ?? err}`);
    }
  };

  const projectList = projects.data?.projects ?? [];
  const sessionsList = sessions.data?.sessions ?? [];
  const jobsList = jobs.data?.jobs ?? [];
  const approvals = policy.data?.decisions ?? [];
  const alertsList = alerts.data?.alerts ?? [];
  const queued = jobsList.filter((j) => j.status === 'queued').length;
  const running = jobsList.filter((j) => j.status === 'running').length;
  const activeQueue = queued + running;
  const readyCount = projectList.filter((p) => p.state === 'READY_FOR_BUILD').length;
  const exceptions = projectList.filter((p) => EXCEPTION_STATES.includes(p.state));
  const auditChainLen = audit.data?.systemChainLength ?? null;
  const phaseRows = PIPELINE_PHASES.map((phase) => ({
    ...phase,
    projects: projectList.filter((p) => phase.states.includes(p.state)),
  }));
  const recentProjects = [...projectList]
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, 8);
  const commandProjects = [...projectList]
    .sort((a, b) => {
      const aScore = EXCEPTION_STATES.includes(a.state) ? 3 : a.openJobs > 0 ? 2 : a.state === 'READY_FOR_BUILD' ? 1 : 0;
      const bScore = EXCEPTION_STATES.includes(b.state) ? 3 : b.openJobs > 0 ? 2 : b.state === 'READY_FOR_BUILD' ? 1 : 0;
      if (aScore !== bScore) return bScore - aScore;
      return String(b.updatedAt).localeCompare(String(a.updatedAt));
    })
    .slice(0, 4);
  const operationsPrimary = ['scrum', 'devops', 'operator'].includes(roleLens);

  return (
    <div className="cp-page wide">
      <PageHead
        eyebrow={copy.dashboardEyebrow ?? 'pipeline · inception to build'}
        title={copy.dashboardTitle ?? 'Build pipeline'}
        right={<>
          <div className="meta-block"><span className="k">projects </span><span className="v">{projectList.length}</span></div>
          <div className="meta-block"><span className="k">agents </span><span className="v">{sessions.data?.totalActive ?? '—'}</span></div>
          <div className="meta-block"><span className="k">queue </span><span className="v">{activeQueue}</span></div>
          <div className="meta-block"><span className="k">version </span><span className="v">{health.data?.version ?? '—'}</span></div>
        </>}
      />

      <ErrorBlock error={health.error || projects.error || sessions.error || jobs.error} />

      <RolePortfolioFocus
        role={roleLens}
        projects={projectList}
        jobs={jobsList}
        sessions={sessions}
        approvals={approvals}
        loading={projects.loading && !projects.data}
        title={copy.dashboardSection}
      />

      <BuildControlRail
        projects={projectList}
        jobs={jobsList}
        sessions={sessions}
        approvals={approvals}
        loading={projects.loading && !projects.data}
        scope="portfolio command"
      />

      {operationsPrimary && (
        <ProviderHealthStrip
          health={health}
          providers={providers}
          loading={(health.loading && !health.data) || (providers.loading && !providers.data)}
        />
      )}

      <div className="status-strip pipeline-runtime">
        {health.loading && !health.data
          ? Array.from({ length: 6 }).map((_, i) => (
              <div className="status-cell" key={i}><LoadingSkeleton rows={2} /></div>
            ))
          : Object.entries(health.data?.components ?? {}).map(([k, v]) => (
              <div className="status-cell" key={k}>
                <span className="label">{v.label}</span>
                <div className="row">
                  <StatusDot status={v.status} pulse={v.status === 'red' || v.status === 'amber'} />
                  <span className="name" style={{ textTransform: 'capitalize' }}>
                    {v.status === 'green' ? 'healthy' : v.status === 'amber' ? 'degraded' : v.status === 'red' ? 'failing' : 'unknown'}
                  </span>
                </div>
                <span className="sub">{v.sub}</span>
              </div>
            ))}
      </div>

      <div className="stat-row pipeline-stats">
        <StatCell label="tracked projects" value={projectList.length} sub={`${readyCount} ready for handoff`} />
        <StatCell label="pipeline blockers" value={exceptions.length + approvals.length + alertsList.length} sub={`${exceptions.length} state · ${approvals.length} approvals · ${alertsList.length} alerts`} warn={exceptions.length + approvals.length + alertsList.length > 0} />
        <StatCell label="active build agents" value={sessions.data?.totalActive ?? '—'} sub={sessions.data?.cap !== undefined ? `of ${sessions.data.cap} session cap` : ''} />
        <StatCell label="build queue" value={activeQueue} sub={`${running} running · ${queued} queued`} warn={queued > 0} />
      </div>

      <CatalogStandardsPanel
        projects={projectList}
        loading={projects.loading && !projects.data}
      />

      <ProjectCommandStack
        projects={commandProjects}
        loading={projects.loading && !projects.data}
        sessions={sessions}
        jobs={jobsList}
      />

      {!operationsPrimary && (
        <ProviderHealthStrip
          health={health}
          providers={providers}
          loading={(health.loading && !health.data) || (providers.loading && !providers.data)}
        />
      )}

      <div className="cp-section-head">
        <span className="cp-section-num">project flow</span>
        <h2 className="cp-section-title">{copy.dashboardSection ?? 'Inception through build handoff'}</h2>
        <span className="cp-section-blurb">Counts come from the project lifecycle state machine.</span>
      </div>
      <PipelineBoard phases={phaseRows} loading={projects.loading && !projects.data} />

      {exceptions.length > 0 && (
        <div className="pipeline-exceptions">
          <div className="label-sm">exceptions</div>
          <div className="exception-list">
            {exceptions.map((p) => (
              <a key={p.id} href={`#/projects/${p.key}`} className="exception-item">
                <span className="mono">{p.key}</span>
                <span>{p.name}</span>
                <StatePill state={p.state} />
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="grid-2 pipeline-main-grid" style={{ marginTop: 32 }}>
        <ProjectLane projects={recentProjects} loading={projects.loading && !projects.data} />
        <AgentMonitorPanel sessions={sessions} jobs={jobs} policy={policy} />
      </div>

      <div className="cp-section-head" style={{ marginTop: 40 }}>
        <span className="cp-section-num">attention</span>
        <h2 className="cp-section-title">Approvals and alerts</h2>
        <span className="cp-section-blurb">Write actions require an operator reason and are logged.</span>
      </div>
      <div className="grid-2">
        <div className="surf">
          <div className="head">
            <span>active alerts</span>
            <span className="right">{alerts.dataLimited ? <DataLimited reason={alerts.dataLimited.reason} /> : `${alertsList.length} firing`}</span>
          </div>
          {alertsList.length === 0 && (
            <div className="empty-copy">
              {alerts.loading ? <LoadingSkeleton rows={2} /> : alerts.dataLimited ? 'No alerts surfaced; alerting layer not wired.' : 'No alerts firing.'}
            </div>
          )}
          {alertsList.map((a) => (
            <div className="alert-row" key={a.id} onClick={() => navigate('#/alerts')}>
              <StatusDot status={a.severity === 'P0' ? 'red' : 'amber'} pulse />
              <span className="id">{a.id}</span>
              <div>
                <div className="name">{a.name}</div>
                <div className="muted-mono" style={{ marginTop: 2 }}>
                  threshold {a.threshold} · current <strong style={{ color: 'var(--ink-2)' }}>{a.current}</strong>
                </div>
              </div>
              <Pill tone={a.severity === 'P0' ? 'red' : 'amber'}>{a.severity}</Pill>
              <span className="runbook">runbook</span>
            </div>
          ))}
        </div>

        <div className="surf">
          <div className="head">
            <span>approval inbox</span>
            <span className="right">{approvals.length} require_approval</span>
          </div>
          <div style={{ padding: '4px 0' }}>
            {policy.loading && !policy.data && (
              <div style={{ padding: '20px 16px' }}><LoadingSkeleton rows={3} /></div>
            )}
            {approvals.length === 0 && !policy.loading && (
              <div className="empty-copy">No require_approval decisions in the inbox.</div>
            )}
            {approvals.slice(0, 4).map((a) => (
              <div key={a.id} className="approval-inline">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span className="muted-mono">{a.id.slice(0, 8)}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink)' }}>{a.toolName}</span>
                  <span className="muted-mono" style={{ marginLeft: 'auto' }}>{a.evaluatedAt.slice(11, 16)}Z</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 8 }}>
                  <span className="muted-mono" style={{ color: 'var(--ink-4)' }}>confidence </span>
                  {a.confidenceScore.toFixed(2)} · {a.confidenceCategorical}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn sm success" onClick={() => onApprove(a.id)}>Approve</button>
                  <button className="btn sm danger" onClick={() => onDeny(a.id)}>Deny</button>
                  <a className="btn sm ghost" href="#/policy">Review</a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="cp-section-head" style={{ marginTop: 40 }}>
        <span className="cp-section-num">audit</span>
        <h2 className="cp-section-title">Recent orchestration entries</h2>
        <span className="cp-section-blurb">Signed chain head: {auditChainLen ?? '—'} entries.</span>
      </div>
      <ErrorBlock error={recentAudit.error} />
      <table className="cp-table">
        <thead>
          <tr><th>timestamp</th><th>actor</th><th>operation</th><th>outcome</th><th>chain hash</th></tr>
        </thead>
        <tbody>
          {recentAudit.loading && !recentAudit.data && (
            <tr><td colSpan="5"><LoadingSkeleton rows={3} /></td></tr>
          )}
          {(recentAudit.data?.entries ?? []).length === 0 && !recentAudit.loading && (
            <tr><td colSpan="5" style={{ color: 'var(--ink-3)', textAlign: 'center', padding: 20 }}>
              No audit entries yet.
            </td></tr>
          )}
          {(recentAudit.data?.entries ?? []).map((e) => (
            <tr key={e.id} className="clickable audit-row" onClick={() => navigate('#/audit')}>
              <td className="ts mono">{e.timestamp.slice(0, 19).replace('T', ' ')}Z</td>
              <td className="actor mono">{e.actor}</td>
              <td className="op mono">{e.toolName}</td>
              <td><OutcomePill outcome={e.outcome} /></td>
              <td className="hash mono">{e.prevHash ? e.prevHash.slice(0, 8) + '...' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="cp-foot">
        <span>auto-refresh {cpTweaks.t.polling ? `on · ${cpTweaks.t.pollIntervalSec}s` : 'paused'}</span>
        <span>operator: {operatorBadge}</span>
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
      {toast && <DashboardToast text={toast} />}
    </div>
  );
}

function CatalogStandardsPanel({ projects, loading }) {
  const rules = standardsRulesFor(projects ?? []);
  const passed = rules.filter((rule) => rule.state === 'pass').length;
  const blocked = rules.filter((rule) => rule.state === 'fail').length;
  const percent = Math.round((passed / Math.max(1, rules.length)) * 100);
  const tone = blocked > 0 ? 'red' : percent >= 85 ? 'green' : 'amber';
  const activeProjects = (projects ?? []).filter((project) => project.state !== 'ARCHIVED').length;

  return (
    <div className={`catalog-standards-panel ${tone}`}>
      <div className="standards-summary">
        <div>
          <span className="label-sm">catalog standards</span>
          <strong>{percent}%</strong>
          <p>{passed}/{rules.length} standards passing across {activeProjects} active projects.</p>
        </div>
        <div className="standards-summary-meta">
          <Pill tone={tone}>{blocked > 0 ? `${blocked} blocked` : `${passed} passing`}</Pill>
          <a className="btn sm ghost" href="#/projects">Open projects</a>
        </div>
      </div>
      <div className="standards-rules">
        {loading
          ? <div className="standards-rule-row"><LoadingSkeleton rows={3} /></div>
          : rules.map((rule) => <ScorecardRuleRow key={rule.id} rule={rule} />)}
      </div>
    </div>
  );
}

function standardsRulesFor(projects) {
  const active = (projects ?? []).filter((project) => project.state !== 'ARCHIVED');
  const total = active.length;
  const passCount = (predicate) => active.filter(predicate).length;
  const hasLinked = (summary, key) => ['linked', 'ready'].includes(summary?.[key]?.status);
  const quietQueue = passCount((project) => Number(project.openJobs ?? 0) === 0);
  const readyStates = passCount((project) => ['VALIDATED', 'READY_FOR_BUILD'].includes(project.state));
  const rules = [
    {
      id: 'blueprint',
      icon: 'context',
      label: 'Blueprint captured',
      detail: 'Every active project has a persisted blueprint version.',
      passed: passCount((project) => Number(project.blueprintVersion ?? 0) > 0),
      total,
    },
    {
      id: 'jira',
      icon: 'jira',
      label: 'Jira work linked',
      detail: 'Project cards are planned or linked to a Jira project.',
      passed: passCount((project) => hasLinked(project.artifactSummary, 'jira')),
      total,
    },
    {
      id: 'docs',
      icon: 'docs',
      label: 'Confluence docs linked',
      detail: 'Project specs and operational docs are available in Confluence.',
      passed: passCount((project) => hasLinked(project.artifactSummary, 'confluence')),
      total,
    },
    {
      id: 'repo',
      icon: 'repo',
      label: 'Repository linked',
      detail: 'The project has a VCS location for build agents.',
      passed: passCount((project) => hasLinked(project.artifactSummary, 'vcs')),
      total,
    },
    {
      id: 'handoff',
      icon: 'handoff',
      label: 'Handoff ready',
      detail: 'Build agents have a handoff packet or bundle to consume.',
      passed: passCount((project) => project.artifactSummary?.handoff?.status === 'ready'),
      total,
    },
    {
      id: 'readiness',
      icon: 'score',
      label: 'Readiness reviewed',
      detail: 'Projects have reached validated or ready-for-build states.',
      passed: readyStates,
      total,
    },
    {
      id: 'queue',
      icon: 'activity',
      label: 'Queue quiet',
      detail: 'No open provisioning or handoff jobs are attached.',
      passed: quietQueue,
      total,
    },
  ];

  return rules.map((rule) => {
    const percent = total === 0 ? 0 : Math.round((rule.passed / total) * 100);
    const state = total === 0 ? 'warn' : rule.passed === total ? 'pass' : rule.passed === 0 ? 'fail' : 'warn';
    return { ...rule, percent, state };
  });
}

function ScorecardRuleRow({ rule }) {
  const tone = rule.state === 'pass' ? 'green' : rule.state === 'fail' ? 'red' : 'amber';
  return (
    <div className={`standards-rule-row ${rule.state}`}>
      <Icon name={rule.icon} />
      <div className="standards-rule-copy">
        <strong>{rule.label}</strong>
        <span>{rule.detail}</span>
      </div>
      <div className={`standard-meter ${tone}`}>
        <span style={{ width: `${rule.percent}%` }}></span>
      </div>
      <Pill tone={tone}>{rule.passed}/{rule.total}</Pill>
    </div>
  );
}

function PipelineBoard({ phases, loading, compact }) {
  if (loading) {
    return <div className="pipeline-board"><div className="pipeline-phase loading"><LoadingSkeleton rows={5} /></div></div>;
  }
  return (
    <div className={'pipeline-board ' + (compact ? 'compact' : '')}>
      {phases.map((phase, index) => (
        <a key={phase.id} className={'pipeline-phase ' + (phase.projects.length > 0 ? 'has-work' : '')} href={phase.route}>
          <div className="phase-head">
            <span className="phase-index">{String(index + 1).padStart(2, '0')}</span>
            <span className="phase-count">{phase.projects.length}</span>
          </div>
          <div className="phase-name">{phase.label}</div>
          <div className="phase-action">{phase.action}</div>
          <div className="phase-states">
            {phase.states.map((state) => <span key={state}>{stateLabel(state)}</span>)}
          </div>
          <div className="phase-projects">
            {phase.projects.length === 0 && <div className="phase-empty">No projects</div>}
            {phase.projects.slice(0, compact ? 2 : 3).map((p) => (
              <div key={p.id} className="phase-project">
                <ProjectMark project={p} size="xs" />
                <span>{p.name}</span>
              </div>
            ))}
            {phase.projects.length > (compact ? 2 : 3) && (
              <div className="phase-more">+{phase.projects.length - (compact ? 2 : 3)} more</div>
            )}
          </div>
        </a>
      ))}
    </div>
  );
}

function ProjectCommandStack({ projects, loading, sessions, jobs }) {
  const activeAgents = sessions.data?.totalActive ?? 0;
  if (loading) {
    return <div className="project-command-stack"><LoadingSkeleton rows={4} /></div>;
  }
  if (projects.length === 0) return null;
  return (
    <div className="project-command-stack">
      <div className="command-stack-head">
        <div>
          <span className="label-sm">active project stack</span>
          <h2>Operator command view</h2>
        </div>
        <div className="command-stack-meta">
          <span>{activeAgents} agents</span>
          <span>{jobs.filter((job) => job.status === 'running').length} running jobs</span>
          <span>{jobs.filter((job) => job.status === 'queued').length} queued</span>
        </div>
      </div>
      <div className="command-project-grid">
        {projects.map((project) => {
          const projectJobs = jobs.filter((job) => job.projectId === project.id);
          const failedJobs = projectJobs.filter((job) => job.status === 'failed').length;
          return (
            <a key={project.id} className="command-project-card" href={`#/projects/${project.key}`}>
              <div className="command-project-main">
                <ProjectMark project={project} size="lg" />
                <div>
                  <div className="project-key">{project.key}</div>
                  <div className="project-name">{project.name}</div>
                  <div className="command-project-state">
                    <StatePill state={project.state} />
                    <span>{project.openJobs} open jobs</span>
                    {failedJobs > 0 && <Pill tone="red">{failedJobs} failed</Pill>}
                  </div>
                </div>
              </div>
              <ProjectProgressRail state={project.state} compact />
              <ArtifactStrip summary={project.artifactSummary} compact />
            </a>
          );
        })}
      </div>
    </div>
  );
}

function ProjectLane({ projects, loading }) {
  return (
    <div className="surf">
      <div className="head">
        <span>project tracking</span>
        <span className="right"><a href="#/projects">open projects</a></span>
      </div>
      {loading && <div style={{ padding: 16 }}><LoadingSkeleton rows={5} /></div>}
      {!loading && projects.length === 0 && <div className="empty-copy">No projects in the orchestration pipeline.</div>}
      <div className="project-lane">
        {projects.map((p) => {
          const phase = phaseForState(p.state);
          return (
            <a key={p.id} className="project-lane-row" href={`#/projects/${p.key}`}>
              <div className="project-lane-main">
                <ProjectMark project={p} size="sm" />
                <div>
                  <div className="project-key">{p.key}</div>
                  <div className="project-name">{p.name}</div>
                </div>
              </div>
              <div className="project-phase">
                <span>{phase?.label ?? 'Exception'}</span>
                <StatePill state={p.state} />
              </div>
              <ArtifactStrip summary={p.artifactSummary} compact />
              <div className="project-meta">
                <span>v{p.blueprintVersion}</span>
                <span>{p.openJobs} open jobs</span>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

function AgentMonitorPanel({ sessions, jobs, policy }) {
  const sessionsList = sessions.data?.sessions ?? [];
  const jobsList = jobs.data?.jobs ?? [];
  const running = jobsList.filter((j) => j.status === 'running');
  const queued = jobsList.filter((j) => j.status === 'queued');
  const approvals = policy.data?.decisions ?? [];
  const enabledFeatureCount = sessionsList.reduce((sum, s) => sum + (s.featuresEnabled?.length ?? 0), 0);
  const disabledFeatureCount = sessionsList.reduce((sum, s) => sum + (s.featuresDisabled?.length ?? 0), 0);

  return (
    <div className="surf agent-monitor">
      <div className="head">
        <span>Agent monitor</span>
        <span className="right"><a href="#/sessions">open agents</a></span>
      </div>
      <div className="agent-summary">
        <div>
          <span className="label-sm">connected</span>
          <strong>{sessions.data?.totalActive ?? '—'}</strong>
        </div>
        <div>
          <span className="label-sm">running jobs</span>
          <strong>{running.length}</strong>
        </div>
        <div>
          <span className="label-sm">queued</span>
          <strong>{queued.length}</strong>
        </div>
        <div>
          <span className="label-sm">blocked</span>
          <strong>{approvals.length}</strong>
        </div>
      </div>
      <div className="agent-feature-strip">
        <span>{enabledFeatureCount} enabled capabilities</span>
        <span>{disabledFeatureCount} disabled capabilities</span>
      </div>
      {sessions.loading && !sessions.data && <div style={{ padding: 16 }}><LoadingSkeleton rows={4} /></div>}
      {!sessions.loading && sessionsList.length === 0 && <div className="empty-copy">No build agents are connected to the public MCP transport.</div>}
      {sessionsList.slice(0, 4).map((s) => (
        <div className="agent-card" key={s.sessionId}>
          <div>
            <div className="agent-name">{s.clientName ?? 'unnamed agent'} {s.clientVersion ? `v${s.clientVersion}` : ''}</div>
            <div className="muted-mono">{s.sessionId.slice(0, 12)}... · {s.protocolVersion}</div>
          </div>
          <div className="agent-card-meta">
            <Pill tone="green">{s.featuresEnabled.length} enabled</Pill>
            {s.featuresDisabled.length > 0 && <Pill tone="amber">{s.featuresDisabled.length} disabled</Pill>}
          </div>
        </div>
      ))}
      <div className="agent-queue-list">
        {running.concat(queued).slice(0, 4).map((j) => (
          <a key={j.id} href="#/jobs" className="agent-job-row">
            <span className="mono">{j.id.slice(0, 8)}...</span>
            <Pill tone={j.status === 'running' ? 'amber' : 'grey'}>{j.status}</Pill>
            <span className="mono">{j.updatedAt.slice(11, 19)}Z</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function StatCell({ label, value, sub, warn }) {
  return (
    <div className={'stat-cell ' + (warn ? 'warn' : '')}>
      <span className="label">{label}</span>
      <div className="value">{value}</div>
      <div className="sub">{sub}</div>
    </div>
  );
}

function DashboardToast({ text }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: 'var(--ink)', color: '#fff', padding: '10px 18px',
      fontFamily: 'var(--font-mono)', fontSize: 12, zIndex: 200,
    }}>{text}</div>
  );
}

Object.assign(window, { DashboardPage, PipelineBoard, ProjectCommandStack, CatalogStandardsPanel, standardsRulesFor, ScorecardRuleRow });
