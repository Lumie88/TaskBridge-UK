ALTER TABLE tenant.agency_settings
  ADD COLUMN IF NOT EXISTS rota_planner_enabled BOOLEAN NOT NULL DEFAULT false;
