import { createHmac, timingSafeEqual } from "node:crypto";
import { type Request, type Response, Router } from "express";
import { z } from "zod";
import { normalizeCarePlatformEvent, parseCarePlatformProvider, type NormalizedCarePlatformEvent } from "../care-platform-adapters.js";
import { config } from "../config.js";
import { query, withTransaction } from "../db.js";
import { normalizeDbsProviderCallback } from "../integrations.js";
import { decryptField, encryptField, hashToken, publicId } from "../security.js";
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

webhookRouter.post("/care-platforms/:provider", async (req, res) => {
  const provider = parseCarePlatformProvider(req.params.provider);
  if (!provider) return res.status(404).json({ error: "Care-platform provider is not supported" });

  const agencyKey = await authenticateAgencyWebhookKey(req);
  if (!agencyKey) return res.status(401).json({ error: "Agency API key is invalid or out of scope" });

  const integration = await careProviderIntegration(agencyKey.agency_id, provider);
  const signingSecret = integration?.settings?.webhookSigningSecretCiphertext
    ? decryptField(String(integration.settings.webhookSigningSecretCiphertext))
    : integration?.settings?.webhookSigningSecret;
  if (typeof signingSecret === "string" && signingSecret.trim()) {
    const signature = req.get("signature") || req.get("x-webhook-signature") || req.get("x-taskbridge-signature") || "";
    if (!validWebhookSignature(signature, signingSecret, req.rawBody || Buffer.alloc(0))) {
      await logCarePlatformFailure(agencyKey.agency_id, integration?.provider_config_id || null, provider, "unknown", "signature_failed", req.body);
      return res.status(401).json({ error: "Invalid webhook signature" });
    }
  }

  const normalized = normalizeCarePlatformEvent(provider, req.body);
  if (!normalized) {
    await logCarePlatformFailure(agencyKey.agency_id, integration?.provider_config_id || null, provider, "unknown", "invalid_payload", req.body);
    return res.status(422).json({ error: "Unsupported or invalid care-platform event" });
  }

  const idempotencyKey = req.get("idempotency-key") || `${provider}:${normalized.eventType}:${normalized.eventId}`;
  const existing = await query<{ response_metadata: { taskIds?: string[]; serviceUserId?: string } }>(
    `SELECT response_metadata FROM integration.webhook_logs
     WHERE agency_id = $1 AND direction = 'inbound' AND idempotency_key = $2`,
    [agencyKey.agency_id, idempotencyKey]
  );
  if (existing.rows[0]) return res.status(200).json({ duplicate: true, ...existing.rows[0].response_metadata });

  try {
    const processed = await processCarePlatformEvent(agencyKey.agency_id, integration?.provider_config_id || null, idempotencyKey, normalized);
    res.status(processed.created ? 201 : 200).json(processed.response);
  } catch (error) {
    await logCarePlatformFailure(
      agencyKey.agency_id,
      integration?.provider_config_id || null,
      provider,
      normalized.eventType,
      error instanceof Error ? error.message : "Care-platform event processing failed",
      normalized.raw,
      idempotencyKey
    );
    throw error;
  }
});

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

async function authenticateAgencyWebhookKey(req: Request) {
  const authorization = req.get("authorization") || "";
  const rawKey = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!rawKey) return null;
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
  return key?.scopes.includes("tasks:write") ? key : null;
}

async function careProviderIntegration(agencyId: string, provider: string) {
  const result = await query<{ provider_config_id: string; settings: Record<string, unknown> }>(
    `SELECT pc.id::text AS provider_config_id, ai.settings
     FROM integration.provider_configs pc
     JOIN integration.agency_integrations ai ON ai.provider_config_id = pc.id
     WHERE ai.agency_id = $1
       AND pc.provider_type = 'care_management'
       AND lower(pc.name) = $2
       AND pc.enabled
       AND ai.enabled
     LIMIT 1`,
    [agencyId, provider]
  );
  return result.rows[0] || null;
}

