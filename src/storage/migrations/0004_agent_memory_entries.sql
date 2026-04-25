CREATE TABLE IF NOT EXISTS agent_memory_entries (
  id            text        PRIMARY KEY,
  tenant_id     text        NOT NULL,
  project_id    text        NOT NULL,
  agent_key     text        NOT NULL,
  session_id    text,
  issue_key     text,
  kind          text        NOT NULL,
  text          text        NOT NULL,
  tags          jsonb       NOT NULL DEFAULT '[]'::jsonb,
  source_refs   jsonb       NOT NULL DEFAULT '[]'::jsonb,
  content_hash  text        NOT NULL,
  embedding_ref text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_memory_active_dedupe_idx
  ON agent_memory_entries(tenant_id, project_id, agent_key, content_hash)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS agent_memory_tenant_project_agent_idx
  ON agent_memory_entries(tenant_id, project_id, agent_key);
CREATE INDEX IF NOT EXISTS agent_memory_tenant_project_issue_idx
  ON agent_memory_entries(tenant_id, project_id, issue_key);
CREATE INDEX IF NOT EXISTS agent_memory_tenant_project_kind_idx
  ON agent_memory_entries(tenant_id, project_id, kind);
CREATE INDEX IF NOT EXISTS agent_memory_tenant_project_updated_idx
  ON agent_memory_entries(tenant_id, project_id, updated_at);
