CREATE TABLE IF NOT EXISTS care.rota_caregivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES tenant.agencies(id) ON DELETE RESTRICT,
  name_ciphertext TEXT NOT NULL,
  start_postcode_ciphertext TEXT,
  available_from TEXT NOT NULL DEFAULT '08:00',
  available_to TEXT NOT NULL DEFAULT '18:00',
  skills_ciphertext TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  deleted_at TIMESTAMPTZ,
  CHECK (available_from ~ '^\d{2}:\d{2}$'),
  CHECK (available_to ~ '^\d{2}:\d{2}$')
);

CREATE INDEX IF NOT EXISTS rota_caregivers_agency_active_idx
  ON care.rota_caregivers (agency_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER rota_caregivers_updated_at
  BEFORE UPDATE ON care.rota_caregivers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE care.rota_caregivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY rota_caregivers_tenant_access ON care.rota_caregivers
USING (
  public.current_taskbridge_role() IN ('taskbridge_admin', 'taskbridge_super_admin')
  OR agency_id = public.current_taskbridge_agency()
)
WITH CHECK (
  public.current_taskbridge_role() IN ('taskbridge_admin', 'taskbridge_super_admin')
  OR agency_id = public.current_taskbridge_agency()
);
