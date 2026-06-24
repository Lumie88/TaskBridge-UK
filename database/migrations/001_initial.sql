CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS tenant;
CREATE SCHEMA IF NOT EXISTS care;
CREATE SCHEMA IF NOT EXISTS trader;
CREATE SCHEMA IF NOT EXISTS ops;
CREATE SCHEMA IF NOT EXISTS integration;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS billing;

CREATE TYPE auth.user_role AS ENUM (
  'care_coordinator',
  'care_manager',
  'taskbridge_admin',
  'taskbridge_super_admin'
);
CREATE TYPE auth.user_status AS ENUM ('invited', 'active', 'suspended', 'disabled');
CREATE TYPE tenant.agency_status AS ENUM ('onboarding', 'active', 'suspended', 'archived');
CREATE TYPE care.risk_level AS ENUM ('standard', 'vulnerable_adult', 'high_risk');
CREATE TYPE ops.task_urgency AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE ops.task_status AS ENUM (
  'draft',
  'awaiting_care_approval',
  'pending_taskbridge_assignment',
  'assignment_review',
  'dispatched',
  'visit_scheduled',
  'checked_in',
  'awaiting_evidence_review',
  'awaiting_care_confirmation',
  'completed',
  'blocked',
  'cancelled',
  'failed_dispatch'
);
CREATE TYPE ops.assignment_status AS ENUM (
  'not_started',
  'matching',
  'pending_admin_review',
  'approved',
  'dispatched',
  'rejected',
  'blocked',
  'failed'
);
CREATE TYPE ops.visit_status AS ENUM (
  'pending',
  'link_sent',
  'checked_in',
  'checked_out',
  'evidence_submitted',
  'confirmed',
  'disputed',
  'cancelled'
);
CREATE TYPE trader.trader_status AS ENUM ('active', 'suspended', 'inactive');
CREATE TYPE trader.dbs_status AS ENUM ('not_started', 'pending', 'approved', 'rejected', 'expired', 'unclear');
CREATE TYPE trader.insurance_status AS ENUM ('unverified', 'pending', 'verified', 'expired', 'rejected');
CREATE TYPE integration.provider_type AS ENUM (
  'care_management',
  'dbs_verification',
  'handyman_network',
  'sms',
  'storage',
  'payment',
  'ai_task_planner'
);
CREATE TYPE integration.webhook_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE integration.webhook_status AS ENUM ('received', 'processed', 'failed', 'retrying', 'ignored');

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_taskbridge_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('app.current_role', true), '');
$$;

CREATE OR REPLACE FUNCTION public.current_taskbridge_agency()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('app.current_agency_id', true), '')::uuid;
$$;

CREATE TABLE tenant.agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  primary_contact_name TEXT,
  primary_contact_email CITEXT,
  work_email_domain CITEXT,
  logo_url TEXT,
  status tenant.agency_status NOT NULL DEFAULT 'onboarding',
  timezone TEXT NOT NULL DEFAULT 'Europe/London',
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE tenant.agency_settings (
  agency_id UUID PRIMARY KEY REFERENCES tenant.agencies(id) ON DELETE CASCADE,
  vulnerable_adult_requires_enhanced_dbs BOOLEAN NOT NULL DEFAULT true,
  completion_requires_care_confirmation BOOLEAN NOT NULL DEFAULT true,
  default_visit_radius_miles NUMERIC(5,2) NOT NULL DEFAULT 15 CHECK (default_visit_radius_miles > 0),
  default_currency CHAR(3) NOT NULL DEFAULT 'GBP',
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE tenant.agency_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES tenant.agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL UNIQUE,
  key_hash TEXT NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['tasks:write']::text[],
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE tenant.agency_webhook_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES tenant.agencies(id) ON DELETE CASCADE,
  callback_url TEXT NOT NULL,
  secret_ciphertext TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (agency_id, callback_url)
);

