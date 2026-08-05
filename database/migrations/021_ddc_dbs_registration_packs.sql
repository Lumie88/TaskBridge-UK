CREATE TABLE IF NOT EXISTS trader.ddc_dbs_registration_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_id UUID NOT NULL UNIQUE REFERENCES trader.traders(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Mr'
    CHECK (title IN ('Mr', 'Mrs', 'Miss', 'Ms', 'Mx', 'Dr', 'Other')),
  forename_ciphertext TEXT NOT NULL,
  middle_names_ciphertext TEXT,
  surname_ciphertext TEXT NOT NULL,
  date_of_birth_ciphertext TEXT NOT NULL,
  national_insurance_ciphertext TEXT NOT NULL,
  daytime_phone_ciphertext TEXT,
  applicant_reference TEXT NOT NULL,
  location_reference TEXT NOT NULL DEFAULT 'TaskBridge',
  role TEXT NOT NULL DEFAULT 'Handyman / Tradesperson',
  applicant_entry_mode TEXT NOT NULL DEFAULT 'applicant_input_own_data'
    CHECK (applicant_entry_mode IN ('applicant_present_admin_enters', 'applicant_input_own_data')),
  status TEXT NOT NULL DEFAULT 'ready_to_enter'
    CHECK (status IN ('not_started', 'ready_to_enter', 'ddc_invite_sent', 'applicant_submitted', 'awaiting_result', 'approved', 'query', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS ddc_dbs_registration_status_idx
  ON trader.ddc_dbs_registration_packs(status, created_at DESC);

CREATE TRIGGER ddc_dbs_registration_packs_updated_at
BEFORE UPDATE ON trader.ddc_dbs_registration_packs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
