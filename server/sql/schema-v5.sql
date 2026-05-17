-- Schema v5: Team invites
-- Run after schema-v4.sql (idempotent)

CREATE TABLE IF NOT EXISTS team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'recruiter',
  token TEXT NOT NULL UNIQUE,
  invited_by UUID REFERENCES tenant_users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days',
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS team_invites_token_idx ON team_invites (token);
CREATE INDEX IF NOT EXISTS team_invites_tenant_idx ON team_invites (tenant_id);