function validWebhookSignature(signature: string, secret: string, rawBody: Buffer) {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

async function processCarePlatformEvent(
  agencyId: string,
  providerConfigId: string | null,
  idempotencyKey: string,
  event: NormalizedCarePlatformEvent
) {
  const taskText = event.eventType === "risk_hazard.logged" ? event.hazardText || event.noteText : event.noteText || event.hazardText;
  const suggestions = event.eventType === "service_user.updated" || event.eventType === "visit.completed" || !taskText
    ? []
    : await createTaskPlan(taskText, event.serviceUser.riskLevel !== "standard");

  const result = await withTransaction(null, async (client) => {
    const serviceUser = await upsertWebhookServiceUser(client, agencyId, event);
    const taskIds: string[] = [];
    let careNoteId: string | null = null;

    if (taskText) {
      const note = await client.query<{ id: string }>(
        `INSERT INTO care.care_notes
          (agency_id, service_user_id, external_note_id, note_ciphertext, source, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (agency_id, idempotency_key) DO UPDATE SET external_note_id = EXCLUDED.external_note_id
         RETURNING id::text`,
        [agencyId, serviceUser.id, event.eventId, encryptField(taskText), `${event.provider}_webhook`, idempotencyKey]
      );
      careNoteId = note.rows[0].id;
    }

    for (const suggestion of suggestions) {
      const taskPublicId = publicId("tsk");
      const task = await client.query<{ id: string }>(
        `INSERT INTO ops.tasks
          (public_id, agency_id, service_user_id, care_note_id, category, urgency, status, summary,
           notes_ciphertext, preferred_window_start, preferred_window_end, carer_on_site,
           vulnerable_adult, ring_fence_required)
         VALUES ($1, $2, $3, $4, $5, $6, 'awaiting_care_approval', $7, $8, $9, $10, $11, $12, $12)
         RETURNING id::text`,
        [taskPublicId, agencyId, serviceUser.id, careNoteId, suggestion.category, suggestion.urgency,
          suggestion.summary, encryptField(taskText || suggestion.summary), event.preferredWindowStart,
          event.preferredWindowEnd, event.carerOnSite, event.serviceUser.riskLevel !== "standard"]
      );
      await client.query(
        `INSERT INTO ops.task_status_events
          (task_id, agency_id, new_status, reason, metadata)
         VALUES ($1, $2, 'awaiting_care_approval', 'Received from care management application', $3)`,
        [task.rows[0].id, agencyId, { provider: event.provider, eventType: event.eventType, eventId: event.eventId }]
      );
      taskIds.push(taskPublicId);
    }

    const response = {
      accepted: true,
      provider: event.provider,
      eventType: event.eventType,
      serviceUserId: serviceUser.publicId,
      taskIds,
      status: event.eventType === "visit.completed" ? "visit_completion_received" : taskIds.length ? "awaiting_care_approval" : "service_user_synced"
    };
    await client.query(
      `INSERT INTO integration.webhook_logs
        (agency_id, provider_config_id, direction, endpoint, event_type, idempotency_key,
         status, request_metadata, response_status, response_metadata, processed_at)
       VALUES ($1, $2, 'inbound', $3, $4, $5, 'processed', $6, $7, $8, clock_timestamp())`,
      [agencyId, providerConfigId, `/api/webhooks/care-platforms/${event.provider}`, event.eventType, idempotencyKey,
        { provider: event.provider, eventId: event.eventId, serviceUserExternalId: event.serviceUser.externalId },
        taskIds.length ? 201 : 200, response]
    );
    return response;
  });

  return { created: result.taskIds.length > 0, response: result };
}

async function upsertWebhookServiceUser(client: { query: typeof query }, agencyId: string, event: NormalizedCarePlatformEvent) {
  const normalizedPostcode = event.serviceUser.postcode?.toUpperCase().replace(/\s+/g, "") || null;
  const existing = await client.query<{ id: string; external_service_user_id: string }>(
    `SELECT id::text, external_service_user_id
     FROM care.service_users
     WHERE agency_id = $1 AND external_service_user_id = $2 AND deleted_at IS NULL
     LIMIT 1`,
    [agencyId, event.serviceUser.externalId]
  );
  if (existing.rows[0]) {
    const updated = await client.query<{ id: string; external_service_user_id: string }>(
      `UPDATE care.service_users
       SET encrypted_name = COALESCE($3, encrypted_name),
           encrypted_address = COALESCE($4, encrypted_address),
           town_ciphertext = COALESCE($5, town_ciphertext),
           county_ciphertext = COALESCE($6, county_ciphertext),
           postcode_ciphertext = COALESCE($7, postcode_ciphertext),
           postcode_hash = COALESCE($8, postcode_hash),
           risk_level = $9,
           vulnerability_notes_ciphertext = COALESCE($10, vulnerability_notes_ciphertext),
           updated_at = clock_timestamp()
       WHERE id = $1 AND agency_id = $2
       RETURNING id::text, external_service_user_id`,
      [existing.rows[0].id, agencyId,
        event.serviceUser.fullName ? encryptField(event.serviceUser.fullName) : null,
        event.serviceUser.address ? encryptField(event.serviceUser.address) : null,
        event.serviceUser.town ? encryptField(event.serviceUser.town) : null,
        event.serviceUser.county ? encryptField(event.serviceUser.county) : null,
        event.serviceUser.postcode ? encryptField(event.serviceUser.postcode.toUpperCase()) : null,
        normalizedPostcode ? hashToken(normalizedPostcode) : null,
        event.serviceUser.riskLevel,
        event.serviceUser.vulnerabilityNotes ? encryptField(event.serviceUser.vulnerabilityNotes) : null]
    );
    return { id: updated.rows[0].id, publicId: updated.rows[0].external_service_user_id };
  }

  if (!event.serviceUser.fullName || !event.serviceUser.address) {
    throw Object.assign(new Error("New service-user events must include at least name and address"), { statusCode: 422 });
  }
  const created = await client.query<{ id: string; external_service_user_id: string }>(
    `INSERT INTO care.service_users
      (agency_id, external_service_user_id, encrypted_name, encrypted_address, postcode_hash,
       town_ciphertext, county_ciphertext, postcode_ciphertext, risk_level, vulnerability_notes_ciphertext)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id::text, external_service_user_id`,
    [agencyId, event.serviceUser.externalId, encryptField(event.serviceUser.fullName), encryptField(event.serviceUser.address),
      normalizedPostcode ? hashToken(normalizedPostcode) : null,
      event.serviceUser.town ? encryptField(event.serviceUser.town) : null,
      event.serviceUser.county ? encryptField(event.serviceUser.county) : null,
      event.serviceUser.postcode ? encryptField(event.serviceUser.postcode.toUpperCase()) : null,
      event.serviceUser.riskLevel,
      event.serviceUser.vulnerabilityNotes ? encryptField(event.serviceUser.vulnerabilityNotes) : null]
  );
  return { id: created.rows[0].id, publicId: created.rows[0].external_service_user_id };
}

async function logCarePlatformFailure(
  agencyId: string,
  providerConfigId: string | null,
  provider: string,
  eventType: string,
  message: string,
  payload: unknown,
  idempotencyKey: string | null = null
) {
  await query(
    `INSERT INTO integration.webhook_logs
      (agency_id, provider_config_id, direction, endpoint, event_type, idempotency_key,
       status, request_metadata, response_status, error_message)
     VALUES ($1, $2, 'inbound', $3, $4, $5, 'failed', $6, 422, $7)
     ON CONFLICT (agency_id, direction, idempotency_key) DO UPDATE
       SET status = 'failed', error_message = EXCLUDED.error_message, response_status = EXCLUDED.response_status`,
    [agencyId, providerConfigId, `/api/webhooks/care-platforms/${provider}`, eventType, idempotencyKey,
      { provider, payloadPreview: payload }, message.slice(0, 500)]
  );
}

async function handleDbsCallback(req: Request, res: Response) {
  if (!config.dbsWebhookSecret) return res.status(503).json({ error: "DBS webhook secret is not configured" });
  const signature = req.get("x-taskbridge-signature") || req.get("x-amiqus-signature") || req.get("x-signature") || "";
  const expected = createHmac("sha256", config.dbsWebhookSecret).update(req.rawBody || Buffer.alloc(0)).digest("hex");
  const validSignature = signature.length === expected.length
    && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!validSignature) return res.status(401).json({ error: "Invalid webhook signature" });
  const parsed = dbsCallbackSchema.safeParse(req.body);
  const normalized = parsed.success
    ? {
        providerSessionId: parsed.data.providerSessionId,
        status: parsed.data.status,
        outcome: parsed.data.outcome || null,
        expiryDate: parsed.data.expiryDate || null,
        evidenceReference: parsed.data.evidenceReference || parsed.data.providerSessionId,
        eventType: "dbs.callback",
        raw: req.body
      }
    : normalizeDbsProviderCallback(req.body);
  if (!normalized) return res.status(422).json({ error: "Invalid DBS callback" });
  const result = await query<{ trader_id: string }>(
    `UPDATE trader.dbs_verifications
     SET status = $2, outcome = $3, expiry_date = $4, evidence_reference = $5,
         provider_event_type = $6, provider_payload = $7,
         checked_at = CASE WHEN $2 = 'pending' THEN checked_at ELSE clock_timestamp() END
     WHERE provider_session_id = $1 RETURNING trader_id::text`,
    [
      normalized.providerSessionId,
      normalized.status,
      normalized.outcome,
      normalized.expiryDate,
      normalized.evidenceReference,
      normalized.eventType,
      normalized.raw
    ]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "DBS verification session was not found" });
  await query(
    `INSERT INTO audit.audit_logs (action, entity_type, entity_id, metadata)
     VALUES ('dbs.callback.received', 'trader', $1, $2)`,
    [result.rows[0].trader_id, {
      providerSessionId: normalized.providerSessionId,
      status: normalized.status,
      eventType: normalized.eventType
    }]
  );
  res.json({ accepted: true });
}

webhookRouter.post("/dbs-callback", handleDbsCallback);
webhookRouter.post("/amiqus-callback", handleDbsCallback);
