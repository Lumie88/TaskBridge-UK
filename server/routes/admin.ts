import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../async-handler.js";
import { audit } from "../audit.js";
import { requireRoles } from "../auth.js";
import { config } from "../config.js";
import { query, withTransaction } from "../db.js";
import { dispatchToHandymanNetwork, sendHandymanOnboardingInvite, sendSecureVisitLink, sendStaffOnboardingInvite, startDbsVerification } from "../integrations.js";
import { evaluateTrader, requiresElectricalQualification, type MatchableTask, type MatchableTrader } from "../matching.js";
import { createComplianceDocumentReviewUrl } from "../media.js";
import { processRetryQueue } from "../retry-worker.js";
import { createOpaqueToken, decryptField, encryptField, hashToken, isWorkEmail, publicId, safeInitials, slugify } from "../security.js";
import type { UserRole } from "../types.js";

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
  electrical_qualification_active: boolean;
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
const createStaffInvitationSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(200),
  role: z.enum(["care_coordinator", "care_manager", "taskbridge_admin", "taskbridge_super_admin"]),
  agencyId: z.string().uuid().nullable().optional()
});
const adminRoleSchema = z.object({ role: z.enum(["taskbridge_admin", "taskbridge_super_admin"]) });
const adminStatusSchema = z.object({ status: z.enum(["active", "suspended"]) });
const electricalReviewSchema = z.object({ status: z.enum(["approved", "rejected"]) });
const documentReviewSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reason: z.string().trim().min(5).max(500),
  dbsExpiryDate: z.string().date().nullable().optional()
});
const demoRequestUpdateSchema = z.object({
  status: z.enum(["new", "contacted", "qualified", "closed"]),
  internalNotes: z.string().trim().max(2000).optional().default("")
});
const agencySettingsSchema = z.object({
  vulnerableAdultRequiresEnhancedDbs: z.boolean(),
  completionRequiresCareConfirmation: z.boolean(),
  supervisedVisitExceptionAllowed: z.boolean(),
  taskbridgeAssignmentRequiresAdminReview: z.boolean(),
  healthAnalyticsEnabled: z.boolean(),
  defaultVisitRadiusMiles: z.number().min(0.1).max(50),
  goLiveStatus: z.enum(["pilot_setup", "pilot_live", "paused", "suspended"]),
  monthlyCap: z.number().min(0).max(100000)
});
const settlementUpdateSchema = z.object({
  settlementStatus: z.enum(["not_invoiced", "invoiced", "agency_paid", "disputed", "written_off"]),
  settlementReference: z.string().trim().max(120).optional().nullable(),
  settlementDueAt: z.string().date().optional().nullable(),
  settlementNotes: z.string().trim().max(2000).optional().nullable()
});
const disputeSchema = z.object({
  reason: z.string().trim().min(5).max(1000),
  refundAmount: z.number().min(0).max(100000).default(0)
});
const invoiceCreateSchema = z.object({
  agencyId: z.string().uuid(),
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
  dueDate: z.string().date().optional().nullable()
});
const invoiceStatusSchema = z.object({ status: z.enum(["issued", "paid", "void"]) });

export const adminRouter = Router();
adminRouter.use(requireRoles("taskbridge_admin", "taskbridge_super_admin"));

adminRouter.get("/dashboard", async (_req, res) => {
  const [taskCounts, traderCounts, integrationFailures, demoRequests, paymentHolds] = await Promise.all([
    query<{ status: string; count: string }>("SELECT status::text, count(*)::text FROM ops.tasks WHERE deleted_at IS NULL GROUP BY status"),
    query<{ dbs_status: string; count: string }>(
      `SELECT COALESCE(d.status::text, 'not_started') AS dbs_status, count(*)::text
       FROM trader.traders t
       LEFT JOIN LATERAL (
         SELECT status FROM trader.dbs_verifications dv WHERE dv.trader_id = t.id ORDER BY dv.created_at DESC LIMIT 1
       ) d ON true
       WHERE t.deleted_at IS NULL GROUP BY d.status`
    ),
    query<{ count: string }>("SELECT count(*)::text FROM integration.webhook_logs WHERE status IN ('failed', 'retrying')"),
    query<{ count: string }>("SELECT count(*)::text FROM tenant.demo_requests WHERE status IN ('new', 'contacted')"),
    query<{ count: string }>("SELECT count(*)::text FROM billing.payouts WHERE status = 'hold'")
  ]);
  res.json({
    tasks: Object.fromEntries(taskCounts.rows.map((row) => [row.status, Number(row.count)])),
    traders: Object.fromEntries(traderCounts.rows.map((row) => [row.dbs_status, Number(row.count)])),
    integrationFailures: Number(integrationFailures.rows[0]?.count || 0),
    demoRequests: Number(demoRequests.rows[0]?.count || 0),
    paymentHolds: Number(paymentHolds.rows[0]?.count || 0)
  });
});

adminRouter.get("/integrations/failures", async (_req, res) => {
  const result = await query<{
    id: string; agency_name: string | null; direction: string; endpoint: string; event_type: string;
    status: string; response_status: number | null; error_message: string | null; retry_count: number;
    next_retry_at: string | null; created_at: string;
  }>(
    `SELECT w.id::text, a.name AS agency_name, w.direction::text, w.endpoint, w.event_type,
            w.status::text, w.response_status, w.error_message, w.retry_count,
            w.next_retry_at::text, w.created_at::text
     FROM integration.webhook_logs w
     LEFT JOIN tenant.agencies a ON a.id = w.agency_id
     WHERE w.status IN ('failed', 'retrying')
     ORDER BY w.created_at DESC LIMIT 100`
  );
  res.json({ failures: result.rows.map((row) => ({
    id: row.id,
    agencyName: row.agency_name,
    direction: row.direction,
    endpoint: row.endpoint,
    eventType: row.event_type,
    status: row.status,
    responseStatus: row.response_status,
    errorMessage: row.error_message,
    retryCount: row.retry_count,
    nextRetryAt: row.next_retry_at,
    createdAt: row.created_at
  })) });
});

adminRouter.post("/integrations/retry/run", requireRoles("taskbridge_super_admin"), asyncHandler(async (req, res) => {
  const limit = Math.min(25, Math.max(1, Number(req.body?.limit || 10)));
  const results = await withTransaction(req.auth!, (client) => processRetryQueue(client, limit));
  await audit(req, "super_admin.integration_retry.run", "retry_queue", "batch", { count: results.length });
  res.json({ processed: results.length, results });
}));

