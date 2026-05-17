-- Schema v8: share_public flag on candidates
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS share_public BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS candidates_share_public_idx ON candidates (share_public) WHERE share_public = true;
