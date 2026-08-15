ALTER TABLE care.rota_caregivers
  ADD COLUMN IF NOT EXISTS travel_mode TEXT NOT NULL DEFAULT 'car',
  ADD COLUMN IF NOT EXISTS weekly_contract_minutes INTEGER NOT NULL DEFAULT 2250,
  ADD COLUMN IF NOT EXISTS assigned_week_minutes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS emergency_cover BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS break_preferred_start TEXT NOT NULL DEFAULT '12:00',
  ADD COLUMN IF NOT EXISTS break_preferred_end TEXT NOT NULL DEFAULT '14:00';

ALTER TABLE care.rota_caregivers
  DROP CONSTRAINT IF EXISTS rota_caregivers_travel_mode_check;

ALTER TABLE care.rota_caregivers
  ADD CONSTRAINT rota_caregivers_travel_mode_check
  CHECK (travel_mode IN ('car', 'walking', 'bike', 'public_transport'));

ALTER TABLE care.rota_caregivers
  DROP CONSTRAINT IF EXISTS rota_caregivers_contract_minutes_check;

ALTER TABLE care.rota_caregivers
  ADD CONSTRAINT rota_caregivers_contract_minutes_check
  CHECK (weekly_contract_minutes BETWEEN 0 AND 4320 AND assigned_week_minutes BETWEEN 0 AND 4320);

ALTER TABLE care.rota_caregivers
  DROP CONSTRAINT IF EXISTS rota_caregivers_break_window_check;

ALTER TABLE care.rota_caregivers
  ADD CONSTRAINT rota_caregivers_break_window_check
  CHECK (break_preferred_start ~ '^\d{2}:\d{2}$' AND break_preferred_end ~ '^\d{2}:\d{2}$');
