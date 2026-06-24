import { Router } from "express";
import { z } from "zod";
import { audit } from "../audit.js";
import { asyncHandler } from "../async-handler.js";
import { requireAgency, requireRoles } from "../auth.js";
import { query, withTransaction } from "../db.js";
import { cancelHandymanNetworkBooking } from "../integrations.js";
import { decryptField, encryptField, hashToken, publicId, safeInitials } from "../security.js";
import { analyzeCareNote } from "../task-planner.js";

interface ServiceUserRow {
  id: string;
  external_service_user_id: string;
  encrypted_name: string;
  encrypted_address: string;
  town_ciphertext: string | null;
  county_ciphertext: string | null;
  postcode_ciphertext: string | null;
  risk_level: "standard" | "vulnerable_adult" | "high_risk";
  vulnerability_notes_ciphertext: string | null;
  created_at: string;
}

interface CoordinatorTaskRow {
  public_id: string;
  encrypted_name: string;
  category: string;
  urgency: string;
  status: string;
  summary: string;
  notes_ciphertext: string;
  vulnerable_adult: boolean;
  ring_fence_required: boolean;
  carer_on_site: boolean;
  preferred_window_start: string | null;
  preferred_window_end: string | null;
  created_at: string;
  assigned_display_name: string | null;
  assigned_network: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  before_photo_url: string | null;
  after_photo_url: string | null;
  completion_notes: string | null;
}

const planSchema = z.object({
  serviceUserId: z.string().uuid(),
  note: z.string().min(10).max(5000)
});

const createServiceUserSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  address: z.string().trim().min(5).max(500),
  town: z.string().trim().min(2).max(120),
  county: z.string().trim().min(2).max(120),
  postcode: z.string().trim().min(5).max(12),
  riskLevel: z.enum(["standard", "vulnerable_adult", "high_risk"]),
  vulnerabilityNotes: z.string().trim().max(2000).optional().default("")
});

const updateServiceUserSchema = createServiceUserSchema;

const serviceUserReviewSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  address: z.string().trim().min(5).max(500),
  town: z.string().trim().min(2).max(120),
  county: z.string().trim().min(2).max(120),
  postcode: z.string().trim().min(5).max(12)
});

const createTasksSchema = z.object({
  serviceUserId: z.string().uuid(),
  note: z.string().min(10).max(5000),
  preferredWindowStart: z.string().datetime().optional().nullable(),
  preferredWindowEnd: z.string().datetime().optional().nullable(),
  carerOnSite: z.boolean().default(false),
  serviceUser: serviceUserReviewSchema,
  keysafeInfo: z.string().trim().max(64).optional().nullable(),
  suggestions: z.array(z.object({
    category: z.string().min(2).max(120),
    summary: z.string().min(5).max(500),
    urgency: z.enum(["low", "medium", "high", "urgent"])
  })).min(1).max(12)
});

const reverseAssignmentSchema = z.object({
  reason: z.string().trim().min(5).max(500)
});

export const coordinatorRouter = Router();
coordinatorRouter.use(requireRoles("care_coordinator", "care_manager"), requireAgency);

coordinatorRouter.get("/dashboard", async (req, res) => {
  const agencyId = req.auth!.agencyId!;
  const [counts, recent, agency] = await Promise.all([
    query<{ status: string; count: string }>(
      `SELECT status::text, count(*)::text
       FROM ops.tasks WHERE agency_id = $1 AND deleted_at IS NULL
       GROUP BY status`,
      [agencyId]
    ),
    query<CoordinatorTaskRow>(coordinatorTaskSql("LIMIT 6"), [agencyId]),
    query<{ name: string }>("SELECT name FROM tenant.agencies WHERE id = $1 AND deleted_at IS NULL", [agencyId])
  ]);
  const byStatus = Object.fromEntries(counts.rows.map((row) => [row.status, Number(row.count)]));
  res.json({
    agencyName: agency.rows[0]?.name || "Care organisation",
    metrics: {
      open: Object.entries(byStatus).filter(([status]) => !["completed", "cancelled"].includes(status)).reduce((sum, [, count]) => sum + count, 0),
      pendingAssignment: (byStatus.pending_taskbridge_assignment || 0) + (byStatus.assignment_review || 0) + (byStatus.failed_dispatch || 0),
      assigned: (byStatus.dispatched || 0) + (byStatus.visit_scheduled || 0) + (byStatus.checked_in || 0) + (byStatus.awaiting_evidence_review || 0),
      awaitingConfirmation: byStatus.awaiting_care_confirmation || 0,
      completed: byStatus.completed || 0
    },
    recentTasks: recent.rows.map(mapCoordinatorTask)
  });
});

