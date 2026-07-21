import { Router } from "express";
import { z } from "zod";
import { audit } from "../audit.js";
import { asyncHandler } from "../async-handler.js";
import { query, withTransaction } from "../db.js";
import { decryptField, hashToken } from "../security.js";

const confirmPaymentSchema = z.object({
  payerName: z.string().trim().min(2).max(160),
  confirmationReference: z.string().trim().min(3).max(160)
});

export const familyRouter = Router();

familyRouter.get("/payments/:token", asyncHandler(async (req, res) => {
  const tokenHash = hashToken(req.params.token);
  const result = await query<{
    id: string; task_public_id: string; agency_name: string; encrypted_name: string;
    category: string; summary: string; amount: string; currency: string; status: string;
    payer_email: string; payer_name: string | null; expires_at: string;
  }>(
    `SELECT s.id::text, t.public_id AS task_public_id, ag.name AS agency_name,
            su.encrypted_name, t.category, t.summary, s.amount::text, s.currency,
            s.status, s.payer_email::text, s.payer_name, s.expires_at::text
     FROM billing.family_payment_sessions s
     JOIN ops.tasks t ON t.id = s.task_id
     JOIN tenant.agencies ag ON ag.id = s.agency_id
     JOIN care.service_users su ON su.id = t.service_user_id
     WHERE s.token_hash = $1`,
    [tokenHash]
  );
  const session = result.rows[0];
  if (!session) return res.status(404).json({ error: "Payment link not found" });
  const expired = new Date(session.expires_at).getTime() < Date.now();
  if (expired && session.status !== "paid") {
    await query("UPDATE billing.family_payment_sessions SET status = 'expired' WHERE id = $1 AND status IN ('created', 'opened')", [session.id]);
    return res.status(410).json({ error: "Payment link has expired" });
  }
  await query("UPDATE billing.family_payment_sessions SET status = 'opened' WHERE id = $1 AND status = 'created'", [session.id]);
  res.json({
    payment: {
      id: session.id,
      taskId: session.task_public_id,
      agencyName: session.agency_name,
      serviceUserInitials: initials(decryptField(session.encrypted_name)),
      category: session.category,
      summary: session.summary,
      amount: Number(session.amount),
      currency: session.currency,
      status: session.status === "created" ? "opened" : session.status,
      payerEmail: session.payer_email,
      payerName: session.payer_name
    }
  });
}));

familyRouter.post("/payments/:token/confirm", asyncHandler(async (req, res) => {
  const parsed = confirmPaymentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.issues[0]?.message || "Payment confirmation is invalid" });
  const tokenHash = hashToken(req.params.token);
  const result = await withTransaction(null, async (client) => {
    const sessionResult = await client.query<{
      id: string; task_id: string; agency_id: string; status: string; expires_at: string;
    }>(
      `SELECT id::text, task_id::text, agency_id::text, status, expires_at::text
       FROM billing.family_payment_sessions
       WHERE token_hash = $1 FOR UPDATE`,
      [tokenHash]
    );
    const session = sessionResult.rows[0];
    if (!session) return { status: 404, error: "Payment link not found" } as const;
    if (session.status === "paid") return { status: 200, taskId: session.task_id, alreadyPaid: true } as const;
    if (new Date(session.expires_at).getTime() < Date.now()) {
      await client.query("UPDATE billing.family_payment_sessions SET status = 'expired' WHERE id = $1", [session.id]);
      return { status: 410, error: "Payment link has expired" } as const;
    }
    await client.query(
      `UPDATE billing.family_payment_sessions
       SET status = 'paid', payer_name = $2, provider_session_id = $3, paid_at = clock_timestamp()
       WHERE id = $1`,
      [session.id, parsed.data.payerName, parsed.data.confirmationReference]
    );
    await client.query(
      `UPDATE ops.tasks
       SET payment_status = 'family_paid', updated_at = clock_timestamp()
       WHERE id = $1 AND payment_route = 'family_representative'`,
      [session.task_id]
    );
    await client.query(
      `INSERT INTO ops.task_status_events
        (task_id, agency_id, previous_status, new_status, reason, metadata)
       SELECT id, agency_id, status, status, 'Family payment confirmed through secure payment link', $2
       FROM ops.tasks WHERE id = $1`,
      [session.task_id, { paymentSessionId: session.id, confirmationReference: parsed.data.confirmationReference }]
    );
    return { status: 200, taskId: session.task_id, alreadyPaid: false } as const;
  });
  if ("error" in result) return res.status(result.status).json({ error: result.error });
  await audit(req, "family.payment.confirmed", "task", result.taskId, { alreadyPaid: result.alreadyPaid });
  res.json({ status: "paid" });
}));

familyRouter.get("/updates/:token", asyncHandler(async (req, res) => {
  const tokenHash = hashToken(req.params.token);
  const result = await query<{
    id: string; task_id: string; task_public_id: string; agency_name: string; encrypted_name: string;
    category: string; summary: string; status: string; completion_notes: string | null;
    before_photo_url: string | null; after_photo_url: string | null; link_status: string; expires_at: string;
    confirmed_at: string | null;
  }>(
    `SELECT l.id::text, t.id::text AS task_id, t.public_id AS task_public_id,
            ag.name AS agency_name, su.encrypted_name, t.category, t.summary,
            t.status::text, v.completion_notes, t.before_photo_url, t.after_photo_url,
            l.status AS link_status, l.expires_at::text, v.confirmed_at::text
     FROM ops.family_update_links l
     JOIN ops.tasks t ON t.id = l.task_id
     JOIN tenant.agencies ag ON ag.id = l.agency_id
     JOIN care.service_users su ON su.id = t.service_user_id
     LEFT JOIN LATERAL (
       SELECT completion_notes, confirmed_at FROM ops.visits vv
       WHERE vv.task_id = t.id ORDER BY vv.created_at DESC LIMIT 1
     ) v ON true
     WHERE l.token_hash = $1`,
    [tokenHash]
  );
  const update = result.rows[0];
  if (!update) return res.status(404).json({ error: "Family update link not found" });
  if (new Date(update.expires_at).getTime() < Date.now() && update.link_status !== "opened") {
    await query("UPDATE ops.family_update_links SET status = 'expired' WHERE id = $1 AND status = 'created'", [update.id]);
    return res.status(410).json({ error: "Family update link has expired" });
  }
  await query(
    `UPDATE ops.family_update_links
     SET status = 'opened', first_opened_at = COALESCE(first_opened_at, clock_timestamp())
     WHERE id = $1 AND status = 'created'`,
    [update.id]
  );
  res.json({
    update: {
      taskId: update.task_public_id,
      agencyName: update.agency_name,
      serviceUserInitials: initials(decryptField(update.encrypted_name)),
      category: update.category,
      summary: update.summary,
      status: update.status,
      completionNotes: update.completion_notes,
      beforePhotoUrl: update.before_photo_url,
      afterPhotoUrl: update.after_photo_url,
      confirmedAt: update.confirmed_at
    }
  });
}));

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "SU";
}
