-- M1 initial schema. Applies to PGlite (dev) and Postgres 16+ (deployed).
-- Hand-authored; verified against both backends by the migration-rehearsal
-- test in tests/integration/storage/migrationRehearsal.test.ts.
--
-- Conventions:
--  - text PKs (we generate ULIDs in app code; no auto-increment)
--  - timestamptz for time columns
--  - jsonb for round-trip payload columns
--  - tenant_id on every table; composite indexes lead with tenant_id

CREATE TABLE IF NOT EXISTS projects (
  id                 text        PRIMARY KEY,
  tenant_id          text        NOT NULL,
  key                text        NOT NULL,
  name               text        NOT NULL,
  state              text        NOT NULL,
  schema_version     integer     NOT NULL,
  blueprint_version  integer     NOT NULL,
  blueprint          jsonb       NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS projects_tenant_idx ON projects(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS projects_tenant_key_idx ON projects(tenant_id, key);

CREATE TABLE IF NOT EXISTS project_profiles (
  id           text        PRIMARY KEY,
  tenant_id    text        NOT NULL,
  project_id   text        NOT NULL,
  payload      jsonb       NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS project_profiles_tenant_project_idx
  ON project_profiles(tenant_id, project_id);

CREATE TABLE IF NOT EXISTS trace_links (
  id          text        PRIMARY KEY,
  tenant_id   text        NOT NULL,
  project_id  text        NOT NULL,
  source_kind text        NOT NULL,
  source_id   text        NOT NULL,
  target_kind text        NOT NULL,
  target_id   text        NOT NULL,
  relation    text        NOT NULL,
  payload     jsonb       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trace_links_tenant_project_idx
  ON trace_links(tenant_id, project_id);
CREATE INDEX IF NOT EXISTS trace_links_source_idx
  ON trace_links(tenant_id, source_kind, source_id);
CREATE INDEX IF NOT EXISTS trace_links_target_idx
  ON trace_links(tenant_id, target_kind, target_id);

CREATE TABLE IF NOT EXISTS context_packs (
  id               text        PRIMARY KEY,
  tenant_id        text        NOT NULL,
  project_id       text        NOT NULL,
  issue_key        text,
  regeneration_key text        NOT NULL,
  payload          jsonb       NOT NULL,
  generated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS context_packs_tenant_project_idx
  ON context_packs(tenant_id, project_id);
CREATE INDEX IF NOT EXISTS context_packs_regen_key_idx
  ON context_packs(tenant_id, regeneration_key);

CREATE TABLE IF NOT EXISTS acl_entries (
  tenant_id      text        NOT NULL,
  project_id     text        NOT NULL,
  artifact_kind  text        NOT NULL,
  artifact_id    text        NOT NULL,
  principal_id   text        NOT NULL,
  decision       text        NOT NULL,
  classification text        NOT NULL,
  source         text        NOT NULL,
  payload        jsonb       NOT NULL,
  observed_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS acl_entries_pk_like
  ON acl_entries(tenant_id, project_id, artifact_kind, artifact_id, principal_id);
CREATE INDEX IF NOT EXISTS acl_entries_tenant_project_idx
  ON acl_entries(tenant_id, project_id);

CREATE TABLE IF NOT EXISTS mcp_session_profiles (
  id               text        PRIMARY KEY,
  tenant_id        text        NOT NULL,
  protocol_version text        NOT NULL,
  client_name      text        NOT NULL,
  agent_mode       text,
  payload          jsonb       NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_seen_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mcp_session_profiles_tenant_idx
  ON mcp_session_profiles(tenant_id);

CREATE TABLE IF NOT EXISTS policy_decisions (
  id                     text             PRIMARY KEY,
  tenant_id              text             NOT NULL,
  project_id             text,
  tool_name              text             NOT NULL,
  effect                 text             NOT NULL,
  confidence_categorical text             NOT NULL,
  confidence_score       double precision NOT NULL,
  payload                jsonb            NOT NULL,
  evaluated_at           timestamptz      NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS policy_decisions_tenant_idx ON policy_decisions(tenant_id);
CREATE INDEX IF NOT EXISTS policy_decisions_tenant_project_idx
  ON policy_decisions(tenant_id, project_id);

CREATE TABLE IF NOT EXISTS audit_entries (
  id                            text        PRIMARY KEY,
  tenant_id                     text        NOT NULL,
  project_id                    text,
  sequence                      bigint      NOT NULL,
  tool_name                     text        NOT NULL,
  actor_principal_fingerprint   text        NOT NULL,
  input_hash                    text        NOT NULL,
  prev_hash                     text        NOT NULL,
  signature_key_id              text        NOT NULL DEFAULT '',
  signature_value               text        NOT NULL DEFAULT '',
  payload                       jsonb       NOT NULL,
  "timestamp"                   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_entries_tenant_idx ON audit_entries(tenant_id);
CREATE INDEX IF NOT EXISTS audit_entries_tenant_project_seq_idx
  ON audit_entries(tenant_id, project_id, sequence);

CREATE TABLE IF NOT EXISTS readiness_reports (
  id           text        PRIMARY KEY,
  tenant_id    text        NOT NULL,
  project_id   text        NOT NULL,
  grade        text,
  verdict      text,
  payload      jsonb       NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS readiness_reports_tenant_project_idx
  ON readiness_reports(tenant_id, project_id);

CREATE TABLE IF NOT EXISTS encrypted_tokens (
  id               text        PRIMARY KEY,
  tenant_id        text        NOT NULL,
  logical_key      text        NOT NULL,
  algo             text        NOT NULL,
  wrapped_data_key text        NOT NULL,
  wrap_nonce       text        NOT NULL,
  ciphertext       text        NOT NULL,
  nonce            text        NOT NULL,
  master_key_id    text        NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS encrypted_tokens_tenant_logical_idx
  ON encrypted_tokens(tenant_id, logical_key);
CREATE INDEX IF NOT EXISTS encrypted_tokens_tenant_idx ON encrypted_tokens(tenant_id);

-- Migration metadata table — used by migrationRunner.ts to track applied versions.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    text        PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