coordinatorRouter.get("/service-users", async (req, res) => {
  const result = await query<ServiceUserRow>(
    `SELECT id::text, external_service_user_id, encrypted_name, encrypted_address,
            town_ciphertext, county_ciphertext, postcode_ciphertext, risk_level,
            vulnerability_notes_ciphertext, created_at::text
     FROM care.service_users
     WHERE agency_id = $1 AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    [req.auth!.agencyId]
  );
  res.json({
    serviceUsers: result.rows.map(mapServiceUser)
  });
});

coordinatorRouter.post("/service-users", async (req, res) => {
  const parsed = createServiceUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.issues[0]?.message || "Invalid service-user details" });
  const data = parsed.data;
  const reference = publicId("res");
  const normalizedPostcode = data.postcode.toUpperCase().replace(/\s+/g, "");
  const encryptedAddress = encryptField(data.address.trim());

  const created = await withTransaction(req.auth!, async (client) => {
    const result = await client.query<ServiceUserRow>(
      `INSERT INTO care.service_users
        (agency_id, external_service_user_id, encrypted_name, encrypted_address, postcode_hash,
         town_ciphertext, county_ciphertext, postcode_ciphertext, risk_level, vulnerability_notes_ciphertext)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id::text, external_service_user_id, encrypted_name, encrypted_address,
                 town_ciphertext, county_ciphertext, postcode_ciphertext, risk_level,
                 vulnerability_notes_ciphertext, created_at::text`,
      [req.auth!.agencyId, reference, encryptField(data.fullName), encryptedAddress,
        hashToken(normalizedPostcode), encryptField(data.town), encryptField(data.county),
        encryptField(data.postcode.toUpperCase()), data.riskLevel,
        data.vulnerabilityNotes ? encryptField(data.vulnerabilityNotes) : null]
    );
    return result.rows[0];
  });

  await audit(req, "care.service_user.created", "service_user", created.id, { riskLevel: created.risk_level });
  res.status(201).json({
    serviceUser: mapServiceUser(created)
  });
});

coordinatorRouter.patch("/service-users/:id", asyncHandler(async (req, res) => {
  const parsed = updateServiceUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.issues[0]?.message || "Invalid service-user details" });
  const data = parsed.data;
  const normalizedPostcode = data.postcode.toUpperCase().replace(/\s+/g, "");
  const result = await query<ServiceUserRow>(
    `UPDATE care.service_users
     SET encrypted_name = $1, encrypted_address = $2, town_ciphertext = $3,
         county_ciphertext = $4, postcode_ciphertext = $5, postcode_hash = $6,
         risk_level = $7, vulnerability_notes_ciphertext = $8, updated_at = clock_timestamp()
     WHERE id = $9 AND agency_id = $10 AND deleted_at IS NULL
     RETURNING id::text, external_service_user_id, encrypted_name, encrypted_address,
               town_ciphertext, county_ciphertext, postcode_ciphertext, risk_level,
               vulnerability_notes_ciphertext, created_at::text`,
    [encryptField(data.fullName), encryptField(data.address), encryptField(data.town), encryptField(data.county),
      encryptField(data.postcode.toUpperCase()), hashToken(normalizedPostcode), data.riskLevel,
      data.vulnerabilityNotes ? encryptField(data.vulnerabilityNotes) : null, req.params.id, req.auth!.agencyId]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Service user not found" });
  await audit(req, "care.service_user.updated", "service_user", result.rows[0].id, { riskLevel: data.riskLevel });
  res.json({ serviceUser: mapServiceUser(result.rows[0]) });
}));

coordinatorRouter.delete("/service-users/:id", asyncHandler(async (req, res) => {
  const result = await withTransaction(req.auth!, async (client) => {
    const serviceUser = await client.query<{ id: string }>(
      `SELECT id::text FROM care.service_users
       WHERE id = $1 AND agency_id = $2 AND deleted_at IS NULL FOR UPDATE`,
      [req.params.id, req.auth!.agencyId]
    );
    if (!serviceUser.rows[0]) return { status: 404, error: "Service user not found" } as const;
    const active = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM ops.tasks
       WHERE service_user_id = $1 AND deleted_at IS NULL AND status NOT IN ('completed', 'cancelled')`,
      [req.params.id]
    );
    if (Number(active.rows[0]?.count || 0) > 0) {
      return { status: 409, error: "This service user has active tasks and cannot be removed yet" } as const;
    }
    await client.query("UPDATE care.service_users SET deleted_at = clock_timestamp(), updated_at = clock_timestamp() WHERE id = $1", [req.params.id]);
    return { status: 200, id: serviceUser.rows[0].id } as const;
  });
  if ("error" in result) return res.status(result.status).json({ error: result.error });
  await audit(req, "care.service_user.deleted", "service_user", result.id);
  res.status(204).end();
}));