adminRouter.get("/demo-requests", asyncHandler(async (_req, res) => {
  const result = await query<{
    id: string; full_name: string; organisation_name: string; work_email: string; message: string | null;
    status: string; internal_notes: string | null; owner_name: string | null; last_contacted_at: string | null; created_at: string;
  }>(
    `SELECT d.id::text, d.full_name, d.organisation_name, d.work_email::text, d.message,
            d.status, d.internal_notes, u.full_name AS owner_name,
            d.last_contacted_at::text, d.created_at::text
     FROM tenant.demo_requests d
     LEFT JOIN auth.users u ON u.id = d.owner_user_id
     ORDER BY d.created_at DESC LIMIT 200`
  );
  res.json({ requests: result.rows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    organisationName: row.organisation_name,
    workEmail: row.work_email,
    message: row.message,
    status: row.status,
    internalNotes: row.internal_notes,
    ownerName: row.owner_name,
    lastContactedAt: row.last_contacted_at,
    createdAt: row.created_at
  })) });
}));

adminRouter.patch("/demo-requests/:id", asyncHandler(async (req, res) => {
  const parsed = demoRequestUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.issues[0]?.message || "Invalid demo request update" });
  const result = await query<{ id: string }>(
    `UPDATE tenant.demo_requests
     SET status = $2, internal_notes = NULLIF($3, ''),
         owner_user_id = COALESCE(owner_user_id, $4),
         last_contacted_at = CASE WHEN $2 IN ('contacted', 'qualified') THEN COALESCE(last_contacted_at, clock_timestamp()) ELSE last_contacted_at END
     WHERE id = $1
     RETURNING id::text`,
    [req.params.id, parsed.data.status, parsed.data.internalNotes, req.auth!.userId]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Demo request not found" });
  await audit(req, "admin.demo_request.updated", "demo_request", result.rows[0].id, { status: parsed.data.status });
  res.json({ id: result.rows[0].id, status: parsed.data.status });
}));

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
  const quote = Number(selected.trader.hourly_rate);
  const precheck = await monthlyCapCheck(candidates.task.agency_id, quote);
  if (!precheck.allowed) {
    return res.status(409).json({
      error: `Agency monthly cap exceeded. Used £${precheck.used.toFixed(2)} of £${precheck.monthlyCap.toFixed(2)}; this dispatch requires £${precheck.totalAmount.toFixed(2)}.`
    });
  }

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
    const cap = await client.query<{ monthly_cap: string | null; used: string }>(
      `SELECT bp.monthly_cap::text,
              COALESCE(SUM(tc.total_amount) FILTER (
                WHERE tc.created_at >= date_trunc('month', clock_timestamp())
                  AND tc.settlement_status <> 'written_off'
              ), 0)::text AS used
       FROM billing.agency_billing_profiles bp
       LEFT JOIN billing.task_charges tc ON tc.agency_id = bp.agency_id
       WHERE bp.agency_id = $1
       GROUP BY bp.monthly_cap`,
      [task.agency_id]
    );
    const monthlyCap = Number(cap.rows[0]?.monthly_cap || 500);
    const used = Number(cap.rows[0]?.used || 0);
    const totalAmount = Number((quote * 1.15).toFixed(2));
    if (used + totalAmount > monthlyCap) {
      await client.query(
        `INSERT INTO ops.task_status_events
          (task_id, agency_id, previous_status, new_status, changed_by_user_id, reason, metadata)
         VALUES ($1, $2, $3, 'blocked', $4, 'Agency monthly cap would be exceeded before dispatch', $5)`,
        [task.id, task.agency_id, task.status, req.auth!.userId, { monthlyCap, used, requested: totalAmount }]
      );
      await client.query("UPDATE ops.tasks SET status = 'blocked' WHERE id = $1", [task.id]);
      throw Object.assign(new Error(`Agency monthly cap exceeded. Used £${used.toFixed(2)} of £${monthlyCap.toFixed(2)}; this dispatch requires £${totalAmount.toFixed(2)}.`), { statusCode: 409 });
    }
    const assignment = await client.query<{ id: string }>(
      `INSERT INTO ops.assignments
        (task_id, agency_id, trader_id, status, selected_by_user_id, provider_booking_id,
         distance_miles, quoted_price, scheduled_start, scheduled_end, dispatched_at)
       VALUES ($1, $2, $3, 'dispatched', $4, $5, $6, $7, $8, $9, clock_timestamp())
       RETURNING id::text`,
      [task.id, task.agency_id, selected.trader.id, req.auth!.userId,
        String(dispatchReceipt.providerBookingId || ""), selected.evaluation.distanceMiles,
        quote, candidates.task.preferred_window_start, candidates.task.preferred_window_end]
    );
    const charge = await client.query<{ id: string }>(
      `INSERT INTO billing.task_charges
        (task_id, agency_id, assignment_id, handyman_amount, agency_coordination_fee,
         platform_fee, total_amount, status, settlement_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 'not_invoiced')
       ON CONFLICT (task_id) DO UPDATE SET assignment_id = EXCLUDED.assignment_id
       RETURNING id::text`,
      [task.id, task.agency_id, assignment.rows[0].id, quote, Number((quote * 0.05).toFixed(2)),
        Number((quote * 0.10).toFixed(2)), totalAmount]
    );
    await client.query(
      `INSERT INTO billing.payouts (trader_id, assignment_id, amount, currency, status, hold_reason)
       VALUES ($1, $2, $3, 'GBP', 'hold', 'Awaiting visit evidence and care confirmation')
       ON CONFLICT (assignment_id) DO NOTHING`,
      [selected.trader.id, assignment.rows[0].id, quote]
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
  const smsStatus = ["sent", "queued", "not_configured"].includes(String(smsResult.status)) ? String(smsResult.status) : "sent";
  await query(
    `INSERT INTO integration.notification_deliveries
      (channel, purpose, recipient_reference, provider, provider_message_id, status, metadata)
     VALUES ('sms', 'secure_visit_link', $1, $2, $3, $4, $5)`,
    [hashToken(decryptField(selected.trader.encrypted_mobile)), String(smsResult.provider || "configured_provider"),
      smsResult.providerMessageId || null, smsStatus, { taskId: req.params.publicId, visitId: created.visitId }]
  );
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

adminRouter.get("/traders/:id/documents", asyncHandler(async (req, res) => {
  const traderResult = await query<{ id: string; display_name: string; services: string[] }>(
    `SELECT t.id::text, t.display_name, COALESCE(s.services, '{}') AS services
     FROM trader.traders t
     LEFT JOIN LATERAL (
       SELECT array_agg(service_category ORDER BY service_category) AS services
       FROM trader.trader_services ts WHERE ts.trader_id = t.id AND ts.active
     ) s ON true
     WHERE t.id = $1 AND t.deleted_at IS NULL`,
    [req.params.id]
  );
  const trader = traderResult.rows[0];
  if (!trader) return res.status(404).json({ error: "Handyman not found" });
  const documents = await query<{
    id: string; document_type: string; storage_key: string; original_filename_ciphertext: string;
    content_type: string; size_bytes: number; document_reference_ciphertext: string | null;
    issue_date: string | null; expiry_date: string | null; review_status: string; review_notes: string | null;
    reviewed_at: string | null; reviewer_name: string | null; created_at: string;
  }>(
    `SELECT d.id::text, d.document_type, d.storage_key, d.original_filename_ciphertext,
            d.content_type, d.size_bytes, d.document_reference_ciphertext,
            d.issue_date::text, d.expiry_date::text, d.review_status, d.review_notes,
            d.reviewed_at::text, u.full_name AS reviewer_name, d.created_at::text
     FROM trader.onboarding_documents d
     LEFT JOIN auth.users u ON u.id = d.reviewed_by_user_id
     WHERE d.trader_id = $1 ORDER BY d.created_at DESC`,
    [req.params.id]
  );
  const mapped = await Promise.all(documents.rows.map(async (document) => {
    let reviewUrl: string | null = null;
    try { reviewUrl = await createComplianceDocumentReviewUrl(document.storage_key); } catch { reviewUrl = null; }
    return {
      id: document.id,
      documentType: document.document_type,
      originalFilename: decryptField(document.original_filename_ciphertext),
      contentType: document.content_type,
      sizeBytes: document.size_bytes,
      reference: document.document_reference_ciphertext ? decryptField(document.document_reference_ciphertext) : null,
      issueDate: document.issue_date,
      expiryDate: document.expiry_date,
      reviewStatus: document.review_status,
      reviewNotes: document.review_notes,
      reviewedAt: document.reviewed_at,
      reviewerName: document.reviewer_name,
      createdAt: document.created_at,
      reviewUrl
    };
  }));
  res.json({ trader: { id: trader.id, displayName: trader.display_name, services: trader.services }, documents: mapped });
}));

adminRouter.post("/traders/:id/documents/:documentId/review", asyncHandler(async (req, res) => {
  const parsed = documentReviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.issues[0]?.message || "Invalid document decision" });
  const data = parsed.data;
  const result = await withTransaction(req.auth!, async (client) => {
    const documentResult = await client.query<{
      id: string; document_type: string; storage_key: string; expiry_date: string | null;
    }>(
      `SELECT id::text, document_type, storage_key, expiry_date::text
       FROM trader.onboarding_documents
       WHERE id = $1 AND trader_id = $2 FOR UPDATE`,
      [req.params.documentId, req.params.id]
    );
    const document = documentResult.rows[0];
    if (!document) throw Object.assign(new Error("Compliance document not found"), { statusCode: 404 });
    if (document.document_type === "enhanced_dbs" && data.status === "approved" && !data.dbsExpiryDate) {
      throw Object.assign(new Error("Enter the DBS review expiry date"), { statusCode: 422 });
    }
    if (document.document_type === "public_liability_insurance" && data.status === "approved" &&
        (!document.expiry_date || new Date(`${document.expiry_date}T23:59:59Z`) < new Date())) {
      throw Object.assign(new Error("Expired insurance cannot be approved"), { statusCode: 409 });
    }
    await client.query(
      `UPDATE trader.onboarding_documents SET review_status = $2, review_notes = $3,
              reviewed_by_user_id = $4, reviewed_at = clock_timestamp()
       WHERE id = $1`,
      [document.id, data.status, data.reason, req.auth!.userId]
    );
    if (document.document_type === "enhanced_dbs") {
      const dbs = await client.query(
        `UPDATE trader.dbs_verifications SET status = $3, outcome = $4,
                expiry_date = $5, checked_at = clock_timestamp()
         WHERE trader_id = $1 AND evidence_reference = $2`,
        [req.params.id, `onboarding-document:${document.id}`,
          data.status === "approved" ? "approved" : "rejected", data.reason,
          data.status === "approved" ? data.dbsExpiryDate : null]
      );
      if (!dbs.rowCount) throw Object.assign(new Error("The submitted DBS record could not be linked"), { statusCode: 409 });
    }
    if (document.document_type === "public_liability_insurance") {
      const insurance = await client.query(
        `UPDATE trader.insurance_records SET status = $3, verified_by_user_id = $4,
                verified_at = CASE WHEN $3 = 'verified' THEN clock_timestamp() ELSE NULL END
         WHERE trader_id = $1 AND evidence_url = $2`,
        [req.params.id, `private-object://${document.storage_key}`,
          data.status === "approved" ? "verified" : "rejected", req.auth!.userId]
      );
      if (!insurance.rowCount) throw Object.assign(new Error("The submitted insurance record could not be linked"), { statusCode: 409 });
    }
    const eligibility = await client.query<{ eligible: boolean }>(
      `SELECT
         (SELECT count(*) = 3 FROM (
            SELECT DISTINCT ON (document_type) document_type, review_status
            FROM trader.onboarding_documents
            WHERE trader_id = $1 AND document_type IN ('identity', 'public_liability_insurance', 'enhanced_dbs')
            ORDER BY document_type, created_at DESC
          ) required_docs WHERE review_status = 'approved')
         AND EXISTS (
           SELECT 1 FROM trader.dbs_verifications WHERE trader_id = $1 AND status = 'approved'
             AND expiry_date >= current_date ORDER BY created_at DESC LIMIT 1
         )
         AND EXISTS (
           SELECT 1 FROM trader.insurance_records WHERE trader_id = $1 AND status = 'verified'
             AND expiry_date >= current_date ORDER BY created_at DESC LIMIT 1
         ) AS eligible`
      , [req.params.id]
    );
    await client.query("UPDATE trader.traders SET status = $2 WHERE id = $1", [req.params.id, eligibility.rows[0]?.eligible ? "active" : "inactive"]);
    return { documentId: document.id, documentType: document.document_type, traderActive: Boolean(eligibility.rows[0]?.eligible) };
  });
  await audit(req, "admin.compliance_document.reviewed", "onboarding_document", result.documentId, {
    traderId: req.params.id, documentType: result.documentType, status: data.status, reason: data.reason
  });
  res.json({ id: result.documentId, status: data.status, traderActive: result.traderActive });
}));

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
  const trader = await query<{ id: string; encrypted_full_name: string; encrypted_mobile: string; email: string | null }>(
    "SELECT id::text, encrypted_full_name, encrypted_mobile, email::text FROM trader.traders WHERE id = $1 AND deleted_at IS NULL",
    [req.params.id]
  );
  if (!trader.rows[0]) return res.status(404).json({ error: "Handyman not found" });
  const provider = await startDbsVerification({
    handymanId: trader.rows[0].id,
    fullName: decryptField(trader.rows[0].encrypted_full_name),
    email: trader.rows[0].email,
    mobile: trader.rows[0].encrypted_mobile ? decryptField(trader.rows[0].encrypted_mobile) : null,
    checkType: "enhanced_dbs",
    callbackUrl: `${config.appOrigin}/api/webhooks/dbs-callback`
  });
  await query(
    `INSERT INTO trader.dbs_verifications
       (trader_id, provider_session_id, status, provider_name, provider_invitation_url, provider_payload, evidence_reference)
     VALUES ($1, $2, $3, $4, $5, $6, $5)`,
    [trader.rows[0].id, provider.providerSessionId, provider.status, provider.provider, provider.invitationUrl, provider.raw]
  );
  await audit(req, "admin.dbs.started", "trader", trader.rows[0].id, {
    provider: provider.provider,
    providerSessionId: provider.providerSessionId
  });
  res.status(201).json({
    traderId: trader.rows[0].id,
    status: provider.status,
    provider: provider.provider,
    providerSessionId: provider.providerSessionId,
    invitationUrl: provider.invitationUrl
  });
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

