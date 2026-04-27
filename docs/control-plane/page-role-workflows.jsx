// Role-specific workflow pages: Requirements Assist and Developer Agent Assignment.

function ResultJson({ data }) {
  if (!data) return null;
  return (
    <pre className="role-flow-json">{JSON.stringify(data, null, 2)}</pre>
  );
}

function RequirementsAssistPage() {
  const { t } = useCPTweaks();
  const [name, setName] = useState('New product initiative');
  const [key, setKey] = useState('NPI');
  const [description, setDescription] = useState('must: Customer can describe a project and preview Jira work. Acceptance: generated stories appear before Jira creation.');
  const [briefs, setBriefs] = useState([]);
  const [intake, setIntake] = useState(null);
  const [blueprint, setBlueprint] = useState(null);
  const [preview, setPreview] = useState(null);
  const [jiraResult, setJiraResult] = useState(null);
  const [reason, setReason] = useState('approved product intake preview');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);

  const payload = () => ({ name, key, description, briefs, operatorBadge: t.operatorBadge });

  const readFiles = async (files) => {
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

  const call = async (label, tool, args, apply) => {
    setBusy(label);
    setError(null);
    try {
      const result = await window.MCP_CLIENT.callTool(tool, args);
      apply(result.structuredContent);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy('');
    }
  };

  const projectKey = blueprint?.projectKey || intake?.projectKey || key;

  return (
    <div className="cp-page wide role-flow-page">
      <PageHead
        eyebrow="product · requirements assist"
        title="Requirements Assist"
        right={<>
          <div className="meta-block"><span className="k">briefs </span><span className="v">{briefs.length}</span></div>
          <div className="meta-block"><span className="k">project </span><span className="v">{projectKey}</span></div>
        </>}
      />

      <ErrorBlock error={error} />

      <div className="role-flow-grid">
        <section className="surf role-flow-form">
          <div className="head"><span>Project intake</span><span className="right"><Pill tone="blue">product</Pill></span></div>
          <div className="form-stack">
            <label><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label><span>Key</span><input value={key} onChange={(event) => setKey(event.target.value.toUpperCase())} /></label>
            <label><span>Description</span><textarea rows="10" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
            <label className="file-drop">
              <span>Briefs</span>
              <input type="file" multiple accept=".txt,.md,.json,text/*,application/json" onChange={(event) => void readFiles(event.target.files)} />
            </label>
            <div className="brief-list">
              {briefs.length === 0 && <span className="muted-mono">no briefs attached</span>}
              {briefs.map((brief, index) => (
                <div key={`${brief.name}-${index}`}><span>{brief.name}</span><button className="btn sm ghost" onClick={() => setBriefs((rows) => rows.filter((_, i) => i !== index))}>remove</button></div>
              ))}
            </div>
          </div>
        </section>

        <section className="surf role-flow-form">
          <div className="head"><span>Workflow</span><span className="right">{busy ? <Pill tone="amber">{busy}</Pill> : <Pill tone="green">ready</Pill>}</span></div>
          <div className="role-flow-actions">
            <button className="btn" onClick={() => call('analyzing', 'admin.requirements.assist.preview', payload(), setPreview)}>Analyze requirements</button>
            <button className="btn primary" onClick={() => call('creating intake', 'admin.requirements.assist.create_intake', payload(), setIntake)}>Create intake</button>
            <button className="btn" disabled={!intake?.projectId} onClick={() => call('generating blueprint', 'admin.requirements.assist.generate_blueprint', { projectId: intake.projectId, useSampling: false, operatorBadge: t.operatorBadge }, setBlueprint)}>Generate blueprint</button>
            <button className="btn" disabled={!projectKey} onClick={() => call('previewing Jira', 'admin.requirements.assist.provision_preview', { projectKey, jiraProjectKey: projectKey }, setPreview)}>Preview Jira</button>
          </div>
          <div className="confirm-row">
            <input value={reason} onChange={(event) => setReason(event.target.value)} />
            <button className="btn warn" disabled={!projectKey || reason.length < 4} onClick={() => call('creating Jira', 'admin.lifecycle.jira.execute', { projectKey, jiraProjectKey: projectKey, reason, operatorBadge: t.operatorBadge }, setJiraResult)}>Create Jira</button>
          </div>
          <div className="role-flow-metrics">
            <div><span>requirements</span><strong>{blueprint?.requirements?.length ?? preview?.suggestedRequirements?.length ?? 0}</strong></div>
            <div><span>jira nodes</span><strong>{preview?.totalNodes ?? 0}</strong></div>
            <div><span>quality</span><strong>{preview?.quality?.score ?? '—'}</strong></div>
          </div>
        </section>
      </div>

      <div className="grid-2 role-flow-results">
        <section className="surf"><div className="head"><span>Analysis</span></div><ResultJson data={preview} /></section>
        <section className="surf"><div className="head"><span>Blueprint</span></div><ResultJson data={blueprint || intake} /></section>
      </div>
      {jiraResult && <section className="surf role-flow-results"><div className="head"><span>Jira execution</span></div><ResultJson data={jiraResult} /></section>}
    </div>
  );
}

