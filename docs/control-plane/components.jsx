// Shared components — TopNav, Pills, StatusDot, Sparkline, Modal, Drawer, JSON view
const { useState, useEffect, useRef, useMemo } = React;

const ROUTES_PRIMARY = [
  { id: 'dashboard', label: 'Pipeline', path: '#/' },
  { id: 'projects',  label: 'Projects',  path: '#/projects' },
  { id: 'sessions',  label: 'Agents',    path: '#/sessions' },
  { id: 'jobs',      label: 'Queue',     path: '#/jobs' },
  { id: 'policy',    label: 'Approvals', path: '#/policy' },
];
const ROUTES_MORE = [
  { id: 'requirements-assist', label: 'Requirements Assist' },
  { id: 'agent-assignment', label: 'Agent Assignment' },
  { id: 'audit',     label: 'Audit chain' },
  { id: 'providers', label: 'Providers' },
  { id: 'alerts',    label: 'Alerts' },
  { id: 'migrations',label: 'Migrations' },
  { id: 'secrets',   label: 'Secrets' },
  { id: 'slo',       label: 'SLOs' },
  { id: 'capacity',  label: 'Capacity' },
  { id: 'dr',        label: 'DR drills' },
  { id: 'settings',  label: 'Settings' },
  { id: 'index',     label: 'Pipeline map' },
];

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash || '#/');
  useEffect(() => {
    const onHash = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return hash;
}

function navigate(to) {
  window.location.hash = to;
}

// Live polling tick — used by TopNav and pages that show "last updated"
function useTick(intervalSec, paused) {
  const [tick, setTick] = useState(0);
  const [lastSync, setLastSync] = useState(Date.now());
  useEffect(() => {
    if (paused) return;
    const ms = Math.max(1, intervalSec) * 1000;
    const id = setInterval(() => {
      setTick(t => t + 1);
      setLastSync(Date.now());
    }, ms);
    return () => clearInterval(id);
  }, [intervalSec, paused]);
  return { tick, lastSync };
}

function RoleSelect({ value, onChange, compact = false }) {
  const profiles = window.ControlSurfaceModel?.roleProfiles() ?? [
    { id: 'developer', label: 'Developer', shortLabel: 'Developer' },
  ];
  const active = profiles.some((profile) => profile.id === value) ? value : 'developer';
  return (
    <label className={'role-select ' + (compact ? 'compact' : '')} title="Presentation role lens">
      <span>Role</span>
      <select value={active} onChange={(event) => onChange(event.target.value)} aria-label="Role lens">
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>{compact ? profile.shortLabel ?? profile.label : profile.label}</option>
        ))}
      </select>
    </label>
  );
}

