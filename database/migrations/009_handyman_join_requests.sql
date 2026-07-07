CREATE TABLE IF NOT EXISTS tenant.handyman_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  business_name TEXT,
  email CITEXT NOT NULL,
  phone TEXT NOT NULL,
  postcode TEXT NOT NULL,
  services TEXT[] NOT NULL DEFAULT '{}',
  has_enhanced_dbs BOOLEAN NOT NULL DEFAULT false,
  has_public_liability BOOLEAN NOT NULL DEFAULT false,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reviewing', 'invited', 'declined', 'closed')),
  source TEXT NOT NULL DEFAULT 'website',
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS handyman_join_requests_status_created_idx
  ON tenant.handyman_join_requests(status, created_at DESC);

DROP TRIGGER IF EXISTS handyman_join_requests_updated_at ON tenant.handyman_join_requests;
CREATE TRIGGER handyman_join_requests_updated_at
BEFORE UPDATE ON tenant.handyman_join_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