adminRouter.post("/traders/:id/electrical-review", requireRoles("taskbridge_super_admin"), asyncHandler(async (req, res) => {
  const parsed = electricalReviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: "Select a valid qualification decision" });
  const result = await query<{ id: string }>(
    `UPDATE trader.qualifications q SET
       review_status = $2,
       verified_by_user_id = CASE WHEN $2 = 'approved' THEN $3::uuid ELSE NULL END,
       verified_at = CASE WHEN $2 = 'approved' THEN clock_timestamp() ELSE NULL END
     WHERE q.id = (
       SELECT id FROM trader.qualifications
       WHERE trader_id = $1
         AND lower(qualification_type || ' ' || title) ~ '(electric|wiring|eicr|18th edition|part p)'
       ORDER BY created_at DESC LIMIT 1
     ) RETURNING q.id::text`,
    [req.params.id, parsed.data.status, req.auth!.userId]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "No electrical qualification is available for review" });
  await audit(req, "super_admin.electrical_qualification.reviewed", "qualification", result.rows[0].id, {
    traderId: req.params.id, status: parsed.data.status
  });
  res.json({ traderId: req.params.id, status: parsed.data.status });
}));

adminRouter.get("/agencies", requireRoles("taskbridge_super_admin"), asyncHandler(async (_req, res) => {
  const result = await query(
    `SELECT a.id::text, a.public_id, a.name, a.slug, a.primary_contact_name, a.primary_contact_email::text,
            a.work_email_domain::text, a.status::text, a.created_at::text,
            COALESCE(workorders.active_workorders, 0)::text AS active_workorders,
            api_key.key_prefix, api_key.key_length, api_key.created_at::text AS api_key_created_at,
            settings.vulnerable_adult_requires_enhanced_dbs,
            settings.completion_requires_care_confirmation,
            settings.supervised_visit_exception_allowed,
            settings.taskbridge_assignment_requires_admin_review,
            settings.health_analytics_enabled,
            settings.default_visit_radius_miles::text,
            settings.go_live_status,
            billing.monthly_cap::text,
            billing.status AS billing_status
     FROM tenant.agencies a
     LEFT JOIN tenant.agency_settings settings ON settings.agency_id = a.id
     LEFT JOIN billing.agency_billing_profiles billing ON billing.agency_id = a.id
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
    settings: {
      vulnerableAdultRequiresEnhancedDbs: row.vulnerable_adult_requires_enhanced_dbs,
      completionRequiresCareConfirmation: row.completion_requires_care_confirmation,
      supervisedVisitExceptionAllowed: row.supervised_visit_exception_allowed,
      taskbridgeAssignmentRequiresAdminReview: row.taskbridge_assignment_requires_admin_review,
      healthAnalyticsEnabled: row.health_analytics_enabled,
      defaultVisitRadiusMiles: Number(row.default_visit_radius_miles || 15),
      goLiveStatus: row.go_live_status || "pilot_setup",
      monthlyCap: Number(row.monthly_cap || 500),
      billingStatus: row.billing_status || "active"
    },
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
  const rawStaffToken = createOpaqueToken(36);
  const invitationExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
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
      `INSERT INTO billing.agency_billing_profiles (agency_id, billing_email, monthly_cap, currency, status)
       VALUES ($1, $2, 500, 'GBP', 'active')`,
      [agency.rows[0].id, data.primaryContactEmail.toLowerCase()]
    );
    await client.query(
      `INSERT INTO tenant.agency_api_keys
        (agency_id, name, key_prefix, key_hash, key_length, scopes)
       VALUES ($1, 'Primary integration key', $2, $3, $4, ARRAY['tasks:write']::text[])`,
      [agency.rows[0].id, rawApiKey.slice(0, 16), hashToken(rawApiKey), rawApiKey.length]
    );
    const invitation = await client.query<{ id: string }>(
      `INSERT INTO auth.user_invitations
        (agency_id, full_name, email, role, token_hash, created_by_user_id, expires_at)
       VALUES ($1, $2, $3, 'care_manager', $4, $5, $6) RETURNING id::text`,
      [agency.rows[0].id, data.primaryContactName, data.primaryContactEmail.toLowerCase(),
        hashToken(rawStaffToken), req.auth!.userId, invitationExpiresAt]
    );
    return { ...agency.rows[0], invitationId: invitation.rows[0].id };
  });
  const invitationUrl = `${config.appOrigin}/staff-onboarding/${rawStaffToken}`;
  const delivery = await sendStaffOnboardingInvite({
    email: data.primaryContactEmail.toLowerCase(),
    fullName: data.primaryContactName,
    organisationName: data.name,
    roleLabel: "care manager",
    invitationUrl,
    expiresAt: invitationExpiresAt.toISOString()
  });
  await query(
    `UPDATE auth.user_invitations SET email_delivery_status = $2, provider_message_id = $3,
       sent_at = CASE WHEN $2 = 'sent' THEN clock_timestamp() ELSE sent_at END WHERE id = $1`,
    [result.invitationId, delivery.status, delivery.providerMessageId]
  );
  await audit(req, "super_admin.agency.created", "agency", result.id);
  res.status(201).json({
    id: result.public_id, status: "onboarding", apiKey: rawApiKey, invitationUrl,
    invitationExpiresAt: invitationExpiresAt.toISOString(), emailDeliveryStatus: delivery.status
  });
});

adminRouter.patch("/agencies/:id/settings", requireRoles("taskbridge_super_admin"), asyncHandler(async (req, res) => {
  const parsed = agencySettingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.issues[0]?.message || "Invalid agency settings" });
  const data = parsed.data;
  const result = await withTransaction(req.auth!, async (client) => {
    const agency = await client.query<{ id: string }>(
      "SELECT id::text FROM tenant.agencies WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
      [req.params.id]
    );
    if (!agency.rows[0]) return null;
    await client.query(
      `UPDATE tenant.agency_settings SET
         vulnerable_adult_requires_enhanced_dbs = $2,
         completion_requires_care_confirmation = $3,
         supervised_visit_exception_allowed = $4,
         taskbridge_assignment_requires_admin_review = $5,
         health_analytics_enabled = $6,
         default_visit_radius_miles = $7,
         go_live_status = $8
       WHERE agency_id = $1`,
      [req.params.id, data.vulnerableAdultRequiresEnhancedDbs, data.completionRequiresCareConfirmation,
        data.supervisedVisitExceptionAllowed, data.taskbridgeAssignmentRequiresAdminReview,
        data.healthAnalyticsEnabled, data.defaultVisitRadiusMiles, data.goLiveStatus]
    );
    await client.query(
      `INSERT INTO billing.agency_billing_profiles (agency_id, monthly_cap, currency, status)
       VALUES ($1, $2, 'GBP', 'active')
       ON CONFLICT (agency_id) DO UPDATE SET monthly_cap = EXCLUDED.monthly_cap`,
      [req.params.id, data.monthlyCap]
    );
    return agency.rows[0].id;
  });
  if (!result) return res.status(404).json({ error: "Care agency not found" });
  await audit(req, "super_admin.agency_settings.updated", "agency", result, data);
  res.json({ id: result, settings: data });
}));

adminRouter.get("/billing/task-charges", asyncHandler(async (_req, res) => {
  const result = await query<{
    id: string; task_id: string; public_id: string; agency_id: string; agency_name: string; handyman_name: string | null;
    handyman_amount: string; agency_coordination_fee: string; platform_fee: string; total_amount: string;
    status: string; settlement_status: string; settlement_reference: string | null; settlement_due_at: string | null;
    settlement_notes: string | null; created_at: string; payout_status: string | null; payable_after: string | null;
  }>(
    `SELECT tc.id::text, t.id::text AS task_id, t.public_id, ag.id::text AS agency_id, ag.name AS agency_name,
            tr.display_name AS handyman_name, tc.handyman_amount::text, tc.agency_coordination_fee::text,
            tc.platform_fee::text, tc.total_amount::text, tc.status, tc.settlement_status,
            tc.settlement_reference, tc.settlement_due_at::text, tc.settlement_notes, tc.created_at::text,
            p.status AS payout_status, p.payable_after::text
     FROM billing.task_charges tc
     JOIN ops.tasks t ON t.id = tc.task_id
     JOIN tenant.agencies ag ON ag.id = tc.agency_id
     LEFT JOIN ops.assignments a ON a.id = tc.assignment_id
     LEFT JOIN trader.traders tr ON tr.id = a.trader_id
     LEFT JOIN billing.payouts p ON p.assignment_id = a.id
     ORDER BY tc.created_at DESC LIMIT 200`
  );
  res.json({ charges: result.rows.map((row) => ({
    id: row.id,
    taskId: row.public_id,
    agencyId: row.agency_id,
    agencyName: row.agency_name,
    handymanName: row.handyman_name,
    handymanAmount: Number(row.handyman_amount),
    agencyCoordinationFee: Number(row.agency_coordination_fee),
    platformFee: Number(row.platform_fee),
    totalAmount: Number(row.total_amount),
    status: row.status,
    settlementStatus: row.settlement_status,
    settlementReference: row.settlement_reference,
    settlementDueAt: row.settlement_due_at,
    settlementNotes: row.settlement_notes,
    payoutStatus: row.payout_status,
    payableAfter: row.payable_after,
    createdAt: row.created_at
  })) });
}));

adminRouter.get("/billing/invoices", asyncHandler(async (_req, res) => {
  const result = await query<{
    id: string; agency_name: string; invoice_number: string; period_start: string; period_end: string;
    total_amount: string; currency: string; status: string; issued_at: string | null; paid_at: string | null; line_count: string;
  }>(
    `SELECT i.id::text, ag.name AS agency_name, i.invoice_number, i.period_start::text, i.period_end::text,
            i.total_amount::text, i.currency, i.status, i.issued_at::text, i.paid_at::text,
            count(tc.id)::text AS line_count
     FROM billing.invoices i
     JOIN tenant.agencies ag ON ag.id = i.agency_id
     LEFT JOIN billing.task_charges tc ON tc.agency_id = i.agency_id AND tc.settlement_reference = i.invoice_number
     GROUP BY i.id, ag.name
     ORDER BY i.created_at DESC LIMIT 100`
  );
  res.json({ invoices: result.rows.map((row) => ({
    id: row.id,
    agencyName: row.agency_name,
    invoiceNumber: row.invoice_number,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    totalAmount: Number(row.total_amount),
    currency: row.currency,
    status: row.status,
    issuedAt: row.issued_at,
    paidAt: row.paid_at,
    lineCount: Number(row.line_count)
  })) });
}));

adminRouter.post("/billing/invoices", asyncHandler(async (req, res) => {
  const parsed = invoiceCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.issues[0]?.message || "Invalid invoice request" });
  const data = parsed.data;
  const created = await withTransaction(req.auth!, async (client) => {
    const charges = await client.query<{ id: string; total_amount: string }>(
      `SELECT id::text, total_amount::text
       FROM billing.task_charges
       WHERE agency_id = $1
         AND settlement_status = 'not_invoiced'
         AND created_at::date BETWEEN $2 AND $3
       ORDER BY created_at
       FOR UPDATE`,
      [data.agencyId, data.periodStart, data.periodEnd]
    );
    if (!charges.rows.length) return null;
    const totalAmount = charges.rows.reduce((sum, row) => sum + Number(row.total_amount), 0);
    const invoiceNumber = `TB-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const invoice = await client.query<{ id: string }>(
      `INSERT INTO billing.invoices
        (agency_id, invoice_number, period_start, period_end, total_amount, currency, status, issued_at)
       VALUES ($1, $2, $3, $4, $5, 'GBP', 'issued', clock_timestamp())
       RETURNING id::text`,
      [data.agencyId, invoiceNumber, data.periodStart, data.periodEnd, totalAmount]
    );
    await client.query(
      `UPDATE billing.task_charges
       SET settlement_status = 'invoiced',
           settlement_reference = $2,
           settlement_due_at = $3,
           settlement_notes = COALESCE(settlement_notes, 'Included in agency invoice export')
       WHERE id = ANY($1::uuid[])`,
      [charges.rows.map((row) => row.id), invoiceNumber, data.dueDate || null]
    );
    return { id: invoice.rows[0].id, invoiceNumber, totalAmount, lineCount: charges.rows.length };
  });
  if (!created) return res.status(409).json({ error: "No uninvoiced task charges found for this agency and period" });
  await audit(req, "admin.billing.invoice_created", "invoice", created.id, data);
  res.status(201).json(created);
}));

