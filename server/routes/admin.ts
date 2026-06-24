import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../async-handler.js";
import { audit } from "../audit.js";
import { requireRoles } from "../auth.js";
import { config } from "../config.js";
import { query, withTransaction } from "../db.js";
import { dispatchToHandymanNetwork, sendHandymanOnboardingInvite, sendSecureVisitLink, startDbsVerification } from "../integrations.js";
import { evaluateTrader, type MatchableTask, type MatchableTrader } from "../matching.js";
import { createOpaqueToken, decryptField, encryptField, hashToken, isWorkEmail, publicId, safeInitials, slugify } from "../security.js";

interface CandidateTaskRow {
  id: string;
  public_id: string;
  agency_id: string;
  category: string;
  vulnerable_adult: boolean;
  status: string;
  summary: string;
  latitude: string | null;
  longitude: string | null;
  radius_miles: string;
  preferred_window_start: string | null;
  preferred_window_end: string | null;
}

interface CandidateTraderRow {
  id: string;
  display_name: string;
  encrypted_mobile: string;
  status: string;
  services: string[];
  dbs_status: string;
  dbs_expiry_date: string | null;
  insurance_status: string;
  insurance_expiry_date: string | null;
  latitude: string;
  longitude: string;
  hourly_rate: string;
  quality_score: string;
  available: boolean;
  network_name: string | null;
  external_trader_id: string | null;
}

interface EvaluatedCandidate {
  trader: CandidateTraderRow;
  evaluation: ReturnType<typeof evaluateTrader>;
}

const dispatchSchema = z.object({ traderId: z.string().uuid() });
const dbsReviewSchema = z.object({
  status: z.enum(["approved", "rejected", "unclear"]),
  expiryDate: z.string().date().nullable().optional(),
  evidenceReference: z.string().max(200).optional(),
  reason: z.string().min(5).max(500)
});
const createAgencySchema = z.object({
  name: z.string().min(2).max(160),
  primaryContactName: z.string().min(2).max(120),
  primaryContactEmail: z.string().email(),
  workEmailDomain: z.string().min(3).max(200)
});
const createHandymanInvitationSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(200)
});

export const adminRouter = Router();
adminRouter.use(requireRoles("taskbridge_admin", "taskbridge_super_admin"));

adminRouter.get("/dashboard", async (_req, res) => {
  const [taskCounts, traderCounts, integrationFailures] = await Promise.all([
    query<{ status: string; count: string }>("SELECT status::text, count(*)::text FROM ops.tasks WHERE deleted_at IS NULL GROUP BY status"),
    query<{ dbs_status: string; count: string }>(
      `SELECT COALESCE(d.status::text, 'not_started') AS dbs_status, count(*)::text
       FROM trader.traders t
       LEFT JOIN LATERAL (
         SELECT status FROM trader.dbs_verifications dv WHERE dv.trader_id = t.id ORDER BY dv.created_at DESC LIMIT 1
       ) d ON true
       WHERE t.deleted_at IS NULL GROUP BY d.status`
    ),
    query<{ count: string }>("SELECT count(*)::text FROM integration.webhook_logs WHERE status IN ('failed', 'retrying')")
  ]);
  res.json({
    tasks: Object.fromEntries(taskCounts.rows.map((row) => [row.status, Number(row.count)])),
    traders: Object.fromEntries(traderCounts.rows.map((row) => [row.dbs_status, Number(row.count)])),
    integrationFailures: Number(integrationFailures.rows[0]?.count || 0)
  });
});

