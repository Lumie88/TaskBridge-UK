CREATE TABLE IF NOT EXISTS trader.trader_rate_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_id UUID NOT NULL REFERENCES trader.traders(id) ON DELETE CASCADE,
  service_category TEXT NOT NULL,
  postcode_area TEXT,
  call_out_fee NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (call_out_fee >= 0),
  hourly_rate NUMERIC(10,2) CHECK (hourly_rate IS NULL OR hourly_rate >= 0),
  fixed_price NUMERIC(10,2) CHECK (fixed_price IS NULL OR fixed_price >= 0),
  minimum_hours NUMERIC(5,2) NOT NULL DEFAULT 1 CHECK (minimum_hours >= 0),
  materials_rule TEXT NOT NULL DEFAULT 'charged_with_receipt'
    CHECK (materials_rule IN ('included', 'charged_with_receipt', 'capped', 'not_included')),
  materials_cap NUMERIC(10,2) CHECK (materials_cap IS NULL OR materials_cap >= 0),
  emergency_uplift_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (emergency_uplift_percent >= 0),
  vat_registered BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'expired', 'rejected')),
  admin_notes TEXT,
  approved_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (fixed_price IS NOT NULL OR hourly_rate IS NOT NULL),
  UNIQUE (trader_id, service_category, postcode_area)
);

CREATE INDEX IF NOT EXISTS trader_rate_cards_lookup_idx
  ON trader.trader_rate_cards(trader_id, lower(service_category), status, postcode_area);

DROP TRIGGER IF EXISTS trader_rate_cards_updated_at ON trader.trader_rate_cards;
CREATE TRIGGER trader_rate_cards_updated_at
BEFORE UPDATE ON trader.trader_rate_cards
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