coordinatorRouter.get("/tasks", async (req, res) => {
  const result = await query<CoordinatorTaskRow>(coordinatorTaskSql(""), [req.auth!.agencyId]);
  res.json({ tasks: result.rows.map(mapCoordinatorTask) });
});

coordinatorRouter.get("/tasks/:publicId", asyncHandler(async (req, res) => {
  const taskResult = await query<{
    id: string;
    public_id: string;
    encrypted_address: string;
    town_ciphertext: string | null;
    county_ciphertext: string | null;
    postcode_ciphertext: string | null;
    latitude: string | null;
    longitude: string | null;
    keysafe_ciphertext: string | null;
  }>(
    `SELECT t.id::text, t.public_id, su.encrypted_address, su.town_ciphertext,
            su.county_ciphertext, su.postcode_ciphertext, su.latitude::text,
            su.longitude::text, t.keysafe_ciphertext
     FROM ops.tasks t
     JOIN care.service_users su ON su.id = t.service_user_id
     WHERE t.public_id = $1 AND t.agency_id = $2 AND t.deleted_at IS NULL`,
    [req.params.publicId, req.auth!.agencyId]
  );
  const task = taskResult.rows[0];
  if (!task) return res.status(404).json({ error: "Task not found" });
  const [events, evidence] = await Promise.all([
    query<{
      id: string;
      previous_status: string | null;
      new_status: string;
      reason: string | null;
      created_at: string;
      actor_name: string | null;
    }>(
      `SELECT e.id::text, e.previous_status::text, e.new_status::text, e.reason,
              e.created_at::text, u.full_name AS actor_name
       FROM ops.task_status_events e
       LEFT JOIN auth.users u ON u.id = e.changed_by_user_id
       WHERE e.task_id = $1 ORDER BY e.created_at ASC`,
      [task.id]
    ),
    query<{ evidence_type: string; file_url: string | null; created_at: string }>(
      `SELECT evidence_type, file_url, created_at::text FROM ops.visit_evidence
       WHERE task_id = $1 ORDER BY created_at ASC`,
      [task.id]
    )
  ]);
  res.json({
    detail: {
      id: task.public_id,
      serviceUserAddress: {
        address: decryptField(task.encrypted_address),
        town: decryptOptional(task.town_ciphertext),
        county: decryptOptional(task.county_ciphertext),
        postcode: decryptOptional(task.postcode_ciphertext)
      },
      location: {
        latitude: task.latitude === null ? null : Number(task.latitude),
        longitude: task.longitude === null ? null : Number(task.longitude)
      },
      keysafePasscode: decryptOptional(task.keysafe_ciphertext),
      timeline: events.rows.map((event) => ({
        id: event.id,
        previousStatus: event.previous_status,
        status: event.new_status,
        reason: event.reason,
        actor: event.actor_name || "TaskBridge system",
        createdAt: event.created_at
      })),
      evidence: evidence.rows.map((item) => ({
        type: item.evidence_type,
        url: item.file_url,
        createdAt: item.created_at
      }))
    }
  });
}));