adminRouter.get("/tasks", async (_req, res) => {
  const result = await query<{
    public_id: string; agency_name: string; encrypted_name: string; category: string; urgency: string;
    status: string; summary: string; vulnerable_adult: boolean; ring_fence_required: boolean; created_at: string;
    assigned_display_name: string | null;
  }>(
    `SELECT t.public_id, ag.name AS agency_name, su.encrypted_name, t.category, t.urgency::text,
            t.status::text, t.summary, t.vulnerable_adult, t.ring_fence_required, t.created_at::text,
            tr.display_name AS assigned_display_name
     FROM ops.tasks t
     JOIN tenant.agencies ag ON ag.id = t.agency_id
     JOIN care.service_users su ON su.id = t.service_user_id
     LEFT JOIN LATERAL (
       SELECT trader_id FROM ops.assignments aa WHERE aa.task_id = t.id ORDER BY aa.created_at DESC LIMIT 1
     ) a ON true
     LEFT JOIN trader.traders tr ON tr.id = a.trader_id
     WHERE t.deleted_at IS NULL
     ORDER BY t.created_at DESC`
  );
  res.json({ tasks: result.rows.map((row) => {
    const name = decryptField(row.encrypted_name);
    return {
      id: row.public_id,
      agencyName: row.agency_name,
      residentInitials: safeInitials(name),
      category: row.category,
      urgency: row.urgency,
      status: row.status,
      summary: row.summary,
      vulnerableAdult: row.vulnerable_adult,
      ringFenceRequired: row.ring_fence_required,
      assignedHandyman: row.assigned_display_name,
      createdAt: row.created_at
    };
  }) });
});

adminRouter.get("/tasks/:publicId/candidates", async (req, res) => {
  const candidates = await evaluateCandidates(req.params.publicId);
  if (!candidates) return res.status(404).json({ error: "Task not found" });
  await persistCandidates(candidates.task, candidates.evaluated);
  res.json({
    task: { id: candidates.task.public_id, category: candidates.task.category, vulnerableAdult: candidates.task.vulnerable_adult },
    candidates: candidates.evaluated.map(({ trader, evaluation }) => ({
      id: trader.id,
      displayName: trader.display_name,
      network: trader.network_name,
      hourlyRate: Number(trader.hourly_rate),
      qualityScore: Number(trader.quality_score),
      dbsStatus: trader.dbs_status,
      dbsExpiryDate: trader.dbs_expiry_date,
      insuranceStatus: trader.insurance_status,
      eligible: evaluation.eligible,
      reasons: evaluation.reasons,
      distanceMiles: evaluation.distanceMiles,
      score: evaluation.score
    }))
  });
});