adminRouter.get("/billing/invoices/:id/export.csv", asyncHandler(async (req, res) => {
  const invoice = await query<{ agency_id: string; agency_name: string; invoice_number: string; period_start: string; period_end: string; total_amount: string; status: string }>(
    `SELECT i.agency_id::text, ag.name AS agency_name, i.invoice_number, i.period_start::text, i.period_end::text,
            i.total_amount::text, i.status
     FROM billing.invoices i JOIN tenant.agencies ag ON ag.id = i.agency_id
     WHERE i.id = $1`,
    [req.params.id]
  );
  const header = invoice.rows[0];
  if (!header) return res.status(404).json({ error: "Invoice not found" });
  const lines = await query<{
    task_public_id: string; category: string; created_at: string; handyman_name: string | null;
    handyman_amount: string; agency_coordination_fee: string; platform_fee: string; total_amount: string;
  }>(
    `SELECT t.public_id AS task_public_id, t.category, tc.created_at::text, tr.display_name AS handyman_name,
            tc.handyman_amount::text, tc.agency_coordination_fee::text, tc.platform_fee::text, tc.total_amount::text
     FROM billing.task_charges tc
     JOIN ops.tasks t ON t.id = tc.task_id
     LEFT JOIN ops.assignments a ON a.id = tc.assignment_id
     LEFT JOIN trader.traders tr ON tr.id = a.trader_id
     WHERE tc.agency_id = $1 AND tc.settlement_reference = $2
     ORDER BY tc.created_at`,
    [header.agency_id, header.invoice_number]
  );
  const rows = [
    ["Invoice number", header.invoice_number],
    ["Agency", header.agency_name],
    ["Period", `${header.period_start} to ${header.period_end}`],
    ["Status", header.status],
    ["Total", header.total_amount],
    [],
    ["Task", "Category", "Date", "Handyman", "Handyman amount", "Agency coordination fee", "Platform fee", "Total"]
  ];
  for (const line of lines.rows) {
    rows.push([line.task_public_id, line.category, line.created_at, line.handyman_name || "", line.handyman_amount, line.agency_coordination_fee, line.platform_fee, line.total_amount]);
  }
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
  res.setHeader("content-type", "text/csv; charset=utf-8");
  res.setHeader("content-disposition", `attachment; filename="${header.invoice_number}.csv"`);
  res.send(csv);
}));

