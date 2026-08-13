ALTER TABLE tenant.agency_settings
  ADD COLUMN IF NOT EXISTS care_os_enabled BOOLEAN NOT NULL DEFAULT false;