CREATE TABLE auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES tenant.agencies(id) ON DELETE RESTRICT,
  full_name TEXT NOT NULL,
  email CITEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role auth.user_role NOT NULL,
  status auth.user_status NOT NULL DEFAULT 'invited',
  mfa_enabled BOOLEAN NOT NULL DEFAULT false,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  deleted_at TIMESTAMPTZ,
  CHECK (
    (role IN ('care_coordinator', 'care_manager') AND agency_id IS NOT NULL)
    OR (role IN ('taskbridge_admin', 'taskbridge_super_admin') AND agency_id IS NULL)
  )
);

CREATE TABLE auth.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE auth.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT,
  ip_address INET,
  succeeded BOOLEAN NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE care.service_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES tenant.agencies(id) ON DELETE RESTRICT,
  external_service_user_id TEXT NOT NULL,
  encrypted_name TEXT NOT NULL,
  encrypted_address TEXT NOT NULL,
  postcode_hash TEXT,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  risk_level care.risk_level NOT NULL DEFAULT 'standard',
  vulnerability_notes_ciphertext TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (agency_id, external_service_user_id),
  CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

CREATE TABLE care.care_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES tenant.agencies(id) ON DELETE RESTRICT,
  service_user_id UUID NOT NULL REFERENCES care.service_users(id) ON DELETE RESTRICT,
  submitted_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  external_note_id TEXT,
  note_ciphertext TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'portal',
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (agency_id, idempotency_key)
);

CREATE TABLE trader.networks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  external_reference TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE trader.traders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID REFERENCES trader.networks(id) ON DELETE SET NULL,
  external_trader_id TEXT,
  display_name TEXT NOT NULL,
  encrypted_full_name TEXT NOT NULL,
  encrypted_mobile TEXT NOT NULL,
  email CITEXT,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  postcode_area TEXT,
  hourly_rate NUMERIC(10,2) CHECK (hourly_rate IS NULL OR hourly_rate >= 0),
  quality_score NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (quality_score BETWEEN 0 AND 100),
  status trader.trader_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (network_id, external_trader_id),
  CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

CREATE TABLE trader.trader_services (
  trader_id UUID NOT NULL REFERENCES trader.traders(id) ON DELETE CASCADE,
  service_category TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (trader_id, service_category)
);

CREATE TABLE trader.trader_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_id UUID NOT NULL REFERENCES trader.traders(id) ON DELETE CASCADE,
  available_from TIMESTAMPTZ NOT NULL,
  available_to TIMESTAMPTZ NOT NULL,
  reserved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (available_to > available_from)
);

CREATE TABLE trader.dbs_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_id UUID NOT NULL REFERENCES trader.traders(id) ON DELETE CASCADE,
  provider_session_id TEXT UNIQUE,
  status trader.dbs_status NOT NULL DEFAULT 'not_started',
  outcome TEXT,
  expiry_date DATE,
  evidence_reference TEXT,
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE trader.insurance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_id UUID NOT NULL REFERENCES trader.traders(id) ON DELETE CASCADE,
  status trader.insurance_status NOT NULL DEFAULT 'unverified',
  provider_name TEXT,
  policy_reference_ciphertext TEXT,
  expiry_date DATE,
  evidence_url TEXT,
  verified_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE trader.qualifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_id UUID NOT NULL REFERENCES trader.traders(id) ON DELETE CASCADE,
  qualification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  evidence_url TEXT,
  expiry_date DATE,
  verified_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE ops.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT NOT NULL UNIQUE,
  agency_id UUID NOT NULL REFERENCES tenant.agencies(id) ON DELETE RESTRICT,
  service_user_id UUID NOT NULL REFERENCES care.service_users(id) ON DELETE RESTRICT,
  care_note_id UUID REFERENCES care.care_notes(id) ON DELETE SET NULL,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  urgency ops.task_urgency NOT NULL DEFAULT 'medium',
  status ops.task_status NOT NULL DEFAULT 'draft',
  summary TEXT NOT NULL,
  notes_ciphertext TEXT NOT NULL,
  preferred_window_start TIMESTAMPTZ,
  preferred_window_end TIMESTAMPTZ,
  carer_on_site BOOLEAN NOT NULL DEFAULT false,
  vulnerable_adult BOOLEAN NOT NULL DEFAULT false,
  ring_fence_required BOOLEAN NOT NULL DEFAULT false,
  before_photo_url TEXT,
  after_photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  CHECK (
    preferred_window_end IS NULL
    OR preferred_window_start IS NULL
    OR preferred_window_end > preferred_window_start
  )
);

