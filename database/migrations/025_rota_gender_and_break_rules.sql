ALTER TABLE care.service_users
  ADD COLUMN IF NOT EXISTS preferred_carer_gender TEXT NOT NULL DEFAULT 'no_preference';

ALTER TABLE care.service_users
  DROP CONSTRAINT IF EXISTS service_users_preferred_carer_gender_check;

ALTER TABLE care.service_users
  ADD CONSTRAINT service_users_preferred_carer_gender_check
  CHECK (preferred_carer_gender IN ('no_preference', 'female', 'male'));

ALTER TABLE care.rota_caregivers
  ADD COLUMN IF NOT EXISTS gender TEXT NOT NULL DEFAULT 'not_recorded';

ALTER TABLE care.rota_caregivers
  DROP CONSTRAINT IF EXISTS rota_caregivers_gender_check;

ALTER TABLE care.rota_caregivers
  ADD CONSTRAINT rota_caregivers_gender_check
  CHECK (gender IN ('not_recorded', 'female', 'male'));
