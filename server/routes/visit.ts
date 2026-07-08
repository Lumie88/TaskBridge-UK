import { Router } from "express";
import { z } from "zod";
import { query, withTransaction } from "../db.js";
import { haversineMiles } from "../matching.js";
import { decryptField, hashToken } from "../security.js";
import { createEvidenceUpload, evidenceFileUrl, verifyEvidenceUpload } from "../media.js";

interface VisitAccessRow {
  visit_id: string;
  task_id: string;
  agency_id: string;
  assignment_id: string;
  visit_status: string;
  task_status: string;
  category: string;
  summary: string;
  encrypted_address: string;
  preferred_window_start: string | null;
  preferred_window_end: string | null;
  latitude: string | null;
  longitude: string | null;
  trader_name: string;
  expires_at: string;
  revoked_at: string | null;
}

const checkInSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180)
});

const completeSchema = z.object({
  completionNotes: z.string().min(5).max(1000),
  afterPhotoStorageKey: z.string().min(20).max(500),
  afterPhotoContentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  afterPhotoSizeBytes: z.number().int().positive().max(10 * 1024 * 1024)
});

const uploadSchema = z.object({
  fileName: z.string().min(1).max(200),
  evidenceType: z.enum(["before_photo", "after_photo"]),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024)
});

const evidenceSchema = z.object({
  evidenceType: z.literal("before_photo"),
  storageKey: z.string().min(20).max(500),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024)
});

const declineSchema = z.object({
  reason: z.string().trim().min(5).max(500).optional().default("Handyman declined the assigned task")
});

export const visitRouter = Router();

visitRouter.get("/:token", async (req, res) => {
  const access = await findVisit(req.params.token);
  if (!access) return res.status(404).json({ error: "Visit link is invalid or expired" });
  res.json({
    visit: {
      status: access.visit_status,
      category: access.category,
      summary: access.summary,
      address: decryptField(access.encrypted_address),
      handyman: access.trader_name,
      preferredWindow: {
        start: access.preferred_window_start,
        end: access.preferred_window_end
      },
      mandatedInstruction: "Present physical identification to the resident or attending caregiver before work begins."
    }
  });
});

visitRouter.post("/:token/accept", async (req, res) => {
  const access = await findVisit(req.params.token);
  if (!access) return res.status(404).json({ error: "Visit link is invalid or expired" });
  if (!["link_sent", "pending"].includes(access.visit_status)) {
    return res.status(409).json({ error: "This task can no longer be accepted from this link" });
  }
  await withTransaction(null, async (client) => {
    await client.query("UPDATE ops.visits SET status = 'accepted' WHERE id = $1", [access.visit_id]);
    await client.query("UPDATE ops.tasks SET status = 'visit_scheduled' WHERE id = $1", [access.task_id]);
    await client.query(
      `INSERT INTO ops.task_status_events
        (task_id, agency_id, previous_status, new_status, reason)
       VALUES ($1, $2, $3, 'visit_scheduled', 'Handyman accepted the assigned task')`,
      [access.task_id, access.agency_id, access.task_status]
    );
  });
  res.json({ status: "accepted" });
});

