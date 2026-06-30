ALTER TABLE tenant.agency_settings
  ADD COLUMN IF NOT EXISTS health_analytics_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS care.health_metric_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES tenant.agencies(id) ON DELETE RESTRICT,
  uploaded_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS care.health_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES tenant.agencies(id) ON DELETE RESTRICT,
  service_user_id UUID NOT NULL REFERENCES care.service_users(id) ON DELETE RESTRICT,
  upload_id UUID REFERENCES care.health_metric_uploads(id) ON DELETE SET NULL,
  observation_date DATE NOT NULL,
  metric_type TEXT NOT NULL,
  metric_value NUMERIC(12,2),
  metric_unit TEXT,
  outcome_label TEXT,
  notes_ciphertext TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS health_observations_agency_service_date_idx
  ON care.health_observations (agency_id, service_user_id, observation_date DESC);

CREATE INDEX IF NOT EXISTS health_observations_metric_idx
  ON care.health_observations (agency_id, metric_type, observation_date DESC);

ALTER TABLE care.health_metric_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE care.health_observations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS health_metric_uploads_tenant_access ON care.health_metric_uploads;
CREATE POLICY health_metric_uploads_tenant_access ON care.health_metric_uploads
USING (
  public.current_taskbridge_role() IN ('taskbridge_admin', 'taskbridge_super_admin')
  OR agency_id = public.current_taskbridge_agency()
)
WITH CHECK (
  public.current_taskbridge_role() IN ('taskbridge_admin', 'taskbridge_super_admin')
  OR agency_id = public.current_taskbridge_agency()
);

DROP POLICY IF EXISTS health_observations_tenant_access ON care.health_observations;
CREATE POLICY health_observations_tenant_access ON care.health_observations
USING (
  public.current_taskbridge_role() IN ('taskbridge_admin', 'taskbridge_super_admin')
  OR agency_id = public.current_taskbridge_agency()
)
WITH CHECK (
  public.current_taskbridge_role() IN ('taskbridge_admin', 'taskbridge_super_admin')
  OR agency_id = public.current_taskbridge_agency()
);
