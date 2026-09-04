ALTER TABLE tenant.handyman_join_requests
  ADD COLUMN IF NOT EXISTS trading_status TEXT NOT NULL DEFAULT 'sole_trader',
  ADD COLUMN IF NOT EXISTS company_registration_number TEXT,
  ADD COLUMN IF NOT EXISTS vat_number TEXT,
  ADD COLUMN IF NOT EXISTS dbs_route TEXT NOT NULL DEFAULT 'basic_or_not_sure',
  ADD COLUMN IF NOT EXISTS dbs_eligibility_notes TEXT;

ALTER TABLE trader.traders
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS trading_status TEXT NOT NULL DEFAULT 'sole_trader',
  ADD COLUMN IF NOT EXISTS company_registration_number TEXT,
  ADD COLUMN IF NOT EXISTS vat_number TEXT,
  ADD COLUMN IF NOT EXISTS source_join_request_id UUID REFERENCES tenant.handyman_join_requests(id) ON DELETE SET NULL;
