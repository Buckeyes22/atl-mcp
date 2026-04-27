// Index page - inception-to-build pipeline map.

function PipelineMapDiagram() {
  const nodes = [
    { id: '01', name: 'Intake', sub: 'project-intake-interview', x: 40, y: 80, route: '#/projects' },
    { id: '02', name: 'Blueprint', sub: 'requirements-decomposer', x: 210, y: 80, route: '#/projects' },
    { id: '03', name: 'Review', sub: 'architecture-review', x: 380, y: 80, route: '#/projects' },
    { id: '04', name: 'Preflight', sub: 'provider profile', x: 550, y: 80, route: '#/providers' },
    { id: '05', name: 'Provision', sub: 'Jira + Confluence + VCS', x: 720, y: 80, route: '#/jobs' },
    { id: '06', name: 'Context', sub: 'retrieval + redaction', x: 890, y: 80, route: '#/projects' },
    { id: '07', name: 'Readiness', sub: 'readiness-reviewer', x: 1060, y: 80, route: '#/projects' },
    { id: '08', name: 'Handoff', sub: 'build-agent-handoff', x: 1060, y: 220, route: '#/sessions' },
  ];
  const edges = [
    ['01', '02'], ['02', '03'], ['03', '04'], ['04', '05'], ['05', '06'], ['06', '07'], ['07', '08'],
  ];
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const path = (from, to) => {
    const a = byId[from], b = byId[to];
    const ax = a.x + 130, ay = a.y + 32;
    const bx = b.x, by = b.y + 32;
    if (b.y > a.y) return `M ${ax} ${ay} C ${ax + 70} ${ay}, ${bx - 80} ${by}, ${bx} ${by}`;
    return `M ${ax} ${ay} L ${bx} ${by}`;
  };

  return (
    <svg className="flow-diagram pipeline-map" viewBox="0 0 1240 330" style={{ maxHeight: 360 }}>
      <rect className="group-bg" x="24" y="34" width="640" height="130" />
      <rect className="group-bg" x="704" y="34" width="500" height="244" />
      <text className="group-label" x="40" y="26">shared orchestration workflow</text>
      <text className="group-label" x="720" y="26">artifact + agent handoff lane</text>
      {edges.map(([from, to]) => (
        <path key={`${from}-${to}`} className="edge primary" d={path(from, to)} />
      ))}
      {nodes.map((n) => (
        <g key={n.id} style={{ cursor: 'pointer' }} onClick={() => window.location.hash = n.route}>
          <rect className="node-rect tier1" x={n.x} y={n.y} width="130" height="64" />
          <text className="node-num" x={n.x + 10} y={n.y + 18}>{n.id}</text>
          <text className="node-name" x={n.x + 10} y={n.y + 38}>{n.name}</text>
          <text className="edge-label" x={n.x + 10} y={n.y + 54}>{n.sub}</text>
        </g>
      ))}
      <g>
        <rect className="node-rect tier2" x="40" y="220" width="260" height="58" />
        <text className="node-num" x="52" y="238">operator entry</text>
        <text className="node-name" x="52" y="258">Frontend admin MCP</text>
        <text className="edge-label" x="52" y="274">Pipeline, Projects, Agents, Jobs, Approvals</text>
      </g>
      <g>
        <rect className="node-rect tier2" x="330" y="220" width="260" height="58" />
        <text className="node-num" x="342" y="238">build entry</text>
        <text className="node-name" x="342" y="258">Public MCP tools/resources</text>
        <text className="edge-label" x="342" y="274">Same workflow, agent-facing contract</text>
      </g>
    </svg>
  );
}