adminRouter.post("/tasks/:publicId/dispatch", async (req, res) => {
  const parsed = dispatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: "Select a valid handyman" });
  const candidates = await evaluateCandidates(req.params.publicId);
  if (!candidates) return res.status(404).json({ error: "Task not found" });
  const selected = candidates.evaluated.find((candidate) => candidate.trader.id === parsed.data.traderId);
  if (!selected) return res.status(404).json({ error: "Handyman not found in the eligible pool" });
  if (!selected.evaluation.eligible) return res.status(409).json({ error: selected.evaluation.reasons.join("; ") });

  const rawVisitToken = createOpaqueToken(36);
  const visitPath = `/visit/${rawVisitToken}`;
  const dispatchReceipt = await dispatchToHandymanNetwork({
    taskId: candidates.task.public_id,
    category: candidates.task.category,
    taskSummary: candidates.task.summary,
    selectedTraderId: selected.trader.external_trader_id || selected.trader.id,
    requiredSafeguards: candidates.task.vulnerable_adult ? ["enhanced_dbs", "verified_insurance"] : ["verified_insurance"],
    visitUrl: `${config.appOrigin}${visitPath}`
  });

  const created = await withTransaction(req.auth!, async (client) => {
    const locked = await client.query<{ id: string; agency_id: string; status: string }>(
      `SELECT id::text, agency_id::text, status::text FROM ops.tasks
       WHERE public_id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [req.params.publicId]
    );
    const task = locked.rows[0];
    if (!task) throw Object.assign(new Error("Task not found"), { statusCode: 404 });
    if (!["pending_taskbridge_assignment", "assignment_review"].includes(task.status)) {
      throw Object.assign(new Error("Task is no longer available for assignment"), { statusCode: 409 });
    }
    const assignment = await client.query<{ id: string }>(
      `INSERT INTO ops.assignments
        (task_id, agency_id, trader_id, status, selected_by_user_id, provider_booking_id,
         distance_miles, quoted_price, scheduled_start, scheduled_end, dispatched_at)
       VALUES ($1, $2, $3, 'dispatched', $4, $5, $6, $7, $8, $9, clock_timestamp())
       RETURNING id::text`,
      [task.id, task.agency_id, selected.trader.id, req.auth!.userId,
        String(dispatchReceipt.providerBookingId || ""), selected.evaluation.distanceMiles,
        Number(selected.trader.hourly_rate), candidates.task.preferred_window_start, candidates.task.preferred_window_end]
    );
    const visit = await client.query<{ id: string }>(
      `INSERT INTO ops.visits (task_id, agency_id, assignment_id, trader_id, status)
       VALUES ($1, $2, $3, $4, 'link_sent') RETURNING id::text`,
      [task.id, task.agency_id, assignment.rows[0].id, selected.trader.id]
    );
    await client.query(
      `INSERT INTO ops.visit_tokens (visit_id, task_id, token_hash, expires_at)
       VALUES ($1, $2, $3, clock_timestamp() + interval '48 hours')`,
      [visit.rows[0].id, task.id, hashToken(rawVisitToken)]
    );
    await client.query("UPDATE ops.tasks SET status = 'dispatched' WHERE id = $1", [task.id]);
    await client.query(
      `INSERT INTO ops.task_status_events
        (task_id, agency_id, previous_status, new_status, changed_by_user_id, reason, metadata)
       VALUES ($1, $2, $3, 'dispatched', $4, 'Handyman approved and released by TaskBridge admin', $5)`,
      [task.id, task.agency_id, task.status, req.auth!.userId, { traderId: selected.trader.id }]
    );
    return { taskId: task.id, visitId: visit.rows[0].id };
  });

  const smsResult = await sendSecureVisitLink({
    mobile: decryptField(selected.trader.encrypted_mobile),
    visitUrl: `${config.appOrigin}${visitPath}`,
    scheduledWindow: {
      start: candidates.task.preferred_window_start,
      end: candidates.task.preferred_window_end
    }
  });
  await audit(req, "admin.task.dispatched", "task", created.taskId, { traderId: selected.trader.id, smsStatus: smsResult.status });
  res.json({ id: req.params.publicId, status: "dispatched", visitUrl: `${config.appOrigin}${visitPath}`, smsStatus: smsResult.status });
});

adminRouter.get("/traders", async (_req, res) => {
  const result = await query<{
    id: string; display_name: string; email: string | null; network_name: string | null; hourly_rate: string;
    quality_score: string; status: string; dbs_status: string; dbs_expiry_date: string | null;
    insurance_status: string; insurance_expiry_date: string | null; services: string[];
    onboarding_status: string | null; invitation_expires_at: string | null; email_delivery_status: string | null;
  }>(
    `SELECT t.id::text, t.display_name, t.email::text, n.name AS network_name, t.hourly_rate::text, t.quality_score::text,
            t.status::text, COALESCE(d.status::text, 'not_started') AS dbs_status, d.expiry_date::text AS dbs_expiry_date,
            COALESCE(i.status::text, 'unverified') AS insurance_status, i.expiry_date::text AS insurance_expiry_date,
            COALESCE(s.services, '{}') AS services, invite.status AS onboarding_status,
            invite.expires_at::text AS invitation_expires_at, invite.email_delivery_status
     FROM trader.traders t
     LEFT JOIN trader.networks n ON n.id = t.network_id
     LEFT JOIN LATERAL (
       SELECT status, expiry_date FROM trader.dbs_verifications dv WHERE dv.trader_id = t.id ORDER BY dv.created_at DESC LIMIT 1
     ) d ON true
     LEFT JOIN LATERAL (
       SELECT status, expiry_date FROM trader.insurance_records ir WHERE ir.trader_id = t.id ORDER BY ir.created_at DESC LIMIT 1
     ) i ON true
     LEFT JOIN LATERAL (
       SELECT array_agg(service_category ORDER BY service_category) AS services
       FROM trader.trader_services ts WHERE ts.trader_id = t.id AND ts.active
     ) s ON true
     LEFT JOIN LATERAL (
       SELECT status, expires_at, email_delivery_status FROM trader.onboarding_invitations oi
       WHERE oi.trader_id = t.id ORDER BY oi.created_at DESC LIMIT 1
     ) invite ON true
     WHERE t.deleted_at IS NULL ORDER BY t.display_name`
  );
  res.json({ traders: result.rows.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    network: row.network_name,
    hourlyRate: Number(row.hourly_rate),
    qualityScore: Number(row.quality_score),
    status: row.status,
    dbsStatus: row.dbs_status,
    dbsExpiryDate: row.dbs_expiry_date,
    insuranceStatus: row.insurance_status,
    insuranceExpiryDate: row.insurance_expiry_date,
    onboardingStatus: row.onboarding_status || "not_invited",
    invitationExpiresAt: row.invitation_expires_at,
    emailDeliveryStatus: row.email_delivery_status,
    services: row.services
  })) });
});

adminRouter.post("/traders/invitations", requireRoles("taskbridge_super_admin"), asyncHandler(async (req, res) => {
  const parsed = createHandymanInvitationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.issues[0]?.message || "Invalid handyman details" });
  const data = parsed.data;
  const email = data.email.toLowerCase();
  const rawToken = createOpaqueToken(36);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const created = await withTransaction(req.auth!, async (client) => {
    const existing = await client.query("SELECT 1 FROM trader.traders WHERE lower(email::text) = $1 AND deleted_at IS NULL", [email]);
    if (existing.rowCount) throw Object.assign(new Error("A handyman record already exists for this email"), { statusCode: 409 });
    const trader = await client.query<{ id: string }>(
      `INSERT INTO trader.traders
        (external_trader_id, display_name, encrypted_full_name, encrypted_mobile, email, status)
       VALUES ($1, $2, $3, $4, $5, 'inactive') RETURNING id::text`,
      [publicId("direct"), data.fullName, encryptField(data.fullName), encryptField(""), email]
    );
    const invitation = await client.query<{ id: string }>(
      `INSERT INTO trader.onboarding_invitations
        (trader_id, email, token_hash, created_by_user_id, expires_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING id::text`,
      [trader.rows[0].id, email, hashToken(rawToken), req.auth!.userId, expiresAt]
    );
    return { traderId: trader.rows[0].id, invitationId: invitation.rows[0].id };
  });

  const invitationUrl = `${config.appOrigin}/handyman-onboarding/${rawToken}`;
  const delivery = await sendHandymanOnboardingInvite({
    email,
    fullName: data.fullName,
    invitationUrl,
    expiresAt: expiresAt.toISOString()
  });
  await query(
    `UPDATE trader.onboarding_invitations
     SET email_delivery_status = $2, provider_message_id = $3,
         sent_at = CASE WHEN $2 = 'sent' THEN clock_timestamp() ELSE sent_at END
     WHERE id = $1`,
    [created.invitationId, delivery.status, delivery.providerMessageId]
  );
  await audit(req, "super_admin.handyman.invited", "trader", created.traderId, {
    invitationId: created.invitationId,
    emailDeliveryStatus: delivery.status
  });
  res.status(201).json({
    traderId: created.traderId,
    invitationUrl,
    expiresAt: expiresAt.toISOString(),
    emailDeliveryStatus: delivery.status
  });
}));

adminRouter.delete("/traders/:id/invitation", requireRoles("taskbridge_super_admin"), asyncHandler(async (req, res) => {
  const result = await withTransaction(req.auth!, async (client) => {
    const invitation = await client.query<{ id: string; status: string }>(
      `SELECT id::text, status FROM trader.onboarding_invitations
       WHERE trader_id = $1 ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [req.params.id]
    );
    if (!invitation.rows[0]) return { status: 404, error: "Handyman invitation not found" };
    if (invitation.rows[0].status !== "pending") return { status: 409, error: "Only a pending invitation can be revoked" };
    await client.query(
      `UPDATE trader.onboarding_invitations
       SET status = 'revoked', revoked_at = clock_timestamp() WHERE id = $1`,
      [invitation.rows[0].id]
    );
    await client.query("UPDATE trader.traders SET deleted_at = clock_timestamp() WHERE id = $1 AND status = 'inactive'", [req.params.id]);
    return { status: 204, invitationId: invitation.rows[0].id };
  });
  if ("error" in result) return res.status(result.status).json({ error: result.error });
  await audit(req, "super_admin.handyman.invitation_revoked", "trader", req.params.id, { invitationId: result.invitationId });
  res.status(204).end();
}));

