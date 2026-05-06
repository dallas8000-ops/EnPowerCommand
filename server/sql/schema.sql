CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company TEXT NOT NULL,
  contact_name TEXT,
  role TEXT,
  url TEXT,
  notes TEXT,
  stage TEXT NOT NULL DEFAULT 'new',
  next_action_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_stage_idx ON leads (stage);
CREATE INDEX IF NOT EXISTS leads_next_action_idx ON leads (next_action_at);
