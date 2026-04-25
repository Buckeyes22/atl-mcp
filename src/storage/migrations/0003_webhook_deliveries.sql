CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id          text        PRIMARY KEY,
  tenant_id   text        NOT NULL,
  source      text        NOT NULL,
  observed_at timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS webhook_deliveries_tenant_source_idx
  ON webhook_deliveries(tenant_id, source);
CREATE INDEX IF NOT EXISTS webhook_deliveries_tenant_observed_idx
  ON webhook_deliveries(tenant_id, observed_at);
