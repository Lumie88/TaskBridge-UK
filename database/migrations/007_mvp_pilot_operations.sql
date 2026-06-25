ALTER TABLE tenant.demo_requests
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;

ALTER TABLE tenant.agency_settings
  ADD COLUMN IF NOT EXISTS supervised_visit_exception_allowed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS taskbridge_assignment_requires_admin_review BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS go_live_status TEXT NOT NULL DEFAULT 'pilot_setup'
    CHECK (go_live_status IN ('pilot_setup', 'pilot_live', 'paused', 'suspended'));

ALTER TABLE billing.task_charges
  ADD COLUMN IF NOT EXISTS agency_coordination_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS settlement_status TEXT NOT NULL DEFAULT 'not_invoiced'
    CHECK (settlement_status IN ('not_invoiced', 'invoiced', 'agency_paid', 'disputed', 'written_off')),
  ADD COLUMN IF NOT EXISTS settlement_reference TEXT,
  ADD COLUMN IF NOT EXISTS settlement_due_at DATE,
  ADD COLUMN IF NOT EXISTS settlement_notes TEXT;

ALTER TABLE billing.payouts
  ADD COLUMN IF NOT EXISTS hold_reason TEXT,
  ADD COLUMN IF NOT EXISTS released_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS billing.payment_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_charge_id UUID NOT NULL REFERENCES billing.task_charges(id) ON DELETE RESTRICT,
  agency_id UUID NOT NULL REFERENCES tenant.agencies(id) ON DELETE RESTRICT,
  task_id UUID NOT NULL REFERENCES ops.tasks(id) ON DELETE RESTRICT,
  opened_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'investigating', 'refund_due', 'resolved', 'rejected')),
  reason TEXT NOT NULL,
  resolution_notes TEXT,
  refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (refund_amount >= 0),
  payout_hold BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS demo_requests_status_owner_idx
  ON tenant.demo_requests(status, owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS task_charges_agency_settlement_idx
  ON billing.task_charges(agency_id, settlement_status, created_at DESC);

CREATE INDEX IF NOT EXISTS payment_disputes_status_idx
  ON billing.payment_disputes(status, created_at DESC);

DROP TRIGGER IF EXISTS payment_disputes_updated_at ON billing.payment_disputes;
CREATE TRIGGER payment_disputes_updated_at
BEFORE UPDATE ON billing.payment_disputes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
