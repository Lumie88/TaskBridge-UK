ALTER TABLE ops.tasks
  ADD COLUMN IF NOT EXISTS safeguarding_risk_score INTEGER NOT NULL DEFAULT 0 CHECK (safeguarding_risk_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS safeguarding_risk_band TEXT NOT NULL DEFAULT 'standard'
    CHECK (safeguarding_risk_band IN ('standard', 'elevated', 'high', 'critical')),
  ADD COLUMN IF NOT EXISTS safeguarding_risk_factors TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS tasks_safeguarding_risk_idx
  ON ops.tasks(agency_id, safeguarding_risk_band, safeguarding_risk_score DESC, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS billing.family_payment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES ops.tasks(id) ON DELETE RESTRICT,
  agency_id UUID NOT NULL REFERENCES tenant.agencies(id) ON DELETE RESTRICT,
  payer_email CITEXT NOT NULL,
  payer_name TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'GBP',
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'opened', 'paid', 'expired', 'cancelled')),
  provider TEXT NOT NULL DEFAULT 'taskbridge_manual',
  provider_session_id TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS family_payment_sessions_task_idx
  ON billing.family_payment_sessions(task_id, status, created_at DESC);

DROP TRIGGER IF EXISTS family_payment_sessions_updated_at ON billing.family_payment_sessions;
CREATE TRIGGER family_payment_sessions_updated_at
BEFORE UPDATE ON billing.family_payment_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS ops.family_update_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES ops.tasks(id) ON DELETE RESTRICT,
  agency_id UUID NOT NULL REFERENCES tenant.agencies(id) ON DELETE RESTRICT,
  recipient_email CITEXT NOT NULL,
  recipient_name TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'opened', 'expired', 'revoked')),
  expires_at TIMESTAMPTZ NOT NULL,
  first_opened_at TIMESTAMPTZ,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS family_update_links_task_idx
  ON ops.family_update_links(task_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS ops.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT NOT NULL UNIQUE,
  task_id UUID REFERENCES ops.tasks(id) ON DELETE SET NULL,
  agency_id UUID REFERENCES tenant.agencies(id) ON DELETE SET NULL,
  reported_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL
    CHECK (type IN ('failed_visit', 'handyman_declined', 'family_complaint', 'missing_evidence', 'safeguarding_concern', 'payment_dispute')),
  severity TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'investigating', 'escalated', 'resolved', 'closed')),
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  resolution_notes TEXT,
  escalated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS incidents_status_idx
  ON ops.incidents(status, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS incidents_agency_task_idx
  ON ops.incidents(agency_id, task_id, created_at DESC);

DROP TRIGGER IF EXISTS incidents_updated_at ON ops.incidents;
CREATE TRIGGER incidents_updated_at
BEFORE UPDATE ON ops.incidents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