adminRouter.patch("/billing/invoices/:id/status", asyncHandler(async (req, res) => {
  const parsed = invoiceStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.issues[0]?.message || "Invalid invoice status" });
  const data = parsed.data;
  const result = await withTransaction(req.auth!, async (client) => {
    const invoice = await client.query<{ id: string; agency_id: string; invoice_number: string }>(
      `UPDATE billing.invoices
       SET status = $2,
           paid_at = CASE WHEN $2 = 'paid' THEN clock_timestamp() ELSE paid_at END
       WHERE id = $1
       RETURNING id::text, agency_id::text, invoice_number`,
      [req.params.id, data.status]
    );
    if (!invoice.rows[0]) return null;
    if (data.status === "paid") {
      await client.query(
        `UPDATE billing.task_charges
         SET settlement_status = 'agency_paid',
             status = 'settled',
             settlement_notes = COALESCE(settlement_notes, 'Agency invoice marked paid')
         WHERE agency_id = $1 AND settlement_reference = $2`,
        [invoice.rows[0].agency_id, invoice.rows[0].invoice_number]
      );
    }
    if (data.status === "void") {
      await client.query(
        `UPDATE billing.task_charges
         SET settlement_status = 'not_invoiced',
             settlement_reference = NULL,
             settlement_due_at = NULL
         WHERE agency_id = $1 AND settlement_reference = $2 AND settlement_status = 'invoiced'`,
        [invoice.rows[0].agency_id, invoice.rows[0].invoice_number]
      );
    }
    return invoice.rows[0].id;
  });
  if (!result) return res.status(404).json({ error: "Invoice not found" });
  await audit(req, "admin.billing.invoice_status_updated", "invoice", result, data);
  res.json({ id: result, status: data.status });
}));