function AgentAssignmentPage() {
  const { t } = useCPTweaks();
  const projects = useAdmin('admin.projects.list');
  const [projectKey, setProjectKey] = useState('');
  const detail = useAdmin('admin.projects.get', { key: projectKey }, { enabled: Boolean(projectKey) });
  const assignments = useAdmin('admin.agent.work.list', { projectKey }, { enabled: Boolean(projectKey) });
  const [recommendations, setRecommendations] = useState({});
  const [quality, setQuality] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    const first = projects.data?.projects?.[0]?.key;
    if (!projectKey && first) setProjectKey(first);
  }, [projects.data, projectKey]);

  const stories = (detail.data?.blueprint?.epics ?? []).flatMap((epic) => (epic.stories ?? []).map((story) => ({ ...story, epicTitle: epic.title })));
  const assignmentRows = assignments.data?.assignments ?? [];

  const call = async (label, tool, args, apply) => {
    setBusy(label);
    setError(null);
    try {
      const result = await window.MCP_CLIENT.callTool(tool, args);
      apply(result.structuredContent);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy('');
    }
  };

  const recommend = (story) => call('recommending', 'admin.agent.work.recommend', {
    projectKey,
    workRef: { kind: 'blueprint_story', id: story.id, title: story.title },
  }, (data) => setRecommendations((current) => ({ ...current, [story.id]: data })));

  const assign = (story, agentId) => call('assigning', 'admin.agent.work.assign', {
    projectKey,
    workRef: { kind: 'blueprint_story', id: story.id, title: story.title },
    assignedAgentId: agentId,
    assignedBy: t.operatorBadge || 'developer@loopback',
    reason: `assign ${story.id} to ${agentId}`,
    operatorBadge: t.operatorBadge,
  }, () => { void assignments.refetch(); });

  return (
    <div className="cp-page wide role-flow-page">
      <PageHead
        eyebrow="developer · agent assignment"
        title="Agent Assignment"
        right={<>
          <div className="meta-block"><span className="k">stories </span><span className="v">{stories.length}</span></div>
          <div className="meta-block"><span className="k">assigned </span><span className="v">{assignmentRows.filter((row) => row.status === 'assigned').length}</span></div>
        </>}
      />

      <ErrorBlock error={error || projects.error || detail.error || assignments.error} />

      <div className="role-flow-toolbar">
        <label><span>Project</span>
          <select value={projectKey} onChange={(event) => setProjectKey(event.target.value)}>
            {(projects.data?.projects ?? []).map((project) => <option key={project.key} value={project.key}>{project.key} · {project.name}</option>)}
          </select>
        </label>
        <button className="btn" disabled={!projectKey} onClick={() => call('scoring quality', 'admin.quality.score.project', { projectKey, operatorBadge: t.operatorBadge }, (data) => setQuality(data.report))}>Score quality</button>
        {busy && <Pill tone="amber">{busy}</Pill>}
        {quality && <Pill tone={quality.score >= 80 ? 'green' : quality.score >= 60 ? 'amber' : 'red'}>quality {quality.score}</Pill>}
      </div>

      <div className="assignment-board">
        {detail.loading && !detail.data && <LoadingSkeleton rows={4} />}
        {!detail.loading && stories.length === 0 && <div className="empty-copy">No blueprint stories are ready for assignment.</div>}
        {stories.map((story) => {
          const rec = recommendations[story.id];
          const assigned = assignmentRows.find((row) => row.workRef?.id === story.id);
          const top = rec?.recommendations?.[0];
          return (
            <section key={story.id} className="assignment-card">
              <div className="assignment-head">
                <div>
                  <span className="label-sm">{story.epicTitle}</span>
                  <h2>{story.title}</h2>
                  <p>{story.userStory}</p>
                </div>
                <Pill tone={assigned?.status === 'assigned' ? 'green' : rec ? 'blue' : 'grey'}>{assigned?.status || rec?.classification?.workType || 'unclassified'}</Pill>
              </div>
              <div className="assignment-tags">
                {(rec?.classification?.skillTags ?? story.acceptanceCriteria ?? []).slice(0, 8).map((tag) => <span key={tag}>{tag}</span>)}
              </div>
              <div className="assignment-actions">
                <button className="btn sm" onClick={() => recommend(story)}>Recommend</button>
                <button className="btn sm primary" disabled={!top?.agentId && !assigned?.assignedAgentId} onClick={() => assign(story, top?.agentId || assigned?.assignedAgentId)}>Assign top agent</button>
              </div>
              {rec && (
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
            </section>
          );
        })}
      </div>
    </div>
  );
}

window.RequirementsAssistPage = RequirementsAssistPage;
window.AgentAssignmentPage = AgentAssignmentPage;