coordinatorRouter.get("/notifications", asyncHandler(async (req, res) => {
  const result = await query<{
    id: string;
    public_id: string;
    category: string;
    encrypted_name: string;
    new_status: string;
    reason: string | null;
    created_at: string;
  }>(
    `SELECT e.id::text, t.public_id, t.category, su.encrypted_name,
            e.new_status::text, e.reason, e.created_at::text
     FROM ops.task_status_events e
     JOIN ops.tasks t ON t.id = e.task_id
     JOIN care.service_users su ON su.id = t.service_user_id
     WHERE e.agency_id = $1 AND t.deleted_at IS NULL
     ORDER BY e.created_at DESC LIMIT 80`,
    [req.auth!.agencyId]
  );
  res.json({
    notifications: result.rows.map((item) => ({
      id: item.id,
      taskId: item.public_id,
      title: notificationTitle(item.new_status),
      message: item.reason || `${item.category} for ${decryptField(item.encrypted_name)} is now ${item.new_status.replaceAll("_", " ")}.`,
      status: item.new_status,
      createdAt: item.created_at
    }))
  });
}));

coordinatorRouter.post("/task-plan", async (req, res) => {
  const parsed = planSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.issues[0]?.message || "Invalid task note" });
  const serviceUser = await query<Pick<ServiceUserRow, "id" | "encrypted_name" | "risk_level">>(
    `SELECT id::text, encrypted_name, risk_level FROM care.service_users
     WHERE id = $1 AND agency_id = $2 AND deleted_at IS NULL`,
    [parsed.data.serviceUserId, req.auth!.agencyId]
  );
  if (!serviceUser.rows[0]) return res.status(404).json({ error: "Service-user record not found" });
  const vulnerable = serviceUser.rows[0].risk_level !== "standard";
  const analysis = await analyzeCareNote(parsed.data.note, vulnerable);
  await audit(req, "care.task_plan.created", "service_user", parsed.data.serviceUserId, { count: analysis.suggestions.length });
  res.json({ ...analysis, vulnerableAdult: vulnerable });
});

coordinatorRouter.post("/tasks", async (req, res) => {
  const parsed = createTasksSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.issues[0]?.message || "Invalid task details" });
  const data = parsed.data;
  const serviceUser = await query<Pick<ServiceUserRow, "id" | "encrypted_name" | "risk_level">>(
    `SELECT id::text, encrypted_name, risk_level FROM care.service_users
     WHERE id = $1 AND agency_id = $2 AND deleted_at IS NULL`,
    [data.serviceUserId, req.auth!.agencyId]
  );
  if (!serviceUser.rows[0]) return res.status(404).json({ error: "Service-user record not found" });
  const vulnerable = serviceUser.rows[0].risk_level !== "standard";

  const created = await withTransaction(req.auth!, async (client) => {
    const normalizedPostcode = data.serviceUser.postcode.toUpperCase().replace(/\s+/g, "");
    await client.query(
      `UPDATE care.service_users
       SET encrypted_name = $1, encrypted_address = $2, town_ciphertext = $3,
           county_ciphertext = $4, postcode_ciphertext = $5, postcode_hash = $6,
           updated_at = clock_timestamp()
       WHERE id = $7 AND agency_id = $8 AND deleted_at IS NULL`,
      [encryptField(data.serviceUser.fullName), encryptField(data.serviceUser.address),
        encryptField(data.serviceUser.town), encryptField(data.serviceUser.county),
        encryptField(data.serviceUser.postcode.toUpperCase()), hashToken(normalizedPostcode),
        data.serviceUserId, req.auth!.agencyId]
    );
    const noteResult = await client.query<{ id: string }>(
      `INSERT INTO care.care_notes (agency_id, service_user_id, submitted_by_user_id, note_ciphertext, source)
       VALUES ($1, $2, $3, $4, 'portal') RETURNING id::text`,
      [req.auth!.agencyId, data.serviceUserId, req.auth!.userId, encryptField(data.note)]
    );
    const tasks: Array<{ id: string; publicId: string }> = [];
    for (const suggestion of data.suggestions) {
      const taskPublicId = publicId("tsk");
      const taskResult = await client.query<{ id: string }>(
        `INSERT INTO ops.tasks
          (public_id, agency_id, service_user_id, care_note_id, created_by_user_id, category, urgency,
           status, summary, notes_ciphertext, preferred_window_start, preferred_window_end, carer_on_site,
           vulnerable_adult, ring_fence_required, keysafe_ciphertext)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending_taskbridge_assignment', $8, $9, $10, $11, $12, $13, $13, $14)
         RETURNING id::text`,
        [taskPublicId, req.auth!.agencyId, data.serviceUserId, noteResult.rows[0].id, req.auth!.userId,
          suggestion.category, suggestion.urgency, suggestion.summary, encryptField(data.note),
          data.preferredWindowStart || null, data.preferredWindowEnd || null, data.carerOnSite, vulnerable,
          data.keysafeInfo ? encryptField(data.keysafeInfo) : null]
      );
      await client.query(
        `INSERT INTO ops.task_status_events
          (task_id, agency_id, previous_status, new_status, changed_by_user_id, reason)
         VALUES ($1, $2, 'awaiting_care_approval', 'pending_taskbridge_assignment', $3, 'Approved by care team')`,
        [taskResult.rows[0].id, req.auth!.agencyId, req.auth!.userId]
      );
      tasks.push({ id: taskResult.rows[0].id, publicId: taskPublicId });
    }
    return tasks;
  });
  await audit(req, "care.tasks.approved", "care_note", created[0]?.id || data.serviceUserId, { taskCount: created.length });
  res.status(201).json({ tasks: created.map((task) => ({ id: task.publicId, status: "pending_taskbridge_assignment" })) });
});