adminRouter.patch("/billing/task-charges/:id/settlement", asyncHandler(async (req, res) => {
  const parsed = settlementUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.issues[0]?.message || "Invalid settlement update" });
  const data = parsed.data;
  const result = await query<{ id: string }>(
    `UPDATE billing.task_charges
     SET settlement_status = $2, settlement_reference = $3, settlement_due_at = $4, settlement_notes = $5,
         status = CASE WHEN $2 = 'agency_paid' THEN 'settled' ELSE status END
     WHERE id = $1 RETURNING id::text`,
    [req.params.id, data.settlementStatus, data.settlementReference || null, data.settlementDueAt || null, data.settlementNotes || null]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Task charge not found" });
  await audit(req, "admin.billing.settlement_updated", "task_charge", result.rows[0].id, data);
  res.json({ id: result.rows[0].id, settlementStatus: data.settlementStatus });
}));

adminRouter.post("/billing/task-charges/:id/disputes", asyncHandler(async (req, res) => {
  const parsed = disputeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.issues[0]?.message || "Invalid dispute" });
  const data = parsed.data;
  const dispute = await withTransaction(req.auth!, async (client) => {
    const charge = await client.query<{ id: string; agency_id: string; task_id: string; assignment_id: string | null }>(
      "SELECT id::text, agency_id::text, task_id::text, assignment_id::text FROM billing.task_charges WHERE id = $1 FOR UPDATE",
      [req.params.id]
    );
    if (!charge.rows[0]) return null;
    const created = await client.query<{ id: string }>(
      `INSERT INTO billing.payment_disputes
        (task_charge_id, agency_id, task_id, opened_by_user_id, reason, refund_amount, payout_hold)
       VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id::text`,
      [charge.rows[0].id, charge.rows[0].agency_id, charge.rows[0].task_id, req.auth!.userId, data.reason, data.refundAmount]
    );
    await client.query("UPDATE billing.task_charges SET settlement_status = 'disputed', status = 'disputed' WHERE id = $1", [charge.rows[0].id]);
    if (charge.rows[0].assignment_id) {
      await client.query(
        "UPDATE billing.payouts SET status = 'hold', hold_reason = $2 WHERE assignment_id = $1",
        [charge.rows[0].assignment_id, `Dispute opened: ${data.reason}`]
      );
    }
    return created.rows[0].id;
  });
  if (!dispute) return res.status(404).json({ error: "Task charge not found" });
  await audit(req, "admin.billing.dispute_opened", "payment_dispute", dispute, { taskChargeId: req.params.id, reason: data.reason });
  res.status(201).json({ id: dispute, status: "open" });
}));

