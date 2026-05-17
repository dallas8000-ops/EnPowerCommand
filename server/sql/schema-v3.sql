-- Public job board upgrade (idempotent)

ALTER TABLE job_orders ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'recruiter';
ALTER TABLE job_orders ADD COLUMN IF NOT EXISTS client_contact_name TEXT;
ALTER TABLE job_orders ADD COLUMN IF NOT EXISTS client_contact_email TEXT;
ALTER TABLE job_orders ADD COLUMN IF NOT EXISTS client_notes TEXT;

-- pending = submitted by client, awaiting recruiter review
-- (open, filled, on_hold, canceled already exist)
-- No enum change needed — status is free-text

-- Per-tenant public slug for the job board URL
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS public_email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_idx ON tenants (slug) WHERE slug IS NOT NULL;
