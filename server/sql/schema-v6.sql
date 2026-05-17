-- Schema v6: SMTP config + email logs
-- Run after schema-v5.sql (idempotent)

CREATE TABLE IF NOT EXISTS smtp_configs (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 587,
  secure BOOLEAN NOT NULL DEFAULT false,
  user_email TEXT NOT NULL,
  encrypted_password TEXT NOT NULL,
  from_name TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
  job_order_id UUID REFERENCES job_orders(id) ON DELETE SET NULL,
  sent_by UUID REFERENCES tenant_users(id) ON DELETE SET NULL,
  direction TEXT NOT NULL DEFAULT 'outbound',
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_logs_tenant_idx ON email_logs (tenant_id);
CREATE INDEX IF NOT EXISTS email_logs_candidate_idx ON email_logs (candidate_id);
CREATE INDEX IF NOT EXISTS email_logs_created_idx ON email_logs (created_at DESC);
