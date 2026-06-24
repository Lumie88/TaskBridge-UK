CREATE TABLE tenant.demo_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  organisation_name text NOT NULL,
  work_email citext NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'closed')),
  source text NOT NULL DEFAULT 'website',
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_demo_requests_status_created ON tenant.demo_requests (status, created_at DESC);
CREATE TRIGGER trg_demo_requests_updated_at BEFORE UPDATE ON tenant.demo_requests
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
