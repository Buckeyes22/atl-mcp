// Shared control-surface model for the static operator UI.
// Keep this file JSX-free so unit tests can evaluate it directly in Node.
(function attachControlSurfaceModel(root) {
  const PHASES = [
    { id: 'inception', label: 'Inception', states: ['DRAFT_INTAKE'], action: 'intake record', route: '#/projects' },
    { id: 'requirements', label: 'Requirements', states: ['CLARIFICATION_NEEDED'], action: 'clarify scope', route: '#/projects' },
    { id: 'blueprint', label: 'Blueprint', states: ['BLUEPRINT_READY'], action: 'architecture map', route: '#/projects' },
    { id: 'preflight', label: 'Preflight', states: ['PREFLIGHT_PASSED'], action: 'provider profile', route: '#/providers' },
    { id: 'provisioning', label: 'Provisioning', states: ['PROVISIONING_PREVIEWED', 'PROVISIONED'], action: 'Jira + docs + VCS', route: '#/jobs' },
    { id: 'context', label: 'Context', states: ['LINKED'], action: 'context pack', route: '#/projects' },
    { id: 'readiness', label: 'Readiness', states: ['VALIDATED'], action: 'gate review', route: '#/projects' },
    { id: 'handoff', label: 'Handoff', states: ['READY_FOR_BUILD'], action: 'agent packet', route: '#/sessions' },
    { id: 'build', label: 'Build', states: [], action: 'agent execution', route: '#/sessions' },
  ];

  const EXCEPTION_STATES = ['VALIDATION_FAILED', 'DRIFT_DETECTED'];

  const STATUS_TONES = {
    linked: 'green',
    ready: 'green',
    pass: 'green',
    ok: 'green',
    green: 'green',
    complete: 'green',
    completed: 'green',
    current: 'amber',
    planned: 'amber',
    not_ready: 'amber',
    warn: 'amber',
    warning: 'amber',
    amber: 'amber',
    queued: 'amber',
    running: 'amber',
    blocked: 'red',
    error: 'red',
    fail: 'red',
    failed: 'red',
    red: 'red',
    missing: 'grey',
    grey: 'grey',
    unknown: 'grey',
  };

  const READINESS_SCORE = {
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

  const ROLE_PROFILES = [
    { id: 'customer', label: 'Customer', shortLabel: 'Customer' },
    { id: 'product', label: 'Product Owner', shortLabel: 'Product' },
    { id: 'scrum', label: 'Scrum Master', shortLabel: 'Scrum' },
    { id: 'developer', label: 'Developer', shortLabel: 'Developer' },
    { id: 'devops', label: 'DevOps Engineer', shortLabel: 'DevOps' },
    { id: 'operator', label: 'Operator', shortLabel: 'Operator' },
  ];

  const ANALYZED_AGENT_SOURCES = ['velocity-code-engine', 'velocity-ops-engine'];

  const AGENT_ROLE_CATALOG = [
    {
      id: 'architect',
      label: 'Architect',
      description: 'Designs significant features, refactors, system boundaries, technology choices, and ADR-level tradeoffs before implementation starts.',
      bestFor: ['architecture decisions', 'system refactors', 'technical tradeoffs'],
      workClasses: ['architecture', 'design', 'planning', 'refactor'],
      avoidFor: 'Routine code edits with an accepted plan.',
      tools: ['read', 'write', 'edit', 'search', 'web evidence'],
      sourceRepos: ANALYZED_AGENT_SOURCES,
    },
    {
      id: 'implementer',
      label: 'Implementer',
      description: 'Turns an approved plan, ADR, or task specification into complete code with test-first execution and verification evidence.',
      bestFor: ['planned feature implementation', 'TDD execution', 'integration tasks'],
      workClasses: ['implementation', 'backend', 'frontend', 'integration', 'refactor'],
      avoidFor: 'Undefined requirements or architecture decisions that still need shaping.',
      tools: ['read', 'write', 'edit', 'search', 'tests'],
      sourceRepos: ANALYZED_AGENT_SOURCES,
    },
    {
      id: 'tdd-coach',
      label: 'TDD Coach',
      description: 'Keeps a task on a strict red-green-refactor loop and converts requirements into failing tests before production code changes.',
      bestFor: ['test-first planning', 'regression reproduction', 'red-green-refactor repair'],
      workClasses: ['testing', 'tdd', 'requirements', 'quality'],
      avoidFor: 'Large implementation ownership after the test target is clear.',
      tools: ['read', 'write', 'edit', 'test commands'],
      sourceRepos: ANALYZED_AGENT_SOURCES,
    },
    {
      id: 'tester',
      label: 'Tester',
      description: 'Adds unit, integration, property-based, and regression coverage after new code exists or a bug exposes missing test protection.',
      bestFor: ['test coverage', 'property tests', 'regression suites'],
      workClasses: ['testing', 'regression', 'quality', 'verification'],
      avoidFor: 'Owning production implementation fixes.',
      tools: ['read', 'write', 'edit', 'test commands'],
      sourceRepos: ANALYZED_AGENT_SOURCES,
    },
    {
      id: 'reviewer',
      label: 'Reviewer',
      description: 'Performs adversarial code review for correctness, security, maintainability, type-safety, missing tests, and spec compliance.',
      bestFor: ['code review', 'security review', 'quality gates'],
      workClasses: ['review', 'security', 'quality', 'correctness'],
      avoidFor: 'Implementing fixes it identifies.',
      tools: ['read', 'search', 'test inspection'],
      sourceRepos: ANALYZED_AGENT_SOURCES,
    },
    {
      id: 'critic',
      label: 'Critic',
      description: 'Validates implementation against the requested behavior after a builder reports completion and returns pass/fail violation reports.',
      bestFor: ['spec validation', 'acceptance checks', 'builder-critic loops'],
      workClasses: ['review', 'acceptance', 'quality', 'verification'],
      avoidFor: 'General implementation or architecture ownership.',
      tools: ['read', 'search', 'shell checks'],
      sourceRepos: ANALYZED_AGENT_SOURCES,
    },
    {
      id: 'judge',
      label: 'Judge',
      description: 'Filters raw review output for false positives, duplicate findings, weak evidence, unclear fixes, and severity inconsistencies.',
      bestFor: ['review triage', 'finding consolidation', 'false-positive filtering'],
      workClasses: ['review', 'quality', 'triage', 'governance'],
      avoidFor: 'Primary code review without an input report.',
      tools: ['read', 'search'],
      sourceRepos: ANALYZED_AGENT_SOURCES,
    },
    {
      id: 'researcher',
      label: 'Researcher',
      description: 'Gathers source-backed evidence when implementation, security, compliance, library behavior, or architecture depends on uncertainty.',
      bestFor: ['technical research', 'library comparison', 'standard verification'],
      workClasses: ['research', 'security', 'compliance', 'architecture'],
      avoidFor: 'Making final architecture or implementation decisions.',
      tools: ['read', 'write', 'edit', 'search', 'web evidence'],
      sourceRepos: ANALYZED_AGENT_SOURCES,
    },
    {
      id: 'docs',
      label: 'Docs',
      description: 'Updates API docs, architecture narratives, changelogs, READMEs, ADR-adjacent docs, and session handoff records after changes land.',
      bestFor: ['documentation updates', 'changelogs', 'session handoff'],
      workClasses: ['documentation', 'handoff', 'governance', 'release'],
      avoidFor: 'Writing ADR decisions or production logic.',
      tools: ['read', 'write', 'edit', 'search'],
      sourceRepos: ANALYZED_AGENT_SOURCES,
    },
    {
      id: 'ops',
      label: 'Ops',
      description: 'Handles release readiness, deployment execution, rollback operations, operational hardening, and incident response coordination.',
      bestFor: ['release readiness', 'deployment execution', 'incident response'],
      workClasses: ['deployment', 'incident-response', 'rollback', 'runtime', 'operations'],
      avoidFor: 'Feature implementation that has not reached release or runtime concerns.',
      tools: ['read', 'write', 'search', 'shell checks'],
      sourceRepos: ANALYZED_AGENT_SOURCES,
    },
    {
      id: 'guardrails-sentinel',
      label: 'Guardrails Sentinel',
      description: 'Runs targeted quality and guardrail audits for stubs, unsafe patterns, weak tests, type escapes, and code-level policy drift.',
      bestFor: ['guardrail scan', 'anti-stub audit', 'policy drift checks'],
      workClasses: ['quality', 'security', 'guardrails', 'audit'],
      avoidFor: 'Replacing full code review or test generation.',
      tools: ['read', 'search', 'scanner commands'],
      sourceRepos: ANALYZED_AGENT_SOURCES,
    },
    {
      id: 'post-incident',
      label: 'Post Incident',
      description: 'Traces a production bug back through specs, tests, and guardrails, then identifies missing coverage and prevention patterns.',
      bestFor: ['incident analysis', 'root-cause review', 'prevention coverage'],
      workClasses: ['incident-response', 'testing', 'quality', 'governance'],
      avoidFor: 'The immediate production bug fix itself.',
      tools: ['read', 'write', 'edit', 'search', 'shell checks'],
      sourceRepos: ANALYZED_AGENT_SOURCES,
    },
    {
      id: 'thinking-partner',
      label: 'Thinking Partner',
      description: 'Challenges high-stakes assumptions, scope choices, risk assessments, and architectural tradeoffs before code or commitments happen.',
      bestFor: ['decision review', 'risk assessment', 'scope challenge'],
      workClasses: ['planning', 'risk', 'architecture', 'strategy'],
      avoidFor: 'Executing implementation after the decision is settled.',
      tools: ['read', 'search', 'structured reasoning'],
      sourceRepos: ANALYZED_AGENT_SOURCES,
    },
  ];

  const ROLE_COPIES = {
    customer: {
      dashboardEyebrow: 'delivery · outcomes',
      dashboardTitle: 'Delivery status',
      dashboardSection: 'Milestones and readiness',
      projectsEyebrow: 'projects · delivery view',
      projectsTitle: 'Delivery portfolio',
      projectDetailEyebrow: 'project · delivery',
      projectWorkspaceLabel: 'Delivery status',
      queueEyebrow: 'supporting detail · queue',
      queueTitle: 'Work queue detail',
      agentsEyebrow: 'supporting detail · agents',
      agentsTitle: 'Agent activity detail',
      approvalsEyebrow: 'supporting detail · decisions',
      approvalsTitle: 'Decision support detail',
      providersEyebrow: 'supporting detail · providers',
      providersTitle: 'Provider readiness detail',
      primaryVocabulary: ['status', 'outcomes', 'milestones', 'readiness', 'blockers'],
    },
    product: {
      dashboardEyebrow: 'planning · scope',
      dashboardTitle: 'Planning readiness',
      dashboardSection: 'Requirements through trace',
      projectsEyebrow: 'projects · scope view',
      projectsTitle: 'Product planning board',
      projectDetailEyebrow: 'project · product',
      projectWorkspaceLabel: 'Scope and trace',
      queueEyebrow: 'supporting detail · queue',
      queueTitle: 'Planning work queue',
      agentsEyebrow: 'supporting detail · agents',
      agentsTitle: 'Handoff support detail',
      approvalsEyebrow: 'policy · planning gates',
      approvalsTitle: 'Scope decisions and gates',
      providersEyebrow: 'supporting detail · providers',
      providersTitle: 'Planning integration detail',
      primaryVocabulary: ['requirements', 'Jira', 'Confluence', 'trace', 'scope gaps'],
    },
    scrum: {
      dashboardEyebrow: 'flow · blockers',
      dashboardTitle: 'Flow control',
      dashboardSection: 'Blocked lanes and handoffs',
      projectsEyebrow: 'projects · flow view',
      projectsTitle: 'Team flow board',
      projectDetailEyebrow: 'project · flow',
      projectWorkspaceLabel: 'Flow and blockers',
      queueEyebrow: 'flow · queue',
      queueTitle: 'Queue and blockers',
      agentsEyebrow: 'flow · agents',
      agentsTitle: 'Agent handoff flow',
      approvalsEyebrow: 'flow · approvals',
      approvalsTitle: 'Approval blockers',
      providersEyebrow: 'flow · providers',
      providersTitle: 'Dependency health',
      primaryVocabulary: ['phase flow', 'blocked lanes', 'approvals', 'queue pressure', 'aging'],
    },
    developer: {
      dashboardEyebrow: 'pipeline · build inputs',
      dashboardTitle: 'Developer build pipeline',
      dashboardSection: 'Repo, context, handoff, and trace',
      projectsEyebrow: 'projects · developer workbench',
      projectsTitle: 'Project workbench',
      projectDetailEyebrow: 'project · developer',
      projectWorkspaceLabel: 'Developer workspace',
      queueEyebrow: 'build · queue',
      queueTitle: 'Build queue',
      agentsEyebrow: 'agents · public MCP',
      agentsTitle: 'Agent monitor',
      approvalsEyebrow: 'policy · decisions',
      approvalsTitle: 'Approvals and decision history',
      providersEyebrow: 'providers · health',
      providersTitle: 'Provider connections',
      primaryVocabulary: ['repo', 'checkout', 'context pack', 'handoff URI', 'logs'],
    },
    devops: {
      dashboardEyebrow: 'runtime · control',
      dashboardTitle: 'Runtime readiness',
      dashboardSection: 'Providers, queue, agents, and transport',
      projectsEyebrow: 'projects · runtime view',
      projectsTitle: 'Runtime project lanes',
      projectDetailEyebrow: 'project · runtime',
      projectWorkspaceLabel: 'Runtime and queue',
      queueEyebrow: 'runtime · queue',
      queueTitle: 'Queue runway',
      agentsEyebrow: 'runtime · agents',
      agentsTitle: 'Agent runtime monitor',
      approvalsEyebrow: 'runtime · gates',
      approvalsTitle: 'Operational gates',
      providersEyebrow: 'runtime · providers',
      providersTitle: 'Provider and transport health',
      primaryVocabulary: ['provider health', 'queue runway', 'agents', 'webhooks', 'transport'],
    },
    operator: {
      dashboardEyebrow: 'control plane · operations',
      dashboardTitle: 'Control-plane overview',
      dashboardSection: 'Health, queue, approvals, audit, and lifecycle',
      projectsEyebrow: 'projects · control surface',
      projectsTitle: 'Project control surface',
      projectDetailEyebrow: 'project · control surface',
      projectWorkspaceLabel: 'Control surface',
      queueEyebrow: 'build · queue',
      queueTitle: 'Build queue',
      agentsEyebrow: 'agents · public MCP',
      agentsTitle: 'Agent monitor',
      approvalsEyebrow: 'policy · decisions',
      approvalsTitle: 'Approvals and decision history',
      providersEyebrow: 'providers · health',
      providersTitle: 'Provider connections',
      primaryVocabulary: ['health', 'queue', 'approvals', 'audit', 'providers', 'lifecycle'],
    },
  };

  function toneForStatus(status) {
    return STATUS_TONES[String(status ?? 'unknown')] ?? 'grey';
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function numeric(value, fallback) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function stateLabel(state) {
    return String(state ?? '').toLowerCase().replace(/_/g, ' ');
  }

  function phaseIndexForState(state) {
    if (EXCEPTION_STATES.includes(state)) return 4;
    const index = PHASES.findIndex((phase) => phase.states.includes(state));
    return index < 0 ? 0 : index;
  }

  function phaseForState(state) {
    return PHASES[phaseIndexForState(state)] ?? PHASES[0];
  }

  function readinessPercent(projectOrState) {
    const state = typeof projectOrState === 'string' ? projectOrState : projectOrState?.state;
    return READINESS_SCORE[state] ?? 0;
  }

  function freshnessLabel(value) {
    if (!value) return 'not synced';
    const text = String(value);
    return text.length >= 10 ? text.slice(0, 10) : text;
  }

  function repoHost(url) {
    if (!url) return null;
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  }

  function artifactCount(actual, planned) {
    const a = numeric(actual, 0);
    const p = numeric(planned, 0);
    if (a > 0) return String(a);
    if (p > 0) return `${p} planned`;
    return 'none';
  }

  function rowBase(id, icon, label, source, count, planned, href) {
    const status = source?.status ?? (href ? 'linked' : planned > 0 ? 'planned' : 'missing');
    return {
      id,
      icon,
      label,
      status,
      tone: toneForStatus(status),
      href: href ?? null,
      count,
      planned,
      freshness: freshnessLabel(source?.lastSyncedAt),
      provenance: source?.provenance ?? 'derived from admin payload',
      linkHealth: source?.linkHealth ?? (href ? 'ok' : 'unknown'),
      blockingReason: source?.blockingReason ?? null,
    };
  }

  function artifactChainRows(project, summary) {
    const safe = summary ?? {};
    const jira = safe.jira ?? {};
    const confluence = safe.confluence ?? {};
    const vcs = safe.vcs ?? {};
    const context = safe.context ?? {};
    const readiness = safe.readiness ?? {};
    const handoff = safe.handoff ?? {};
    const audit = safe.audit ?? {};
    const queue = safe.queue ?? {};
    return [
      {
        ...rowBase('jira', 'jira', 'Jira', jira, numeric(jira.issueCount, 0), numeric(jira.plannedCount, 0), jira.projectUrl ?? null),
        value: artifactCount(jira.issueCount, jira.plannedCount),
        sub: jira.projectKey ?? project?.atlassianProjectKey ?? '-',
      },
      {
        ...rowBase('confluence', 'docs', 'Confluence', confluence, numeric(confluence.pageCount, 0), numeric(confluence.plannedCount, 0), confluence.spaceUrl ?? null),
        value: artifactCount(confluence.pageCount, confluence.plannedCount),
        sub: confluence.spaceId ?? '-',
      },
      {
        ...rowBase('vcs', 'repo', 'VCS', vcs, numeric(vcs.fileCount, 0), numeric(vcs.fileCount, 0), vcs.repoUrl ?? null),
        value: vcs.repoUrl ? 'linked' : artifactCount(vcs.fileCount, 0),
        sub: repoHost(vcs.repoUrl) ?? 'repo',
      },
      {
        ...rowBase('context', 'context', 'Context pack', context, numeric(context.packCount, 0), numeric(context.plannedCount, 1), context.uri ?? null),
        value: context.uri ? 'ready' : artifactCount(context.packCount, context.plannedCount ?? 1),
        sub: context.uri ?? 'mcp context',
      },
      {
        ...rowBase('readiness', 'score', 'Readiness', readiness, numeric(readiness.score, readinessPercent(project)), numeric(readiness.gateCount, 0), null),
        value: `${numeric(readiness.score, readinessPercent(project))}%`,
        sub: readiness.verdict ?? stateLabel(project?.state),
      },
      {
        ...rowBase('handoff', 'handoff', 'Handoff', handoff, numeric(handoff.bundleCount, 0), numeric(handoff.plannedCount, 1), handoff.uri ?? null),
        value: handoff.status === 'ready' ? 'ready' : artifactCount(handoff.bundleCount, 1),
        sub: handoff.latestBundleId ?? handoff.uri ?? 'agent packet',
      },
      {
        ...rowBase('audit', 'audit', 'Audit', audit, numeric(audit.eventCount, 0), 0, null),
        value: `${numeric(audit.eventCount, 0)}`,
        sub: audit.latestAt ? `latest ${freshnessLabel(audit.latestAt)}` : 'signed chain',
      },
      {
        ...rowBase('queue', 'queue', 'Queue', queue, numeric(queue.openJobs, 0), 0, '#/jobs'),
        value: `${numeric(queue.openJobs, 0)}`,
        sub: `${numeric(queue.runningJobs, 0)} running, ${numeric(queue.failedJobs, 0)} failed`,
      },
    ];
  }

  function phaseConveyorRows(project, summary) {
    const current = phaseIndexForState(project?.state);
    const exception = EXCEPTION_STATES.includes(project?.state);
    const buildActive = numeric(summary?.queue?.runningJobs, 0) > 0;
    return PHASES.map((phase, index) => {
      let status = index < current ? 'complete' : index === current ? 'current' : 'planned';
      if (phase.id === 'build' && buildActive) status = 'current';
      if (exception && index >= current) status = index === current ? 'blocked' : 'planned';
      return {
        ...phase,
        index,
        status,
        tone: toneForStatus(status),
        blockingReason: status === 'blocked' ? summary?.readiness?.blockingReason ?? stateLabel(project?.state) : null,
      };
    });
  }

  function commandActions(project, summary) {
    const safe = summary ?? {};
    const handoffUri = safe.handoff?.uri ?? safe.handoff?.latestBundleId ?? null;
    return [
      { id: 'open-jira', icon: 'jira', label: 'Open Jira', href: safe.jira?.projectUrl ?? null, enabled: Boolean(safe.jira?.projectUrl) },
      { id: 'open-confluence', icon: 'docs', label: 'Open Confluence', href: safe.confluence?.spaceUrl ?? null, enabled: Boolean(safe.confluence?.spaceUrl) },
      { id: 'open-repo', icon: 'repo', label: 'Open repo', href: safe.vcs?.repoUrl ?? null, enabled: Boolean(safe.vcs?.repoUrl) },
      { id: 'refresh-context', icon: 'context', label: 'Refresh context', href: '#/projects', enabled: project?.state !== 'ARCHIVED' },
      { id: 'rerun-readiness', icon: 'score', label: 'Rerun readiness', href: '#/projects', enabled: project?.state !== 'ARCHIVED' },
      { id: 'retry-provision', icon: 'queue', label: 'Retry provision', href: '#/jobs', enabled: safe.queue?.failedJobs > 0 || ['missing', 'planned', 'error'].includes(safe.vcs?.status) },
      { id: 'copy-handoff-uri', icon: 'handoff', label: 'Copy handoff URI', copyValue: handoffUri, enabled: Boolean(handoffUri) },
      { id: 'open-agent-monitor', icon: 'agent', label: 'Open agent monitor', href: '#/sessions', enabled: true },
      { id: 'open-queue', icon: 'queue', label: 'Open queue', href: '#/jobs', enabled: true },
    ];
  }

  function providerHealthRows(health, providers) {
    const components = health?.components ?? {};
    const providerRows = safeArray(providers?.providers);
    const providerById = new Map(providerRows.map((provider) => [provider.id, provider]));
    const order = [
      ['jira', 'Jira'],
      ['confluence', 'Confluence'],
      ['vcs', 'VCS'],
      ['context', 'Qdrant / context'],
      ['queue', 'Queue'],
      ['audit', 'Audit chain'],
      ['transport', 'MCP transport'],
      ['webhooks', 'Webhooks'],
    ];
    return order.map(([id, fallbackLabel]) => {
      const provider = providerById.get(id) ?? (id === 'vcs' ? providerById.get('bitbucket') : undefined);
      const component = components[id] ?? (id === 'jira' || id === 'confluence' ? components.atlassian : id === 'vcs' ? components.bitbucket : undefined);
      const reachable = provider?.reachable;
      const status = component?.status ?? (reachable === true ? 'green' : reachable === false ? 'red' : provider?.configured === false ? 'grey' : 'grey');
      return {
        id,
        label: component?.label ?? provider?.name ?? fallbackLabel,
        status,
        tone: toneForStatus(status),
        sub: component?.sub ?? provider?.details ?? (provider?.configured === false ? 'not configured' : 'no signal'),
        provenance: component ? 'admin.health.get' : provider ? 'admin.providers.list' : 'not reported',
      };
    });
  }

  function queuePhaseRows(jobs) {
    const rows = [
      { id: 'jira', label: 'Jira', icon: 'jira', matches: ['jira'] },
      { id: 'confluence', label: 'Confluence', icon: 'docs', matches: ['confluence'] },
      { id: 'vcs', label: 'VCS', icon: 'repo', matches: ['vcs', 'repo'] },
      { id: 'context', label: 'Context', icon: 'context', matches: ['context'] },
      { id: 'readiness', label: 'Readiness', icon: 'score', matches: ['readiness', 'validation'] },
      { id: 'handoff', label: 'Handoff', icon: 'handoff', matches: ['handoff'] },
      { id: 'build', label: 'Build execution', icon: 'agent', matches: ['build', 'agent'] },
    ];
    return rows.map((row) => {
      const matched = safeArray(jobs).filter((job) => row.matches.some((part) => String(job.id ?? '').toLowerCase().includes(part)));
      const active = matched.filter((job) => job.status === 'queued' || job.status === 'running').length;
      const failed = matched.filter((job) => job.status === 'failed').length;
      const status = failed > 0 ? 'failed' : active > 0 ? 'running' : matched.length > 0 ? 'complete' : 'missing';
      return { ...row, count: matched.length, active, failed, status, tone: toneForStatus(status) };
    });
  }

  function agentOperationLanes(sessions, jobs, projects, approvals) {
    const sessionRows = safeArray(sessions?.data?.sessions ?? sessions?.sessions ?? sessions);
    const jobRows = safeArray(jobs);
    const projectRows = safeArray(projects);
    const approvalRows = safeArray(approvals);
    return [
      { id: 'available', label: 'Available agents', count: sessionRows.length, tone: sessionRows.length > 0 ? 'green' : 'grey' },
      { id: 'assigned', label: 'Assigned agents', count: jobRows.filter((job) => job.status === 'running').length, tone: 'amber' },
      { id: 'handoffs', label: 'Ready handoffs', count: projectRows.filter((project) => project.state === 'READY_FOR_BUILD').length, tone: 'green' },
      { id: 'running', label: 'Running jobs', count: jobRows.filter((job) => job.status === 'running').length, tone: 'amber' },
      { id: 'blocked', label: 'Blocked jobs', count: jobRows.filter((job) => job.status === 'queued').length + approvalRows.length, tone: approvalRows.length > 0 ? 'amber' : 'grey' },
      { id: 'failed', label: 'Failed jobs', count: jobRows.filter((job) => job.status === 'failed').length, tone: jobRows.some((job) => job.status === 'failed') ? 'red' : 'grey' },
      { id: 'stale', label: 'Stale handoffs', count: projectRows.filter((project) => project.artifactSummary?.handoff?.status === 'blocked').length, tone: 'red' },
      { id: 'approvals', label: 'Pending approvals', count: approvalRows.length, tone: approvalRows.length > 0 ? 'amber' : 'grey' },
    ];
  }

  function readinessRadarRows(project, summary, jobs, sessions) {
    const chain = artifactChainRows(project, summary);
    const lookup = new Map(chain.map((row) => [row.id, row]));
    const activeAgents = numeric(sessions?.data?.totalActive ?? sessions?.totalActive, 0);
    const failedJobs = safeArray(jobs).filter((job) => job.status === 'failed').length;
    return [
      { id: 'jira', label: 'Jira', score: lookup.get('jira')?.tone === 'green' ? 100 : 45, tone: lookup.get('jira')?.tone ?? 'grey' },
      { id: 'docs', label: 'Docs', score: lookup.get('confluence')?.tone === 'green' ? 100 : 45, tone: lookup.get('confluence')?.tone ?? 'grey' },
      { id: 'repo', label: 'Repo', score: lookup.get('vcs')?.tone === 'green' ? 100 : 45, tone: lookup.get('vcs')?.tone ?? 'grey' },
      { id: 'context', label: 'Context', score: lookup.get('context')?.tone === 'green' ? 100 : 60, tone: lookup.get('context')?.tone ?? 'grey' },
      { id: 'handoff', label: 'Handoff', score: lookup.get('handoff')?.tone === 'green' ? 100 : 35, tone: lookup.get('handoff')?.tone ?? 'grey' },
      { id: 'agents', label: 'Agents', score: activeAgents > 0 ? 100 : 40, tone: activeAgents > 0 ? 'green' : 'grey' },
      { id: 'jobs', label: 'Jobs', score: failedJobs > 0 ? 20 : 100, tone: failedJobs > 0 ? 'red' : 'green' },
    ];
  }

  function failedJobRows(jobs) {
    return safeArray(jobs).filter((job) => job.status === 'failed');
  }

  function activeJobRows(jobs) {
    return safeArray(jobs).filter((job) => job.status === 'queued' || job.status === 'running');
  }

  function developerNextAction(project, summary, jobs) {
    const safe = summary ?? {};
    const failedJobs = failedJobRows(jobs).length;
    const activeJobs = activeJobRows(jobs).length;
    const repoLinked = Boolean(safe.vcs?.repoUrl);
    const contextUri = safe.context?.uri ?? null;
    const handoffUri = safe.handoff?.uri ?? safe.handoff?.latestBundleId ?? null;

    if (failedJobs > 0) {
      return {
        id: 'inspect-failure',
        label: 'Inspect failed job',
        detail: `${failedJobs} failed job(s) need logs, provider output, or a retry.`,
        href: '#/jobs',
        tone: 'red',
      };
    }
    if (!repoLinked) {
      return {
        id: 'provision-repo',
        label: 'Provision repository',
        detail: 'No repository link is available for a local checkout.',
        href: '#/jobs',
        tone: 'amber',
      };
    }
    if (!contextUri) {
      return {
        id: 'refresh-context',
        label: 'Refresh context pack',
        detail: 'Code exists, but the context pack is not ready for a developer or agent.',
        href: '#/projects',
        tone: 'amber',
      };
    }
    if (!handoffUri || safe.handoff?.status !== 'ready') {
      return {
        id: 'compose-handoff',
        label: 'Compose handoff bundle',
        detail: 'Repo and context are present; create the agent-ready handoff packet.',
        href: '#/jobs',
        tone: 'amber',
      };
    }
    if (activeJobs > 0) {
      return {
        id: 'watch-queue',
        label: 'Watch running job',
        detail: `${activeJobs} active queue item(s) can change the build inputs.`,
        href: '#/jobs',
        tone: 'amber',
      };
    }
    return {
      id: 'open-handoff',
      label: 'Open handoff',
      detail: `Use ${handoffUri} with the repo, Jira work, and docs already linked.`,
      href: safe.vcs?.repoUrl ?? '#/sessions',
      tone: project?.state === 'READY_FOR_BUILD' ? 'green' : 'amber',
      handoffUri,
    };
  }

  function developerCommandRows(project, summary, jobs) {
    const safe = summary ?? {};
    const repoUrl = safe.vcs?.repoUrl ?? null;
    const contextUri = safe.context?.uri ?? null;
    const handoffUri = safe.handoff?.uri ?? safe.handoff?.latestBundleId ?? null;
    const failedJobs = failedJobRows(jobs).length;
    const traceRows = safeArray(safe.traceRows);
    const repoPaths = traceRows.map((row) => row.repoPath).filter(Boolean);
    return [
      {
        id: 'checkout',
        label: 'Checkout',
        value: repoUrl ? `git clone ${repoUrl}` : 'repo link pending',
        href: repoUrl,
        tone: repoUrl ? 'green' : 'amber',
      },
      {
        id: 'branch',
        label: 'Branch',
        value: safe.vcs?.branchName ?? `feature/${String(project?.key ?? 'project').toLowerCase()}-handoff`,
        tone: repoUrl ? 'green' : 'grey',
      },
      {
        id: 'context',
        label: 'Context',
        value: contextUri ?? 'context pack pending',
        tone: contextUri ? 'green' : 'amber',
      },
      {
        id: 'handoff',
        label: 'Handoff',
        value: handoffUri ?? 'handoff pending',
        tone: handoffUri ? 'green' : 'amber',
      },
      {
        id: 'verify',
        label: 'Verify',
        value: failedJobs > 0 ? 'open failed job log' : 'npm test',
        href: failedJobs > 0 ? '#/jobs' : null,
        tone: failedJobs > 0 ? 'red' : 'green',
      },
      {
        id: 'files',
        label: 'Files',
        value: repoPaths.length > 0 ? `${repoPaths.slice(0, 2).join(', ')}${repoPaths.length > 2 ? ' +' + (repoPaths.length - 2) : ''}` : `${numeric(safe.vcs?.fileCount, 0)} seeded files`,
        tone: repoPaths.length > 0 || numeric(safe.vcs?.fileCount, 0) > 0 ? 'green' : 'grey',
      },
    ];
  }

  function developerLensRows(project, summary, jobs, sessions) {
    const safe = summary ?? {};
    const failedJobs = failedJobRows(jobs).length;
    const activeJobs = activeJobRows(jobs).length;
    const traceRows = safeArray(safe.traceRows);
    const repoLinked = Boolean(safe.vcs?.repoUrl);
    const contextReady = Boolean(safe.context?.uri);
    const handoffReady = safe.handoff?.status === 'ready' || Boolean(safe.handoff?.uri);
    const activeAgents = numeric(sessions?.data?.totalActive ?? sessions?.totalActive, 0);
    const next = developerNextAction(project, safe, jobs);
    return [
      {
        id: 'actionability',
        label: 'Actionability',
        status: next.label,
        detail: next.detail,
        tone: next.tone,
      },
      {
        id: 'code-proximity',
        label: 'Code proximity',
        status: repoLinked ? 'repo linked' : 'repo missing',
        detail: repoLinked ? `${repoHost(safe.vcs?.repoUrl) ?? 'repo'} · ${numeric(safe.vcs?.fileCount, 0)} files` : 'provision or link a repository before build work',
        tone: repoLinked ? 'green' : 'amber',
      },
      {
        id: 'debuggability',
        label: 'Debuggability',
        status: failedJobs > 0 ? `${failedJobs} failure(s)` : activeJobs > 0 ? `${activeJobs} active job(s)` : 'quiet queue',
        detail: failedJobs > 0 ? 'failed job details are the first stop' : 'queue state is available without leaving the project',
        tone: failedJobs > 0 ? 'red' : activeJobs > 0 ? 'amber' : 'green',
      },
      {
        id: 'context-quality',
        label: 'Context quality',
        status: contextReady ? 'context pack ready' : 'context pending',
        detail: safe.context?.uri ?? safe.context?.provenance ?? 'no context URI',
        tone: contextReady ? 'green' : 'amber',
      },
      {
        id: 'trace-usefulness',
        label: 'Trace usefulness',
        status: traceRows.length > 0 ? `${traceRows.length} mapped rows` : 'trace missing',
        detail: traceRows.length > 0 ? 'requirements map to Jira, docs, repo paths, context, readiness, and handoff' : 'no requirement-to-code mapping',
        tone: traceRows.length > 0 ? 'green' : 'amber',
      },
      {
        id: 'handoff-clarity',
        label: 'Handoff clarity',
        status: handoffReady ? 'handoff ready' : 'handoff pending',
        detail: safe.handoff?.uri ?? safe.handoff?.latestBundleId ?? safe.handoff?.blockingReason ?? 'no handoff URI',
        tone: handoffReady ? 'green' : 'amber',
      },
      {
        id: 'noise-control',
        label: 'Noise control',
        status: activeAgents > 0 ? `${activeAgents} agent(s) visible` : 'ops secondary',
        detail: 'provider health, phases, audit, and queue stay below build inputs',
        tone: 'green',
      },
    ];
  }

  function roleProfiles() {
    return ROLE_PROFILES.map((role) => ({ ...role }));
  }

  function agentRoleCatalog() {
    return AGENT_ROLE_CATALOG.map((agent) => ({
      ...agent,
      bestFor: safeArray(agent.bestFor).slice(),
      workClasses: safeArray(agent.workClasses).slice(),
      tools: safeArray(agent.tools).slice(),
      sourceRepos: safeArray(agent.sourceRepos).slice(),
    }));
  }

  function normalizeRole(role) {
    const id = String(role ?? 'developer');
    return ROLE_COPIES[id] ? id : 'developer';
  }

  function roleCopy(role) {
    const id = normalizeRole(role);
    return {
      id,
      label: ROLE_PROFILES.find((profile) => profile.id === id)?.label ?? 'Developer',
      ...ROLE_COPIES[id],
    };
  }

  function countProjectArtifacts(summary) {
    const safe = summary ?? {};
    return ['jira', 'confluence', 'vcs', 'context', 'handoff'].filter((key) => {
      const status = safe[key]?.status;
      return status === 'linked' || status === 'ready';
    }).length;
  }

  function roleProjectFocus(role, project, summary, jobs, sessions) {
    const id = normalizeRole(role);
    const safe = summary ?? {};
    const failedJobs = failedJobRows(jobs).length;
    const activeJobs = activeJobRows(jobs).length;
    const traceRows = safeArray(safe.traceRows);
    const activeAgents = numeric(sessions?.data?.totalActive ?? sessions?.totalActive, 0);
    const readinessScore = numeric(safe.readiness?.score, readinessPercent(project));
    const blockerText = safe.readiness?.blockingReason ?? (EXCEPTION_STATES.includes(project?.state) ? stateLabel(project?.state) : null);
    const phase = phaseForState(project?.state);

    if (id === 'customer') {
      return {
        role: id,
        title: 'Delivery status',
        primaryAction: blockerText
          ? { id: 'review-blocker', label: 'Review blocker', detail: blockerText, href: '#/projects', tone: 'red' }
          : { id: 'view-progress', label: 'View progress', detail: `${phase.label} is the current delivery phase.`, href: '#/projects', tone: readinessScore >= 80 ? 'green' : 'amber' },
        emphasizedPanels: ['milestones', 'readiness', 'resources', 'timeline'],
        cards: [
          { id: 'delivery-status', icon: 'score', label: 'Delivery status', value: stateLabel(project?.state), detail: `${phase.label} phase`, tone: EXCEPTION_STATES.includes(project?.state) ? 'red' : readinessScore >= 80 ? 'green' : 'amber' },
          { id: 'readiness', icon: 'score', label: 'Readiness', value: `${readinessScore}%`, detail: safe.readiness?.verdict ?? 'readiness gate', tone: readinessScore >= 80 ? 'green' : readinessScore >= 50 ? 'amber' : 'red' },
          { id: 'blockers', icon: 'audit', label: 'Blockers', value: blockerText ? 'blocked' : 'clear', detail: blockerText ?? 'no blocking reason reported', tone: blockerText ? 'red' : 'green' },
          { id: 'recent-progress', icon: 'activity', label: 'Recent progress', value: safe.audit?.latestAt ? freshnessLabel(safe.audit.latestAt) : 'not synced', detail: `${countProjectArtifacts(safe)}/5 artifact links ready`, tone: countProjectArtifacts(safe) >= 3 ? 'green' : 'amber' },
          { id: 'project-links', icon: 'jira', label: 'Project links', value: `${safe.jira?.projectUrl ? 'Jira' : 'Jira pending'} / ${safe.confluence?.spaceUrl ? 'Docs' : 'Docs pending'}`, detail: 'Jira and Confluence are the customer-facing references', tone: safe.jira?.projectUrl || safe.confluence?.spaceUrl ? 'green' : 'amber' },
        ],
      };
    }

    if (id === 'product') {
      const planned = numeric(safe.jira?.plannedCount, 0) + numeric(safe.confluence?.plannedCount, 0);
      return {
        role: id,
        title: 'Scope and trace',
        primaryAction: traceRows.length > 0
          ? { id: 'review-trace', label: 'Review trace', detail: `${traceRows.length} trace rows connect requirements to artifacts.`, href: '#/projects', tone: 'green' }
          : { id: 'close-scope-gaps', label: 'Close scope gaps', detail: 'Trace rows are missing or not yet synced.', href: '#/projects', tone: 'amber' },
        emphasizedPanels: ['jira', 'confluence', 'trace', 'readiness'],
        cards: [
          { id: 'requirements', icon: 'matrix', label: 'Requirements', value: `${planned} planned`, detail: `${numeric(safe.jira?.issueCount, 0)} Jira issues and ${numeric(safe.confluence?.pageCount, 0)} docs linked`, tone: planned > 0 ? 'green' : 'amber' },
          { id: 'jira', icon: 'jira', label: 'Jira cards', value: artifactCount(safe.jira?.issueCount, safe.jira?.plannedCount), detail: safe.jira?.projectKey ?? project?.atlassianProjectKey ?? 'project key pending', tone: toneForStatus(safe.jira?.status) },
          { id: 'confluence', icon: 'docs', label: 'Confluence pages', value: artifactCount(safe.confluence?.pageCount, safe.confluence?.plannedCount), detail: safe.confluence?.spaceId ?? 'space pending', tone: toneForStatus(safe.confluence?.status) },
          { id: 'trace', icon: 'trace', label: 'Trace matrix', value: `${traceRows.length}`, detail: traceRows.length > 0 ? 'requirements map through repo and handoff' : 'trace rows missing', tone: traceRows.length > 0 ? 'green' : 'amber' },
          { id: 'scope-gaps', icon: 'score', label: 'Scope gaps', value: readinessScore >= 80 ? 'low' : 'review', detail: safe.readiness?.verdict ?? `${readinessScore}% readiness`, tone: readinessScore >= 80 ? 'green' : 'amber' },
        ],
      };
    }

    if (id === 'scrum') {
      return {
        role: id,
        title: 'Flow and blockers',
        primaryAction: blockerText || failedJobs > 0
          ? { id: 'clear-blocker', label: 'Clear blocker', detail: blockerText ?? `${failedJobs} failed job(s) need triage.`, href: failedJobs > 0 ? '#/jobs' : '#/projects', tone: 'red' }
          : { id: 'review-flow', label: 'Review flow', detail: `${activeJobs} active jobs and ${phase.label} current phase.`, href: '#/jobs', tone: activeJobs > 0 ? 'amber' : 'green' },
        emphasizedPanels: ['phase-flow', 'queue', 'approvals', 'timeline'],
        cards: [
          { id: 'phase-flow', icon: 'activity', label: 'Phase flow', value: phase.label, detail: stateLabel(project?.state), tone: EXCEPTION_STATES.includes(project?.state) ? 'red' : 'amber' },
          { id: 'blockers', icon: 'audit', label: 'Blocked lanes', value: blockerText || failedJobs > 0 ? 'blocked' : 'clear', detail: blockerText ?? `${failedJobs} failed jobs`, tone: blockerText || failedJobs > 0 ? 'red' : 'green' },
          { id: 'queue', icon: 'queue', label: 'Queue pressure', value: `${activeJobs}`, detail: `${failedJobs} failed`, tone: failedJobs > 0 ? 'red' : activeJobs > 0 ? 'amber' : 'green' },
          { id: 'handoff', icon: 'handoff', label: 'Handoff readiness', value: safe.handoff?.status ?? 'pending', detail: safe.handoff?.uri ?? 'handoff URI pending', tone: toneForStatus(safe.handoff?.status) },
        ],
      };
    }

    if (id === 'devops') {
      return {
        role: id,
        title: 'Runtime and queue',
        primaryAction: failedJobs > 0
          ? { id: 'inspect-runtime-failure', label: 'Inspect runtime failure', detail: `${failedJobs} failed job(s) need logs or provider probes.`, href: '#/jobs', tone: 'red' }
          : { id: 'probe-runtime', label: 'Probe runtime', detail: `${activeAgents} connected agent(s), ${activeJobs} active job(s).`, href: '#/providers', tone: activeJobs > 0 ? 'amber' : 'green' },
        emphasizedPanels: ['runtime', 'queue', 'providers', 'audit'],
        cards: [
          { id: 'provider-health', icon: 'score', label: 'Provider health', value: safe.vcs?.status ?? 'derived', detail: safe.vcs?.repoUrl ?? 'repo/provider link pending', tone: toneForStatus(safe.vcs?.status) },
          { id: 'queue', icon: 'queue', label: 'Queue runway', value: `${activeJobs}`, detail: `${failedJobs} failed jobs`, tone: failedJobs > 0 ? 'red' : activeJobs > 0 ? 'amber' : 'green' },
          { id: 'agents', icon: 'agent', label: 'Agents', value: `${activeAgents}`, detail: 'public MCP sessions', tone: activeAgents > 0 ? 'green' : 'grey' },
          { id: 'transport', icon: 'activity', label: 'Transport', value: activeAgents > 0 ? 'active' : 'idle', detail: 'MCP transport and handoff lane', tone: activeAgents > 0 ? 'green' : 'grey' },
          { id: 'webhooks', icon: 'audit', label: 'Webhooks', value: safe.audit?.latestAt ? 'signaled' : 'no signal', detail: safe.audit?.provenance ?? 'audit chain is the fallback signal', tone: safe.audit?.latestAt ? 'green' : 'grey' },
        ],
      };
    }

    if (id === 'operator') {
      return {
        role: id,
        title: 'Control surface',
        primaryAction: failedJobs > 0
          ? { id: 'triage-failure', label: 'Triage failure', detail: `${failedJobs} failed job(s) are in the lane.`, href: '#/jobs', tone: 'red' }
          : { id: 'review-control-surface', label: 'Review control surface', detail: `${phase.label}, ${activeJobs} active jobs, ${countProjectArtifacts(safe)}/5 artifacts.`, href: '#/projects', tone: activeJobs > 0 ? 'amber' : 'green' },
        emphasizedPanels: ['health', 'queue', 'approvals', 'audit', 'providers', 'lifecycle'],
        cards: [
          { id: 'health', icon: 'score', label: 'Health', value: EXCEPTION_STATES.includes(project?.state) ? 'exception' : 'nominal', detail: stateLabel(project?.state), tone: EXCEPTION_STATES.includes(project?.state) ? 'red' : 'green' },
          { id: 'queue', icon: 'queue', label: 'Queue', value: `${activeJobs}`, detail: `${failedJobs} failed jobs`, tone: failedJobs > 0 ? 'red' : activeJobs > 0 ? 'amber' : 'green' },
          { id: 'audit', icon: 'audit', label: 'Audit', value: safe.audit?.eventCount ?? 0, detail: safe.audit?.latestAt ? `latest ${freshnessLabel(safe.audit.latestAt)}` : 'signed chain', tone: 'green' },
          { id: 'lifecycle', icon: 'activity', label: 'Lifecycle', value: phase.label, detail: stateLabel(project?.state), tone: EXCEPTION_STATES.includes(project?.state) ? 'red' : 'amber' },
        ],
      };
    }

    const developerAction = developerNextAction(project, safe, jobs);
    return {
      role: 'developer',
      title: 'Developer workspace',
      primaryAction: developerAction,
      emphasizedPanels: ['developer-workspace', 'trace', 'jobs', 'handoff'],
      cards: [
        { id: 'repo', icon: 'repo', label: 'Repository', value: safe.vcs?.repoUrl ? repoHost(safe.vcs.repoUrl) ?? 'linked' : 'pending', detail: safe.vcs?.repoUrl ?? 'repo link unavailable', tone: safe.vcs?.repoUrl ? 'green' : 'amber' },
        { id: 'context', icon: 'context', label: 'Context pack', value: safe.context?.uri ?? 'pending', detail: safe.context?.provenance ?? 'MCP context URI', tone: safe.context?.uri ? 'green' : 'amber' },
        { id: 'handoff', icon: 'handoff', label: 'Handoff URI', value: safe.handoff?.uri ?? safe.handoff?.latestBundleId ?? 'pending', detail: safe.handoff?.status ?? 'agent packet', tone: safe.handoff?.uri || safe.handoff?.status === 'ready' ? 'green' : 'amber' },
        { id: 'debug', icon: 'queue', label: 'Debug surface', value: failedJobs > 0 ? `${failedJobs} failed` : 'clear', detail: failedJobs > 0 ? 'open failed job logs' : `${activeJobs} active jobs`, tone: failedJobs > 0 ? 'red' : activeJobs > 0 ? 'amber' : 'green' },
        { id: 'trace', icon: 'trace', label: 'Trace-to-file', value: `${traceRows.length}`, detail: traceRows[0]?.repoPath ?? 'repo path mapping pending', tone: traceRows.length > 0 ? 'green' : 'amber' },
      ],
    };
  }

  function rolePortfolioFocus(role, projects, jobs, sessions, approvals) {
    const id = normalizeRole(role);
    const projectRows = safeArray(projects);
    const jobRows = safeArray(jobs);
    const approvalRows = safeArray(approvals);
    const queued = jobRows.filter((job) => job.status === 'queued').length;
    const running = jobRows.filter((job) => job.status === 'running').length;
    const failed = jobRows.filter((job) => job.status === 'failed').length;
    const activeJobs = queued + running;
    const ready = projectRows.filter((project) => project.state === 'READY_FOR_BUILD').length;
    const blocked = projectRows.filter((project) => EXCEPTION_STATES.includes(project.state)).length + failed;
    const activeAgents = numeric(sessions?.data?.totalActive ?? sessions?.totalActive ?? (Array.isArray(sessions) ? sessions.length : 0), 0);
    const linkedArtifacts = projectRows.reduce((sum, project) => sum + countProjectArtifacts(project.artifactSummary), 0);

    const common = {
      role: id,
      title: roleCopy(id).dashboardSection,
      summary: `${projectRows.length} projects, ${activeJobs} active jobs, ${approvalRows.length} approval gates`,
    };

    if (id === 'customer') {
      return {
        ...common,
        emphasizedPanels: ['milestones', 'readiness', 'blockers', 'recent-progress'],
        metrics: [
          { id: 'delivery-status', label: 'Delivery status', value: `${ready}`, detail: 'ready handoffs', tone: ready > 0 ? 'green' : 'amber', href: '#/projects' },
          { id: 'readiness', label: 'Readiness', value: `${projectRows.length - blocked}/${projectRows.length || 0}`, detail: 'projects without blockers', tone: blocked > 0 ? 'amber' : 'green', href: '#/projects' },
          { id: 'blockers', label: 'Blockers', value: `${blocked}`, detail: 'exceptions and failed jobs', tone: blocked > 0 ? 'red' : 'green', href: '#/jobs' },
          { id: 'progress', label: 'Recent progress', value: `${linkedArtifacts}`, detail: 'linked delivery artifacts', tone: linkedArtifacts > 0 ? 'green' : 'grey', href: '#/projects' },
        ],
        lanes: [
          { id: 'milestones', label: 'Milestones', count: projectRows.length, tone: 'green' },
          { id: 'outcomes', label: 'Outcomes', count: ready, tone: ready > 0 ? 'green' : 'grey' },
          { id: 'blockers', label: 'Blockers', count: blocked, tone: blocked > 0 ? 'red' : 'green' },
        ],
      };
    }

    if (id === 'product') {
      return {
        ...common,
        emphasizedPanels: ['requirements', 'jira', 'confluence', 'trace', 'readiness'],
        metrics: [
          { id: 'requirements', label: 'Requirements', value: `${linkedArtifacts}`, detail: 'linked artifacts', tone: linkedArtifacts > 0 ? 'green' : 'amber', href: '#/projects' },
          { id: 'jira', label: 'Jira cards', value: `${projectRows.filter((project) => project.artifactSummary?.jira?.status === 'linked').length}`, detail: 'projects with Jira', tone: 'green', href: '#/projects' },
          { id: 'confluence', label: 'Confluence pages', value: `${projectRows.filter((project) => project.artifactSummary?.confluence?.status === 'linked').length}`, detail: 'projects with docs', tone: 'green', href: '#/projects' },
          { id: 'trace', label: 'Trace readiness', value: `${projectRows.filter((project) => safeArray(project.artifactSummary?.traceRows).length > 0).length}`, detail: 'projects with trace rows', tone: 'amber', href: '#/projects' },
        ],
        lanes: [
          { id: 'scope-gaps', label: 'Scope gaps', count: blocked, tone: blocked > 0 ? 'amber' : 'green' },
          { id: 'planning-action', label: 'Planning action', count: approvalRows.length, tone: approvalRows.length > 0 ? 'amber' : 'grey' },
        ],
      };
    }

    if (id === 'scrum') {
      return {
        ...common,
        emphasizedPanels: ['phase-flow', 'queue', 'approvals', 'aging'],
        metrics: [
          { id: 'blocked', label: 'Blocked lanes', value: `${blocked}`, detail: 'exceptions, failed jobs, and blockers', tone: blocked > 0 ? 'red' : 'green', href: '#/projects' },
          { id: 'queued', label: 'Queued work', value: `${queued}`, detail: 'waiting on agents or gates', tone: queued > 0 ? 'amber' : 'grey', href: '#/jobs' },
          { id: 'running', label: 'Running work', value: `${running}`, detail: 'active handoffs', tone: running > 0 ? 'amber' : 'grey', href: '#/jobs' },
          { id: 'approvals', label: 'Approvals', value: `${approvalRows.length}`, detail: 'operator decisions pending', tone: approvalRows.length > 0 ? 'amber' : 'green', href: '#/policy' },
        ],
        lanes: [
          { id: 'phase-flow', label: 'Phase flow', count: projectRows.length, tone: 'amber' },
          { id: 'handoff-readiness', label: 'Handoff readiness', count: ready, tone: ready > 0 ? 'green' : 'grey' },
          { id: 'work-aging', label: 'Work aging', count: queued, tone: queued > 0 ? 'amber' : 'grey' },
        ],
      };
    }

    if (id === 'devops') {
      return {
        ...common,
        emphasizedPanels: ['providers', 'queue', 'agents', 'transport', 'audit'],
        metrics: [
          { id: 'provider-health', label: 'Provider health', value: failed > 0 ? 'degraded' : 'nominal', detail: `${failed} failed jobs as runtime signal`, tone: failed > 0 ? 'red' : 'green', href: '#/providers' },
          { id: 'queue-runway', label: 'Queue runway', value: `${activeJobs}`, detail: `${running} running, ${queued} queued`, tone: activeJobs > 0 ? 'amber' : 'green', href: '#/jobs' },
          { id: 'agents', label: 'Agents', value: `${activeAgents}`, detail: 'connected public MCP sessions', tone: activeAgents > 0 ? 'green' : 'grey', href: '#/sessions' },
          { id: 'transport', label: 'Transport', value: activeAgents > 0 ? 'active' : 'idle', detail: 'MCP transport readiness', tone: activeAgents > 0 ? 'green' : 'grey', href: '#/sessions' },
        ],
        lanes: [
          { id: 'webhooks', label: 'Webhooks', count: 0, tone: 'grey' },
          { id: 'audit-chain', label: 'Audit chain', count: projectRows.length, tone: 'green' },
          { id: 'runtime-readiness', label: 'Runtime readiness', count: activeAgents, tone: activeAgents > 0 ? 'green' : 'grey' },
        ],
      };
    }

    if (id === 'operator') {
      return {
        ...common,
        emphasizedPanels: ['health', 'queue', 'approvals', 'audit', 'providers', 'lifecycle'],
        metrics: [
          { id: 'health', label: 'Health', value: blocked > 0 ? 'attention' : 'nominal', detail: `${blocked} blockers`, tone: blocked > 0 ? 'red' : 'green', href: '#/' },
          { id: 'queue', label: 'Queue', value: `${activeJobs}`, detail: `${failed} failed jobs`, tone: failed > 0 ? 'red' : activeJobs > 0 ? 'amber' : 'green', href: '#/jobs' },
          { id: 'approvals', label: 'Approvals', value: `${approvalRows.length}`, detail: 'policy decisions pending', tone: approvalRows.length > 0 ? 'amber' : 'green', href: '#/policy' },
          { id: 'audit', label: 'Audit', value: `${projectRows.length}`, detail: 'project lifecycle lanes', tone: 'green', href: '#/audit' },
        ],
        lanes: [
          { id: 'providers', label: 'Providers', count: linkedArtifacts, tone: linkedArtifacts > 0 ? 'green' : 'grey' },
          { id: 'lifecycle', label: 'Lifecycle controls', count: projectRows.length, tone: 'amber' },
        ],
      };
    }

    return {
      ...common,
      role: 'developer',
      emphasizedPanels: ['developer-workspace', 'trace', 'jobs', 'handoff'],
      metrics: [
        { id: 'repo', label: 'Repo links', value: `${projectRows.filter((project) => project.artifactSummary?.vcs?.repoUrl).length}`, detail: 'projects with repo links', tone: 'green', href: '#/projects' },
        { id: 'context', label: 'Context packs', value: `${projectRows.filter((project) => project.artifactSummary?.context?.uri).length}`, detail: 'ready context URIs', tone: 'green', href: '#/projects' },
        { id: 'handoff', label: 'Handoffs', value: `${ready}`, detail: 'ready for build', tone: ready > 0 ? 'green' : 'amber', href: '#/sessions' },
        { id: 'debug', label: 'Debug', value: `${failed}`, detail: 'failed job logs', tone: failed > 0 ? 'red' : 'green', href: '#/jobs' },
      ],
      lanes: [
        { id: 'trace', label: 'Trace-to-file', count: projectRows.filter((project) => safeArray(project.artifactSummary?.traceRows).length > 0).length, tone: 'amber' },
        { id: 'active-build-inputs', label: 'Active build inputs', count: activeJobs, tone: activeJobs > 0 ? 'amber' : 'grey' },
      ],
    };
  }

  function fetchPanelState(fetchState, label) {
    if (fetchState?.error) {
      return {
        status: 'degraded',
        tone: 'amber',
        label,
        message: `${label} data is degraded: ${fetchState.error.message ?? String(fetchState.error)}`,
      };
    }
    if (fetchState?.loading && !fetchState?.data) {
      return { status: 'loading', tone: 'grey', label, message: `${label} data is loading` };
    }
    if (!fetchState?.data) {
      return { status: 'empty', tone: 'grey', label, message: `${label} data is not available yet` };
    }
    return { status: 'ready', tone: 'green', label, message: `${label} data ready` };
  }

  root.ControlSurfaceModel = {
    PHASES,
    EXCEPTION_STATES,
    toneForStatus,
    artifactChainRows,
    phaseConveyorRows,
    providerHealthRows,
    commandActions,
    queuePhaseRows,
    agentOperationLanes,
    readinessRadarRows,
    developerNextAction,
    developerCommandRows,
    developerLensRows,
    roleProfiles,
    agentRoleCatalog,
    roleCopy,
    roleProjectFocus,
    rolePortfolioFocus,
    fetchPanelState,
    phaseForState,
    readinessPercent,
    stateLabel,
    repoHost,
  };
})(typeof window !== 'undefined' ? window : globalThis);
