CREATE TABLE trader.onboarding_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_id UUID NOT NULL REFERENCES trader.traders(id) ON DELETE CASCADE,
  email CITEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'submitted', 'expired', 'revoked')),
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  expires_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  email_delivery_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (email_delivery_status IN ('pending', 'sent', 'not_configured', 'failed')),
  provider_message_id TEXT,
  submitted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX onboarding_invitation_pending_trader_idx
  ON trader.onboarding_invitations(trader_id)
  WHERE status = 'pending';
CREATE INDEX onboarding_invitation_token_idx
  ON trader.onboarding_invitations(token_hash, expires_at)
  WHERE status = 'pending';

CREATE TABLE trader.onboarding_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_id UUID NOT NULL UNIQUE REFERENCES trader.traders(id) ON DELETE CASCADE,
  invitation_id UUID NOT NULL UNIQUE REFERENCES trader.onboarding_invitations(id) ON DELETE RESTRICT,
  postcode_hash TEXT NOT NULL,
  safeguarding_declaration BOOLEAN NOT NULL,
  data_accuracy_confirmation BOOLEAN NOT NULL,
  privacy_notice_accepted_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE trader.onboarding_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_id UUID NOT NULL REFERENCES trader.traders(id) ON DELETE CASCADE,
  invitation_id UUID NOT NULL REFERENCES trader.onboarding_invitations(id) ON DELETE RESTRICT,
  document_type TEXT NOT NULL
    CHECK (document_type IN ('identity', 'public_liability_insurance', 'enhanced_dbs', 'qualification')),
  storage_key TEXT NOT NULL UNIQUE,
  original_filename_ciphertext TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 15728640),
  document_reference_ciphertext TEXT,
  issue_date DATE,
  expiry_date DATE,
  review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'approved', 'rejected')),
  reviewed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX onboarding_documents_trader_idx
  ON trader.onboarding_documents(trader_id, review_status, document_type);

CREATE TRIGGER onboarding_invitations_updated_at
BEFORE UPDATE ON trader.onboarding_invitations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