adminRouter.get("/access/users", requireRoles("taskbridge_super_admin"), asyncHandler(async (_req, res) => {
  const [users, invitations] = await Promise.all([
    query(
      `SELECT u.id::text, u.full_name, u.email::text, u.role::text, u.status::text,
              u.last_login_at::text, u.created_at::text, a.name AS agency_name
       FROM auth.users u LEFT JOIN tenant.agencies a ON a.id = u.agency_id
       WHERE u.deleted_at IS NULL ORDER BY u.role DESC, u.full_name`
    ),
    query(
      `SELECT i.id::text, i.full_name, i.email::text, i.role::text, i.status,
              i.expires_at::text, i.email_delivery_status, a.name AS agency_name
       FROM auth.user_invitations i LEFT JOIN tenant.agencies a ON a.id = i.agency_id
       WHERE i.status = 'pending' AND i.expires_at > clock_timestamp()
       ORDER BY i.created_at DESC`
    )
  ]);
  res.json({ users: users.rows, invitations: invitations.rows });
}));

adminRouter.post("/access/invitations", requireRoles("taskbridge_super_admin"), asyncHandler(async (req, res) => {
  const parsed = createStaffInvitationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.issues[0]?.message || "Invalid staff invitation" });
  const data = parsed.data;
  const email = data.email.toLowerCase();
  if (!isWorkEmail(email)) return res.status(422).json({ error: "Staff invitations require a work email address" });
  const isCareRole = data.role === "care_coordinator" || data.role === "care_manager";
  if (isCareRole !== Boolean(data.agencyId)) return res.status(422).json({ error: isCareRole ? "Select a care agency" : "TaskBridge administrators cannot belong to a care agency" });

  let organisationName = "TaskBridge";
  if (data.agencyId) {
    const agency = await query<{ name: string; work_email_domain: string }>(
      "SELECT name, work_email_domain::text FROM tenant.agencies WHERE id = $1 AND deleted_at IS NULL",
      [data.agencyId]
    );
    if (!agency.rows[0]) return res.status(404).json({ error: "Care agency not found" });
    if (email.split("@")[1] !== agency.rows[0].work_email_domain.toLowerCase()) {
      return res.status(422).json({ error: `Email must use the approved ${agency.rows[0].work_email_domain} domain` });
    }
    organisationName = agency.rows[0].name;
  }

  const existing = await query("SELECT 1 FROM auth.users WHERE email = $1 AND deleted_at IS NULL", [email]);
  if (existing.rowCount) return res.status(409).json({ error: "An account already exists for this email" });
  const rawToken = createOpaqueToken(36);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const invitation = await query<{ id: string }>(
    `INSERT INTO auth.user_invitations
      (agency_id, full_name, email, role, token_hash, created_by_user_id, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id::text`,
    [data.agencyId || null, data.fullName, email, data.role, hashToken(rawToken), req.auth!.userId, expiresAt]
  );
  const invitationUrl = `${config.appOrigin}/staff-onboarding/${rawToken}`;
  const delivery = await sendStaffOnboardingInvite({
    email, fullName: data.fullName, organisationName,
    roleLabel: data.role.replaceAll("_", " "), invitationUrl, expiresAt: expiresAt.toISOString()
  });
  await query(
    `UPDATE auth.user_invitations SET email_delivery_status = $2, provider_message_id = $3,
       sent_at = CASE WHEN $2 = 'sent' THEN clock_timestamp() ELSE sent_at END WHERE id = $1`,
    [invitation.rows[0].id, delivery.status, delivery.providerMessageId]
  );
  await audit(req, "super_admin.staff.invited", "user_invitation", invitation.rows[0].id, { role: data.role, agencyId: data.agencyId || null });
  res.status(201).json({ invitationUrl, expiresAt: expiresAt.toISOString(), emailDeliveryStatus: delivery.status });
}));

