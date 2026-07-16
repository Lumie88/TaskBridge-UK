ALTER TABLE ops.tasks
  ADD COLUMN IF NOT EXISTS payment_route TEXT NOT NULL DEFAULT 'agency',
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'agency_invoice',
  ADD COLUMN IF NOT EXISTS payer_name TEXT,
  ADD COLUMN IF NOT EXISTS payer_email CITEXT,
  ADD COLUMN IF NOT EXISTS payer_phone TEXT,
  ADD COLUMN IF NOT EXISTS funding_reference TEXT,
  ADD COLUMN IF NOT EXISTS funding_notes TEXT;

ALTER TABLE ops.tasks DROP CONSTRAINT IF EXISTS tasks_payment_route_check;
ALTER TABLE ops.tasks
  ADD CONSTRAINT tasks_payment_route_check
  CHECK (payment_route IN ('agency', 'family_representative', 'council_personal_budget'));

ALTER TABLE ops.tasks DROP CONSTRAINT IF EXISTS tasks_payment_status_check;
ALTER TABLE ops.tasks
  ADD CONSTRAINT tasks_payment_status_check
  CHECK (payment_status IN (
    'agency_invoice',
    'awaiting_family_payment',
    'family_paid',
    'funding_pending',
    'funding_approved',
    'payment_waived'
  ));

CREATE INDEX IF NOT EXISTS tasks_agency_payment_idx
  ON ops.tasks(agency_id, payment_route, payment_status, created_at DESC)
  WHERE deleted_at IS NULL;
