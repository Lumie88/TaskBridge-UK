ALTER TABLE care.service_users
  ADD COLUMN IF NOT EXISTS carers_required_per_visit INTEGER NOT NULL DEFAULT 1;

ALTER TABLE care.service_users
  DROP CONSTRAINT IF EXISTS service_users_carers_required_per_visit_check;

ALTER TABLE care.service_users
  ADD CONSTRAINT service_users_carers_required_per_visit_check
  CHECK (carers_required_per_visit IN (1, 2));
