ALTER TABLE tenant.handyman_join_requests
  ADD COLUMN IF NOT EXISTS dbs_route TEXT NOT NULL DEFAULT 'not_sure'
    CHECK (dbs_route IN ('already_enhanced', 'needs_application', 'basic_or_not_sure')),
  ADD COLUMN IF NOT EXISTS dbs_eligibility_notes TEXT;

ALTER TABLE trader.dbs_verifications
  ADD COLUMN IF NOT EXISTS verification_route TEXT NOT NULL DEFAULT 'manual_review'
    CHECK (verification_route IN ('manual_review', 'self_submitted_certificate', 'umbrella_application_required', 'basic_or_not_sure')),
  ADD COLUMN IF NOT EXISTS enhanced_dbs_eligible BOOLEAN,
  ADD COLUMN IF NOT EXISTS workforce_type TEXT
    CHECK (workforce_type IS NULL OR workforce_type IN ('adult', 'child', 'adult_and_child', 'unknown')),
  ADD COLUMN IF NOT EXISTS update_service_consent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS update_service_status TEXT NOT NULL DEFAULT 'not_checked'
    CHECK (update_service_status IN ('not_checked', 'consented_pending_check', 'active_confirmed', 'not_subscribed', 'failed'));

CREATE INDEX IF NOT EXISTS dbs_verification_route_idx
  ON trader.dbs_verifications(verification_route, status, created_at DESC);