coordinatorRouter.post("/tasks/:publicId/confirm", async (req, res) => {
  const result = await withTransaction(req.auth!, async (client) => {
    const task = await client.query<{ id: string; status: string }>(
      `SELECT id::text, status::text FROM ops.tasks
       WHERE public_id = $1 AND agency_id = $2 AND deleted_at IS NULL FOR UPDATE`,
      [req.params.publicId, req.auth!.agencyId]
    );
    if (!task.rows[0]) return { status: 404, error: "Task not found" };
    if (task.rows[0].status !== "awaiting_care_confirmation") return { status: 409, error: "Task is not awaiting care confirmation" };
    await client.query(
      `UPDATE ops.tasks SET status = 'completed', completed_at = clock_timestamp() WHERE id = $1`,
      [task.rows[0].id]
    );
    await client.query(
      `UPDATE ops.visits SET status = 'confirmed', confirmed_by_user_id = $1, confirmed_at = clock_timestamp()
       WHERE task_id = $2`,
      [req.auth!.userId, task.rows[0].id]
    );
    await client.query(
      `INSERT INTO ops.task_status_events
        (task_id, agency_id, previous_status, new_status, changed_by_user_id, reason)
       VALUES ($1, $2, 'awaiting_care_confirmation', 'completed', $3, 'Completion confirmed by care team')`,
      [task.rows[0].id, req.auth!.agencyId, req.auth!.userId]
    );
    const log = await client.query<{ id: string }>(
      `INSERT INTO integration.webhook_logs
        (agency_id, direction, endpoint, event_type, idempotency_key, status, request_metadata)
       VALUES ($1, 'outbound', 'agency_completion_callback', 'task.completed', $2, 'received', $3)
       ON CONFLICT (agency_id, direction, idempotency_key) DO UPDATE SET status = EXCLUDED.status
       RETURNING id::text`,
      [req.auth!.agencyId, `task-completed:${task.rows[0].id}`, { taskId: req.params.publicId }]
    );
    await client.query(
      `INSERT INTO integration.retry_queue (webhook_log_id, job_type, payload)
       VALUES ($1, 'care_completion_callback', $2)`,
      [log.rows[0].id, { taskId: req.params.publicId }]
    );
    return { status: 200, taskId: task.rows[0].id };
  });
  if ("error" in result) return res.status(result.status).json({ error: result.error });
  await audit(req, "care.task.completed", "task", result.taskId);
  res.json({ id: req.params.publicId, status: "completed" });
});

