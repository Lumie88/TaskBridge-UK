ALTER TABLE care.service_users
  ADD COLUMN IF NOT EXISTS town_ciphertext TEXT,
  ADD COLUMN IF NOT EXISTS county_ciphertext TEXT,
  ADD COLUMN IF NOT EXISTS postcode_ciphertext TEXT;

ALTER TABLE ops.tasks
  ADD COLUMN IF NOT EXISTS keysafe_ciphertext TEXT;

ALTER TABLE tenant.agency_api_keys
  ADD COLUMN IF NOT EXISTS key_length SMALLINT;

ALTER TABLE tenant.agency_api_keys
  ADD CONSTRAINT agency_api_keys_key_length_check
  CHECK (key_length IS NULL OR key_length BETWEEN 24 AND 512);

CREATE INDEX IF NOT EXISTS idx_service_users_agency_directory
  ON care.service_users (agency_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_task_status_events_agency_recent
  ON ops.task_status_events (agency_id, created_at DESC);