adminRouter.post("/traders/:id/dbs-check", async (req, res) => {
  const trader = await query<{ id: string; encrypted_full_name: string; encrypted_mobile: string }>(
    "SELECT id::text, encrypted_full_name, encrypted_mobile FROM trader.traders WHERE id = $1 AND deleted_at IS NULL",
    [req.params.id]
  );
  if (!trader.rows[0]) return res.status(404).json({ error: "Handyman not found" });
  const provider = await startDbsVerification({
    handymanId: trader.rows[0].id,
    fullName: decryptField(trader.rows[0].encrypted_full_name),
    mobile: decryptField(trader.rows[0].encrypted_mobile),
    checkType: "enhanced_dbs",
    callbackUrl: `${config.appOrigin}/api/webhooks/dbs-callback`
  });
  const providerSessionId = String(provider.providerSessionId || provider.id || "");
  if (!providerSessionId) return res.status(502).json({ error: "DBS provider did not return a session identifier" });
  await query(
    `INSERT INTO trader.dbs_verifications (trader_id, provider_session_id, status)
     VALUES ($1, $2, 'pending')`,
    [trader.rows[0].id, providerSessionId]
  );
  await audit(req, "admin.dbs.started", "trader", trader.rows[0].id);
  res.status(201).json({ traderId: trader.rows[0].id, status: "pending" });
});