coordinatorRouter.post("/tasks/:publicId/reverse-assignment", asyncHandler(async (req, res) => {
  const parsed = reverseAssignmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.issues[0]?.message || "Record a reason for reassignment" });

  const reversed = await withTransaction(req.auth!, async (client) => {
    const task = await client.query<{ id: string; agency_id: string; status: string }>(
      `SELECT id::text, agency_id::text, status::text FROM ops.tasks
       WHERE public_id = $1 AND agency_id = $2 AND deleted_at IS NULL FOR UPDATE`,
      [req.params.publicId, req.auth!.agencyId]
    );
    if (!task.rows[0]) return { status: 404, error: "Task not found" } as const;
    if (!["dispatched", "visit_scheduled"].includes(task.rows[0].status)) {
      return { status: 409, error: "This assignment can no longer be reversed because the visit has started or finished" } as const;
    }
    const assignment = await client.query<{ id: string; provider_booking_id: string | null }>(
      `SELECT id::text, provider_booking_id FROM ops.assignments
       WHERE task_id = $1 AND status IN ('approved', 'dispatched')
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [task.rows[0].id]
    );
    if (!assignment.rows[0]) return { status: 409, error: "Active assignment was not found" } as const;
    const visit = await client.query<{ id: string; status: string }>(
      `SELECT id::text, status::text FROM ops.visits
       WHERE assignment_id = $1 ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [assignment.rows[0].id]
    );
    if (visit.rows[0] && !["pending", "link_sent"].includes(visit.rows[0].status)) {
      return { status: 409, error: "The handyman has already started this visit; contact TaskBridge operations" } as const;
    }

    await client.query("UPDATE ops.assignments SET status = 'rejected' WHERE id = $1", [assignment.rows[0].id]);
    if (visit.rows[0]) {
      await client.query("UPDATE ops.visits SET status = 'cancelled' WHERE id = $1", [visit.rows[0].id]);
      await client.query(
        "UPDATE ops.visit_tokens SET revoked_at = clock_timestamp() WHERE visit_id = $1 AND revoked_at IS NULL",
        [visit.rows[0].id]
      );
    }
    await client.query("DELETE FROM ops.assignment_candidates WHERE task_id = $1", [task.rows[0].id]);
    await client.query("UPDATE ops.tasks SET status = 'pending_taskbridge_assignment' WHERE id = $1", [task.rows[0].id]);
    await client.query(
      `INSERT INTO ops.task_status_events
        (task_id, agency_id, previous_status, new_status, changed_by_user_id, reason, metadata)
       VALUES ($1, $2, $3, 'pending_taskbridge_assignment', $4, $5, $6)`,
      [task.rows[0].id, task.rows[0].agency_id, task.rows[0].status, req.auth!.userId,
        `Care team requested reassignment: ${parsed.data.reason}`, { assignmentId: assignment.rows[0].id }]
    );
    return {
      status: 200,
      taskId: task.rows[0].id,
      agencyId: task.rows[0].agency_id,
      assignmentId: assignment.rows[0].id,
      providerBookingId: assignment.rows[0].provider_booking_id
    } as const;
  });
  if ("error" in reversed) return res.status(reversed.status).json({ error: reversed.error });

  let providerCancellationStatus = "not_configured";
  try {
    const providerResult = await cancelHandymanNetworkBooking({
      taskId: req.params.publicId,
      assignmentId: reversed.assignmentId,
      providerBookingId: reversed.providerBookingId,
      reason: parsed.data.reason
    });
    providerCancellationStatus = String(providerResult.status || "accepted");
  } catch {
    providerCancellationStatus = "retrying";
    const log = await query<{ id: string }>(
      `INSERT INTO integration.webhook_logs
        (agency_id, direction, endpoint, event_type, idempotency_key, status, request_metadata)
       VALUES ($1, 'outbound', 'handyman_network_cancellation', 'assignment.cancelled', $2, 'failed', $3)
       ON CONFLICT (agency_id, direction, idempotency_key) DO UPDATE SET status = 'failed'
       RETURNING id::text`,
      [reversed.agencyId, `assignment-cancelled:${reversed.assignmentId}`, {
        taskId: req.params.publicId,
        assignmentId: reversed.assignmentId,
        providerBookingId: reversed.providerBookingId
      }]
    );
    await query(
      `INSERT INTO integration.retry_queue (webhook_log_id, job_type, payload)
       VALUES ($1, 'handyman_assignment_cancellation', $2)`,
      [log.rows[0].id, {
        taskId: req.params.publicId,
        assignmentId: reversed.assignmentId,
        providerBookingId: reversed.providerBookingId,
        reason: parsed.data.reason
      }]
    );
  }
  await audit(req, "care.assignment.reversed", "task", reversed.taskId, {
    assignmentId: reversed.assignmentId,
    providerCancellationStatus,
    reason: parsed.data.reason
  });
  res.json({
    id: req.params.publicId,
    status: "pending_taskbridge_assignment",
    providerCancellationStatus
  });
}));