CREATE TABLE ops.task_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES ops.tasks(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES tenant.agencies(id) ON DELETE RESTRICT,
  previous_status ops.task_status,
  new_status ops.task_status NOT NULL,
  changed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE ops.assignment_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES ops.tasks(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES tenant.agencies(id) ON DELETE RESTRICT,
  trader_id UUID NOT NULL REFERENCES trader.traders(id) ON DELETE CASCADE,
  eligible BOOLEAN NOT NULL,
  rejection_reasons TEXT[] NOT NULL DEFAULT '{}',
  score NUMERIC(7,2) NOT NULL DEFAULT 0,
  distance_miles NUMERIC(7,2),
  quoted_price NUMERIC(10,2),
  availability_start TIMESTAMPTZ,
  availability_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (task_id, trader_id)
);

CREATE TABLE ops.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES ops.tasks(id) ON DELETE RESTRICT,
  agency_id UUID NOT NULL REFERENCES tenant.agencies(id) ON DELETE RESTRICT,
  trader_id UUID NOT NULL REFERENCES trader.traders(id) ON DELETE RESTRICT,
  status ops.assignment_status NOT NULL DEFAULT 'not_started',
  selected_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  provider_booking_id TEXT,
  distance_miles NUMERIC(7,2),
  quoted_price NUMERIC(10,2),
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  blocked_reason TEXT,
  dispatched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (quoted_price IS NULL OR quoted_price >= 0)
);

CREATE TABLE ops.visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES ops.tasks(id) ON DELETE RESTRICT,
  agency_id UUID NOT NULL REFERENCES tenant.agencies(id) ON DELETE RESTRICT,
  assignment_id UUID NOT NULL REFERENCES ops.assignments(id) ON DELETE RESTRICT,
  trader_id UUID NOT NULL REFERENCES trader.traders(id) ON DELETE RESTRICT,
  status ops.visit_status NOT NULL DEFAULT 'pending',
  check_in_at TIMESTAMPTZ,
  check_in_latitude NUMERIC(9,6),
  check_in_longitude NUMERIC(9,6),
  check_out_at TIMESTAMPTZ,
  completion_notes TEXT,
  confirmed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMPTZ,
  disputed_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (check_in_latitude IS NULL OR check_in_latitude BETWEEN -90 AND 90),
  CHECK (check_in_longitude IS NULL OR check_in_longitude BETWEEN -180 AND 180)
);

CREATE TABLE ops.visit_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES ops.visits(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES ops.tasks(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  first_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE ops.visit_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES ops.visits(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES ops.tasks(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('before_photo', 'after_photo', 'document', 'note')),
  file_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  reviewed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE integration.provider_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_type integration.provider_type NOT NULL,
  name TEXT NOT NULL,
  api_base_url TEXT,
  credentials_ciphertext TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (provider_type, name)
);

CREATE TABLE integration.agency_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES tenant.agencies(id) ON DELETE CASCADE,
  provider_config_id UUID NOT NULL REFERENCES integration.provider_configs(id) ON DELETE RESTRICT,
  external_account_id TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (agency_id, provider_config_id)
);

CREATE TABLE integration.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES tenant.agencies(id) ON DELETE SET NULL,
  provider_config_id UUID REFERENCES integration.provider_configs(id) ON DELETE SET NULL,
  direction integration.webhook_direction NOT NULL,
  endpoint TEXT NOT NULL,
  event_type TEXT NOT NULL,
  idempotency_key TEXT,
  status integration.webhook_status NOT NULL DEFAULT 'received',
  request_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_status INTEGER,
  response_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  next_retry_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE NULLS NOT DISTINCT (agency_id, direction, idempotency_key)
);

