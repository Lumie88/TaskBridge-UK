ALTER TABLE trader.dbs_verifications
  ADD COLUMN IF NOT EXISTS provider_name TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS provider_invitation_url TEXT,
  ADD COLUMN IF NOT EXISTS provider_event_type TEXT,
  ADD COLUMN IF NOT EXISTS provider_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS dbs_provider_session_idx
  ON trader.dbs_verifications(provider_name, provider_session_id)
  WHERE provider_session_id IS NOT NULL;
