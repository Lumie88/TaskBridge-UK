-- TaskBridge PostgreSQL schema for Railway
-- Run this in your Railway PostgreSQL database.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'access_level') THEN
    CREATE TYPE access_level AS ENUM ('care', 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trader_source') THEN
    CREATE TYPE trader_source AS ENUM ('taskrabbit', 'airtasker', 'checkatrade', 'direct');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dbs_status') THEN
    CREATE TYPE dbs_status AS ENUM ('Pending', 'Approved', 'Rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_urgency') THEN
    CREATE TYPE task_urgency AS ENUM ('Low', 'Medium', 'High');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
    CREATE TYPE task_status AS ENUM ('Triaged', 'Dispatched', 'Checked-In', 'Completed', 'Cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_status') THEN
    CREATE TYPE assignment_status AS ENUM ('Pending assignment', 'Assigned', 'Blocked', 'Failed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS agencies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  api_key_hash TEXT NOT NULL,
  primary_contact TEXT,
  webhook_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_users (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  encrypted_name TEXT NOT NULL,
  encrypted_address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  is_vulnerable BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS care_users (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  access_level access_level NOT NULL DEFAULT 'care',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS traders (
  id TEXT PRIMARY KEY,
  source trader_source NOT NULL,
  marketplace_trader_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  amiqus_session_id TEXT,
  dbs_status dbs_status NOT NULL DEFAULT 'Pending',
  dbs_expiry_date DATE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  hourly_rate NUMERIC(8,2),
  next_available TEXT,
  services TEXT[] NOT NULL DEFAULT '{}',
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, marketplace_trader_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  service_user_id TEXT NOT NULL REFERENCES service_users(id) ON DELETE CASCADE,
  created_by_care_user_id TEXT REFERENCES care_users(id) ON DELETE SET NULL,
  care_worker_notes TEXT NOT NULL,
  ai_summary TEXT,
  ai_recommended_service TEXT,
  category TEXT NOT NULL,
  urgency task_urgency NOT NULL DEFAULT 'Medium',
  preferred_window TEXT NOT NULL DEFAULT 'Next available',
  carer_on_site BOOLEAN NOT NULL DEFAULT false,
  ring_fence_enforced BOOLEAN NOT NULL DEFAULT false,
  supervised_visit_required BOOLEAN NOT NULL DEFAULT false,
  assignment_status assignment_status NOT NULL DEFAULT 'Pending assignment',
  assigned_trader_id TEXT REFERENCES traders(id) ON DELETE SET NULL,
  status task_status NOT NULL DEFAULT 'Triaged',
  marketplace TEXT,
  dispatch_receipt TEXT,
  before_photo_url TEXT,
  after_photo_url TEXT,
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  check_in_lat DOUBLE PRECISION,
  check_in_lng DOUBLE PRECISION,
  visit_token_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_task_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_user_id TEXT NOT NULL REFERENCES service_users(id) ON DELETE CASCADE,
  care_user_id TEXT REFERENCES care_users(id) ON DELETE SET NULL,
  raw_note TEXT NOT NULL,
  summary TEXT NOT NULL,
  safeguarding TEXT NOT NULL,
  preferred_window TEXT,
  carer_on_site BOOLEAN NOT NULL DEFAULT false,
  generated_tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS demo_requests (
  id TEXT PRIMARY KEY,
  name TEXT,
  work_email TEXT NOT NULL,
  organisation TEXT,
  role TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'Requested',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS visit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  trader_id TEXT REFERENCES traders(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  photo_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outbound_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id TEXT NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  target_url TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'Queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_care_user_id TEXT REFERENCES care_users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  detail TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_users_agency_id ON service_users(agency_id);
CREATE INDEX IF NOT EXISTS idx_care_users_agency_id ON care_users(agency_id);
CREATE INDEX IF NOT EXISTS idx_care_users_access_level ON care_users(access_level);
CREATE INDEX IF NOT EXISTS idx_traders_dbs_status ON traders(dbs_status);
CREATE INDEX IF NOT EXISTS idx_traders_services ON traders USING GIN (services);
CREATE INDEX IF NOT EXISTS idx_tasks_service_user_id ON tasks(service_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignment_status ON tasks(assignment_status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_trader_id ON tasks(assigned_trader_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_task_plans_service_user_id ON ai_task_plans(service_user_id);
CREATE INDEX IF NOT EXISTS idx_visit_events_task_id ON visit_events(task_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agencies_set_updated_at ON agencies;
CREATE TRIGGER agencies_set_updated_at
BEFORE UPDATE ON agencies
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS service_users_set_updated_at ON service_users;
CREATE TRIGGER service_users_set_updated_at
BEFORE UPDATE ON service_users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS care_users_set_updated_at ON care_users;
CREATE TRIGGER care_users_set_updated_at
BEFORE UPDATE ON care_users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS traders_set_updated_at ON traders;
CREATE TRIGGER traders_set_updated_at
BEFORE UPDATE ON traders
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS tasks_set_updated_at ON tasks;
CREATE TRIGGER tasks_set_updated_at
BEFORE UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS outbound_webhook_events_set_updated_at ON outbound_webhook_events;
CREATE TRIGGER outbound_webhook_events_set_updated_at
BEFORE UPDATE ON outbound_webhook_events
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