visitRouter.post("/:token/decline", async (req, res) => {
  const parsed = declineSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: "Record a short reason for declining the task" });
  const access = await findVisit(req.params.token);
  if (!access) return res.status(404).json({ error: "Visit link is invalid or expired" });
  if (!["link_sent", "pending", "accepted"].includes(access.visit_status)) {
    return res.status(409).json({ error: "This task can no longer be declined from this link" });
  }
  await withTransaction(null, async (client) => {
    await client.query("UPDATE ops.visits SET status = 'cancelled', disputed_reason = $2 WHERE id = $1", [access.visit_id, parsed.data.reason]);
    await client.query("UPDATE ops.assignments SET status = 'rejected', blocked_reason = $2 WHERE id = $1", [access.assignment_id, parsed.data.reason]);
    await client.query(
      "UPDATE ops.visit_tokens SET revoked_at = clock_timestamp() WHERE visit_id = $1 AND revoked_at IS NULL",
      [access.visit_id]
    );
    await client.query(
      `UPDATE billing.payouts SET status = 'hold', hold_reason = 'Assignment declined before visit'
       WHERE assignment_id = $1`,
      [access.assignment_id]
    );
    await client.query("DELETE FROM ops.assignment_candidates WHERE task_id = $1", [access.task_id]);
    await client.query("UPDATE ops.tasks SET status = 'pending_taskbridge_assignment' WHERE id = $1", [access.task_id]);
    await client.query(
      `INSERT INTO ops.task_status_events
        (task_id, agency_id, previous_status, new_status, reason, metadata)
       VALUES ($1, $2, $3, 'pending_taskbridge_assignment', $4, $5)`,
      [access.task_id, access.agency_id, access.task_status, `Handyman declined assignment: ${parsed.data.reason}`, { assignmentId: access.assignment_id }]
    );
  });
  res.json({ status: "declined" });
});

visitRouter.post("/:token/check-in", async (req, res) => {
  const parsed = checkInSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: "A valid device location is required" });
  const access = await findVisit(req.params.token);
  if (!access) return res.status(404).json({ error: "Visit link is invalid or expired" });
  if (access.visit_status !== "accepted") return res.status(409).json({ error: "Accept the assigned task before checking in" });
  if (access.latitude === null || access.longitude === null) return res.status(409).json({ error: "Resident location is not configured" });
  const distance = haversineMiles(
    parsed.data.latitude,
    parsed.data.longitude,
    Number(access.latitude),
    Number(access.longitude)
  );
  if (distance > 0.35) return res.status(409).json({ error: "Check-in location is outside the permitted visit radius" });

  await withTransaction(null, async (client) => {
    await client.query(
      `UPDATE ops.visits
       SET status = 'checked_in', check_in_at = clock_timestamp(), check_in_latitude = $1, check_in_longitude = $2
       WHERE id = $3`,
      [parsed.data.latitude, parsed.data.longitude, access.visit_id]
    );
    await client.query("UPDATE ops.tasks SET status = 'checked_in' WHERE id = $1", [access.task_id]);
    await client.query(
      `UPDATE ops.visit_tokens SET first_used_at = COALESCE(first_used_at, clock_timestamp())
       WHERE token_hash = $1`,
      [hashToken(req.params.token)]
    );
    await client.query(
      `INSERT INTO ops.task_status_events
        (task_id, agency_id, previous_status, new_status, reason, metadata)
       VALUES ($1, $2, $3, 'checked_in', 'Geofenced trader check-in', $4)`,
      [access.task_id, access.agency_id, access.task_status, { distanceMiles: Number(distance.toFixed(3)) }]
    );
  });
  res.json({ status: "checked_in", distanceMiles: Number(distance.toFixed(3)) });
});

visitRouter.post("/:token/evidence-upload-url", async (req, res) => {
  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: "Select a JPEG, PNG or WebP photo smaller than 10 MB" });
  const access = await findVisit(req.params.token);
  if (!access) return res.status(404).json({ error: "Visit link is invalid or expired" });
  if (access.visit_status !== "checked_in") return res.status(409).json({ error: "Check in before uploading visit evidence" });
  const upload = await createEvidenceUpload(
    access.task_id,
    parsed.data.evidenceType,
    parsed.data.contentType,
    parsed.data.sizeBytes
  );
  res.json(upload);
});

