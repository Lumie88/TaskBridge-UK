import { createHmac, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { query, withTransaction } from "../db.js";
import { encryptField, hashToken, publicId } from "../security.js";
import { createTaskPlan } from "../task-planner.js";

const incomingTaskSchema = z.object({
  service_user_id: z.string().min(1).max(200),
  notes: z.string().min(10).max(5000),
  preferred_window_start: z.string().datetime().optional(),
  preferred_window_end: z.string().datetime().optional(),
  carer_on_site: z.boolean().default(false)
});

const dbsCallbackSchema = z.object({
  providerSessionId: z.string().min(2).max(300),
  status: z.enum(["pending", "approved", "rejected", "unclear"]),
  outcome: z.string().max(500).optional(),
  expiryDate: z.string().date().nullable().optional(),
  evidenceReference: z.string().max(300).optional()
});

export const webhookRouter = Router();

webhookRouter.post("/incoming-care-task", async (req, res) => {
  const authorization = req.get("authorization") || "";
  const rawKey = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!rawKey) return res.status(401).json({ error: "Agency API key required" });
  const keyResult = await query<{ agency_id: string; scopes: string[] }>(
    `UPDATE tenant.agency_api_keys k
     SET last_used_at = clock_timestamp()
     FROM tenant.agencies a
     WHERE k.key_hash = $1 AND k.agency_id = a.id
       AND k.revoked_at IS NULL AND (k.expires_at IS NULL OR k.expires_at > clock_timestamp())
       AND a.status = 'active'
     RETURNING k.agency_id::text, k.scopes`,
    [hashToken(rawKey)]
  );
  const key = keyResult.rows[0];
  if (!key || !key.scopes.includes("tasks:write")) return res.status(401).json({ error: "Agency API key is invalid or out of scope" });
  const idempotencyKey = req.get("idempotency-key") || "";
  if (!idempotencyKey) return res.status(422).json({ error: "Idempotency-Key header is required" });
  const parsed = incomingTaskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.issues[0]?.message || "Invalid care task" });

  const existing = await query<{ request_metadata: { taskIds?: string[] } }>(
    `SELECT request_metadata FROM integration.webhook_logs
     WHERE agency_id = $1 AND direction = 'inbound' AND idempotency_key = $2`,
    [key.agency_id, idempotencyKey]
  );
  if (existing.rows[0]) return res.status(200).json({ duplicate: true, taskIds: existing.rows[0].request_metadata.taskIds || [] });

  const serviceUser = await query<{ id: string; risk_level: string }>(
    `SELECT id::text, risk_level::text FROM care.service_users
     WHERE agency_id = $1 AND external_service_user_id = $2 AND deleted_at IS NULL`,
    [key.agency_id, parsed.data.service_user_id]
  );
  if (!serviceUser.rows[0]) return res.status(404).json({ error: "Service user is not registered for this agency" });
  const vulnerable = serviceUser.rows[0].risk_level !== "standard";
  const suggestions = await createTaskPlan(parsed.data.notes, vulnerable);

  const taskIds = await withTransaction(null, async (client) => {
    const note = await client.query<{ id: string }>(
      `INSERT INTO care.care_notes
        (agency_id, service_user_id, note_ciphertext, source, idempotency_key)
       VALUES ($1, $2, $3, 'care_webhook', $4) RETURNING id::text`,
      [key.agency_id, serviceUser.rows[0].id, encryptField(parsed.data.notes), idempotencyKey]
    );
    const ids: string[] = [];
    for (const suggestion of suggestions) {
      const taskPublicId = publicId("tsk");
      const task = await client.query<{ id: string }>(
        `INSERT INTO ops.tasks
          (public_id, agency_id, service_user_id, care_note_id, category, urgency, status, summary,
           notes_ciphertext, preferred_window_start, preferred_window_end, carer_on_site,
           vulnerable_adult, ring_fence_required)
         VALUES ($1, $2, $3, $4, $5, $6, 'awaiting_care_approval', $7, $8, $9, $10, $11, $12, $12)
         RETURNING id::text`,
        [taskPublicId, key.agency_id, serviceUser.rows[0].id, note.rows[0].id, suggestion.category,
          suggestion.urgency, suggestion.summary, encryptField(parsed.data.notes),
          parsed.data.preferred_window_start || null, parsed.data.preferred_window_end || null,
          parsed.data.carer_on_site, vulnerable]
      );
      await client.query(
        `INSERT INTO ops.task_status_events (task_id, agency_id, new_status, reason)
         VALUES ($1, $2, 'awaiting_care_approval', 'Received from care management application')`,
        [task.rows[0].id, key.agency_id]
      );
      ids.push(taskPublicId);
    }
    await client.query(
      `INSERT INTO integration.webhook_logs
        (agency_id, direction, endpoint, event_type, idempotency_key, status, request_metadata, response_status, response_metadata, processed_at)
       VALUES ($1, 'inbound', '/api/webhooks/incoming-care-task', 'care.task.received', $2, 'processed', $3, 201, $4, clock_timestamp())`,
      [key.agency_id, idempotencyKey, { serviceUserId: parsed.data.service_user_id, taskCount: ids.length }, { taskIds: ids }]
    );
    return ids;
  });
  res.status(201).json({ taskIds, status: "awaiting_care_approval", safeguardApplied: vulnerable });
});

webhookRouter.post("/dbs-callback", async (req, res) => {
  if (!config.dbsWebhookSecret) return res.status(503).json({ error: "DBS webhook secret is not configured" });
  const signature = req.get("x-taskbridge-signature") || "";
  const expected = createHmac("sha256", config.dbsWebhookSecret).update(req.rawBody || Buffer.alloc(0)).digest("hex");
  const validSignature = signature.length === expected.length
    && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!validSignature) return res.status(401).json({ error: "Invalid webhook signature" });
  const parsed = dbsCallbackSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: "Invalid DBS callback" });
  const data = parsed.data;
  const result = await query<{ trader_id: string }>(
    `UPDATE trader.dbs_verifications
     SET status = $2, outcome = $3, expiry_date = $4, evidence_reference = $5,
         checked_at = CASE WHEN $2 = 'pending' THEN checked_at ELSE clock_timestamp() END
     WHERE provider_session_id = $1 RETURNING trader_id::text`,
    [data.providerSessionId, data.status, data.outcome || null, data.expiryDate || null, data.evidenceReference || null]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "DBS verification session was not found" });
  await query(
    `INSERT INTO audit.audit_logs (action, entity_type, entity_id, metadata)
     VALUES ('dbs.callback.received', 'trader', $1, $2)`,
    [result.rows[0].trader_id, { status: data.status }]
  );
  res.json({ accepted: true });
});
