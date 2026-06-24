CREATE TABLE auth.user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES tenant.agencies(id) ON DELETE RESTRICT,
  full_name TEXT NOT NULL,
  email CITEXT NOT NULL,
  role auth.user_role NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  expires_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  email_delivery_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (email_delivery_status IN ('pending', 'sent', 'not_configured', 'failed')),
  provider_message_id TEXT,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (
    (role IN ('care_coordinator', 'care_manager') AND agency_id IS NOT NULL)
    OR (role IN ('taskbridge_admin', 'taskbridge_super_admin') AND agency_id IS NULL)
  ),
  CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX user_invitations_pending_email_idx
  ON auth.user_invitations(email)
  WHERE status = 'pending';
CREATE INDEX user_invitations_token_idx
  ON auth.user_invitations(token_hash, expires_at)
  WHERE status = 'pending';

CREATE TRIGGER user_invitations_updated_at
BEFORE UPDATE ON auth.user_invitations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE integration.notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  purpose TEXT NOT NULL,
  recipient_reference TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_message_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('sent', 'queued', 'not_configured', 'failed')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX notification_deliveries_purpose_time_idx
  ON integration.notification_deliveries(purpose, created_at DESC);

ALTER TABLE trader.qualifications
  ADD COLUMN review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'approved', 'rejected'));

CREATE INDEX qualifications_trader_review_idx
  ON trader.qualifications(trader_id, review_status, expiry_date);
