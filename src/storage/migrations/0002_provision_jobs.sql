-- M6a (interim) — persistent provision job state.
-- Replaces the in-memory globalProvisionJobStore (audit finding F-011).
-- BullMQ + Redis migration is the eventual target per v6 §24; this table
-- buys correctness in the meantime so job state survives restart.

CREATE TABLE IF NOT EXISTS provision_jobs (
  id           text        PRIMARY KEY,
  tenant_id    text        NOT NULL,
  project_id   text        NOT NULL,
  status       text        NOT NULL,
  result       jsonb,
  error        text,
  payload      jsonb       NOT NULL,
  queued_at    timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS provision_jobs_tenant_idx ON provision_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS provision_jobs_tenant_project_updated_idx
  ON provision_jobs(tenant_id, project_id, updated_at);
CREATE INDEX IF NOT EXISTS provision_jobs_tenant_status_idx
  ON provision_jobs(tenant_id, status);
