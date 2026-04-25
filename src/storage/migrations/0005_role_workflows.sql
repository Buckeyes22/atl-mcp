CREATE TABLE IF NOT EXISTS work_assignments (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  work_kind text NOT NULL,
  work_id text NOT NULL,
  status text NOT NULL,
  assigned_agent_id text,
  assigned_by text,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_assignments_tenant_project_idx
  ON work_assignments(tenant_id, project_id);

CREATE INDEX IF NOT EXISTS work_assignments_tenant_project_work_idx
  ON work_assignments(tenant_id, project_id, work_kind, work_id);

CREATE INDEX IF NOT EXISTS work_assignments_tenant_status_idx
  ON work_assignments(tenant_id, status);

CREATE TABLE IF NOT EXISTS content_quality_reports (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  artifact_kind text NOT NULL,
  artifact_id text NOT NULL,
  score integer NOT NULL,
  grade text NOT NULL,
  payload jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_quality_tenant_project_idx
  ON content_quality_reports(tenant_id, project_id);

CREATE INDEX IF NOT EXISTS content_quality_tenant_artifact_idx
  ON content_quality_reports(tenant_id, artifact_kind, artifact_id);

CREATE INDEX IF NOT EXISTS content_quality_project_generated_idx
  ON content_quality_reports(tenant_id, project_id, generated_at);
