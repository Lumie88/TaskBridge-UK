import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { audit } from "../audit.js";
import { asyncHandler } from "../async-handler.js";
import { createSession, publicUser, revokeSession } from "../auth.js";
import { query, withTransaction } from "../db.js";
import { sendDemoRequestReceipt } from "../integrations.js";
import { hashPassword, hashToken, isWorkEmail, verifyPassword } from "../security.js";
import type { UserRole } from "../types.js";

interface UserRow {
  id: string;
  agency_id: string | null;
  full_name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  status: string;
}

const signInLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });

const signInSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  portal: z.enum(["care", "admin"]).default("care")
});

const demoRequestSchema = z.object({
  fullName: z.string().min(2).max(120),
  organisationName: z.string().min(2).max(160),
  workEmail: z.string().email().max(200),
  message: z.string().max(1000).optional().default("")
});
const handymanJoinRequestSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  businessName: z.string().trim().max(160).optional().default(""),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(8).max(30),
  postcode: z.string().trim().min(4).max(12),
  services: z.array(z.string().trim().min(2).max(80)).min(1).max(12),
  hasEnhancedDbs: z.boolean().default(false),
  hasPublicLiability: z.boolean().default(false),
  message: z.string().trim().max(1200).optional().default("")
});
const acceptInvitationSchema = z.object({
  password: z.string().min(12).max(200)
    .refine((value) => /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value), "Use upper and lower case letters and a number")
});

export const authRouter = Router();

authRouter.post("/demo-request", signInLimiter, asyncHandler(async (req, res) => {
  const parsed = demoRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: "Enter valid organisation details" });
  const email = parsed.data.workEmail.trim().toLowerCase();
  if (!isWorkEmail(email)) return res.status(422).json({ error: "Please use a work email address" });
  const created = await query<{ id: string }>(
    `INSERT INTO tenant.demo_requests (full_name, organisation_name, work_email, message, ip_address)
     VALUES ($1, $2, $3, $4, $5) RETURNING id::text`,
    [parsed.data.fullName, parsed.data.organisationName, email, parsed.data.message || null, req.ip]
  );
  const delivery = await sendDemoRequestReceipt({
    email,
    fullName: parsed.data.fullName,
    organisationName: parsed.data.organisationName
  });
  await query(
    `INSERT INTO integration.notification_deliveries
      (channel, purpose, recipient_reference, provider, provider_message_id, status, metadata)
     VALUES ('email', 'demo_request_receipt', $1, 'email_provider', $2, $3, $4)`,
    [email, delivery.providerMessageId, delivery.status, { demoRequestId: created.rows[0].id }]
  );
  res.status(201).json({ status: "received", emailDeliveryStatus: delivery.status });
}));

authRouter.post("/handyman-join-request", signInLimiter, asyncHandler(async (req, res) => {
  const parsed = handymanJoinRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: "Enter valid handyman application details" });
  const data = parsed.data;
  const created = await query<{ id: string }>(
    `INSERT INTO tenant.handyman_join_requests
      (full_name, business_name, email, phone, postcode, services, has_enhanced_dbs, has_public_liability, message, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id::text`,
    [data.fullName, data.businessName || null, data.email.toLowerCase(), data.phone, data.postcode.toUpperCase(), data.services, data.hasEnhancedDbs, data.hasPublicLiability, data.message || null, req.ip]
  );
  await query(
    `INSERT INTO integration.notification_deliveries
      (channel, purpose, recipient_reference, provider, provider_message_id, status, metadata)
     VALUES ('internal', 'handyman_join_request', $1, 'taskbridge', $2, 'queued', $3)`,
    [data.email.toLowerCase(), created.rows[0].id, { services: data.services, postcode: data.postcode.toUpperCase() }]
  );
  res.status(201).json({ status: "received", requestId: created.rows[0].id });
}));

authRouter.get("/staff-invitations/:token", asyncHandler(async (req, res) => {
  const result = await query<{
    full_name: string; email: string; role: UserRole; expires_at: string; organisation_name: string;
  }>(
    `SELECT i.full_name, i.email::text, i.role, i.expires_at::text,
            COALESCE(a.name, 'TaskBridge') AS organisation_name
     FROM auth.user_invitations i
     LEFT JOIN tenant.agencies a ON a.id = i.agency_id
     WHERE i.token_hash = $1 AND i.status = 'pending' AND i.expires_at > clock_timestamp()`,
    [hashToken(req.params.token)]
  );
  const invitation = result.rows[0];
  if (!invitation) return res.status(404).json({ error: "This invitation is invalid or has expired" });
  res.json({ invitation: {
    fullName: invitation.full_name,
    email: invitation.email,
    role: invitation.role,
    organisationName: invitation.organisation_name,
    expiresAt: invitation.expires_at
  } });
}));

