CREATE TABLE IF NOT EXISTS ops.family_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES ops.tasks(id) ON DELETE RESTRICT,
  agency_id UUID NOT NULL REFERENCES tenant.agencies(id) ON DELETE RESTRICT,
  family_update_link_id UUID REFERENCES ops.family_update_links(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  felt_safer BOOLEAN,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (task_id, family_update_link_id)
);

CREATE INDEX IF NOT EXISTS family_feedback_agency_created_idx
  ON ops.family_feedback(agency_id, created_at DESC);