function coordinatorTaskSql(suffix: string) {
  return `SELECT t.public_id, su.encrypted_name, t.category, t.urgency::text, t.status::text,
                 t.summary, t.notes_ciphertext, t.vulnerable_adult, t.ring_fence_required,
                 t.carer_on_site, t.preferred_window_start::text, t.preferred_window_end::text,
                 t.created_at::text, tr.display_name AS assigned_display_name, n.name AS assigned_network,
                 a.scheduled_start::text, a.scheduled_end::text, t.before_photo_url,
                 t.after_photo_url, v.completion_notes
          FROM ops.tasks t
          JOIN care.service_users su ON su.id = t.service_user_id
          LEFT JOIN LATERAL (
            SELECT * FROM ops.assignments aa
            WHERE aa.task_id = t.id AND aa.status IN ('approved', 'dispatched')
            ORDER BY aa.created_at DESC LIMIT 1
          ) a ON true
          LEFT JOIN trader.traders tr ON tr.id = a.trader_id
          LEFT JOIN trader.networks n ON n.id = tr.network_id
          LEFT JOIN LATERAL (
            SELECT completion_notes FROM ops.visits vv WHERE vv.task_id = t.id ORDER BY vv.created_at DESC LIMIT 1
          ) v ON true
          WHERE t.agency_id = $1 AND t.deleted_at IS NULL
          ORDER BY t.created_at DESC ${suffix}`;
}

function mapCoordinatorTask(row: CoordinatorTaskRow) {
  const residentName = decryptField(row.encrypted_name);
  return {
    id: row.public_id,
    resident: { displayName: residentName, initials: safeInitials(residentName) },
    category: row.category,
    urgency: row.urgency,
    status: row.status,
    summary: row.summary,
    note: decryptField(row.notes_ciphertext),
    vulnerableAdult: row.vulnerable_adult,
    ringFenceRequired: row.ring_fence_required,
    carerOnSite: row.carer_on_site,
    preferredWindow: { start: row.preferred_window_start, end: row.preferred_window_end },
    createdAt: row.created_at,
    assignedHandyman: row.assigned_display_name ? {
      displayName: row.assigned_display_name,
      network: row.assigned_network,
      scheduledStart: row.scheduled_start,
      scheduledEnd: row.scheduled_end
    } : null,
    completion: row.before_photo_url || row.after_photo_url || row.completion_notes ? {
      beforePhotoUrl: row.before_photo_url,
      afterPhotoUrl: row.after_photo_url,
      notes: row.completion_notes
    } : null
  };
}

function mapServiceUser(row: ServiceUserRow) {
  return {
    id: row.id,
    reference: row.external_service_user_id,
    name: decryptField(row.encrypted_name),
    address: decryptField(row.encrypted_address),
    town: decryptOptional(row.town_ciphertext),
    county: decryptOptional(row.county_ciphertext),
    postcode: decryptOptional(row.postcode_ciphertext),
    riskLevel: row.risk_level,
    vulnerabilityNotes: decryptOptional(row.vulnerability_notes_ciphertext),
    createdAt: row.created_at
  };
}

function decryptOptional(value: string | null) {
  return value ? decryptField(value) : "";
}

function notificationTitle(status: string) {
  const titles: Record<string, string> = {
    pending_taskbridge_assignment: "Task approved for assignment",
    assignment_review: "Assignment review started",
    dispatched: "Handyman assigned",
    visit_scheduled: "Visit scheduled",
    checked_in: "Handyman checked in",
    awaiting_evidence_review: "Visit evidence submitted",
    awaiting_care_confirmation: "Completion needs confirmation",
    completed: "Task completed",
    failed_dispatch: "Assignment needs attention",
    cancelled: "Task cancelled"
  };
  return titles[status] || "Task status updated";
}