function IndexPage() {
  const promptCards = [
    ['project-intake-interview', 'Inception', 'Open questions and stakeholder intent become the draft blueprint.'],
    ['requirements-decomposer', 'Blueprint', 'Requirements, epics, stories, risks, and acceptance signals are structured.'],
    ['architecture-review', 'Review', 'Architecture and policy fit are checked before provisioning work begins.'],
    ['provisioning-reviewer', 'Provision', 'Jira, Confluence, VCS, cross-links, and idempotency are reviewed together.'],
    ['readiness-reviewer', 'Readiness', 'Context quality and deterministic score gate READY_FOR_BUILD.'],
    ['build-agent-handoff', 'Handoff', 'Agent configs, context pack URI, and manifest spawn payload are assembled.'],
  ];

  return (
    <div className="cp-page wide">
      <PageHead
        eyebrow="control plane · shared workflow"
        title="Inception-to-build pipeline"
        right={<>
          <div className="meta-block"><span className="k">operator </span><span className="v">frontend</span></div>
          <div className="meta-block"><span className="k">agent </span><span className="v">MCP</span></div>
          <div className="meta-block"><span className="k">workflow </span><span className="v">shared</span></div>
        </>}
      />

      <div className="cp-section-head">
        <span className="cp-section-num">pipeline map</span>
        <h2 className="cp-section-title">One workflow, two entry paths</h2>
        <span className="cp-section-blurb">Operators use the frontend; build agents use MCP. Both drive the same backend lifecycle.</span>
      </div>
      <PipelineMapDiagram />

      <div className="cp-section-head" style={{ marginTop: 42 }}>
        <span className="cp-section-num">lifecycle phases</span>
        <h2 className="cp-section-title">Project state lanes</h2>
        <span className="cp-section-blurb">These are the phase lanes used by the Pipeline and Projects pages.</span>
      </div>
      <div className="ix-grid pipeline-index-grid">
        {PIPELINE_PHASES.map((phase, index) => (
          <a className="ix-card live" key={phase.id} href={phase.route}>
            <div className="ix-card-head">
              <span className="mono num">{String(index + 1).padStart(2, '0')}</span>
              <span className="live-pill">{phase.action}</span>
            </div>
            <div className="ix-name">{phase.label}</div>
            <div className="ix-desc">{phase.states.map(stateLabel).join(', ')}</div>
          </a>
        ))}
      </div>

      <div className="cp-section-head" style={{ marginTop: 42 }}>
        <span className="cp-section-num">prompt contract</span>
        <h2 className="cp-section-title">Agent-facing orchestration prompts</h2>
        <span className="cp-section-blurb">The frontend mirrors the same milestones the public MCP prompt surface exposes.</span>
      </div>
      <div className="ix-grid">
        {promptCards.map(([id, name, desc]) => (
          <div key={id} className="ix-card">
            <div className="ix-card-head">
              <span className="mono num">{id}</span>
              <span className="live-pill">MCP</span>
            </div>
            <div className="ix-name">{name}</div>
            <div className="ix-desc">{desc}</div>
          </div>
        ))}
      </div>

      <div className="cp-section-head" style={{ marginTop: 42 }}>
        <span className="cp-section-num">operator surfaces</span>
        <h2 className="cp-section-title">Control-plane entry points</h2>
        <span className="cp-section-blurb">The primary pages now track lifecycle execution and build-agent capacity.</span>
      </div>
      <div className="grid-3">
        {[
          ['Pipeline', '#/', 'Phase board, queue pressure, blockers, and agent readiness.'],
          ['Projects', '#/projects', 'Project lifecycle tracking with blueprint, provisioning, jobs, audit, and handoff detail.'],
          ['Agents', '#/sessions', 'Connected build agents, negotiated capabilities, disabled features, and queue load.'],
          ['Jobs', '#/jobs', 'Provisioning and build queue operations with retry/cancel audit records.'],
          ['Approvals', '#/policy', 'Policy decisions that block provisioning or agent actions.'],
          ['Audit', '#/audit', 'Signed evidence across every operator and workflow transition.'],
        ].map(([name, route, desc]) => (
          <a key={name} className="ix-card live" href={route}>
            <div className="ix-card-head">
              <span className="mono num">{name.toLowerCase()}</span>
              <span className="live-pill">live</span>
            </div>
            <div className="ix-name">{name}</div>
            <div className="ix-desc">{desc}</div>
          </a>
        ))}
      </div>
    </div>
  );
}

window.IndexPage = IndexPage;