authRouter.post("/staff-invitations/:token/accept", signInLimiter, asyncHandler(async (req, res) => {
  const parsed = acceptInvitationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.issues[0]?.message || "Use a stronger password" });
  const passwordHash = await hashPassword(parsed.data.password);
  const accepted = await withTransaction(null, async (client) => {
    const invitationResult = await client.query<{
      id: string; agency_id: string | null; full_name: string; email: string; role: UserRole;
    }>(
      `SELECT id::text, agency_id::text, full_name, email::text, role
       FROM auth.user_invitations
       WHERE token_hash = $1 AND status = 'pending' AND expires_at > clock_timestamp()
       FOR UPDATE`,
      [hashToken(req.params.token)]
    );
    const invitation = invitationResult.rows[0];
    if (!invitation) throw Object.assign(new Error("This invitation is invalid or has expired"), { statusCode: 404 });
    const existing = await client.query("SELECT 1 FROM auth.users WHERE email = $1 AND deleted_at IS NULL", [invitation.email]);
    if (existing.rowCount) throw Object.assign(new Error("An active account already exists for this email"), { statusCode: 409 });
    const user = await client.query<{ id: string }>(
      `INSERT INTO auth.users (agency_id, full_name, email, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5, 'active') RETURNING id::text`,
      [invitation.agency_id, invitation.full_name, invitation.email, passwordHash, invitation.role]
    );
    await client.query(
      `UPDATE auth.user_invitations SET status = 'accepted', accepted_at = clock_timestamp() WHERE id = $1`,
      [invitation.id]
    );
    return { userId: user.rows[0].id, role: invitation.role };
  });
  await audit(req, "auth.staff_invitation.accepted", "user", accepted.userId, { role: accepted.role });
  res.status(201).json({ status: "active", portal: accepted.role.startsWith("taskbridge_") ? "admin" : "care" });
}));

authRouter.get("/me", (req, res) => {
  if (!req.auth) return res.status(401).json({ error: "Not signed in" });
  res.json({ user: publicUser(req.auth) });
});

authRouter.post("/signin", signInLimiter, async (req, res) => {
  const parsed = signInSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: "Enter a valid email and password" });
  const email = parsed.data.email.trim().toLowerCase();
  const result = await query<UserRow>(
    `SELECT id::text, agency_id::text, full_name, email::text, password_hash, role, status
     FROM auth.users WHERE email = $1 AND deleted_at IS NULL`,
    [email]
  );
  const user = result.rows[0];
  const validPassword = user ? await verifyPassword(parsed.data.password, user.password_hash) : false;
  const careRole = user && ["care_coordinator", "care_manager"].includes(user.role);
  const adminRole = user && ["taskbridge_admin", "taskbridge_super_admin"].includes(user.role);
  const validPortal = parsed.data.portal === "care" ? careRole : adminRole;
  const succeeded = Boolean(user && user.status === "active" && validPassword && validPortal);
  await query(
    "INSERT INTO auth.login_attempts (email, ip_address, succeeded, reason) VALUES ($1, $2, $3, $4)",
    [email, req.ip, succeeded, succeeded ? null : "invalid_credentials_or_portal"]
  );
  if (!succeeded || !user) return res.status(401).json({ error: "Invalid credentials" });

  await query("UPDATE auth.users SET last_login_at = clock_timestamp() WHERE id = $1", [user.id]);
  await createSession(req, res, user.id);
  req.auth = {
    sessionId: "new",
    userId: user.id,
    agencyId: user.agency_id,
    fullName: user.full_name,
    email: user.email,
    role: user.role
  };
  await audit(req, "auth.signin", "user", user.id);
  res.json({ user: publicUser(req.auth) });
});

authRouter.post("/signout", async (req, res) => {
  if (req.auth) await audit(req, "auth.signout", "user", req.auth.userId);
  await revokeSession(req, res);
  res.status(204).end();
});