function TopNav({ activeRoute }) {
  const { t, setTweak } = (window.useCPTweaks ? window.useCPTweaks() : { t: window.CP_TWEAK_DEFAULTS || {}, setTweak: () => {} });
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  const { tick, lastSync } = useTick(t.pollIntervalSec || 30, !t.polling);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const ageSec = Math.floor((now - lastSync) / 1000);

  useEffect(() => {
    const onClick = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const env = t.env || 'production';
  const envCls = env === 'production' ? 'prod' : env === 'staging' ? 'staging' : 'dev';
  const envLabel = env;
  const roleLens = t.roleLens || 'developer';
  const opEmail = t.operatorBadge || 'chris@lateapexllc.com';
  const initials = (opEmail.split('@')[0] || '').split(/[.\-_]/).map(s => s[0]).filter(Boolean).slice(0,2).join('').toUpperCase() || 'OP';

  return (
    <nav className="tnav">
      <a className="tnav-brand" href="#/" style={{ textDecoration: 'none' }}>
        <span className="glyph">a</span>
        <span>atl-mcp · build pipeline</span>
        <span className="ver">v0.18.4</span>
      </a>
      <div className="tnav-routes">
        {ROUTES_PRIMARY.map(r => (
          <a key={r.id} href={r.path}
             className={'tnav-route ' + (activeRoute === r.id ? 'active' : '')}>
            {r.label}
          </a>
        ))}
        <div className="tnav-more" ref={moreRef}>
          <button className={'tnav-route ' + (ROUTES_MORE.find(x=>x.id===activeRoute) ? 'active' : '')}
                  onClick={() => setMoreOpen(o => !o)}>
            More ▾
          </button>
          {moreOpen && (
            <div className="tnav-dropdown">
              {ROUTES_MORE.map(r => (
                <a key={r.id} href={'#/' + r.id} onClick={() => setMoreOpen(false)}>{r.label}</a>
              ))}
            </div>
          )}
        </div>
        <div className="tnav-mobile-role">
          <RoleSelect compact value={roleLens} onChange={(value) => setTweak('roleLens', value)} />
        </div>
      </div>
      <div className="tnav-right">
        <RoleSelect value={roleLens} onChange={(value) => setTweak('roleLens', value)} />
        <span className={'env-pill ' + envCls}>{envLabel}</span>
        <button className={'refresh-toggle ' + (t.polling ? '' : 'paused')}
                onClick={() => setTweak('polling', !t.polling)}
                title="Auto-refresh">
          <span className="ddot"></span>
          {t.polling
            ? <>auto · {t.pollIntervalSec}s · <span style={{color: 'var(--ink-4)'}}>{ageSec}s</span></>
            : <>paused</>}
        </button>
        <div className="op-badge">
          <span className="av">{initials}</span>
          <span>{opEmail}</span>
        </div>
      </div>
    </nav>
  );
}

function RolePortfolioFocus({ role, projects = [], jobs = [], sessions, approvals = [], loading = false, title }) {
  const model = window.ControlSurfaceModel;
  const focus = model?.rolePortfolioFocus(role, projects, jobs, sessions, approvals);
  if (loading && !focus) {
    return <div className="role-portfolio-focus"><LoadingSkeleton rows={3} /></div>;
  }
  if (!focus) return null;
  const metrics = focus.metrics ?? [];
  const lanes = focus.lanes ?? [];
  return (
    <section className={`role-portfolio-focus ${focus.role}`}>
      <div className="role-focus-copy">
        <span className="label-sm">{model?.roleCopy(role)?.label ?? 'Role lens'}</span>
        <strong>{title ?? focus.title}</strong>
        <p>{focus.summary}</p>
      </div>
      <div className="role-focus-metrics">
        {metrics.map((metric) => {
          const body = (
            <>
              <Icon name={metric.icon ?? roleMetricIcon(metric.id)} />
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.detail}</small>
            </>
          );
          return metric.href
            ? <a key={metric.id} className={`role-focus-card ${metric.tone ?? 'grey'}`} href={metric.href}>{body}</a>
            : <div key={metric.id} className={`role-focus-card ${metric.tone ?? 'grey'}`}>{body}</div>;
        })}
      </div>
      {lanes.length > 0 && (
        <div className="role-focus-lanes">
          {lanes.map((lane) => (
            <div key={lane.id} className={`role-focus-lane ${lane.tone ?? 'grey'}`}>
              <span>{lane.label}</span>
              <strong>{lane.count}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function roleMetricIcon(id) {
  if (String(id).includes('jira')) return 'jira';
  if (String(id).includes('confluence') || String(id).includes('requirements')) return 'docs';
  if (String(id).includes('repo')) return 'repo';
  if (String(id).includes('handoff')) return 'handoff';
  if (String(id).includes('agent') || String(id).includes('transport')) return 'agent';
  if (String(id).includes('queue') || String(id).includes('debug') || String(id).includes('blocked')) return 'queue';
  if (String(id).includes('trace') || String(id).includes('scope')) return 'trace';
  if (String(id).includes('approval')) return 'audit';
  if (String(id).includes('health') || String(id).includes('readiness') || String(id).includes('status')) return 'score';
  return 'activity';
}

function PageHead({ eyebrow, title, right }) {
  return (
    <div className="cp-page-head">
      <div>
        {eyebrow && <div className="cp-eyebrow">{eyebrow}</div>}
        <h1 className="cp-title">{title}</h1>
      </div>
      {right && <div className="right">{right}</div>}
    </div>
  );
}

function Sparkline({ values, color = '#1f6e54', target, breach }) {
  if (!values || !values.length) return null;
  const w = 100, h = 28, pad = 2;
  const min = Math.min(...values), max = Math.max(...values);
  const range = (max - min) || 1;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg className="sparkline" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="1.2" points={pts} />
      {target != null && (
        <line x1="0" x2={w} y1={h - pad - ((target - min) / range) * (h - pad * 2)}
              y2={h - pad - ((target - min) / range) * (h - pad * 2)}
              stroke="#9a9690" strokeDasharray="2 2" strokeWidth="0.8" />
      )}
    </svg>
  );
}

function StatusDot({ status, pulse }) {
  const cls = { green:'green', amber:'amber', red:'red', grey:'grey', blue:'blue' }[status] || 'grey';
  return <span className={`dot ${cls}${pulse ? ' pulse' : ''}`}></span>;
}

function Pill({ tone='grey', children }) {
  return <span className={`pill2 ${tone}`}>{children}</span>;
}

function Icon({ name, title }) {
  const labels = {
    jira: 'J',
    docs: 'D',
    repo: 'R',
    handoff: 'H',
    agent: 'A',
    score: 'S',
    trace: 'T',
    matrix: 'M',
    activity: 'L',
    queue: 'Q',
    action: '>',
    audit: '#',
    context: 'C',
  };
  return <span className={`cp-icon ${name ?? 'default'}`} title={title ?? name}>{labels[name] ?? '?'}</span>;
}

function ProjectMark({ project, size = 'md' }) {
  const key = String(project?.key ?? project?.atlassianProjectKey ?? '?').toUpperCase();
  const name = String(project?.name ?? key);
  const initials = key.replace(/[^A-Z0-9]/g, '').slice(0, 3) || name.split(/\s+/).map((part) => part[0]).join('').slice(0, 3).toUpperCase() || 'P';
  const palette = projectPalette(key);
  return (
    <span className={`project-mark ${size}`} style={{ '--mark-bg': palette.bg, '--mark-accent': palette.accent }} title={name}>
      <span className="project-mark-grid"></span>
      <span className="project-mark-initials">{initials}</span>
    </span>
  );
}

function projectPalette(key) {
  const palettes = [
    { bg: '#0f4f5f', accent: '#b9d8df' },
    { bg: '#68422b', accent: '#e2c2a7' },
    { bg: '#24583b', accent: '#b7d5c3' },
    { bg: '#59406f', accent: '#d2c0df' },
    { bg: '#773a35', accent: '#e2b7b2' },
    { bg: '#334e7a', accent: '#b8c8e1' },
  ];
  const hash = String(key).split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return palettes[hash % palettes.length];
}

// Mirrors src/domain/projectState.ts (real 12-state set, ADR 0006).
const STATE_TONES = {
  DRAFT_INTAKE: 'grey',
  CLARIFICATION_NEEDED: 'amber',
  BLUEPRINT_READY: 'amber',
  PREFLIGHT_PASSED: 'amber',
  PROVISIONING_PREVIEWED: 'amber',
  PROVISIONED: 'green',
  LINKED: 'green',
  VALIDATED: 'green',
  READY_FOR_BUILD: 'green',
  VALIDATION_FAILED: 'red',
  DRIFT_DETECTED: 'red',
  ARCHIVED: 'grey',
};

const PIPELINE_PHASES = [
  {
    id: 'inception',
    label: 'Inception',
    states: ['DRAFT_INTAKE'],
    action: 'intake record',
    route: '#/projects',
  },
  {
    id: 'requirements',
    label: 'Requirements',
    states: ['CLARIFICATION_NEEDED'],
    action: 'clarify scope',
    route: '#/projects',
  },
  {
    id: 'blueprint',
    label: 'Blueprint',
    states: ['BLUEPRINT_READY'],
    action: 'architecture map',
    route: '#/projects',
  },
  {
    id: 'preflight',
    label: 'Preflight',
    states: ['PREFLIGHT_PASSED'],
    action: 'provider profile',
    route: '#/providers',
  },
  {
    id: 'provisioning',
    label: 'Provisioning',
    states: ['PROVISIONING_PREVIEWED', 'PROVISIONED'],
    action: 'Jira + docs + VCS',
    route: '#/jobs',
  },
  {
    id: 'context',
    label: 'Context',
    states: ['LINKED'],
    action: 'context pack',
    route: '#/projects',
  },
  {
    id: 'readiness',
    label: 'Readiness',
    states: ['VALIDATED'],
    action: 'gate review',
    route: '#/projects',
  },
  {
    id: 'handoff',
    label: 'Handoff',
    states: ['READY_FOR_BUILD'],
    action: 'agent packet',
    route: '#/sessions',
  },
  {
    id: 'build',
    label: 'Build',
    states: [],
    action: 'agent execution',
    route: '#/sessions',
  },
];

const EXCEPTION_STATES = ['VALIDATION_FAILED', 'DRIFT_DETECTED'];

function stateLabel(state) {
  return String(state ?? '').toLowerCase().replace(/_/g, ' ');
}

function phaseForState(state) {
  return PIPELINE_PHASES.find((phase) => phase.states.includes(state)) ?? null;
}

function readinessPercent(state) {
  const map = {
    DRAFT_INTAKE: 8,
    CLARIFICATION_NEEDED: 14,
    BLUEPRINT_READY: 28,
    PREFLIGHT_PASSED: 42,
    PROVISIONING_PREVIEWED: 55,
    PROVISIONED: 66,
    LINKED: 78,
    VALIDATED: 88,
    READY_FOR_BUILD: 100,
    VALIDATION_FAILED: 52,
    DRIFT_DETECTED: 60,
    ARCHIVED: 0,
  };
  return map[state] ?? 0;
}

function ProjectProgressRail({ state, compact = false }) {
  const current = readinessPercent(state);
  const phase = phaseForState(state);
  const tone = EXCEPTION_STATES.includes(state) ? 'red' : state === 'READY_FOR_BUILD' ? 'green' : 'amber';
  return (
    <div className={'project-progress-rail ' + (compact ? 'compact ' : '') + tone}>
      <div className="rail-head">
        <span>{phase?.label ?? 'Exception'}</span>
        <span>{current}%</span>
      </div>
      <div className="rail-track">
        <span style={{ width: `${current}%` }}></span>
      </div>
      {!compact && (
        <div className="rail-steps">
          {PIPELINE_PHASES.map((phaseItem) => (
            <span key={phaseItem.id} className={phaseItem.states.includes(state) ? 'on' : ''}>{phaseItem.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function ArtifactStrip({ summary, compact = false }) {
  const safe = summary ?? {};
  const jira = safe.jira ?? {};
  const confluence = safe.confluence ?? {};
  const vcs = safe.vcs ?? {};
  const handoff = safe.handoff ?? {};
  const items = [
    { id: 'jira', label: 'Jira', value: artifactCount(jira.issueCount, jira.plannedCount), status: jira.status, sub: jira.projectKey },
    { id: 'confluence', label: 'Docs', value: artifactCount(confluence.pageCount, confluence.plannedCount), status: confluence.status, sub: confluence.spaceId },
    { id: 'vcs', label: 'Repo', value: vcs.repoUrl ? 'linked' : vcs.fileCount ? `${vcs.fileCount}` : 'none', status: vcs.status, sub: repoHost(vcs.repoUrl) },
    { id: 'handoff', label: 'Handoff', value: handoff.bundleCount ? `${handoff.bundleCount}` : handoff.status === 'ready' ? 'ready' : 'wait', status: handoff.status, sub: null },
  ];
  return (
    <div className={'artifact-strip ' + (compact ? 'compact' : '')}>
      {items.map((item) => (
        <span key={item.id} className={`artifact-chip ${artifactTone(item.status)}`}>
          <span className="artifact-label">{item.label}</span>
          <strong>{item.value}</strong>
          {!compact && item.sub && <span className="artifact-sub">{item.sub}</span>}
        </span>
      ))}
    </div>
  );
}

function artifactCount(actual, planned) {
  const a = Number(actual ?? 0);
  const p = Number(planned ?? 0);
  if (a > 0) return `${a}`;
  if (p > 0) return `${p} planned`;
  return 'none';
}

function artifactTone(status) {
  const map = {
    linked: 'green',
    ready: 'green',
    planned: 'amber',
    not_ready: 'amber',
    error: 'red',
    blocked: 'red',
    missing: 'grey',
  };
  return map[status] ?? 'grey';
}

function repoHost(url) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function ReadinessScorecard({ project, summary, jobs = [], sessions, compact = false }) {
  const gates = readinessGates(project, summary, jobs, sessions);
  const passed = gates.filter((gate) => gate.state === 'pass').length;
  const blocked = gates.filter((gate) => gate.state === 'fail').length;
  const score = Math.round((passed / Math.max(1, gates.length)) * 100);
  const tone = blocked > 0 ? 'red' : score >= 85 ? 'green' : 'amber';
  return (
    <div className={'readiness-scorecard ' + (compact ? 'compact ' : '') + tone}>
      <div className="scorecard-head">
        <div>
          <span className="label-sm">readiness scorecard</span>
          <strong>{score}%</strong>
        </div>
        <Pill tone={tone}>{blocked > 0 ? `${blocked} blocked` : `${passed}/${gates.length} pass`}</Pill>
      </div>
      <div className="scorecard-gates">
        {gates.map((gate) => (
          <div key={gate.id} className={`scorecard-gate ${gate.state}`}>
            <Icon name={gate.icon} />
            <div>
              <span>{gate.label}</span>
              {!compact && <small>{gate.detail}</small>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function readinessGates(project, summary, jobs = [], sessions) {
  const safe = summary ?? {};
  const totalAgents = sessions?.data?.totalActive ?? sessions?.totalActive ?? 0;
  const failedJobs = jobs.filter((job) => job.status === 'failed').length;
  const percent = readinessPercent(project?.state);
  return [
    {
      id: 'intake',
      label: 'Intake',
      icon: 'context',
      state: project?.blueprintVersion > 0 ? 'pass' : 'warn',
      detail: project?.blueprintVersion > 0 ? `blueprint v${project.blueprintVersion}` : 'missing blueprint',
    },
    {
      id: 'blueprint',
      label: 'Blueprint',
      icon: 'score',
      state: percent >= 28 ? 'pass' : 'warn',
      detail: phaseForState(project?.state)?.label ?? 'not phased',
    },
    {
      id: 'jira',
      label: 'Jira',
      icon: 'jira',
      state: gateState(safe.jira?.status, safe.jira?.plannedCount),
      detail: safe.jira?.projectKey ? `${safe.jira.projectKey} · ${safe.jira.issueCount ?? 0} cards` : `${safe.jira?.plannedCount ?? 0} planned`,
    },
    {
      id: 'docs',
      label: 'Docs',
      icon: 'docs',
      state: gateState(safe.confluence?.status, safe.confluence?.plannedCount),
      detail: safe.confluence?.spaceId ? `${safe.confluence.spaceId} · ${safe.confluence.pageCount ?? 0} pages` : `${safe.confluence?.plannedCount ?? 0} planned`,
    },
    {
      id: 'repo',
      label: 'Repo',
      icon: 'repo',
      state: gateState(safe.vcs?.status, safe.vcs?.fileCount),
      detail: safe.vcs?.repoUrl ? repoHost(safe.vcs.repoUrl) : `${safe.vcs?.fileCount ?? 0} files`,
    },
    {
      id: 'handoff',
      label: 'Handoff',
      icon: 'handoff',
      state: safe.handoff?.status === 'ready' ? 'pass' : safe.handoff?.status === 'blocked' ? 'fail' : 'warn',
      detail: `${safe.handoff?.bundleCount ?? 0} bundles`,
    },
    {
      id: 'agents',
      label: 'Agents',
      icon: 'agent',
      state: totalAgents > 0 ? 'pass' : 'warn',
      detail: `${totalAgents} connected`,
    },
    {
      id: 'jobs',
      label: 'Jobs',
      icon: 'activity',
      state: failedJobs > 0 ? 'fail' : 'pass',
      detail: failedJobs > 0 ? `${failedJobs} failed` : 'no failed jobs',
    },
  ];
}

function gateState(status, plannedCount) {
  if (status === 'error' || status === 'blocked') return 'fail';
  if (status === 'linked' || status === 'ready') return 'pass';
  if (status === 'planned' || Number(plannedCount ?? 0) > 0) return 'warn';
  return 'warn';
}

function BuildControlRail({ projects = [], jobs = [], sessions, approvals = [], loading = false, scope = 'portfolio' }) {
  const metrics = buildControlMetrics(projects, jobs, sessions, approvals);
  if (loading) {
    return (
      <div className="build-control-rail">
        <LoadingSkeleton rows={4} />
      </div>
    );
  }

  return (
    <div className="build-control-rail">
      <div className="control-rail-head">
        <div>
          <span className="label-sm">build control surface</span>
          <strong>{scope}</strong>
        </div>
        <div className="control-rail-links">
          <a href="#/projects">projects</a>
          <a href="#/jobs">queue</a>
          <a href="#/sessions">agents</a>
          <a href="#/policy">gates</a>
        </div>
      </div>
      <div className="control-rail-main">
        {metrics.cards.map((card) => (
          <a key={card.id} className={`control-rail-card ${card.tone}`} href={card.href}>
            <Icon name={card.icon} />
            <div>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.detail}</small>
            </div>
            <Pill tone={card.tone}>{card.badge}</Pill>
          </a>
        ))}
      </div>
      <div className="control-rail-phases">
        {metrics.phaseRows.map((phase) => (
          <a key={phase.id} className={`control-phase-chip ${phase.count > 0 ? 'has-work' : ''}`} href={phase.route}>
            <span>{phase.label}</span>
            <strong>{phase.count}</strong>
          </a>
        ))}
      </div>
    </div>
  );
}

function ProviderHealthStrip({ health, providers, loading = false }) {
  const model = window.ControlSurfaceModel;
  const rows = model
    ? model.providerHealthRows(health?.data ?? health ?? {}, providers?.data ?? providers ?? {})
    : [];
  const degraded = [
    ...(health?.error ? [model?.fetchPanelState ? model.fetchPanelState(health, 'System health') : null] : []),
    ...(providers?.error ? [model?.fetchPanelState ? model.fetchPanelState(providers, 'Provider health') : null] : []),
  ].filter(Boolean);

  if (loading && rows.length === 0) {
    return (
      <div className="provider-health-strip">
        {Array.from({ length: 8 }).map((_, index) => (
          <div className="provider-health-cell" key={index}><LoadingSkeleton rows={2} /></div>
        ))}
      </div>
    );
  }

  return (
    <div className="provider-health-strip">
      {degraded.map((item) => (
        <div className={`provider-health-cell ${item.tone}`} key={item.label}>
          <span className="provider-label">{item.label}</span>
          <div className="provider-state"><StatusDot status={item.tone} pulse /><strong>degraded</strong></div>
          <span className="provider-sub">{item.message}</span>
        </div>
      ))}
      {rows.map((row) => (
        <div className={`provider-health-cell ${row.tone}`} key={row.id}>
          <span className="provider-label">{row.label}</span>
          <div className="provider-state">
            <StatusDot status={row.tone} pulse={row.tone === 'red' || row.tone === 'amber'} />
            <strong>{row.status === 'green' ? 'healthy' : row.status === 'amber' ? 'degraded' : row.status === 'red' ? 'failing' : 'unknown'}</strong>
          </div>
          <span className="provider-sub">{row.sub}</span>
        </div>
      ))}
    </div>
  );
}

function PhaseConveyor({ project, summary }) {
  const rows = window.ControlSurfaceModel
    ? window.ControlSurfaceModel.phaseConveyorRows(project, summary)
    : PIPELINE_PHASES.map((phase) => ({ ...phase, status: phase.states.includes(project?.state) ? 'current' : 'planned', tone: 'grey' }));
  return (
    <div className="phase-conveyor">
      {rows.map((row) => (
        <a key={row.id} className={`phase-conveyor-step ${row.status} ${row.tone}`} href={row.route}>
          <span className="phase-conveyor-index">{String(row.index + 1).padStart(2, '0')}</span>
          <strong>{row.label}</strong>
          <small>{row.blockingReason ?? row.action}</small>
        </a>
      ))}
    </div>
  );
}

function ArtifactChainDiagram({ project, summary, compact = false }) {
  const rows = window.ControlSurfaceModel
    ? window.ControlSurfaceModel.artifactChainRows(project, summary)
    : [];
  return (
    <div className={'artifact-chain-diagram ' + (compact ? 'compact' : '')}>
      {rows.map((row, index) => {
        const body = (
          <>
            <Icon name={row.icon} />
            <span>{row.label}</span>
            <strong>{row.value}</strong>
            {!compact && <small>{row.sub}</small>}
          </>
        );
        return (
          <React.Fragment key={row.id}>
            {row.href && !String(row.href).startsWith('mcp://')
              ? <a className={`artifact-chain-node ${row.tone}`} href={row.href} target={String(row.href).startsWith('#') ? undefined : '_blank'} rel={String(row.href).startsWith('#') ? undefined : 'noreferrer'}>{body}</a>
              : <div className={`artifact-chain-node ${row.tone}`}>{body}</div>}
            {index < rows.length - 1 && <span className="artifact-chain-edge"></span>}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function ReadinessRadar({ project, summary, jobs, sessions }) {
  const rows = window.ControlSurfaceModel
    ? window.ControlSurfaceModel.readinessRadarRows(project, summary, jobs, sessions)
    : [];
  return (
    <div className="readiness-radar">
      {rows.map((row) => (
        <div key={row.id} className={`radar-spoke ${row.tone}`}>
          <span>{row.label}</span>
          <div className="radar-meter"><i style={{ width: `${row.score}%` }}></i></div>
          <strong>{row.score}</strong>
        </div>
      ))}
    </div>
  );
}

function ActivityHeatStrip({ entries = [], jobs = [] }) {
  const buckets = Array.from({ length: 14 }).map((_, index) => {
    const entry = entries[index];
    const job = jobs[index];
    const tone = entry?.outcome && entry.outcome !== 'ok'
      ? 'red'
      : job?.status === 'failed'
        ? 'red'
        : job?.status === 'running' || job?.status === 'queued'
          ? 'amber'
          : entry || job
            ? 'green'
            : 'grey';
    return { id: index, tone, label: entry?.toolName ?? job?.id ?? 'no activity' };
  });
  return (
    <div className="activity-heat-strip">
      {buckets.map((bucket) => <span key={bucket.id} className={bucket.tone} title={bucket.label}></span>)}
    </div>
  );
}

function buildControlMetrics(projects = [], jobs = [], sessions, approvals = []) {
  const activeProjects = projects.filter((project) => project.state !== 'ARCHIVED');
  const exceptions = activeProjects.filter((project) => EXCEPTION_STATES.includes(project.state));
  const readyProjects = activeProjects.filter((project) => project.state === 'READY_FOR_BUILD');
  const jobRows = Array.isArray(jobs) ? jobs : [];
  const queued = jobRows.filter((job) => job.status === 'queued').length;
  const running = jobRows.filter((job) => job.status === 'running').length;
  const failed = jobRows.filter((job) => job.status === 'failed').length;
  const sessionRows = Array.isArray(sessions)
    ? sessions
    : sessions?.data?.sessions ?? sessions?.sessions ?? [];
  const activeAgents = sessions?.data?.totalActive ?? sessions?.totalActive ?? sessionRows.length;
  const approvalRows = Array.isArray(approvals)
    ? approvals
    : approvals?.data?.decisions ?? approvals?.decisions ?? [];
  const linkedArtifacts = activeProjects.reduce((sum, project) => {
    const summary = project.artifactSummary ?? {};
    const artifactStatuses = [
      summary.jira?.status,
      summary.confluence?.status,
      summary.vcs?.status,
      summary.handoff?.status,
    ];
    return sum + artifactStatuses.filter((status) => status === 'linked' || status === 'ready').length;
  }, 0);
  const artifactSlots = activeProjects.length * 4;
  const artifactPercent = artifactSlots === 0 ? 0 : Math.round((linkedArtifacts / artifactSlots) * 100);
  const blockers = exceptions.length + failed + approvalRows.length;

  return {
    phaseRows: PIPELINE_PHASES.map((phase) => ({
      ...phase,
      count: activeProjects.filter((project) => phase.states.includes(project.state)).length,
    })),
    cards: [
      {
        id: 'flow',
        icon: 'context',
        label: 'Project flow',
        value: `${readyProjects.length}/${activeProjects.length}`,
        detail: `${exceptions.length} exceptions across active work`,
        badge: readyProjects.length > 0 ? 'handoff' : 'forming',
        tone: exceptions.length > 0 ? 'red' : readyProjects.length > 0 ? 'green' : 'amber',
        href: '#/projects',
      },
      {
        id: 'artifacts',
        icon: 'matrix',
        label: 'Artifact chain',
        value: `${artifactPercent}%`,
        detail: `${linkedArtifacts}/${artifactSlots || 0} Jira, docs, repo, handoff links`,
        badge: artifactPercent >= 85 ? 'linked' : artifactPercent > 0 ? 'partial' : 'empty',
        tone: artifactPercent >= 85 ? 'green' : artifactPercent > 0 ? 'amber' : 'grey',
        href: '#/projects',
      },
      {
        id: 'runway',
        icon: 'agent',
        label: 'Agent runway',
        value: `${activeAgents}`,
        detail: `${running} running, ${queued} queued`,
        badge: activeAgents > 0 ? 'online' : 'waiting',
        tone: activeAgents > 0 ? (queued > 0 ? 'amber' : 'green') : 'grey',
        href: '#/sessions',
      },
      {
        id: 'gates',
        icon: 'queue',
        label: 'Operator gates',
        value: `${blockers}`,
        detail: `${approvalRows.length} approvals, ${failed} failed jobs`,
        badge: blockers > 0 ? 'blocked' : 'clear',
        tone: failed + exceptions.length > 0 ? 'red' : approvalRows.length > 0 ? 'amber' : 'green',
        href: blockers > 0 && failed === 0 ? '#/policy' : '#/jobs',
      },
    ],
  };
}

function StatePill({ state }) {
  const tone = STATE_TONES[state] || 'grey';
  return <Pill tone={tone}>{stateLabel(state)}</Pill>;
}

function OutcomePill({ outcome }) {
  const map = { allow: 'green', deny: 'red', require_approval: 'amber', failure: 'red', refusal: 'red' };
  return <Pill tone={map[outcome] || 'grey'}>{outcome}</Pill>;
}

function Modal({ title, onClose, children, footer }) {
  return (
    <div className="modal-veil" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="head">
          <span className="title">{title}</span>
          <button className="close" onClick={onClose}>✕</button>
        </div>
        <div className="body">{children}</div>
        {footer && <div className="foot">{footer}</div>}
      </div>
    </div>
  );
}

function Drawer({ title, onClose, children, eyebrow }) {
  return (
    <>
      <div className="drawer-veil" onClick={onClose}></div>
      <div className="drawer">
        <div className="head">
          <div>
            {eyebrow && <div className="eyebrow-mono">{eyebrow}</div>}
            <div className="title">{title}</div>
          </div>
          <button className="close" onClick={onClose}>✕</button>
        </div>
        <div className="body">{children}</div>
      </div>
    </>
  );
}

function JsonView({ obj }) {
  const render = (v, indent = 0) => {
    const pad = '  '.repeat(indent);
    if (v === null) return <span className="nul">null</span>;
    if (typeof v === 'boolean') return <span className="b">{String(v)}</span>;
    if (typeof v === 'number') return <span className="n">{v}</span>;
    if (typeof v === 'string') return <span className="s">"{v}"</span>;
    if (Array.isArray(v)) {
      if (v.length === 0) return <>[]</>;
      return <>
        {'[\n'}
        {v.map((it, i) => <React.Fragment key={i}>{pad}  {render(it, indent + 1)}{i < v.length - 1 ? ',' : ''}{'\n'}</React.Fragment>)}
        {pad}{']'}
      </>;
    }
    if (typeof v === 'object') {
      const keys = Object.keys(v);
      if (keys.length === 0) return <>{'{}'}</>;
      return <>
        {'{\n'}
        {keys.map((k, i) => (
          <React.Fragment key={k}>
            {pad}  <span className="k">"{k}"</span>: {render(v[k], indent + 1)}{i < keys.length - 1 ? ',' : ''}{'\n'}
          </React.Fragment>
        ))}
        {pad}{'}'}
      </>;
    }
    return String(v);
  };
  return <div className="json-view">{render(obj)}</div>;
}

function ConfirmModal({ title, body, danger, onConfirm, onCancel, confirmLabel = 'Confirm', requireReason }) {
  const [reason, setReason] = useState('');
  const ok = !requireReason || reason.trim().length > 3;
  return (
    <Modal title={title} onClose={onCancel} footer={
      <>
        <button className="btn ghost" onClick={onCancel}>Cancel</button>
        <button className={'btn ' + (danger ? 'danger' : 'primary')}
                disabled={!ok}
                onClick={() => onConfirm(reason)}>
          {confirmLabel}
        </button>
      </>
    }>
      <p>{body}</p>
      {requireReason && (
        <>
          <h4>Reason — recorded in audit chain</h4>
          <textarea rows="3" placeholder="e.g. confirmed with project lead via Slack ref T-1148"
                    value={reason} onChange={e => setReason(e.target.value)} />
        </>
      )}
    </Modal>
  );
}

// expose
Object.assign(window, {
  useHashRoute, navigate, useTick,
  TopNav, RoleSelect, RolePortfolioFocus, PageHead, Sparkline, StatusDot, Pill, Icon, StatePill,
  OutcomePill, Modal, Drawer, JsonView, ConfirmModal,
  ProjectMark, ArtifactStrip, ProjectProgressRail, ReadinessScorecard,
  BuildControlRail, ProviderHealthStrip, PhaseConveyor, ArtifactChainDiagram,
  ReadinessRadar, ActivityHeatStrip, buildControlMetrics,
  ROUTES_PRIMARY, ROUTES_MORE,
  PIPELINE_PHASES, EXCEPTION_STATES, stateLabel, phaseForState,
  readinessPercent, artifactTone, repoHost,
});
