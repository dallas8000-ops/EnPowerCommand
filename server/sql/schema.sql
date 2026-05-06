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
  last_contact_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS leads_stage_idx ON leads (stage);
CREATE INDEX IF NOT EXISTS leads_next_action_idx ON leads (next_action_at);
CREATE INDEX IF NOT EXISTS leads_last_contact_idx ON leads (last_contact_at);

CREATE TABLE IF NOT EXISTS user_profile (
  id smallint PRIMARY KEY CHECK (id = 1),
  resume_text TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO user_profile (id, resume_text)
VALUES (1, '')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_activities_lead_idx ON lead_activities (lead_id);
CREATE INDEX IF NOT EXISTS lead_activities_created_idx ON lead_activities (created_at DESC);
