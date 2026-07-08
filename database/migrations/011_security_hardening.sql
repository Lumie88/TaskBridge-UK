CREATE UNIQUE INDEX IF NOT EXISTS assignments_one_active_per_task_idx
  ON ops.assignments(task_id)
  WHERE status IN ('pending_admin_review', 'approved', 'dispatched');

COMMENT ON INDEX ops.assignments_one_active_per_task_idx IS
  'Prevents duplicate active handyman assignment reservations and provider dispatches for a single task.';