adminRouter.post("/traders/:id/dbs-review", requireRoles("taskbridge_super_admin"), async (req, res) => {
  const parsed = dbsReviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.issues[0]?.message || "Invalid DBS review" });
  const result = await query<{ id: string }>(
    `INSERT INTO trader.dbs_verifications
      (trader_id, status, outcome, expiry_date, evidence_reference, checked_at)
     SELECT id, $2, $3, $4, $5, clock_timestamp() FROM trader.traders
     WHERE id = $1 AND deleted_at IS NULL RETURNING id::text`,
    [req.params.id, parsed.data.status, parsed.data.reason, parsed.data.expiryDate || null, parsed.data.evidenceReference || null]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Handyman not found" });
  await audit(req, "super_admin.dbs.reviewed", "trader", req.params.id, { status: parsed.data.status, reason: parsed.data.reason });
  res.json({ traderId: req.params.id, status: parsed.data.status });
});

adminRouter.get("/agencies", requireRoles("taskbridge_super_admin"), asyncHandler(async (_req, res) => {
  const result = await query(
    `SELECT a.id::text, a.public_id, a.name, a.slug, a.primary_contact_name, a.primary_contact_email::text,
            a.work_email_domain::text, a.status::text, a.created_at::text,
            COALESCE(workorders.active_workorders, 0)::text AS active_workorders,
            api_key.key_prefix, api_key.key_length, api_key.created_at::text AS api_key_created_at
     FROM tenant.agencies a
     LEFT JOIN LATERAL (
       SELECT count(*) AS active_workorders FROM ops.tasks t
       WHERE t.agency_id = a.id AND t.deleted_at IS NULL AND t.status NOT IN ('completed', 'cancelled')
     ) workorders ON true
     LEFT JOIN LATERAL (
       SELECT k.key_prefix, k.key_length, k.created_at FROM tenant.agency_api_keys k
       WHERE k.agency_id = a.id AND k.revoked_at IS NULL
         AND (k.expires_at IS NULL OR k.expires_at > clock_timestamp())
       ORDER BY k.created_at DESC LIMIT 1
     ) api_key ON true
     WHERE a.deleted_at IS NULL ORDER BY a.name`
  );
  res.json({ agencies: result.rows.map((row: Record<string, unknown>) => ({
    ...row,
    activeWorkorders: Number(row.active_workorders || 0),
    secretApiKey: row.key_prefix ? {
      masked: `${row.key_prefix}${"•".repeat(12)}`,
      length: Number(row.key_length || 0),
      encryptionRepresentation: "SHA-256 hash · non-recoverable",
      issuedAt: row.api_key_created_at
    } : null
  })) });
}));