visitRouter.post("/:token/evidence", async (req, res) => {
  const parsed = evidenceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: "Valid before-work evidence is required" });
  const access = await findVisit(req.params.token);
  if (!access) return res.status(404).json({ error: "Visit link is invalid or expired" });
  if (access.visit_status !== "checked_in") return res.status(409).json({ error: "Check in before uploading visit evidence" });
  await verifyEvidenceUpload(access.task_id, "before_photo", parsed.data.storageKey, parsed.data.contentType, parsed.data.sizeBytes);
  const fileUrl = evidenceFileUrl(parsed.data.storageKey);
  await withTransaction(null, async (client) => {
    await client.query(
      `INSERT INTO ops.visit_evidence (visit_id, task_id, evidence_type, file_url)
       VALUES ($1, $2, 'before_photo', $3)`,
      [access.visit_id, access.task_id, fileUrl]
    );
    await client.query("UPDATE ops.tasks SET before_photo_url = $1 WHERE id = $2", [fileUrl, access.task_id]);
  });
  res.status(201).json({ status: "recorded" });
});

visitRouter.post("/:token/complete", async (req, res) => {
  const parsed = completeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.issues[0]?.message || "Completion evidence is required" });
  const access = await findVisit(req.params.token);
  if (!access) return res.status(404).json({ error: "Visit link is invalid or expired" });
  if (access.visit_status !== "checked_in") return res.status(409).json({ error: "The visit must be checked in before completion" });

  const beforeEvidence = await query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM ops.visit_evidence
       WHERE visit_id = $1 AND evidence_type = 'before_photo' AND file_url IS NOT NULL
     ) AS exists`,
    [access.visit_id]
  );
  if (!beforeEvidence.rows[0]?.exists) return res.status(409).json({ error: "Upload a before-work photo before completing the visit" });
  await verifyEvidenceUpload(access.task_id, "after_photo", parsed.data.afterPhotoStorageKey, parsed.data.afterPhotoContentType, parsed.data.afterPhotoSizeBytes);
  const afterPhotoUrl = evidenceFileUrl(parsed.data.afterPhotoStorageKey);

  await withTransaction(null, async (client) => {
    await client.query(
      `UPDATE ops.visits
       SET status = 'evidence_submitted', check_out_at = clock_timestamp(), completion_notes = $1
       WHERE id = $2`,
      [parsed.data.completionNotes, access.visit_id]
    );
    await client.query(
      `INSERT INTO ops.visit_evidence (visit_id, task_id, evidence_type, file_url)
       VALUES ($1, $2, 'after_photo', $3)`,
      [access.visit_id, access.task_id, afterPhotoUrl]
    );
    await client.query(
      `UPDATE ops.tasks SET status = 'awaiting_care_confirmation', after_photo_url = $1 WHERE id = $2`,
      [afterPhotoUrl, access.task_id]
    );
    await client.query(
      `INSERT INTO ops.task_status_events
        (task_id, agency_id, previous_status, new_status, reason)
       VALUES ($1, $2, 'checked_in', 'awaiting_care_confirmation', 'Trader submitted completion evidence')`,
      [access.task_id, access.agency_id]
    );
  });
  res.json({ status: "awaiting_care_confirmation" });
});

async function findVisit(rawToken: string) {
  const result = await query<VisitAccessRow>(
    `SELECT v.id::text AS visit_id, t.id::text AS task_id, t.agency_id::text,
            v.assignment_id::text, v.status::text AS visit_status,
            t.status::text AS task_status, t.category, t.summary, su.encrypted_address,
            t.preferred_window_start::text, t.preferred_window_end::text,
            su.latitude::text, su.longitude::text, tr.display_name AS trader_name,
            vt.expires_at::text, vt.revoked_at::text
     FROM ops.visit_tokens vt
     JOIN ops.visits v ON v.id = vt.visit_id
     JOIN ops.tasks t ON t.id = vt.task_id
     JOIN care.service_users su ON su.id = t.service_user_id
     JOIN trader.traders tr ON tr.id = v.trader_id
     WHERE vt.token_hash = $1 AND vt.revoked_at IS NULL AND vt.expires_at > clock_timestamp()`,
    [hashToken(rawToken)]
  );
  return result.rows[0] || null;
}