CREATE TABLE integration.retry_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_log_id UUID REFERENCES integration.webhook_logs(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 8 CHECK (max_attempts > 0),
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  locked_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE audit.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role auth.user_role,
  agency_id UUID REFERENCES tenant.agencies(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE audit.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email CITEXT,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  ip_address INET,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE OR REPLACE FUNCTION audit.prevent_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Audit records are immutable';
END;
$$;

CREATE TRIGGER audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit.audit_logs
FOR EACH ROW EXECUTE FUNCTION audit.prevent_mutation();

CREATE TRIGGER security_events_immutable
BEFORE UPDATE OR DELETE ON audit.security_events
FOR EACH ROW EXECUTE FUNCTION audit.prevent_mutation();

CREATE TABLE billing.agency_billing_profiles (
  agency_id UUID PRIMARY KEY REFERENCES tenant.agencies(id) ON DELETE RESTRICT,
  billing_email CITEXT,
  monthly_cap NUMERIC(12,2),
  currency CHAR(3) NOT NULL DEFAULT 'GBP',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (monthly_cap IS NULL OR monthly_cap >= 0)
);

CREATE TABLE billing.task_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL UNIQUE REFERENCES ops.tasks(id) ON DELETE RESTRICT,
  agency_id UUID NOT NULL REFERENCES tenant.agencies(id) ON DELETE RESTRICT,
  assignment_id UUID REFERENCES ops.assignments(id) ON DELETE SET NULL,
  handyman_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  platform_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'GBP',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (handyman_amount >= 0 AND platform_fee >= 0 AND total_amount >= 0)
);

CREATE TABLE billing.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES tenant.agencies(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL UNIQUE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'GBP',
  status TEXT NOT NULL DEFAULT 'draft',
  issued_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (period_end >= period_start)
);

CREATE TABLE billing.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_id UUID NOT NULL REFERENCES trader.traders(id) ON DELETE RESTRICT,
  assignment_id UUID NOT NULL UNIQUE REFERENCES ops.assignments(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'GBP',
  status TEXT NOT NULL DEFAULT 'pending',
  payable_after TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER agencies_updated_at BEFORE UPDATE ON tenant.agencies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER agency_settings_updated_at BEFORE UPDATE ON tenant.agency_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER webhook_configs_updated_at BEFORE UPDATE ON tenant.agency_webhook_configs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER users_updated_at BEFORE UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER service_users_updated_at BEFORE UPDATE ON care.service_users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER networks_updated_at BEFORE UPDATE ON trader.networks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER traders_updated_at BEFORE UPDATE ON trader.traders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER dbs_updated_at BEFORE UPDATE ON trader.dbs_verifications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER insurance_updated_at BEFORE UPDATE ON trader.insurance_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON ops.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER assignments_updated_at BEFORE UPDATE ON ops.assignments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER visits_updated_at BEFORE UPDATE ON ops.visits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER provider_configs_updated_at BEFORE UPDATE ON integration.provider_configs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER agency_integrations_updated_at BEFORE UPDATE ON integration.agency_integrations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER billing_profiles_updated_at BEFORE UPDATE ON billing.agency_billing_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER task_charges_updated_at BEFORE UPDATE ON billing.task_charges FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX tasks_agency_status_idx ON ops.tasks(agency_id, status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX tasks_service_user_idx ON ops.tasks(service_user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX task_events_task_idx ON ops.task_status_events(task_id, created_at);
CREATE INDEX sessions_active_idx ON auth.sessions(token_hash) WHERE revoked_at IS NULL;
CREATE INDEX sessions_user_idx ON auth.sessions(user_id, expires_at DESC);
CREATE INDEX dbs_current_idx ON trader.dbs_verifications(trader_id, status, expiry_date DESC);
CREATE INDEX insurance_current_idx ON trader.insurance_records(trader_id, status, expiry_date DESC);
CREATE INDEX trader_location_idx ON trader.traders(latitude, longitude) WHERE status = 'active' AND deleted_at IS NULL;
CREATE INDEX assignment_candidates_task_idx ON ops.assignment_candidates(task_id, eligible, score DESC);
CREATE INDEX visits_task_idx ON ops.visits(task_id, created_at DESC);
CREATE INDEX webhook_retry_idx ON integration.webhook_logs(status, next_retry_at) WHERE status IN ('failed', 'retrying');
CREATE INDEX retry_queue_ready_idx ON integration.retry_queue(next_run_at) WHERE completed_at IS NULL AND failed_at IS NULL;
CREATE INDEX audit_agency_time_idx ON audit.audit_logs(agency_id, created_at DESC);
CREATE INDEX audit_action_time_idx ON audit.audit_logs(action, created_at DESC);

ALTER TABLE tenant.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE care.service_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE care.care_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.task_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.assignment_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration.agency_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY agencies_tenant_read ON tenant.agencies
FOR SELECT USING (
  public.current_taskbridge_role() IN ('taskbridge_admin', 'taskbridge_super_admin')
  OR id = public.current_taskbridge_agency()
);

CREATE POLICY users_tenant_read ON auth.users
FOR SELECT USING (
  public.current_taskbridge_role() IN ('taskbridge_admin', 'taskbridge_super_admin')
  OR agency_id = public.current_taskbridge_agency()
);

CREATE POLICY service_users_tenant_access ON care.service_users
USING (
  public.current_taskbridge_role() IN ('taskbridge_admin', 'taskbridge_super_admin')
  OR agency_id = public.current_taskbridge_agency()
)
WITH CHECK (
  public.current_taskbridge_role() IN ('taskbridge_admin', 'taskbridge_super_admin')
  OR agency_id = public.current_taskbridge_agency()
);

CREATE POLICY care_notes_tenant_access ON care.care_notes
USING (
  public.current_taskbridge_role() IN ('taskbridge_admin', 'taskbridge_super_admin')
  OR agency_id = public.current_taskbridge_agency()
)
WITH CHECK (
  public.current_taskbridge_role() IN ('taskbridge_admin', 'taskbridge_super_admin')
  OR agency_id = public.current_taskbridge_agency()
);

CREATE POLICY tasks_tenant_access ON ops.tasks
USING (
  public.current_taskbridge_role() IN ('taskbridge_admin', 'taskbridge_super_admin')
  OR agency_id = public.current_taskbridge_agency()
)
WITH CHECK (
  public.current_taskbridge_role() IN ('taskbridge_admin', 'taskbridge_super_admin')
  OR agency_id = public.current_taskbridge_agency()
);

CREATE POLICY task_events_tenant_access ON ops.task_status_events
USING (
  public.current_taskbridge_role() IN ('taskbridge_admin', 'taskbridge_super_admin')
  OR agency_id = public.current_taskbridge_agency()
);

CREATE POLICY assignment_candidates_admin_only ON ops.assignment_candidates
USING (public.current_taskbridge_role() IN ('taskbridge_admin', 'taskbridge_super_admin'));

CREATE POLICY assignments_tenant_read ON ops.assignments
FOR SELECT USING (
  public.current_taskbridge_role() IN ('taskbridge_admin', 'taskbridge_super_admin')
  OR agency_id = public.current_taskbridge_agency()
);

CREATE POLICY visits_tenant_read ON ops.visits
FOR SELECT USING (
  public.current_taskbridge_role() IN ('taskbridge_admin', 'taskbridge_super_admin')
  OR agency_id = public.current_taskbridge_agency()
);

CREATE POLICY agency_integrations_admin_only ON integration.agency_integrations
USING (public.current_taskbridge_role() = 'taskbridge_super_admin');