adminRouter.post("/agencies", requireRoles("taskbridge_super_admin"), async (req, res) => {
  const parsed = createAgencySchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.issues[0]?.message || "Invalid agency" });
  const data = parsed.data;
  if (!isWorkEmail(data.primaryContactEmail)) return res.status(422).json({ error: "Primary contact must use a work email address" });
  const rawApiKey = `tb_live_${createOpaqueToken(32)}`;
  const result = await withTransaction(req.auth!, async (client) => {
    const agency = await client.query<{ id: string; public_id: string }>(
      `INSERT INTO tenant.agencies
        (public_id, name, slug, primary_contact_name, primary_contact_email, work_email_domain, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'onboarding') RETURNING id::text, public_id`,
      [publicId("agc"), data.name, `${slugify(data.name)}-${Date.now().toString(36)}`, data.primaryContactName,
        data.primaryContactEmail.toLowerCase(), data.workEmailDomain.toLowerCase()]
    );
    await client.query("INSERT INTO tenant.agency_settings (agency_id) VALUES ($1)", [agency.rows[0].id]);
    await client.query(
      `INSERT INTO tenant.agency_api_keys
        (agency_id, name, key_prefix, key_hash, key_length, scopes)
       VALUES ($1, 'Primary integration key', $2, $3, $4, ARRAY['tasks:write']::text[])`,
      [agency.rows[0].id, rawApiKey.slice(0, 16), hashToken(rawApiKey), rawApiKey.length]
    );
    return agency.rows[0];
  });
  await audit(req, "super_admin.agency.created", "agency", result.id);
  res.status(201).json({ id: result.public_id, status: "onboarding", apiKey: rawApiKey });
});

adminRouter.get("/audit", requireRoles("taskbridge_super_admin"), async (_req, res) => {
  const result = await query(
    `SELECT a.id::text, a.action, a.entity_type, a.entity_id, a.created_at::text,
            u.full_name AS actor_name, ag.name AS agency_name, a.metadata
     FROM audit.audit_logs a
     LEFT JOIN auth.users u ON u.id = a.actor_user_id
     LEFT JOIN tenant.agencies ag ON ag.id = a.agency_id
     ORDER BY a.created_at DESC LIMIT 200`
  );
  res.json({ events: result.rows });
});