adminRouter.patch("/access/users/:id/role", requireRoles("taskbridge_super_admin"), asyncHandler(async (req, res) => {
  const parsed = adminRoleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: "Select a valid TaskBridge role" });
  if (req.params.id === req.auth!.userId) return res.status(409).json({ error: "You cannot change your own super-admin role" });
  const changed = await withTransaction(req.auth!, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('taskbridge-super-admin-roster'))");
    const target = await client.query<{ role: UserRole }>(
      `SELECT role FROM auth.users WHERE id = $1 AND role IN ('taskbridge_admin', 'taskbridge_super_admin')
       AND deleted_at IS NULL FOR UPDATE`, [req.params.id]
    );
    if (!target.rows[0]) throw Object.assign(new Error("TaskBridge administrator not found"), { statusCode: 404 });
    if (target.rows[0].role === "taskbridge_super_admin" && parsed.data.role !== "taskbridge_super_admin") {
      const remaining = await client.query<{ count: string }>(
        `SELECT count(*)::text FROM auth.users WHERE role = 'taskbridge_super_admin' AND status = 'active'
         AND deleted_at IS NULL AND id <> $1`, [req.params.id]
      );
      if (Number(remaining.rows[0].count) < 1) throw Object.assign(new Error("The final active super admin cannot be demoted"), { statusCode: 409 });
    }
    await client.query("UPDATE auth.users SET role = $2 WHERE id = $1", [req.params.id, parsed.data.role]);
    await client.query("UPDATE auth.sessions SET revoked_at = clock_timestamp() WHERE user_id = $1 AND revoked_at IS NULL", [req.params.id]);
    return target.rows[0].role;
  });
  await audit(req, "super_admin.user.role_changed", "user", req.params.id, { previousRole: changed, role: parsed.data.role });
  res.json({ id: req.params.id, role: parsed.data.role });
}));

adminRouter.patch("/access/users/:id/status", requireRoles("taskbridge_super_admin"), asyncHandler(async (req, res) => {
  const parsed = adminStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: "Select a valid account status" });
  if (req.params.id === req.auth!.userId) return res.status(409).json({ error: "You cannot suspend your own account" });
  await withTransaction(req.auth!, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('taskbridge-super-admin-roster'))");
    const target = await client.query<{ role: UserRole }>(
      `SELECT role FROM auth.users WHERE id = $1 AND role IN ('taskbridge_admin', 'taskbridge_super_admin')
       AND deleted_at IS NULL FOR UPDATE`, [req.params.id]
    );
    if (!target.rows[0]) throw Object.assign(new Error("TaskBridge administrator not found"), { statusCode: 404 });
    if (parsed.data.status === "suspended" && target.rows[0].role === "taskbridge_super_admin") {
      const remaining = await client.query<{ count: string }>(
        `SELECT count(*)::text FROM auth.users WHERE role = 'taskbridge_super_admin' AND status = 'active'
         AND deleted_at IS NULL AND id <> $1`, [req.params.id]
      );
      if (Number(remaining.rows[0].count) < 1) throw Object.assign(new Error("The final active super admin cannot be suspended"), { statusCode: 409 });
    }
    await client.query("UPDATE auth.users SET status = $2 WHERE id = $1", [req.params.id, parsed.data.status]);
    if (parsed.data.status === "suspended") {
      await client.query("UPDATE auth.sessions SET revoked_at = clock_timestamp() WHERE user_id = $1 AND revoked_at IS NULL", [req.params.id]);
    }
  });
  await audit(req, "super_admin.user.status_changed", "user", req.params.id, { status: parsed.data.status });
  res.json({ id: req.params.id, status: parsed.data.status });
}));

adminRouter.delete("/access/users/:id", requireRoles("taskbridge_super_admin"), asyncHandler(async (req, res) => {
  if (req.params.id === req.auth!.userId) return res.status(409).json({ error: "You cannot delete your own account" });
  await withTransaction(req.auth!, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('taskbridge-super-admin-roster'))");
    const target = await client.query<{ role: UserRole }>(
      `SELECT role FROM auth.users WHERE id = $1 AND role IN ('taskbridge_admin', 'taskbridge_super_admin')
       AND deleted_at IS NULL FOR UPDATE`, [req.params.id]
    );
    if (!target.rows[0]) throw Object.assign(new Error("TaskBridge administrator not found"), { statusCode: 404 });
    if (target.rows[0].role === "taskbridge_super_admin") {
      const remaining = await client.query<{ count: string }>(
        `SELECT count(*)::text FROM auth.users WHERE role = 'taskbridge_super_admin' AND status = 'active'
         AND deleted_at IS NULL AND id <> $1`, [req.params.id]
      );
      if (Number(remaining.rows[0].count) < 1) throw Object.assign(new Error("The final active super admin cannot be deleted"), { statusCode: 409 });
    }
    await client.query("UPDATE auth.sessions SET revoked_at = clock_timestamp() WHERE user_id = $1 AND revoked_at IS NULL", [req.params.id]);
    await client.query("UPDATE auth.users SET status = 'disabled', deleted_at = clock_timestamp() WHERE id = $1", [req.params.id]);
  });
  await audit(req, "super_admin.user.deleted", "user", req.params.id);
  res.status(204).end();
}));

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

async function monthlyCapCheck(agencyId: string, handymanAmount: number) {
  const totalAmount = Number((handymanAmount * 1.15).toFixed(2));
  const result = await query<{ monthly_cap: string | null; used: string }>(
    `SELECT bp.monthly_cap::text,
            COALESCE(SUM(tc.total_amount) FILTER (
              WHERE tc.created_at >= date_trunc('month', clock_timestamp())
                AND tc.settlement_status <> 'written_off'
            ), 0)::text AS used
     FROM billing.agency_billing_profiles bp
     LEFT JOIN billing.task_charges tc ON tc.agency_id = bp.agency_id
     WHERE bp.agency_id = $1
     GROUP BY bp.monthly_cap`,
    [agencyId]
  );
  const monthlyCap = Number(result.rows[0]?.monthly_cap || 500);
  const used = Number(result.rows[0]?.used || 0);
  return { allowed: used + totalAmount <= monthlyCap, monthlyCap, used, totalAmount };
}

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
            t.quality_score::text, availability.available, n.name AS network_name, t.external_trader_id,
            EXISTS (
              SELECT 1 FROM trader.qualifications q
              WHERE q.trader_id = t.id AND q.review_status = 'approved' AND q.verified_at IS NOT NULL
                AND (q.expiry_date IS NULL OR q.expiry_date >= current_date)
                AND lower(q.qualification_type || ' ' || q.title) ~ '(electric|wiring|eicr|18th edition|part p)'
            ) AS electrical_qualification_active
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
    radiusMiles: Number(task.radius_miles),
    requiresElectricalQualification: requiresElectricalQualification(task.category, task.summary)
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
      available: trader.available,
      electricalQualificationActive: trader.electrical_qualification_active
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
