-- Schema v4: Interview scheduling
-- Run after schema-v2.sql (idempotent)

CREATE TABLE IF NOT EXISTS interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_order_id UUID NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  location TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS interviews_tenant_idx ON interviews (tenant_id);
CREATE INDEX IF NOT EXISTS interviews_candidate_idx ON interviews (candidate_id);
CREATE INDEX IF NOT EXISTS interviews_scheduled_idx ON interviews (scheduled_at);
