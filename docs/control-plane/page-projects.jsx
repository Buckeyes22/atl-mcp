// page-projects.jsx — S2 Project list + S3 Project detail (ADR 0006).
// Reads admin.projects.list and admin.projects.get; writes via
// admin.projects.transition + admin.projects.preflight.refresh.

const STATE_FILTER_OPTIONS = [
  'all',
  'DRAFT_INTAKE', 'CLARIFICATION_NEEDED', 'BLUEPRINT_READY',
  'PREFLIGHT_PASSED', 'PROVISIONING_PREVIEWED', 'PROVISIONED',
  'LINKED', 'VALIDATED', 'READY_FOR_BUILD',
  'VALIDATION_FAILED', 'DRIFT_DETECTED', 'ARCHIVED',
];

function ProjectListPage() {
  const list = useAdmin('admin.projects.list');
  const health = useAdmin('admin.health.get');
  const providers = useAdmin('admin.providers.list');
  const jobs = useAdmin('admin.jobs.list', { limit: 100 });
  const sessions = useAdmin('admin.sessions.list');
  const policy = useAdmin('admin.policy.decisions.list', { effect: 'require_approval', limit: 25 });
  const cpTweaks = useCPTweaks();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [adoptOpen, setAdoptOpen] = useState(false);
  const roleLens = cpTweaks.t.roleLens || 'developer';
  const roleCopy = window.ControlSurfaceModel?.roleCopy ?? (() => ({}));
  const copy = roleCopy(roleLens);

  const projects = list.data?.projects ?? [];
  const jobsList = jobs.data?.jobs ?? [];
  const approvals = policy.data?.decisions ?? [];
  const portfolioFocus = window.ControlSurfaceModel?.rolePortfolioFocus?.(roleLens, projects, jobsList, sessions, approvals);
  const filtered = projects.filter((p) => {
    if (filter !== 'all' && p.state !== filter) return false;
    if (search && !(`${p.key} ${p.name}`.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });
  const phaseRows = PIPELINE_PHASES.map((phase) => ({
    ...phase,
    projects: projects.filter((p) => phase.states.includes(p.state)),
  }));
  const exceptionCount = projects.filter((p) => EXCEPTION_STATES.includes(p.state)).length;

  return (
    <div className="cp-page wide">
      <PageHead
        eyebrow={copy.projectsEyebrow ?? 'projects · developer workbench'}
        title={copy.projectsTitle ?? 'Project workbench'}
        right={<>
          <div className="meta-block"><span className="k">total </span><span className="v">{projects.length}</span></div>
          <div className="meta-block"><span className="k">filtered </span><span className="v">{filtered.length}</span></div>
          <div className="meta-block"><span className="k">exceptions </span><span className="v">{exceptionCount}</span></div>
        </>}
      />

      <ErrorBlock error={list.error || jobs.error || sessions.error || policy.error} />

      <RolePortfolioFocus
        role={roleLens}
        projects={projects}
        jobs={jobsList}
        sessions={sessions}
        approvals={approvals}
        loading={list.loading && !list.data}
        title={portfolioFocus?.title}
      />

      <BuildControlRail
        projects={projects}
        jobs={jobsList}
        sessions={sessions}
        approvals={approvals}
        loading={list.loading && !list.data}
        scope="project portfolio"
      />

      <ProviderHealthStrip
        health={health}
        providers={providers}
        loading={(health.loading && !health.data) || (providers.loading && !providers.data)}
      />

      <PortfolioControlSummary
        projects={projects}
        filtered={filtered}
        jobs={jobsList}
        role={roleLens}
        loading={list.loading && !list.data}
      />

      <ProjectAssistPanel
        operatorBadge={cpTweaks.t.operatorBadge}
        onProjectCreated={() => { void list.refetch(); }}
      />

      <div className="cp-section-head">
        <span className="cp-section-num">phase board</span>
        <h2 className="cp-section-title">Inception through build handoff</h2>
        <span className="cp-section-blurb">Open a project row to inspect blueprint, provisioning, jobs, audit, and handoff state.</span>
      </div>
      <PipelineBoard phases={phaseRows} loading={list.loading && !list.data} compact />

      <ProjectPortfolioGrid projects={filtered} loading={list.loading && !list.data} />

      <div style={{ margin: '24px 0 18px', display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn primary" onClick={() => setAdoptOpen(true)}>+ Adopt Atlassian project</button>
      </div>

      <div className="filter-bar">
        <div className="pill-group">
          {STATE_FILTER_OPTIONS.slice(0, 7).map((s) => (
            <button key={s} className={s === filter ? 'on' : ''} onClick={() => setFilter(s)}>
              {s === 'all' ? 'all' : s.toLowerCase().replace(/_/g, ' ')}
              {s === filter && <span className="count">{filtered.length}</span>}
            </button>
          ))}
        </div>
        <div className="pill-group">
          {STATE_FILTER_OPTIONS.slice(7).map((s) => (
            <button key={s} className={s === filter ? 'on' : ''} onClick={() => setFilter(s)}>
              {s.toLowerCase().replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <div className="search">
          <input placeholder="key or name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <table className="cp-table">
        <thead>
          <tr>
            <th>project</th>
            <th>name</th>
            <th>{projectFocusHeader(roleLens)}</th>
            <th>state</th>
            <th>artifacts</th>
            <th>{roleLens === 'product' ? 'scope' : roleLens === 'customer' ? 'readiness' : 'work'}</th>
            <th>updated</th>
          </tr>
        </thead>
        <tbody>
          {list.loading && !list.data && (
            <tr><td colSpan="7"><LoadingSkeleton rows={4} /></td></tr>
          )}
          {!list.loading && filtered.length === 0 && (
            <tr><td colSpan="7" style={{ color: 'var(--ink-3)', textAlign: 'center', padding: 20 }}>
              {projects.length === 0 ? 'No projects in the database. Create one via the project_intake_create MCP tool.' : 'No projects match the current filter.'}
            </td></tr>
          )}
          {filtered.map((p) => (
            <tr key={p.id} className="clickable" onClick={() => navigate(`#/projects/${p.key}`)}>
              <td>
                <div className="table-project-cell">
                  <ProjectMark project={p} size="xs" />
                  <span className="mono">{p.key}</span>
                  {p.atlassianProjectKey && <Pill tone="blue">adopted</Pill>}
                </div>
              </td>
              <td>{p.name}</td>
              <td><ProjectTableFocusCell role={roleLens} project={p} /></td>
              <td><StatePill state={p.state} /></td>
              <td><ArtifactStrip summary={p.artifactSummary} compact /></td>
              <td><ProjectTableWorkCell role={roleLens} project={p} /></td>
              <td className="mono">{p.updatedAt.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {adoptOpen && (
        <AdoptAtlassianModal
          onClose={() => setAdoptOpen(false)}
          onAdopted={() => { setAdoptOpen(false); void list.refetch(); }}
        />
      )}
    </div>
  );
}

function projectFocusHeader(role) {
  if (role === 'customer') return 'delivery focus';
  if (role === 'product') return 'scope focus';
  if (role === 'scrum') return 'flow focus';
  if (role === 'devops') return 'runtime focus';
  if (role === 'operator') return 'control focus';
  return 'developer focus';
}

function ProjectTableFocusCell({ role, project }) {
  const summary = project.artifactSummary ?? {};
  const focus = window.ControlSurfaceModel?.roleProjectFocus?.(role, project, summary, [], {});
  const card = focus?.cards?.[0];
  if (!card) return <span className="mono">—</span>;
  return (
    <div className="table-focus-cell">
      <span>{card.label}</span>
      <strong>{card.value}</strong>
      <small>{card.detail}</small>
    </div>
  );
}

function ProjectTableWorkCell({ role, project }) {
  const summary = project.artifactSummary ?? {};
  if (role === 'customer') {
    const score = summary.readiness?.score ?? readinessPercent(project.state);
    return <span className="mono num">{score}%</span>;
  }
  if (role === 'product') {
    const traceCount = (summary.traceRows ?? []).length;
    return <span className="mono num">{traceCount} trace</span>;
  }
  if (role === 'developer') {
    return <span className="mono num">{summary.vcs?.repoUrl ? 'repo linked' : `${project.openJobs} jobs`}</span>;
  }
  return <span className="mono num">{project.openJobs} jobs</span>;
}

function portfolioSummaryText(role) {
  if (role === 'customer') return 'Prioritize delivery status, readiness, blockers, recent progress, and customer-facing links.';
  if (role === 'product') return 'Prioritize requirements, Jira cards, Confluence pages, trace coverage, and scope gaps.';
  if (role === 'scrum') return 'Prioritize blocked lanes, approvals, queue pressure, handoff readiness, and work aging.';
  if (role === 'devops') return 'Prioritize provider health, queue runway, agents, transport, webhooks, and failed jobs.';
  if (role === 'operator') return 'Prioritize health, queue, approvals, audit, providers, and lifecycle controls.';
  return 'Prioritize ready handoffs, repository links, queue failures, and source artifacts across active projects.';
}

function PortfolioControlSummary({ projects, filtered, jobs, role = 'developer', loading }) {
  const active = (projects ?? []).filter((project) => project.state !== 'ARCHIVED');
  const visible = filtered ?? [];
  const ready = active.filter((project) => project.state === 'READY_FOR_BUILD').length;
  const exceptions = active.filter((project) => EXCEPTION_STATES.includes(project.state)).length;
  const artifactLinked = active.reduce((sum, project) => {
    const summary = project.artifactSummary ?? {};
    return sum + ['jira', 'confluence', 'vcs', 'handoff'].filter((key) => {
      const status = summary[key]?.status;
      return status === 'linked' || status === 'ready';
    }).length;
  }, 0);
  const artifactTotal = active.length * 4;
  const openJobs = (jobs ?? []).filter((job) => job.status === 'queued' || job.status === 'running').length;
  const copy = window.ControlSurfaceModel?.roleCopy?.(role) ?? {};

  return (
    <div className="portfolio-control-summary">
      {loading ? (
        <LoadingSkeleton rows={3} />
      ) : (
        <>
          <div className="portfolio-summary-copy">
            <span className="label-sm">{copy.label ?? 'Developer'} layer</span>
            <strong>{visible.length} visible projects</strong>
            <p>{portfolioSummaryText(role)}</p>
          </div>
          <div className="portfolio-summary-grid">
            <div><span>ready</span><strong>{ready}</strong></div>
            <div><span>exceptions</span><strong>{exceptions}</strong></div>
            <div><span>artifact links</span><strong>{artifactLinked}/{artifactTotal || 0}</strong></div>
            <div><span>open jobs</span><strong>{openJobs}</strong></div>
          </div>
        </>
      )}
    </div>
  );
}

function ProjectPortfolioGrid({ projects, loading }) {
  if (loading) {
    return <div className="project-portfolio-grid"><div className="project-portfolio-card"><LoadingSkeleton rows={5} /></div></div>;
  }
  if (projects.length === 0) return null;
  return (
    <div className="project-portfolio-grid">
      {projects.slice(0, 9).map((project) => (
        <a key={project.id} href={`#/projects/${project.key}`} className="project-portfolio-card">
          <div className="portfolio-card-head">
            <ProjectMark project={project} size="md" />
            <div>
              <div className="project-key">{project.key}</div>
              <div className="project-name">{project.name}</div>
            </div>
            <StatePill state={project.state} />
          </div>
          <ProjectProgressRail state={project.state} />
          <ArtifactStrip summary={project.artifactSummary} />
          <div className="portfolio-card-foot">
            <span>v{project.blueprintVersion}</span>
            <span>{project.openJobs} open jobs</span>
            <span>{project.updatedAt.slice(0, 10)}</span>
          </div>
        </a>
      ))}
    </div>
  );
}

function ProjectAssistPanel({ operatorBadge, onProjectCreated, defaultName = 'New product initiative', defaultKey = 'NPI', compact = false }) {
  const [name, setName] = useState(defaultName);
  const [key, setKey] = useState(defaultKey);
  const [description, setDescription] = useState('must: Customer can describe the project outcome and preview Jira work. Acceptance: generated stories appear before Jira creation.');
  const [briefs, setBriefs] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [intake, setIntake] = useState(null);
  const [blueprint, setBlueprint] = useState(null);
  const [jiraPreview, setJiraPreview] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);

  const payload = () => ({ name, key, description, briefs, operatorBadge });
  const intakeProjectId = blueprint?.projectId ?? intake?.projectId ?? null;
  const intakeProjectKey = blueprint?.projectKey ?? intake?.projectKey ?? key;

  const callAssist = async (label, toolName, args, setter, after) => {
    setBusy(label);
    setError(null);
    try {
      const result = await window.MCP_CLIENT.callTool(toolName, args);
      const payload = result.structuredContent;
      setter(payload);
      if (after) after(payload);
    } catch (err) {
      setError(err.message ?? String(err));
    } finally {
      setBusy('');
    }
  };

  return (
    <section className={`surf project-assist-panel ${compact ? 'compact' : ''}`}>
      <div className="head">
        <span>Project Assist</span>
        <span className="right">{busy ? <Pill tone="amber">{busy}</Pill> : <Pill tone="blue">requirements</Pill>}</span>
      </div>
      <div className="project-assist-grid">
        <ProjectAssistComposer
          name={name}
          setName={setName}
          projectKey={key}
          setProjectKey={setKey}
          description={description}
          setDescription={setDescription}
          briefs={briefs}
          setBriefs={setBriefs}
        />
        <div className="project-assist-workflow">
          <ErrorBlock error={error} />
          <div className="project-assist-actions">
            <button className="btn" disabled={Boolean(busy)} onClick={() => callAssist('analyzing', 'admin.requirements.assist.preview', payload(), setAnalysis)}>Analyze</button>
            <button className="btn primary" disabled={Boolean(busy)} onClick={() => callAssist('creating intake', 'admin.requirements.assist.create_intake', payload(), setIntake, () => onProjectCreated && onProjectCreated())}>Create intake</button>
            <button className="btn" disabled={Boolean(busy) || !intake?.projectId} onClick={() => callAssist('generating blueprint', 'admin.requirements.assist.generate_blueprint', { projectId: intake.projectId, useSampling: false, operatorBadge }, setBlueprint, () => onProjectCreated && onProjectCreated())}>Generate blueprint</button>
            <button className="btn" disabled={Boolean(busy) || !intakeProjectId} onClick={() => callAssist('previewing Jira', 'admin.requirements.assist.provision_preview', { projectId: intakeProjectId, jiraProjectKey: intakeProjectKey }, setJiraPreview)}>Preview Jira</button>
          </div>
          <div className="project-assist-metrics">
            <div><span>sources</span><strong>{analysis?.sourceCount ?? (1 + briefs.length)}</strong></div>
            <div><span>requirements</span><strong>{blueprint?.requirements?.length ?? analysis?.suggestedRequirements?.length ?? 0}</strong></div>
            <div><span>jira nodes</span><strong>{jiraPreview?.totalNodes ?? 0}</strong></div>
            <div><span>quality</span><strong>{jiraPreview?.quality?.score ?? '-'}</strong></div>
          </div>
          <div className="project-assist-preview">
            <div>
              <span className="label-sm">project</span>
              <strong>{intakeProjectKey}</strong>
              <small>{intake?.state ?? blueprint?.state ?? 'drafting'}</small>
            </div>
            <div>
              <span className="label-sm">next</span>
              <strong>{intakeProjectId ? 'Generate and preview' : 'Create intake'}</strong>
              <small>{analysis?.suggestedRequirements?.[0]?.title ?? 'Add outcome, acceptance, and brief context.'}</small>
            </div>
          </div>
          {!compact && (analysis || blueprint || jiraPreview) && (
            <div className="project-assist-json">
              <JsonView obj={jiraPreview ?? blueprint ?? analysis} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ProjectAssistComposer({ name, setName, projectKey, setProjectKey, description, setDescription, briefs, setBriefs }) {
  const readBriefFiles = async (files) => {
    const next = [];
    for (const file of Array.from(files || [])) {
      const text = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('file read failed'));
        reader.readAsText(file);
      });
      next.push({ name: file.name, mimeType: file.type || 'text/plain', text });
    }
    setBriefs((current) => [...current, ...next]);
  };

  return (
    <div className="project-assist-composer">
      <label><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label><span>Key</span><input value={projectKey} onChange={(event) => setProjectKey(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))} /></label>
      <label className="project-assist-description"><span>Description</span><textarea rows="7" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      <label className="project-assist-file"><span>Briefs</span><input type="file" multiple accept=".txt,.md,.json,text/*,application/json" onChange={(event) => void readBriefFiles(event.target.files)} /></label>
      <div className="project-assist-briefs">
        {briefs.length === 0 && <span className="muted-mono">no briefs attached</span>}
        {briefs.map((brief, index) => (
          <div key={`${brief.name}-${index}`}>
            <span>{brief.name}</span>
            <button className="btn sm ghost" onClick={() => setBriefs((rows) => rows.filter((_, i) => i !== index))}>remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentAssignmentPanel({ projectKey, detail, operatorBadge, compact = false, onOpenAssignments }) {
  const assignments = useAdmin('admin.agent.work.list', { projectKey }, { enabled: Boolean(projectKey) });
  const [recommendations, setRecommendations] = useState({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);
  const stories = (detail?.blueprint?.epics ?? []).flatMap((epic) => (epic.stories ?? []).map((story) => ({ ...story, epicTitle: epic.title })));
  const visibleStories = compact ? stories.slice(0, 2) : stories;
  const assignmentRows = assignments.data?.assignments ?? [];
  const assignedCount = assignmentRows.filter((row) => row.status === 'assigned').length;

  const callAgentTool = async (label, toolName, args, apply) => {
    setBusy(label);
    setError(null);
    try {
      const result = await window.MCP_CLIENT.callTool(toolName, args);
      apply(result.structuredContent);
    } catch (err) {
      setError(err.message ?? String(err));
    } finally {
      setBusy('');
    }
  };

  const recommend = (story) => callAgentTool('recommending', 'admin.agent.work.recommend', {
    projectKey,
    workRef: { kind: 'blueprint_story', id: story.id, title: story.title },
  }, (data) => setRecommendations((current) => ({ ...current, [story.id]: data })));

  const assign = (story, agentId) => callAgentTool('assigning', 'admin.agent.work.assign', {
    projectKey,
    workRef: { kind: 'blueprint_story', id: story.id, title: story.title },
    assignedAgentId: agentId,
    assignedBy: operatorBadge || 'developer@loopback',
    reason: `assign ${story.id} to ${agentId}`,
    operatorBadge,
  }, () => { void assignments.refetch(); });

  return (
    <section className={`surf project-agent-assignment-panel ${compact ? 'compact' : ''}`}>
      <div className="head">
        <span>Agent Assignment</span>
        <span className="right">{busy ? <Pill tone="amber">{busy}</Pill> : <Pill tone={assignedCount > 0 ? 'green' : 'grey'}>{assignedCount}/{stories.length} assigned</Pill>}</span>
      </div>
      <ErrorBlock error={error || assignments.error} />
      <div className="project-agent-assignment-list">
        {assignments.loading && !assignments.data && <LoadingSkeleton rows={3} />}
        {!assignments.loading && stories.length === 0 && <div className="empty-copy">No blueprint stories are ready for assignment.</div>}
        {visibleStories.map((story) => {
          const rec = recommendations[story.id];
          const assigned = assignmentRows.find((row) => row.workRef?.id === story.id);
          const top = rec?.recommendations?.[0];
          return (
            <div key={story.id} className="project-agent-story">
              <div className="project-agent-story-head">
                <div>
                  <span className="label-sm">{story.epicTitle}</span>
                  <strong>{story.title}</strong>
                  {!compact && <small>{story.userStory}</small>}
                </div>
                <Pill tone={assigned ? 'green' : rec ? 'blue' : 'grey'}>{assigned?.status ?? rec?.classification?.workType ?? 'unclassified'}</Pill>
              </div>
              <div className="assignment-tags">
                {(rec?.classification?.skillTags ?? story.acceptanceCriteria ?? []).slice(0, compact ? 4 : 8).map((tag) => <span key={tag}>{tag}</span>)}
              </div>
              <div className="assignment-actions">
                <button className="btn sm" disabled={Boolean(busy)} onClick={() => recommend(story)}>Recommend</button>
                <button className="btn sm primary" disabled={Boolean(busy) || (!top?.agentId && !assigned?.assignedAgentId)} onClick={() => assign(story, top?.agentId || assigned?.assignedAgentId)}>Assign top agent</button>
              </div>
              {rec && !compact && (
                <div className="recommendation-list">
                  {rec.recommendations.length === 0 && <span className="muted-mono">needs human assignment</span>}
                  {rec.recommendations.map((agent) => (
                    <button key={agent.agentId} onClick={() => assign(story, agent.agentId)}>
                      <strong>{agent.label}</strong>
                      <span>{agent.score}</span>
                      <small>{agent.reasons.join(' · ')}</small>
                    </button>
                  ))}
                </div>
              )}
              {assigned && <div className="assigned-row">assigned to <strong>{assigned.assignedAgentId}</strong></div>}
            </div>
          );
        })}
        {compact && stories.length > visibleStories.length && <button className="btn sm ghost" onClick={onOpenAssignments}>Open assignment tab</button>}
      </div>
    </section>
  );
}

function ContentQualityPanel({ projectKey, operatorBadge, compact = false }) {
  const reports = useAdmin('admin.quality.reports.list', { projectKey }, { enabled: Boolean(projectKey) });
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const latest = report ?? reports.data?.reports?.[0] ?? null;
  const findings = latest?.findings ?? [];
  const recommendations = latest?.recommendations ?? [];

  const score = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await window.MCP_CLIENT.callTool('admin.quality.score.project', { projectKey, operatorBadge });
      setReport(result.structuredContent.report);
      void reports.refetch();
    } catch (err) {
      setError(err.message ?? String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`surf content-quality-panel ${compact ? 'compact' : ''}`}>
      <div className="head">
        <span>Content Quality</span>
        <span className="right"><Pill tone={qualityTone(latest?.score)}>{latest ? `${latest.grade} · ${latest.score}` : 'unscored'}</Pill></span>
      </div>
      <ErrorBlock error={error || reports.error} />
      <div className="quality-score-layout">
        <div className={`quality-score-ring ${qualityTone(latest?.score)}`}>
          <strong>{latest?.score ?? '-'}</strong>
          <span>{latest?.grade ?? 'grade'}</span>
        </div>
        <div className="quality-score-copy">
          <strong>{latest ? 'Latest trustworthiness report' : 'No quality report yet'}</strong>
          <p>{latest ? `Generated ${latest.generatedAt.slice(0, 19).replace('T', ' ')}Z. LLM critique: ${latest.llmCritique?.status ?? 'unavailable'}.` : 'Run the rubric against blueprint, Jira, Confluence, and handoff content before build assignment.'}</p>
          <button className="btn primary" disabled={busy} onClick={score}>{busy ? 'Scoring...' : 'Score project content'}</button>
        </div>
      </div>
      {!compact && (
        <div className="quality-detail-grid">
          <div>
            <span className="label-sm">findings</span>
            {findings.length === 0 && <div className="empty-copy">No findings recorded yet.</div>}
            {findings.slice(0, 6).map((finding) => (
              <div className="quality-finding-row" key={finding.id}>
                <Pill tone={finding.status === 'pass' ? 'green' : finding.status === 'fail' ? 'red' : 'amber'}>{finding.status}</Pill>
                <div><strong>{finding.label}</strong><small>{finding.detail}</small></div>
              </div>
            ))}
          </div>
          <div>
            <span className="label-sm">recommendations</span>
            {recommendations.length === 0 && <div className="empty-copy">No recommendations recorded yet.</div>}
            {recommendations.slice(0, 6).map((item, index) => (
              <div className="quality-recommendation-row" key={`${item}-${index}`}>{item}</div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function qualityTone(score) {
  if (score == null) return 'grey';
  if (score >= 80) return 'green';
  if (score >= 60) return 'amber';
  return 'red';
}

function AdoptAtlassianModal({ onClose, onAdopted }) {
  const cloud = useAdmin('admin.atlassian.projects.list');
  const cpTweaks = useCPTweaks();
  const [working, setWorking] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const adopt = async (key) => {
    const reason = window.prompt(`Reason for adopting ${key} into atl-mcp:`);
    if (!reason || reason.length < 4) return;
    setWorking(key);
    setErrorMsg(null);
    try {
      const r = await window.MCP_CLIENT.callTool('admin.projects.adopt', {
        atlassianProjectKey: key,
        reason,
        operatorBadge: cpTweaks.t.operatorBadge,
      });
      const sc = r.structuredContent;
      if (sc.alreadyAdopted) {
        setErrorMsg(`${key} is already adopted as blueprint ${sc.blueprintId.slice(0, 8)}…`);
      } else {
        onAdopted();
      }
    } catch (err) {
      setErrorMsg(err.message ?? String(err));
    } finally {
      setWorking(null);
    }
  };

  return (
    <Modal
      title="Adopt Atlassian project"
      onClose={onClose}
      footer={<button className="btn ghost" onClick={onClose}>Close</button>}
    >
      <p style={{ marginBottom: 12 }}>
        Pick a Cloud project to adopt into atl-mcp's lifecycle. Adopting creates a blueprint with state{' '}
        <strong>PROVISIONED</strong> and the Atlassian key recorded for linkage.
      </p>
      <ErrorBlock error={cloud.error} />
      {cloud.data?.dataLimited && <DataLimited reason={cloud.data.dataLimited.reason} />}
      {errorMsg && <div className="error-block"><div className="mono" style={{ fontSize: 12 }}>{errorMsg}</div></div>}
      {cloud.loading && !cloud.data && <LoadingSkeleton rows={4} />}
      {cloud.data && (cloud.data.projects ?? []).length === 0 && (
        <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>
          No Cloud projects returned (Jira may not be configured, or the principal has no project access).
        </p>
      )}
      <table className="cp-table" style={{ marginTop: 8 }}>
        <thead><tr><th>key</th><th>name</th><th>type</th><th>lead</th><th></th></tr></thead>
        <tbody>
          {(cloud.data?.projects ?? []).map((p) => (
            <tr key={p.id}>
              <td className="mono">{p.key}</td>
              <td>{p.name}</td>
              <td className="mono">{p.projectTypeKey ?? '—'}</td>
              <td className="mono">{p.leadDisplayName ?? '—'}</td>
              <td>
                {p.adoptedBlueprintId ? (
                  <Pill tone="green">adopted</Pill>
                ) : (
                  <button className="btn sm primary" disabled={working === p.key} onClick={() => adopt(p.key)}>
                    {working === p.key ? 'Adopting…' : 'Adopt'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: 12, color: 'var(--ink-3)', fontSize: 11 }}>
        Source: <span className="mono">{cloud.data?.source ?? '—'}</span>
      </p>
    </Modal>
  );
}

function ProjectDetailPage({ projectKey }) {
  const detail = useAdmin('admin.projects.get', { key: projectKey });
  const sessions = useAdmin('admin.sessions.list');
  const health = useAdmin('admin.health.get');
  const providers = useAdmin('admin.providers.list');
  const cpTweaks = useCPTweaks();
  const roleLens = cpTweaks.t.roleLens || 'developer';
  const roleCopy = window.ControlSurfaceModel?.roleCopy ?? (() => ({}));
  const copy = roleCopy(roleLens);
  const [tab, setTab] = useState('overview');
  const [transitionTarget, setTransitionTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2400); };

  const submitTransition = async (reason) => {
    const target = transitionTarget;
    setTransitionTarget(null);
    try {
      await window.MCP_CLIENT.callTool('admin.projects.transition', {
        key: projectKey,
        toState: target,
        reason,
        operatorBadge: cpTweaks.t.operatorBadge,
      });
      showToast(`Transitioned ${projectKey} → ${target}`);
      void detail.refetch();
    } catch (err) {
      showToast(`Error: ${err.message ?? err}`);
    }
  };

  if (detail.error) {
    return (
      <div className="cp-page">
        <PageHead eyebrow="project · error" title={`Project ${projectKey}`} />
        <ErrorBlock error={detail.error} />
        <a className="btn" href="#/projects">← back to project list</a>
      </div>
    );
  }
  if (!detail.data) {
    return (
      <div className="cp-page">
        <PageHead eyebrow="project · loading" title={`Project ${projectKey}`} />
        <LoadingSkeleton rows={6} />
      </div>
    );
  }

  const p = detail.data.project;
  const allowed = detail.data.allowedTransitions ?? [];
  const artifactSummary = detail.data.artifactSummary ?? {};
  const latestEvent = detail.data.latestEvent ?? p.latestEvent ?? null;
  const phaseSummary = detail.data.phaseSummary ?? p.phaseSummary ?? null;
  const agentLaneSummary = detail.data.agentLaneSummary ?? p.agentLaneSummary ?? null;

  return (
    <div className="cp-page wide">
      <PageHead
        eyebrow={`${copy.projectDetailEyebrow ?? 'project'} · ${p.key}`}
        title={p.name}
        right={<>
          <div className="meta-block"><span className="k">id </span><span className="v mono">{p.id.slice(0, 8)}…</span></div>
          <div className="meta-block"><span className="k">state </span><span className="v"><StatePill state={p.state} /></span></div>
          <div className="meta-block"><span className="k">blueprint </span><span className="v">v{p.blueprintVersion}</span></div>
        </>}
      />

      <ProjectBreadcrumbTrail project={p} summary={artifactSummary} />
      <ProjectCommandHeader
        project={p}
        summary={artifactSummary}
        sessions={sessions}
        jobs={detail.data.recentJobs}
        latestEvent={latestEvent}
        phaseSummary={phaseSummary}
        agentLaneSummary={agentLaneSummary}
        roleLens={roleLens}
        onPrimaryAction={() => setTab(artifactSummary?.handoff?.status === 'ready' ? 'jobs' : 'provision')}
      />
      <RoleWorkspacePanel
        roleLens={roleLens}
        project={p}
        summary={artifactSummary}
        jobs={detail.data.recentJobs}
        sessions={sessions}
        latestEvent={latestEvent}
        onOpenProvision={() => setTab('provision')}
      />
      <div className="project-workflow-grid compact">
        <ContentQualityPanel projectKey={p.key} operatorBadge={cpTweaks.t.operatorBadge} compact />
        <AgentAssignmentPanel projectKey={p.key} detail={detail.data} operatorBadge={cpTweaks.t.operatorBadge} compact onOpenAssignments={() => setTab('assignments')} />
      </div>
      <div className="operational-guardrails">
        <div className="guardrail-label">operational guardrails</div>
        <ProviderHealthStrip
          health={health}
          providers={providers}
          loading={(health.loading && !health.data) || (providers.loading && !providers.data)}
        />
        <PhaseConveyor project={p} summary={artifactSummary} />
        <BuildControlRail
          projects={[{ ...p, artifactSummary }]}
          jobs={detail.data.recentJobs}
          sessions={sessions}
          approvals={[]}
          scope={`${p.key} build lane`}
        />
      </div>

      <div className="project-detail-layout">
        <ProjectSideRail activeTab={tab} onSelectTab={setTab} project={p} summary={artifactSummary} />
        <div className="project-detail-main">
      <div className="tabs">
        {['overview', 'assist', 'assignments', 'quality', 'blueprint', 'audit', 'jobs', 'transitions', 'provision'].map((t) => (
          <button key={t} className={'tab ' + (t === tab ? 'active' : '')} onClick={() => setTab(t)}>
            {t}
            {t === 'audit' && <span className="count">{detail.data.recentAudit.length}</span>}
            {t === 'jobs' && <span className="count">{detail.data.recentJobs.length}</span>}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div>
          <div className="cp-section-head">
            <span className="cp-section-num">overview</span>
            <h2 className="cp-section-title">Build inputs and trace</h2>
            <span className="cp-section-blurb">Repo, handoff, context, source artifacts, failures, and requirement-to-code mapping.</span>
          </div>
          <OperatorLaunchpad
            project={p}
            summary={artifactSummary}
            onOpenProvision={() => setTab('provision')}
            onOpenTransitions={() => setTab('transitions')}
          />
          <div className="project-overview-grid">
            <div className="surf project-fact-panel">
              <div className="head"><span>project facts</span><span className="right"><StatePill state={p.state} /></span></div>
              <div className="fact-grid">
                <div><span>id</span><strong className="mono">{p.id.slice(0, 12)}...</strong></div>
                <div><span>schema</span><strong>v{p.schemaVersion}</strong></div>
                <div><span>blueprint</span><strong>v{p.blueprintVersion}</strong></div>
                <div><span>open jobs</span><strong>{p.openJobs}</strong></div>
                <div><span>Jira key</span><strong className="mono">{p.atlassianProjectKey ?? artifactSummary.jira?.projectKey ?? '-'}</strong></div>
                <div><span>updated</span><strong className="mono">{p.updatedAt.slice(0, 10)}</strong></div>
              </div>
              <ProjectProgressRail state={p.state} />
            </div>
            <ProjectMilestonePanel project={p} summary={artifactSummary} />
            <ReadinessScorecard project={p} summary={artifactSummary} jobs={detail.data.recentJobs} sessions={sessions} />
            <ArtifactMatrixPanel project={p} summary={artifactSummary} />
            <ResourceDock project={p} summary={artifactSummary} />
            <JiraCardsPanel summary={artifactSummary} />
            <ConfluencePagesPanel summary={artifactSummary} />
            <TraceMatrixPanel rows={artifactSummary.traceRows ?? []} />
            <TraceMapWidget project={p} summary={artifactSummary} />
            <OrchestrationTimeline entries={detail.data.recentAudit} />
            <AgentHandoffPanel project={p} summary={artifactSummary} sessions={sessions} jobs={detail.data.recentJobs} />
          </div>
        </div>
      )}

      {tab === 'assist' && (
        <div>
          <div className="cp-section-head">
            <span className="cp-section-num">project assist</span>
            <h2 className="cp-section-title">Requirements intake</h2>
            <span className="cp-section-blurb">Draft a project from description text and uploaded briefs, then preview the Jira issue tree before creation.</span>
          </div>
          <ProjectAssistPanel
            operatorBadge={cpTweaks.t.operatorBadge}
            defaultName={`${p.name} follow-up`}
            defaultKey={`${p.key}2`}
          />
        </div>
      )}

      {tab === 'assignments' && (
        <div>
          <div className="cp-section-head">
            <span className="cp-section-num">agent assignment</span>
            <h2 className="cp-section-title">Story-to-agent routing</h2>
            <span className="cp-section-blurb">Classify work from the blueprint, rank available agents, and persist confirmed assignments.</span>
          </div>
          <AgentAssignmentPanel projectKey={p.key} detail={detail.data} operatorBadge={cpTweaks.t.operatorBadge} />
        </div>
      )}

      {tab === 'quality' && (
        <div>
          <div className="cp-section-head">
            <span className="cp-section-num">content quality</span>
            <h2 className="cp-section-title">Trustworthiness scoring</h2>
            <span className="cp-section-blurb">Score Jira, Confluence, blueprint, and handoff content against the deterministic quality rubric.</span>
          </div>
          <ContentQualityPanel projectKey={p.key} operatorBadge={cpTweaks.t.operatorBadge} />
        </div>
      )}

      {tab === 'blueprint' && (
        <div>
          <div className="cp-section-head">
            <span className="cp-section-num">blueprint JSON</span>
            <h2 className="cp-section-title">Persisted blueprint</h2>
            <span className="cp-section-blurb">The full blueprint as stored. The hash anchors audit entries to this version.</span>
          </div>
          <JsonView obj={detail.data.blueprint} />
        </div>
      )}

      {tab === 'audit' && (
        <div>
          <div className="cp-section-head">
            <span className="cp-section-num">audit · per-project</span>
            <h2 className="cp-section-title">Recent audit entries</h2>
            <span className="cp-section-blurb">Audit entries for this project, newest first.</span>
          </div>
          <table className="cp-table">
            <thead><tr><th>ts</th><th>actor</th><th>tool</th><th>outcome</th><th>prev hash</th></tr></thead>
            <tbody>
              {detail.data.recentAudit.length === 0 && (
                <tr><td colSpan="5" style={{ color: 'var(--ink-3)', textAlign: 'center', padding: 20 }}>No audit entries for this project yet.</td></tr>
              )}
              {detail.data.recentAudit.map((e) => (
                <tr key={e.id}>
                  <td className="mono">{e.timestamp.slice(0, 19).replace('T', ' ')}Z</td>
                  <td className="mono">{e.actor}</td>
                  <td className="mono">{e.toolName}</td>
                  <td><OutcomePill outcome={e.outcome} /></td>
                  <td className="mono">{e.chainHash.slice(0, 8)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'jobs' && (
        <div>
          <div className="cp-section-head">
            <span className="cp-section-num">jobs</span>
            <h2 className="cp-section-title">Recent provisioning jobs</h2>
            <span className="cp-section-blurb">Provisioning jobs for this project.</span>
          </div>
          <table className="cp-table">
            <thead><tr><th>id</th><th>status</th><th>queued</th><th>updated</th><th>error</th></tr></thead>
            <tbody>
              {detail.data.recentJobs.length === 0 && (
                <tr><td colSpan="5" style={{ color: 'var(--ink-3)', textAlign: 'center', padding: 20 }}>No jobs for this project.</td></tr>
              )}
              {detail.data.recentJobs.map((j) => (
                <tr key={j.id}>
                  <td className="mono">{j.id.slice(0, 8)}…</td>
                  <td><Pill tone={j.status === 'completed' ? 'green' : j.status === 'failed' ? 'red' : 'amber'}>{j.status}</Pill></td>
                  <td className="mono">{j.queuedAt.slice(0, 19).replace('T', ' ')}Z</td>
                  <td className="mono">{j.updatedAt.slice(0, 19).replace('T', ' ')}Z</td>
                  <td className="mono">{j.error ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'transitions' && (
        <div>
          <div className="cp-section-head">
            <span className="cp-section-num">state transitions</span>
            <h2 className="cp-section-title">Allowed next states</h2>
            <span className="cp-section-blurb">The server enforces which transitions are legal.</span>
          </div>
          {allowed.length === 0 ? (
            <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>No legal transitions from {p.state}.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {allowed.map((next) => (
                <button key={next} className="btn warn" onClick={() => setTransitionTarget(next)}>
                  → {next.toLowerCase().replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'provision' && (
        <ProvisionSection
          projectKey={projectKey}
          atlassianProjectKey={p.atlassianProjectKey}
          operatorBadge={cpTweaks.t.operatorBadge}
        />
      )}
        </div>
      </div>

      {transitionTarget && (
        <ConfirmModal
          title={`Transition ${p.key} → ${transitionTarget}`}
          body={`Moves the project from ${p.state} to ${transitionTarget}. The reason you enter is logged.`}
          requireReason
          danger={transitionTarget === 'ARCHIVED' || transitionTarget === 'VALIDATION_FAILED'}
          confirmLabel="Transition"
          onCancel={() => setTransitionTarget(null)}
          onConfirm={submitTransition}
        />
      )}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--ink)', color: '#fff', padding: '10px 18px',
          fontFamily: 'var(--font-mono)', fontSize: 12, zIndex: 200,
        }}>{toast}</div>
      )}
    </div>
  );
}

function ProjectCommandHeader({ project, summary, sessions, jobs, latestEvent, phaseSummary, agentLaneSummary, roleLens = 'developer', onPrimaryAction }) {
  const failedJobs = (jobs ?? []).filter((job) => job.status === 'failed').length;
  const runningJobs = (jobs ?? []).filter((job) => job.status === 'running').length;
  const queuedJobs = (jobs ?? []).filter((job) => job.status === 'queued').length;
  const readiness = summary?.readiness ?? {};
  const commandActions = window.ControlSurfaceModel
    ? window.ControlSurfaceModel.commandActions(project, summary)
    : [];
  const developerAction = window.ControlSurfaceModel
    ? window.ControlSurfaceModel.developerNextAction(project, summary, jobs)
    : {
        label: summary?.handoff?.status === 'ready' ? 'Open handoff' : failedJobs > 0 ? 'Inspect failed job' : 'Continue provisioning',
        detail: latestEvent ? `${timelineTitle(latestEvent.toolName)} · ${latestEvent.timestamp.slice(0, 19).replace('T', ' ')}Z` : 'no orchestration event yet',
        href: failedJobs > 0 ? '#/jobs' : null,
      };
  const roleFocus = window.ControlSurfaceModel?.roleProjectFocus?.(roleLens, project, summary, jobs, sessions);
  const activeAction = roleFocus?.primaryAction ?? developerAction;
  const roleCopy = window.ControlSurfaceModel?.roleCopy?.(roleLens) ?? {};
  const primaryLabel = activeAction.label;
  const nextActionLabel = roleLens === 'developer' ? 'next developer action' : `next ${roleCopy.label ?? roleLens} action`;
  const activatePrimary = () => {
    if (activeAction.href && String(activeAction.href).startsWith('#')) {
      window.location.hash = activeAction.href;
      return;
    }
    if (activeAction.href) {
      window.open(activeAction.href, '_blank', 'noopener,noreferrer');
      return;
    }
    onPrimaryAction();
  };
  return (
    <div className="project-command-header">
      <div className="project-command-main">
        <ProjectMark project={project} size="xl" />
        <div>
          <div className="project-key">{project.key}</div>
          <div className="project-command-title">{project.name}</div>
          <div className="project-command-meta">
            <StatePill state={project.state} />
            {phaseSummary && <Pill tone={phaseSummary.status === 'blocked' ? 'red' : phaseSummary.status === 'complete' ? 'green' : 'amber'}>{phaseSummary.label}</Pill>}
            {readiness.verdict && <Pill tone={readiness.verdict === 'ready' ? 'green' : readiness.verdict === 'blocked' ? 'red' : 'amber'}>{readiness.verdict}</Pill>}
            {project.atlassianProjectKey && <Pill tone="blue">Jira {project.atlassianProjectKey}</Pill>}
            {failedJobs > 0 && <Pill tone="red">{failedJobs} failed jobs</Pill>}
            {runningJobs > 0 && <Pill tone="amber">{runningJobs} running</Pill>}
          </div>
        </div>
      </div>
      <div className="project-command-metrics">
        <div><span>readiness</span><strong>{readiness.score ?? readinessPercent(project.state)}%</strong></div>
        <div><span>artifacts</span><strong>{artifactLinkedCount(summary)}/6</strong></div>
        <div><span>queue</span><strong>{queuedJobs + runningJobs}</strong></div>
        <div><span>agents</span><strong>{sessions.data?.totalActive ?? '-'}</strong></div>
      </div>
      <div className="project-command-side">
        <div className="command-next-row">
          <div>
            <span className="label-sm">{nextActionLabel}</span>
            <strong>{primaryLabel}</strong>
            <small>{activeAction.detail ?? (latestEvent ? `${timelineTitle(latestEvent.toolName)} · ${latestEvent.timestamp.slice(0, 19).replace('T', ' ')}Z` : 'no orchestration event yet')}</small>
          </div>
          <button className="btn primary" onClick={activatePrimary}>{primaryLabel}</button>
        </div>
        <ArtifactChainDiagram project={project} summary={summary} compact />
        <ReadinessRadar project={project} summary={summary} jobs={jobs} sessions={sessions} />
        {agentLaneSummary && (
          <div className="agent-feature-strip">
            <span>{agentLaneSummary.readyHandoffs} ready handoffs</span>
            <span>{agentLaneSummary.blockedJobs} blocked lanes</span>
          </div>
        )}
        <div className="command-action-row">
          {commandActions.slice(0, 6).map((action) => (
            action.href
              ? <a key={action.id} className={'btn sm ' + (action.enabled ? 'ghost' : 'disabled')} href={action.href} target={String(action.href).startsWith('#') ? undefined : '_blank'} rel={String(action.href).startsWith('#') ? undefined : 'noreferrer'}>{action.label}</a>
              : <button key={action.id} className="btn sm ghost" disabled={!action.enabled} onClick={() => action.copyValue && navigator.clipboard?.writeText(action.copyValue)}>{action.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProjectDetailHero(props) {
  return <ProjectCommandHeader {...props} />;
}

function RoleWorkspacePanel({ roleLens, project, summary, jobs, sessions, latestEvent, onOpenProvision }) {
  if (roleLens === 'developer') {
    return (
      <DeveloperWorkspacePanel
        project={project}
        summary={summary}
        jobs={jobs}
        sessions={sessions}
        latestEvent={latestEvent}
        onOpenProvision={onOpenProvision}
      />
    );
  }

  const model = window.ControlSurfaceModel;
  const focus = model?.roleProjectFocus?.(roleLens, project, summary, jobs, sessions);
  const copy = model?.roleCopy?.(roleLens) ?? {};
  if (!focus) return null;
  const primary = focus.primaryAction;

  const activatePrimary = () => {
    if (primary?.href && String(primary.href).startsWith('#')) {
      window.location.hash = primary.href;
      return;
    }
    if (primary?.href) {
      window.open(primary.href, '_blank', 'noopener,noreferrer');
      return;
    }
    onOpenProvision();
  };

  return (
    <section className={`role-workspace-panel ${roleLens}`}>
      <div className="role-workspace-head">
        <div>
          <span className="label-sm">{copy.projectWorkspaceLabel ?? focus.title}</span>
          <strong>{primary?.label ?? focus.title}</strong>
          <p>{primary?.detail ?? 'Role-specific focus for this project.'}</p>
        </div>
        <div className="role-workspace-actions">
          <button type="button" className="btn primary" onClick={activatePrimary}>{primary?.label ?? 'Open'}</button>
          {summary?.jira?.projectUrl && <a className="btn ghost" href={summary.jira.projectUrl} target="_blank" rel="noreferrer">Open Jira</a>}
          {summary?.confluence?.spaceUrl && <a className="btn ghost" href={summary.confluence.spaceUrl} target="_blank" rel="noreferrer">Open docs</a>}
          {['devops', 'operator', 'scrum'].includes(roleLens) && <a className="btn ghost" href="#/jobs">Open queue</a>}
        </div>
      </div>
      <div className="role-project-focus-grid">
        {(focus.cards ?? []).map((card) => (
          <div key={card.id} className={`role-project-focus-card ${card.tone ?? 'grey'}`}>
            <Icon name={card.icon ?? card.id} />
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.detail}</small>
          </div>
        ))}
      </div>
      <div className="role-panel-map">
        {(focus.emphasizedPanels ?? []).map((panel) => (
          <span key={panel}>{panel.replace(/-/g, ' ')}</span>
        ))}
      </div>
    </section>
  );
}

function DeveloperWorkspacePanel({ project, summary, jobs, sessions, latestEvent, onOpenProvision }) {
  const model = window.ControlSurfaceModel;
  const nextAction = model?.developerNextAction(project, summary, jobs) ?? {
    id: 'continue',
    label: 'Continue provisioning',
    detail: 'Build inputs are still being assembled.',
    href: null,
    tone: 'amber',
  };
  const commands = model?.developerCommandRows(project, summary, jobs) ?? [];
  const lenses = model?.developerLensRows(project, summary, jobs, sessions) ?? [];
  const failedJobs = (jobs ?? []).filter((job) => job.status === 'failed');
  const latestFailed = failedJobs[0] ?? null;
  const sourceRows = developerSourceRows(project, summary);
  const traceRows = (summary?.traceRows ?? []).slice(0, 4);
  const handoffUri = summary?.handoff?.uri ?? summary?.handoff?.latestBundleId ?? null;

  const activateNext = () => {
    if (nextAction.href && String(nextAction.href).startsWith('#')) {
      window.location.hash = nextAction.href;
      return;
    }
    if (nextAction.href) {
      window.open(nextAction.href, '_blank', 'noopener,noreferrer');
      return;
    }
    onOpenProvision();
  };

  return (
    <section className="developer-workspace-panel">
      <div className="developer-workspace-head">
        <div>
          <span className="label-sm">developer workspace</span>
          <strong>{nextAction.label}</strong>
          <p>{nextAction.detail}</p>
        </div>
        <div className="developer-workspace-actions">
          <button type="button" className="btn primary" onClick={activateNext}>{nextAction.label}</button>
          {summary?.vcs?.repoUrl && <a className="btn ghost" href={summary.vcs.repoUrl} target="_blank" rel="noreferrer">Open repo</a>}
          {handoffUri && <button type="button" className="btn ghost" onClick={() => navigator.clipboard?.writeText(handoffUri)}>Copy handoff URI</button>}
          <a className="btn ghost" href="#/jobs">Open logs</a>
        </div>
      </div>

      <div className="developer-command-grid">
        {commands.map((command) => (
          <div key={command.id} className={`developer-command ${command.tone ?? 'grey'}`}>
            <div>
              <span>{command.label}</span>
              <strong className="mono">{command.value}</strong>
            </div>
            {command.href
              ? <a className="btn sm ghost" href={command.href} target={String(command.href).startsWith('#') ? undefined : '_blank'} rel={String(command.href).startsWith('#') ? undefined : 'noreferrer'}>Open</a>
              : <button type="button" className="btn sm ghost" onClick={() => navigator.clipboard?.writeText(command.value)} disabled={String(command.value).includes('pending')}>Copy</button>}
          </div>
        ))}
      </div>

      <div className="developer-lens-grid">
        {lenses.map((lens) => (
          <div key={lens.id} className={`developer-lens-card ${lens.tone ?? 'grey'}`}>
            <div className="lens-label">{lens.label}</div>
            <strong>{lens.status}</strong>
            <small>{lens.detail}</small>
          </div>
        ))}
      </div>

      <div className="developer-workspace-split">
        <div className="developer-debug-card">
          <div className="head"><span>debug surface</span><span className="right"><Pill tone={latestFailed ? 'red' : 'green'}>{latestFailed ? 'failure' : 'clear'}</Pill></span></div>
          {latestFailed ? (
            <div className="developer-debug-body">
              <strong className="mono">{latestFailed.id}</strong>
              <span>{latestFailed.error ?? 'Failed without a captured error message.'}</span>
              <a className="btn sm ghost" href="#/jobs">Open job log</a>
            </div>
          ) : (
            <div className="developer-debug-body">
              <strong>No failed jobs</strong>
              <span>{latestEvent ? `${timelineTitle(latestEvent.toolName)} at ${latestEvent.timestamp.slice(0, 19).replace('T', ' ')}Z` : 'No orchestration event recorded yet.'}</span>
              <a className="btn sm ghost" href="#/jobs">Open queue</a>
            </div>
          )}
        </div>

        <div className="developer-source-card">
          <div className="head"><span>source of truth</span><span className="right"><Icon name="trace" /></span></div>
          <div className="developer-source-list">
            {sourceRows.map((source) => {
              const body = (
                <>
                  <Icon name={source.icon} />
                  <div>
                    <span>{source.label}</span>
                    <strong>{source.value}</strong>
                    <small>{source.meta}</small>
                  </div>
                  <Pill tone={source.tone}>{source.status}</Pill>
                </>
              );
              return source.href
                ? <a key={source.id} className="developer-source-row" href={source.href} target={source.href.startsWith('#') ? undefined : '_blank'} rel={source.href.startsWith('#') ? undefined : 'noreferrer'}>{body}</a>
                : <div key={source.id} className="developer-source-row">{body}</div>;
            })}
          </div>
        </div>
      </div>

      <DeveloperTraceCards rows={traceRows} />
    </section>
  );
}

function developerSourceRows(project, summary) {
  return [
    {
      id: 'handoff',
      icon: 'handoff',
      label: 'Handoff bundle',
      value: summary?.handoff?.uri ?? summary?.handoff?.latestBundleId ?? 'pending',
      meta: summary?.handoff?.blockingReason ?? `${summary?.handoff?.bundleCount ?? 0} bundle(s)`,
      status: summary?.handoff?.status ?? 'not_ready',
      tone: artifactTone(summary?.handoff?.status),
    },
    {
      id: 'repo',
      icon: 'repo',
      label: 'Repository',
      value: summary?.vcs?.repoUrl ? repoHost(summary.vcs.repoUrl) : 'pending',
      meta: summary?.vcs?.repoUrl ?? 'repo link unavailable',
      status: summary?.vcs?.status ?? 'missing',
      tone: artifactTone(summary?.vcs?.status),
      href: summary?.vcs?.repoUrl ?? null,
    },
    {
      id: 'jira',
      icon: 'jira',
      label: 'Jira work',
      value: summary?.jira?.projectKey ?? project.atlassianProjectKey ?? 'pending',
      meta: `${summary?.jira?.issueCount ?? 0} issue(s), ${summary?.jira?.plannedCount ?? 0} planned`,
      status: summary?.jira?.status ?? 'missing',
      tone: artifactTone(summary?.jira?.status),
      href: summary?.jira?.projectUrl ?? null,
    },
    {
      id: 'docs',
      icon: 'docs',
      label: 'Confluence docs',
      value: summary?.confluence?.spaceId ?? 'pending',
      meta: `${summary?.confluence?.pageCount ?? 0} page(s), ${summary?.confluence?.plannedCount ?? 0} planned`,
      status: summary?.confluence?.status ?? 'missing',
      tone: artifactTone(summary?.confluence?.status),
      href: summary?.confluence?.spaceUrl ?? null,
    },
    {
      id: 'context',
      icon: 'context',
      label: 'Context pack',
      value: summary?.context?.uri ?? 'pending',
      meta: summary?.context?.provenance ?? 'context source unavailable',
      status: summary?.context?.status ?? 'planned',
      tone: artifactTone(summary?.context?.status),
    },
  ];
}

function DeveloperTraceCards({ rows }) {
  return (
    <div className="developer-trace-card">
      <div className="head"><span>developer trace</span><span className="right">{rows.length} mapped</span></div>
      <div className="developer-trace-list">
        {rows.length === 0 && <div className="empty-copy">No requirement-to-code rows are available yet.</div>}
        {rows.map((row) => (
          <div key={row.id} className="developer-trace-row">
            <div>
              <span className="mono">{row.requirementId}</span>
              <strong>{row.featureTitle}</strong>
            </div>
            <div>
              <span>code</span>
              <strong className="mono">{row.repoPath ?? 'repo path pending'}</strong>
            </div>
            <div>
              <span>work</span>
              <strong>{row.jiraIssueUrl ? <a href={row.jiraIssueUrl} target="_blank" rel="noreferrer">{row.jiraIssueKey}</a> : row.jiraIssueKey ?? 'planned'}</strong>
            </div>
            <div>
              <span>readiness</span>
              <Pill tone={artifactTone(row.status)}>{row.readinessGate}</Pill>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function artifactLinkedCount(summary) {
  const statuses = [
    summary?.jira?.status,
    summary?.confluence?.status,
    summary?.vcs?.status,
    summary?.context?.status,
    summary?.readiness?.status,
    summary?.handoff?.status,
  ];
  return statuses.filter((status) => ['linked', 'ready'].includes(status)).length;
}

function ProjectSideRail({ activeTab, onSelectTab, project, summary }) {
  const items = [
    { id: 'overview', label: 'Overview', tab: 'overview', icon: 'context' },
    { id: 'code', label: 'Code', tab: 'overview', icon: 'repo' },
    { id: 'trace', label: 'Trace', tab: 'overview', icon: 'trace' },
    { id: 'queue', label: 'Queue', tab: 'jobs', icon: 'queue' },
    { id: 'agents', label: 'Agents', tab: 'overview', icon: 'agent' },
    { id: 'audit', label: 'Audit', tab: 'audit', icon: 'audit' },
    { id: 'provision', label: 'Provision', tab: 'provision', icon: 'action' },
  ];
  return (
    <aside className="project-side-rail">
      <div className="side-rail-head">
        <ProjectMark project={project} size="xs" />
        <span className="mono">{project.key}</span>
      </div>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={activeTab === item.tab ? 'active' : ''}
          onClick={() => onSelectTab(item.tab)}
        >
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </button>
      ))}
      <div className="side-rail-status">
        <span>handoff</span>
        <Pill tone={artifactTone(summary?.handoff?.status)}>{summary?.handoff?.status ?? 'not_ready'}</Pill>
      </div>
    </aside>
  );
}

function ProjectBreadcrumbTrail({ project, summary }) {
  const phase = phaseForState(project.state);
  const jiraKey = summary?.jira?.projectKey ?? project.atlassianProjectKey ?? null;
  const crumbs = [
    { label: 'Pipeline', href: '#/' },
    { label: 'Projects', href: '#/projects' },
    { label: project.key, href: `#/projects/${project.key}` },
    { label: phase?.label ?? stateLabel(project.state), href: null },
  ];

  return (
    <nav className="project-breadcrumb-trail" aria-label="Project breadcrumb">
      {crumbs.map((crumb, index) => (
        <React.Fragment key={`${crumb.label}:${index}`}>
          {index > 0 && <span className="breadcrumb-sep">/</span>}
          {crumb.href
            ? <a href={crumb.href}>{crumb.label}</a>
            : <span className="breadcrumb-current" aria-current="page">{crumb.label}</span>}
        </React.Fragment>
      ))}
      {jiraKey && <span className="breadcrumb-meta">Jira {jiraKey}</span>}
    </nav>
  );
}

function OperatorLaunchpad({ project, summary, onOpenProvision, onOpenTransitions }) {
  void onOpenTransitions;
  const handoffUri = summary?.handoff?.uri ?? summary?.handoff?.latestBundleId ?? null;
  const actions = [
    {
      id: 'handoff',
      icon: 'handoff',
      label: 'Handoff bundle',
      value: handoffUri ?? 'pending',
      meta: summary?.handoff?.status ?? 'not ready',
      tone: artifactTone(summary?.handoff?.status),
      onClick: () => handoffUri && navigator.clipboard?.writeText(handoffUri),
    },
    {
      id: 'repo',
      icon: 'repo',
      label: 'Repository',
      value: summary?.vcs?.repoUrl ? repoHost(summary.vcs.repoUrl) : 'link repo',
      meta: summary?.vcs?.repoUrl ?? `${summary?.vcs?.fileCount ?? 0} seeded files`,
      tone: artifactTone(summary?.vcs?.status),
      href: summary?.vcs?.repoUrl ?? null,
      onClick: onOpenProvision,
    },
    {
      id: 'context',
      icon: 'context',
      label: 'Context pack',
      value: summary?.context?.uri ?? 'pending',
      meta: summary?.context?.lastSyncedAt ? `synced ${summary.context.lastSyncedAt.slice(0, 10)}` : 'source pins',
      tone: artifactTone(summary?.context?.status),
      onClick: () => summary?.context?.uri && navigator.clipboard?.writeText(summary.context.uri),
    },
    {
      id: 'jira',
      icon: 'jira',
      label: 'Jira work',
      value: summary?.jira?.projectKey ?? project.atlassianProjectKey ?? 'planned',
      meta: `${summary?.jira?.issueCount ?? 0} cards`,
      tone: artifactTone(summary?.jira?.status),
      href: summary?.jira?.projectUrl ?? null,
    },
    {
      id: 'docs',
      icon: 'docs',
      label: 'Confluence docs',
      value: summary?.confluence?.spaceId ?? 'planned',
      meta: `${summary?.confluence?.pageCount ?? 0} pages`,
      tone: artifactTone(summary?.confluence?.status),
      href: summary?.confluence?.spaceUrl ?? null,
    },
    {
      id: 'logs',
      icon: 'queue',
      label: 'Queue and logs',
      value: `${summary?.queue?.openJobs ?? 0} open`,
      meta: `${summary?.queue?.failedJobs ?? 0} failed`,
      tone: (summary?.queue?.failedJobs ?? 0) > 0 ? 'red' : 'green',
      href: '#/jobs',
    },
  ];

  return (
    <div className="operator-launchpad">
      <div className="launchpad-head">
        <div>
          <span className="label-sm">developer launchpad</span>
          <strong>{project.key}</strong>
        </div>
        <ArtifactStrip summary={summary} compact />
      </div>
      <div className="launchpad-grid">
        {actions.map((action) => {
          const body = (
            <>
              <Icon name={action.icon} />
              <div>
                <span>{action.label}</span>
                <strong>{action.value}</strong>
                <small>{action.meta}</small>
              </div>
              <Pill tone={action.tone}>{action.tone}</Pill>
            </>
          );
          if (action.href) {
            return <a key={action.id} className="launchpad-action" href={action.href} target={action.href.startsWith('#') ? undefined : '_blank'} rel={action.href.startsWith('#') ? undefined : 'noreferrer'}>{body}</a>;
          }
          return <button key={action.id} type="button" className="launchpad-action" onClick={action.onClick} disabled={!action.onClick}>{body}</button>;
        })}
      </div>
    </div>
  );
}

function ArtifactMatrixPanel({ project, summary }) {
  const rows = artifactMatrixRows(project, summary);
  return (
    <div className="surf artifact-matrix-panel">
      <div className="head">
        <span>artifact matrix</span>
        <span className="right"><Icon name="trace" title="artifact matrix" /></span>
      </div>
      <div className="artifact-matrix-scroll">
        <table className="artifact-matrix-table">
          <thead>
            <tr>
              <th>resource</th>
              <th>status</th>
              <th>current</th>
              <th>planned</th>
              <th>action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className="artifact-matrix-resource">
                    <Icon name={row.icon} />
                    <div>
                      <strong>{row.label}</strong>
                      <small>{row.meta}</small>
                    </div>
                  </div>
                </td>
                <td><Pill tone={artifactTone(row.status)}>{row.status}</Pill></td>
                <td className="mono">{row.current}</td>
                <td className="mono">{row.planned}</td>
                <td>
                  {row.href
                    ? <a className="btn sm ghost" href={row.href} target="_blank" rel="noreferrer">Open</a>
                    : <span className="muted-mono">pending</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function artifactMatrixRows(project, summary) {
  const safe = summary ?? {};
  return [
    {
      id: 'jira',
      icon: 'jira',
      label: 'Jira project',
      status: safe.jira?.status ?? 'missing',
      current: `${safe.jira?.issueCount ?? 0} issues`,
      planned: `${safe.jira?.plannedCount ?? 0}`,
      meta: safe.jira?.projectKey ?? project.atlassianProjectKey ?? '-',
      href: safe.jira?.projectUrl ?? null,
    },
    {
      id: 'confluence',
      icon: 'docs',
      label: 'Confluence space',
      status: safe.confluence?.status ?? 'missing',
      current: `${safe.confluence?.pageCount ?? 0} pages`,
      planned: `${safe.confluence?.plannedCount ?? 0}`,
      meta: safe.confluence?.spaceId ?? '-',
      href: safe.confluence?.spaceUrl ?? null,
    },
    {
      id: 'vcs',
      icon: 'repo',
      label: 'Repository',
      status: safe.vcs?.status ?? 'missing',
      current: safe.vcs?.repoUrl ? repoHost(safe.vcs.repoUrl) ?? 'linked' : '-',
      planned: `${safe.vcs?.fileCount ?? 0} files`,
      meta: safe.vcs?.repoUrl ?? 'repo not linked',
      href: safe.vcs?.repoUrl ?? null,
    },
    {
      id: 'handoff',
      icon: 'handoff',
      label: 'Build handoff',
      status: safe.handoff?.status ?? 'not_ready',
      current: `${safe.handoff?.bundleCount ?? 0} bundles`,
      planned: safe.handoff?.latestBundleId ? safe.handoff.latestBundleId.slice(0, 12) : 'agent packet',
      meta: project.state === 'READY_FOR_BUILD' ? 'ready for agent claim' : stateLabel(project.state),
      href: null,
    },
  ];
}

function ProjectMilestonePanel({ project, summary }) {
  const rows = projectMilestoneRows(project, summary);
  const complete = rows.filter((row) => row.status === 'completed').length;
  return (
    <div className="surf project-milestone-panel">
      <div className="head">
        <span>Milestones</span>
        <span className="right">{complete}/{rows.length} complete</span>
      </div>
      <div className="milestone-list">
        {rows.map((row) => (
          <div key={row.id} className={`milestone-row ${row.status}`}>
            <span className="milestone-index">{row.index}</span>
            <div>
              <strong>{row.label}</strong>
              <small>{row.detail}</small>
            </div>
            <Pill tone={milestoneTone(row.status)}>{row.status}</Pill>
          </div>
        ))}
      </div>
    </div>
  );
}

function projectMilestoneRows(project, summary) {
  const currentIndexRaw = PIPELINE_PHASES.findIndex((phase) => phase.states.includes(project.state));
  const currentIndex = currentIndexRaw < 0 ? 0 : currentIndexRaw;
  const exception = EXCEPTION_STATES.includes(project.state);
  return PIPELINE_PHASES.map((phase, index) => {
    let status = index < currentIndex ? 'completed' : index === currentIndex ? 'current' : 'upcoming';
    if (exception && index >= currentIndex) status = index === currentIndex ? 'blocked' : 'upcoming';
    return {
      id: phase.id,
      index: String(index + 1).padStart(2, '0'),
      label: phase.label,
      status,
      detail: projectMilestoneDetail(phase.id, project, summary),
    };
  });
}

function projectMilestoneDetail(phaseId, project, summary) {
  if (phaseId === 'inception') return Number(project.blueprintVersion ?? 0) > 0 ? `blueprint v${project.blueprintVersion} captured` : 'intake record pending';
  if (phaseId === 'blueprint') return `current state: ${stateLabel(project.state)}`;
  if (phaseId === 'preflight') return `${readinessPercent(project.state)}% lifecycle readiness`;
  if (phaseId === 'provisioning') {
    return `Jira ${summary?.jira?.status ?? 'missing'} · docs ${summary?.confluence?.status ?? 'missing'} · repo ${summary?.vcs?.status ?? 'missing'}`;
  }
  if (phaseId === 'context') return `context pack ${summary?.context?.status ?? 'planned'} · ${readinessPercent(project.state)}% lifecycle readiness`;
  if (phaseId === 'readiness') return `readiness ${summary?.readiness?.verdict ?? stateLabel(project.state)} · ${summary?.readiness?.blockedCount ?? 0} blocked gates`;
  if (phaseId === 'handoff') return `handoff ${summary?.handoff?.status ?? 'not_ready'} · ${summary?.handoff?.bundleCount ?? 0} bundles`;
  return '-';
}

function milestoneTone(status) {
  if (status === 'completed') return 'green';
  if (status === 'blocked') return 'red';
  if (status === 'current') return 'amber';
  return 'grey';
}

function NextBestActionPanel({ project, summary, allowedTransitions, jobs, onOpenProvision, onOpenTransitions }) {
  const failedJobs = (jobs ?? []).filter((job) => job.status === 'failed').length;
  const hasProvisionGap = ['missing', 'planned', undefined].includes(summary?.jira?.status)
    || ['missing', 'planned', undefined].includes(summary?.confluence?.status)
    || ['missing', 'planned', undefined].includes(summary?.vcs?.status);
  let title = 'Keep project artifacts fresh';
  let body = 'Review linked resources and refresh previews before handing work to build agents.';
  let primary = { label: 'Open provision controls', onClick: onOpenProvision, href: null };
  let secondary = { label: 'Open agents', href: '#/sessions' };

  if (EXCEPTION_STATES.includes(project.state) || failedJobs > 0) {
    title = 'Resolve exception before handoff';
    body = `${failedJobs} failed jobs and state ${stateLabel(project.state)} need operator review.`;
    primary = { label: 'Review transitions', onClick: onOpenTransitions, href: null };
    secondary = { label: 'Open jobs', href: '#/jobs' };
  } else if (hasProvisionGap) {
    title = 'Provision missing artifact links';
    body = 'Preview or execute Jira, Confluence, and repo stages so agents receive complete context.';
  } else if (summary?.handoff?.status !== 'ready') {
    title = 'Compose the build handoff';
    body = 'Artifacts are present; create the handoff bundle before agent execution.';
  } else if (project.state === 'READY_FOR_BUILD') {
    title = 'Ready for build agents';
    body = 'Handoff bundle and project artifacts are available. Monitor connected agents and queue pressure.';
    primary = { label: 'Open agents', href: '#/sessions' };
    secondary = { label: 'Open jobs', href: '#/jobs' };
  } else if ((allowedTransitions ?? []).includes('READY_FOR_BUILD')) {
    title = 'Promote when review passes';
    body = 'Readiness artifacts are available; use the legal transition path after operator review.';
    primary = { label: 'Review transitions', onClick: onOpenTransitions, href: null };
  }

  return (
    <div className="next-action-panel">
      <Icon name="action" />
      <div>
        <span className="label-sm">next best action</span>
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
      <div className="next-action-buttons">
        {primary.href
          ? <a className="btn primary" href={primary.href}>{primary.label}</a>
          : <button className="btn primary" onClick={primary.onClick}>{primary.label}</button>}
        {secondary.href && <a className="btn ghost" href={secondary.href}>{secondary.label}</a>}
      </div>
    </div>
  );
}

function ResourceDock({ project, summary }) {
  const resources = [
    {
      id: 'jira',
      icon: 'jira',
      label: 'Jira project',
      value: summary?.jira?.projectKey ?? project.atlassianProjectKey ?? '-',
      meta: `${summary?.jira?.issueCount ?? 0} cards · ${summary?.jira?.plannedCount ?? 0} planned`,
      tone: artifactTone(summary?.jira?.status),
      href: summary?.jira?.projectUrl ?? null,
    },
    {
      id: 'docs',
      icon: 'docs',
      label: 'Confluence space',
      value: summary?.confluence?.spaceId ?? '-',
      meta: `${summary?.confluence?.pageCount ?? 0} pages · ${summary?.confluence?.plannedCount ?? 0} planned`,
      tone: artifactTone(summary?.confluence?.status),
      href: summary?.confluence?.spaceUrl ?? null,
    },
    {
      id: 'repo',
      icon: 'repo',
      label: 'Repository',
      value: summary?.vcs?.repoUrl ? repoHost(summary.vcs.repoUrl) : '-',
      meta: `${summary?.vcs?.fileCount ?? 0} files seeded`,
      tone: artifactTone(summary?.vcs?.status),
      href: summary?.vcs?.repoUrl ?? null,
    },
    {
      id: 'handoff',
      icon: 'handoff',
      label: 'Handoff bundle',
      value: summary?.handoff?.bundleCount ? `${summary.handoff.bundleCount}` : '-',
      meta: summary?.handoff?.latestBundleId ? `latest ${summary.handoff.latestBundleId.slice(0, 8)}` : summary?.handoff?.status ?? 'not ready',
      tone: artifactTone(summary?.handoff?.status),
    },
  ];

  return (
    <div className="surf resource-dock">
      <div className="head"><span>resource dock</span><span className="right"><Icon name="trace" /></span></div>
      <div className="resource-dock-grid">
        {resources.map((resource) => {
          const body = (
            <>
              <Icon name={resource.icon} />
              <div>
                <span>{resource.label}</span>
                <strong>{resource.value}</strong>
                <small>{resource.meta}</small>
              </div>
              <Pill tone={resource.tone}>{resource.tone}</Pill>
            </>
          );
          return resource.href
            ? <a key={resource.id} className="resource-row" href={resource.href} target="_blank" rel="noreferrer">{body}</a>
            : <div key={resource.id} className="resource-row">{body}</div>;
        })}
      </div>
    </div>
  );
}

function JiraCardsPanel({ summary }) {
  const jira = summary?.jira ?? {};
  const cards = jira.cards ?? [];
  return (
    <div className="surf artifact-panel jira-panel">
      <div className="head">
        <span>Jira cards</span>
        <span className="right"><Pill tone={artifactTone(jira.status)}>{jira.status ?? 'missing'}</Pill></span>
      </div>
      <div className="artifact-panel-summary">
        <strong>{jira.issueCount ?? 0}</strong>
        <span>{jira.plannedCount ?? cards.length} planned</span>
        {jira.projectUrl
          ? <a className="mono artifact-link" href={jira.projectUrl} target="_blank" rel="noreferrer">{jira.projectKey ?? '-'}</a>
          : <span className="mono">{jira.projectKey ?? '-'}</span>}
      </div>
      <div className="jira-card-list">
        {cards.length === 0 && <div className="empty-copy">No Jira work tree planned.</div>}
        {cards.slice(0, 8).map((card) => {
          const body = (
            <>
              <div className="jira-card-top">
                <Pill tone={card.kind === 'epic' ? 'blue' : 'grey'}>{card.kind}</Pill>
                <span className="mono">{card.issueKey ?? card.nodeId}</span>
              </div>
              <div className="jira-card-title">{card.title}</div>
            </>
          );
          return card.issueUrl
            ? <a key={`${card.kind}:${card.nodeId}`} className={`jira-work-card ${card.kind}`} href={card.issueUrl} target="_blank" rel="noreferrer">{body}</a>
            : <div key={`${card.kind}:${card.nodeId}`} className={`jira-work-card ${card.kind}`}>{body}</div>;
        })}
      </div>
    </div>
  );
}

function ConfluencePagesPanel({ summary }) {
  const confluence = summary?.confluence ?? {};
  const pages = confluence.pages ?? [];
  return (
    <div className="surf artifact-panel confluence-panel">
      <div className="head">
        <span>Confluence pages</span>
        <span className="right"><Pill tone={artifactTone(confluence.status)}>{confluence.status ?? 'missing'}</Pill></span>
      </div>
      <div className="artifact-panel-summary">
        <strong>{confluence.pageCount ?? 0}</strong>
        <span>{confluence.plannedCount ?? pages.length} planned</span>
        {confluence.spaceUrl
          ? <a className="mono artifact-link" href={confluence.spaceUrl} target="_blank" rel="noreferrer">{confluence.spaceId ?? '-'}</a>
          : <span className="mono">{confluence.spaceId ?? '-'}</span>}
      </div>
      <div className="confluence-page-list">
        {pages.length === 0 && <div className="empty-copy">No Confluence page set planned.</div>}
        {pages.slice(0, 8).map((page) => {
          const pageHref = page.pageUrl ?? confluence.spaceUrl ?? null;
          const body = (
            <>
              <div className="page-template mono">{page.templateSlug}</div>
              <div className="page-title">{page.title}</div>
              <div className="muted-mono">{page.pageId ? `page ${page.pageId}` : 'planned'}</div>
            </>
          );
          return pageHref
            ? <a key={`${page.templateSlug}:${page.title}`} className="confluence-page-card" href={pageHref} target="_blank" rel="noreferrer">{body}</a>
            : <div key={`${page.templateSlug}:${page.title}`} className="confluence-page-card">{body}</div>;
        })}
      </div>
    </div>
  );
}

function AgentHandoffPanel({ project, summary, sessions, jobs }) {
  const handoff = summary?.handoff ?? {};
  const vcs = summary?.vcs ?? {};
  const activeSessions = sessions.data?.sessions ?? [];
  const queued = (jobs ?? []).filter((job) => job.status === 'queued').length;
  const running = (jobs ?? []).filter((job) => job.status === 'running').length;
  const completed = (jobs ?? []).filter((job) => job.status === 'completed').length;
  const failed = (jobs ?? []).filter((job) => job.status === 'failed').length;
  return (
    <div className="surf artifact-panel handoff-panel">
      <div className="head">
        <span>Agent handoff</span>
        <span className="right"><Pill tone={artifactTone(handoff.status)}>{handoff.status ?? 'not_ready'}</Pill></span>
      </div>
      <div className="handoff-meter">
        <ProjectProgressRail state={project.state} />
      </div>
      <div className="handoff-facts">
        <div><span>bundles</span><strong>{handoff.bundleCount ?? 0}</strong></div>
        <div><span>repo</span><strong>{vcs.repoUrl ? 'linked' : '-'}</strong></div>
        <div><span>files</span><strong>{vcs.fileCount ?? 0}</strong></div>
        <div><span>agents</span><strong>{sessions.data?.totalActive ?? '-'}</strong></div>
      </div>
      <div className="agent-queue-list">
        <div className="agent-job-row"><span className="mono">running</span><Pill tone="amber">{running}</Pill><span></span></div>
        <div className="agent-job-row"><span className="mono">queued</span><Pill tone="grey">{queued}</Pill><span></span></div>
        <div className="agent-job-row"><span className="mono">completed</span><Pill tone="green">{completed}</Pill><span></span></div>
        <div className="agent-job-row"><span className="mono">failed</span><Pill tone={failed > 0 ? 'red' : 'grey'}>{failed}</Pill><span></span></div>
      </div>
      {activeSessions.slice(0, 2).map((session) => (
        <div className="agent-card" key={session.sessionId}>
          <div>
            <div className="agent-name">{session.clientName ?? 'unnamed agent'}</div>
            <div className="muted-mono">{session.sessionId.slice(0, 12)}...</div>
          </div>
          <Pill tone="green">{session.featuresEnabled.length} enabled</Pill>
        </div>
      ))}
    </div>
  );
}

function TraceMatrixPanel({ rows }) {
  const traceRows = rows ?? [];
  return (
    <div className="surf trace-matrix-panel">
      <div className="head"><span>trace matrix</span><span className="right"><Icon name="matrix" /></span></div>
      <div className="trace-matrix-scroll">
        <table className="trace-matrix-table">
          <thead>
            <tr>
              <th>requirement</th>
              <th>feature</th>
              <th>Jira</th>
              <th>Confluence</th>
              <th>repo / PR</th>
              <th>context</th>
              <th>readiness</th>
              <th>handoff</th>
            </tr>
          </thead>
          <tbody>
            {traceRows.length === 0 && (
              <tr><td colSpan="8" className="empty-copy">No trace rows emitted by the project detail payload.</td></tr>
            )}
            {traceRows.map((row) => (
              <tr key={row.id}>
                <td className="mono">{row.requirementId}</td>
                <td>{row.featureTitle}</td>
                <td>{row.jiraIssueUrl ? <a href={row.jiraIssueUrl} target="_blank" rel="noreferrer">{row.jiraIssueKey}</a> : <span className="muted-mono">{row.jiraIssueKey ?? 'planned'}</span>}</td>
                <td>{row.confluenceUrl ? <a href={row.confluenceUrl} target="_blank" rel="noreferrer">{row.confluenceTitle}</a> : <span className="muted-mono">{row.confluenceTitle ?? 'planned'}</span>}</td>
                <td className="mono">{row.pullRequestUrl ? <a href={row.pullRequestUrl} target="_blank" rel="noreferrer">PR</a> : row.repoPath ?? '-'}</td>
                <td className="mono">{row.contextPackUri ?? '-'}</td>
                <td>{row.readinessGate}</td>
                <td><Pill tone={artifactTone(row.status)}>{row.handoffBundleId ?? row.status}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TraceMapWidget({ project, summary }) {
  const jiraCards = summary?.jira?.cards ?? [];
  const pages = summary?.confluence?.pages ?? [];
  const steps = [
    { id: 'blueprint', icon: 'context', label: 'Blueprint', value: `v${project.blueprintVersion}`, sub: stateLabel(project.state), tone: 'blue' },
    { id: 'jira', icon: 'jira', label: 'Jira', value: `${summary?.jira?.issueCount ?? 0}`, sub: `${jiraCards.length} mapped nodes`, tone: artifactTone(summary?.jira?.status) },
    { id: 'docs', icon: 'docs', label: 'Confluence', value: `${summary?.confluence?.pageCount ?? 0}`, sub: `${pages.length} page templates`, tone: artifactTone(summary?.confluence?.status) },
    { id: 'repo', icon: 'repo', label: 'Repo', value: summary?.vcs?.repoUrl ? 'linked' : '-', sub: `${summary?.vcs?.fileCount ?? 0} files`, tone: artifactTone(summary?.vcs?.status) },
    { id: 'handoff', icon: 'handoff', label: 'Handoff', value: `${summary?.handoff?.bundleCount ?? 0}`, sub: summary?.handoff?.status ?? 'not ready', tone: artifactTone(summary?.handoff?.status) },
  ];
  return (
    <div className="surf trace-map-widget">
      <div className="head"><span>trace map</span><span className="right"><Icon name="trace" /></span></div>
      <div className="trace-map-flow">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <div className={`trace-node ${step.tone}`}>
              <Icon name={step.icon} />
              <span>{step.label}</span>
              <strong>{step.value}</strong>
              <small>{step.sub}</small>
            </div>
            {index < steps.length - 1 && <div className="trace-edge"></div>}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function OrchestrationTimeline({ entries }) {
  const rows = (entries ?? []).slice(0, 8);
  return (
    <div className="surf orchestration-timeline">
      <div className="head"><span>orchestration timeline</span><span className="right"><Icon name="activity" /></span></div>
      <ActivityHeatStrip entries={rows} jobs={[]} />
      <div className="timeline-list">
        {rows.length === 0 && <div className="empty-copy">No orchestration activity recorded for this project.</div>}
        {rows.map((entry) => (
          <div key={entry.id} className="timeline-row">
            <Icon name={timelineIcon(entry.toolName)} />
            <div>
              <strong>{timelineTitle(entry.toolName)}</strong>
              <span className="muted-mono">{entry.timestamp.slice(0, 19).replace('T', ' ')}Z · {entry.actor}</span>
              {(entry.outputArtifactIds ?? []).length > 0 && (
                <div className="timeline-artifacts">
                  {entry.outputArtifactIds.slice(0, 3).map((artifact) => <Pill key={artifact} tone="grey">{artifact}</Pill>)}
                </div>
              )}
            </div>
            <OutcomePill outcome={entry.outcome} />
          </div>
        ))}
      </div>
    </div>
  );
}

function timelineIcon(toolName) {
  if (toolName.includes('jira')) return 'jira';
  if (toolName.includes('confluence')) return 'docs';
  if (toolName.includes('vcs')) return 'repo';
  if (toolName.includes('handoff')) return 'handoff';
  if (toolName.includes('adopt')) return 'context';
  return 'activity';
}

function timelineTitle(toolName) {
  return String(toolName ?? '').replace(/^admin\./, '').replaceAll('.', ' / ');
}

function ProvisionSection({ projectKey, atlassianProjectKey, operatorBadge }) {
  // 4 stacked stages: Jira → Confluence → VCS → handoff. Each has preview +
  // execute controls. Provider-backed executes return dataLimited honestly
  // when the provider isn't configured; the UI surfaces the badge.
  const manifest = useAdmin('admin.velocity.manifest.get');
  const [jiraPreview, setJiraPreview] = useState(null);
  const [confluencePreview, setConfluencePreview] = useState(null);
  const [vcsPreview, setVcsPreview] = useState(null);
  const [handoffPacket, setHandoffPacket] = useState(null);
  const [lastJiraProjectKey, setLastJiraProjectKey] = useState(atlassianProjectKey ?? null);
  const [lastConfluenceSpaceId, setLastConfluenceSpaceId] = useState(null);
  const [lastRepoUrl, setLastRepoUrl] = useState(null);
  const [stackChoices, setStackChoices] = useState([]);
  const [confluenceSpaceId, setConfluenceSpaceId] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [repoSlug, setRepoSlug] = useState(projectKey.toLowerCase());
  const [confirmAction, setConfirmAction] = useState(null);
  const [working, setWorking] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const callPreview = async (toolName, args, setter) => {
    setWorking(true); setError(null);
    try {
      const r = await window.MCP_CLIENT.callTool(toolName, args);
      setter(r.structuredContent);
    } catch (err) {
      setError(err);
    } finally {
      setWorking(false);
    }
  };

  const submitWrite = async (reason) => {
    if (!confirmAction) return;
    const ca = confirmAction;
    setConfirmAction(null);
    setWorking(true); setError(null);
    try {
      const args = { ...ca.baseArgs, reason, operatorBadge };
      const r = await window.MCP_CLIENT.callTool(ca.tool, args);
      const sc = r.structuredContent;
      if (sc?.ok !== false) {
        if (ca.tool === 'admin.lifecycle.jira.execute') setLastJiraProjectKey(args.jiraProjectKey);
        if (ca.tool === 'admin.lifecycle.confluence.execute') setLastConfluenceSpaceId(args.spaceId);
        if (ca.tool === 'admin.lifecycle.vcs.execute' && sc.repoUrl) setLastRepoUrl(sc.repoUrl);
      }
      if (ca.tool === 'admin.lifecycle.handoff.bundle') setHandoffPacket(sc);
      flash(`${ca.successLabel} — audit ${sc.auditEntryId?.slice(0, 8) ?? '?'}`);
      if (sc.dataLimited?.reason) flash(`data limited: ${sc.dataLimited.reason}`);
    } catch (err) {
      setError(err);
    } finally {
      setWorking(false);
    }
  };

  const moduleSlugs = manifest.data?.modules ?? [];

  return (
    <div>
      <div className="cp-section-head">
        <span className="cp-section-num">provision · M5–M9</span>
        <h2 className="cp-section-title">Provisioning lifecycle</h2>
        <span className="cp-section-blurb">Preview each stage, then execute when ready. Every execute is logged in the audit chain.</span>
      </div>
      <ErrorBlock error={error} />

      {/* Stage 1: Jira */}
      <div className="cp-section-head" style={{ marginTop: 24 }}>
        <span className="cp-section-num">stage 1</span>
        <h2 className="cp-section-title">Jira issue tree</h2>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className="btn" disabled={working} onClick={() => callPreview('admin.lifecycle.jira.preview', { projectKey }, setJiraPreview)}>Preview Jira issues</button>
        <button className="btn warn" disabled={working || !jiraPreview} onClick={() => setConfirmAction({
          tool: 'admin.lifecycle.jira.execute',
          baseArgs: { projectKey, jiraProjectKey: atlassianProjectKey ?? projectKey },
          title: `Create Jira issue tree for ${projectKey}`,
          body: `Creates the epic + story tree in Jira project ${atlassianProjectKey ?? projectKey}. Idempotent on re-run.`,
          successLabel: 'Jira tree created',
        })}>Execute Jira creation</button>
      </div>
      {jiraPreview && (
        <table className="cp-table">
          <thead><tr><th>kind</th><th>node id</th><th>title</th></tr></thead>
          <tbody>
            {jiraPreview.plannedNodes.length === 0 && (
              <tr><td colSpan="3" style={{ color: 'var(--ink-3)', textAlign: 'center', padding: 20 }}>Blueprint has no epics or stories yet.</td></tr>
            )}
            {jiraPreview.plannedNodes.map((n) => (
              <tr key={n.nodeId}>
                <td><Pill tone={n.kind === 'epic' ? 'blue' : 'grey'}>{n.kind}</Pill></td>
                <td className="mono">{n.nodeId}</td>
                <td>{n.title}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Stage 2: Confluence */}
      <div className="cp-section-head" style={{ marginTop: 32 }}>
        <span className="cp-section-num">stage 2</span>
        <h2 className="cp-section-title">Confluence pages</h2>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="search"
          style={{ minWidth: 200, padding: 4, fontFamily: 'var(--font-mono)', fontSize: 11.5, border: '1px solid var(--line-strong)' }}
          placeholder="Confluence space id…"
          value={confluenceSpaceId}
          onChange={(e) => setConfluenceSpaceId(e.target.value)}
        />
        <button className="btn" disabled={working} onClick={() => callPreview('admin.lifecycle.confluence.preview', { projectKey }, setConfluencePreview)}>Preview Confluence pages</button>
        <button className="btn warn" disabled={working || !confluencePreview || !confluenceSpaceId} onClick={() => setConfirmAction({
          tool: 'admin.lifecycle.confluence.execute',
          baseArgs: { projectKey, spaceId: confluenceSpaceId },
          title: `Create ${confluencePreview?.totalPages ?? 0} pages in space ${confluenceSpaceId}`,
          body: `Creates ${confluencePreview?.totalPages ?? 0} Confluence pages from the velocity templates. Returns the new page ids.`,
          successLabel: 'Confluence pages created',
        })}>Seed Confluence</button>
      </div>
      {confluencePreview && (
        <table className="cp-table">
          <thead><tr><th>template</th><th>title</th><th>subs</th><th>unresolved</th></tr></thead>
          <tbody>
            {confluencePreview.pages.map((pg) => (
              <tr key={pg.templateSlug}>
                <td className="mono">{pg.templateSlug}</td>
                <td>{pg.title}</td>
                <td className="mono num">{pg.substitutionsMade}</td>
                <td className="mono">{pg.unresolvedPlaceholders.slice(0, 3).join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Stage 3: VCS */}
      <div className="cp-section-head" style={{ marginTop: 32 }}>
        <span className="cp-section-num">stage 3</span>
        <h2 className="cp-section-title">Repo scaffold</h2>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="search"
          style={{ minWidth: 140, padding: 4, fontFamily: 'var(--font-mono)', fontSize: 11.5, border: '1px solid var(--line-strong)' }}
          placeholder="workspace"
          value={workspace}
          onChange={(e) => setWorkspace(e.target.value)}
        />
        <input
          className="search"
          style={{ minWidth: 140, padding: 4, fontFamily: 'var(--font-mono)', fontSize: 11.5, border: '1px solid var(--line-strong)' }}
          placeholder="repo slug"
          value={repoSlug}
          onChange={(e) => setRepoSlug(e.target.value)}
        />
        <select className="select" multiple value={stackChoices} onChange={(e) => setStackChoices([...e.target.selectedOptions].map((o) => o.value))} style={{ minWidth: 200, height: 80 }}>
          {moduleSlugs.map((m) => (<option key={m} value={m}>{m}</option>))}
        </select>
        <button className="btn" disabled={working || !workspace || !repoSlug} onClick={() => callPreview('admin.lifecycle.vcs.preview', { projectKey, workspace, repoSlug, stackChoices }, setVcsPreview)}>Preview repo files</button>
        <button className="btn warn" disabled={working || !vcsPreview || !workspace || !repoSlug} onClick={() => setConfirmAction({
          tool: 'admin.lifecycle.vcs.execute',
          baseArgs: { projectKey, workspace, repoSlug, stackChoices },
          title: `Initialize repo ${workspace}/${repoSlug}`,
          body: `Creates the Bitbucket repo at ${workspace}/${repoSlug} and seeds ${vcsPreview?.totalFiles ?? 0} files. Returns the repo URL.`,
          successLabel: 'Repo created',
        })}>Initialize repository</button>
      </div>
      {vcsPreview && (
        <table className="cp-table">
          <thead><tr><th>path</th><th>bytes</th><th>exec</th></tr></thead>
          <tbody>
            {vcsPreview.files.map((f) => (
              <tr key={f.path}>
                <td className="mono">{f.path}</td>
                <td className="mono num">{f.bytes}</td>
                <td>{f.executable ? <Pill tone="amber">yes</Pill> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Stage 4: handoff */}
      <div className="cp-section-head" style={{ marginTop: 32 }}>
        <span className="cp-section-num">stage 4</span>
        <h2 className="cp-section-title">Handoff bundle</h2>
      </div>
      <div style={{ marginBottom: 12 }}>
        <button className="btn primary" disabled={working} onClick={() => setConfirmAction({
          tool: 'admin.lifecycle.handoff.bundle',
          baseArgs: {
            projectKey,
            jiraProjectKey: lastJiraProjectKey ?? atlassianProjectKey ?? projectKey,
            ...(lastConfluenceSpaceId ? { confluenceSpaceId: lastConfluenceSpaceId } : {}),
            ...(lastRepoUrl ? { repoUrl: lastRepoUrl } : {}),
          },
          title: `Compose M9 handoff bundle for ${projectKey}`,
          body: 'Read-only; composes the structured packet with project metadata, artifacts, audit-chain head, and the role-card list.',
          successLabel: 'Handoff bundle composed',
        })}>Compose handoff bundle</button>
      </div>
      {handoffPacket && <JsonView obj={handoffPacket.packet} />}

      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          body={confirmAction.body}
          requireReason
          confirmLabel={confirmAction.successLabel.split(' ')[0]}
          onCancel={() => setConfirmAction(null)}
          onConfirm={submitWrite}
        />
      )}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--ink)', color: '#fff', padding: '10px 18px',
          fontFamily: 'var(--font-mono)', fontSize: 12, zIndex: 200,
        }}>{toast}</div>
      )}
    </div>
  );
}

Object.assign(window, {
  ProjectListPage,
  ProjectDetailPage,
  ProjectPortfolioGrid,
  PortfolioControlSummary,
  ProjectAssistPanel,
  ProjectAssistComposer,
  AgentAssignmentPanel,
  ContentQualityPanel,
  JiraCardsPanel,
  ConfluencePagesPanel,
  AgentHandoffPanel,
  ResourceDock,
  TraceMapWidget,
  TraceMatrixPanel,
  DeveloperWorkspacePanel,
  DeveloperTraceCards,
  OrchestrationTimeline,
  NextBestActionPanel,
  OperatorLaunchpad,
  ProjectCommandHeader,
  ProjectSideRail,
  ProjectMilestonePanel,
  projectMilestoneRows,
  ProjectBreadcrumbTrail,
  ArtifactMatrixPanel,
  artifactMatrixRows,
});