async function evaluateCandidates(publicTaskId: string) {
  const taskResult = await query<CandidateTaskRow>(
    `SELECT t.id::text, t.public_id, t.agency_id::text, t.category, t.vulnerable_adult,
            t.status::text, t.summary, su.latitude::text, su.longitude::text,
            settings.default_visit_radius_miles::text AS radius_miles,
            t.preferred_window_start::text, t.preferred_window_end::text
     FROM ops.tasks t
     JOIN care.service_users su ON su.id = t.service_user_id
     JOIN tenant.agency_settings settings ON settings.agency_id = t.agency_id
     WHERE t.public_id = $1 AND t.deleted_at IS NULL`,
    [publicTaskId]
  );
  const task = taskResult.rows[0];
  if (!task) return null;
  if (task.latitude === null || task.longitude === null) {
    throw Object.assign(new Error("Resident coordinates are required before matching"), { statusCode: 409 });
  }
  const traderResult = await query<CandidateTraderRow>(
    `SELECT t.id::text, t.display_name, t.encrypted_mobile, t.status::text,
            COALESCE(services.services, '{}') AS services,
            COALESCE(dbs.status::text, 'not_started') AS dbs_status, dbs.expiry_date::text AS dbs_expiry_date,
            COALESCE(ins.status::text, 'unverified') AS insurance_status, ins.expiry_date::text AS insurance_expiry_date,
            t.latitude::text, t.longitude::text, COALESCE(t.hourly_rate, 0)::text AS hourly_rate,
            t.quality_score::text, availability.available, n.name AS network_name, t.external_trader_id
     FROM trader.traders t
     LEFT JOIN trader.networks n ON n.id = t.network_id
     LEFT JOIN LATERAL (
       SELECT array_agg(service_category) AS services FROM trader.trader_services s
       WHERE s.trader_id = t.id AND s.active
     ) services ON true
     LEFT JOIN LATERAL (
       SELECT status, expiry_date FROM trader.dbs_verifications d
       WHERE d.trader_id = t.id ORDER BY d.created_at DESC LIMIT 1
     ) dbs ON true
     LEFT JOIN LATERAL (
       SELECT status, expiry_date FROM trader.insurance_records i
       WHERE i.trader_id = t.id ORDER BY i.created_at DESC LIMIT 1
     ) ins ON true
     LEFT JOIN LATERAL (
       SELECT CASE
         WHEN $1::timestamptz IS NULL THEN true
         ELSE EXISTS (
           SELECT 1 FROM trader.trader_availability av
           WHERE av.trader_id = t.id AND NOT av.reserved
             AND av.available_from <= COALESCE($2::timestamptz, $1::timestamptz)
             AND av.available_to >= $1::timestamptz
         ) END AS available
     ) availability ON true
     WHERE t.deleted_at IS NULL AND t.latitude IS NOT NULL AND t.longitude IS NOT NULL`,
    [task.preferred_window_start, task.preferred_window_end]
  );
  const matchTask: MatchableTask = {
    category: task.category,
    vulnerableAdult: task.vulnerable_adult,
    latitude: Number(task.latitude),
    longitude: Number(task.longitude),
    radiusMiles: Number(task.radius_miles)
  };
  const evaluated: EvaluatedCandidate[] = traderResult.rows.map((trader) => {
    const matchTrader: MatchableTrader = {
      id: trader.id,
      status: trader.status,
      services: trader.services || [],
      dbsStatus: trader.dbs_status,
      dbsExpiryDate: trader.dbs_expiry_date,
      insuranceStatus: trader.insurance_status,
      insuranceExpiryDate: trader.insurance_expiry_date,
      latitude: Number(trader.latitude),
      longitude: Number(trader.longitude),
      hourlyRate: Number(trader.hourly_rate),
      qualityScore: Number(trader.quality_score),
      available: trader.available
    };
    return { trader, evaluation: evaluateTrader(matchTask, matchTrader) };
  }).sort((a, b) => Number(b.evaluation.eligible) - Number(a.evaluation.eligible) || b.evaluation.score - a.evaluation.score);
  return { task, evaluated };
}

async function persistCandidates(task: CandidateTaskRow, candidates: EvaluatedCandidate[]) {
  await withTransaction(null, async (client) => {
    for (const candidate of candidates) {
      await client.query(
        `INSERT INTO ops.assignment_candidates
          (task_id, agency_id, trader_id, eligible, rejection_reasons, score, distance_miles, quoted_price,
           availability_start, availability_end)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (task_id, trader_id) DO UPDATE SET
           eligible = EXCLUDED.eligible,
           rejection_reasons = EXCLUDED.rejection_reasons,
           score = EXCLUDED.score,
           distance_miles = EXCLUDED.distance_miles,
           quoted_price = EXCLUDED.quoted_price,
           availability_start = EXCLUDED.availability_start,
           availability_end = EXCLUDED.availability_end,
           created_at = clock_timestamp()`,
        [task.id, task.agency_id, candidate.trader.id, candidate.evaluation.eligible,
          candidate.evaluation.reasons, candidate.evaluation.score, candidate.evaluation.distanceMiles,
          Number(candidate.trader.hourly_rate), task.preferred_window_start, task.preferred_window_end]
      );
    }
    await client.query(
      `UPDATE ops.tasks SET status = 'assignment_review'
       WHERE id = $1 AND status = 'pending_taskbridge_assignment'`,
      [task.id]
    );
  });
}
