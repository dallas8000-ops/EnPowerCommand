-- Multi-tenant recruiter upgrade schema
-- Run after schema.sql (idempotent)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tenant organizations (one per recruiter / agency)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subscription_status TEXT NOT NULL DEFAULT 'trialing',
  trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '14 days',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-tenant users (replaces single ADMIN_PASSWORD)
CREATE TABLE IF NOT EXISTS tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email)
);

CREATE INDEX IF NOT EXISTS tenant_users_tenant_idx ON tenant_users (tenant_id);

-- Recruiter candidate database
CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  title TEXT,
  location TEXT,
  resume_url TEXT,
  skills TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS candidates_tenant_idx ON candidates (tenant_id);
CREATE INDEX IF NOT EXISTS candidates_status_idx ON candidates (status);

-- Job requisitions from client companies
CREATE TABLE IF NOT EXISTS job_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_company TEXT NOT NULL,
  title TEXT NOT NULL,
  location TEXT,
  remote BOOLEAN NOT NULL DEFAULT false,
  salary_range TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_orders_tenant_idx ON job_orders (tenant_id);
CREATE INDEX IF NOT EXISTS job_orders_status_idx ON job_orders (status);

-- Pipeline: candidate × job order with stage tracking
CREATE TABLE IF NOT EXISTS placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_order_id UUID NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'sourced',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(candidate_id, job_order_id)
);

CREATE INDEX IF NOT EXISTS placements_tenant_idx ON placements (tenant_id);
CREATE INDEX IF NOT EXISTS placements_job_order_idx ON placements (job_order_id);
CREATE INDEX IF NOT EXISTS placements_candidate_idx ON placements (candidate_id);

-- Activity log per candidate
CREATE TABLE IF NOT EXISTS candidate_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS candidate_activities_candidate_idx ON candidate_activities (candidate_id);

-- Per-tenant recruiter profile (agency bio / intro used for AI outreach)
CREATE TABLE IF NOT EXISTS tenant_profiles (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  resume_text TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add tenant_id to existing leads / activities tables (nullable for migration safety)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE lead_activities ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS leads_tenant_idx ON leads (tenant_id);
