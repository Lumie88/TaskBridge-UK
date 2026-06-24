import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { audit } from "../audit.js";
import { createSession, publicUser, revokeSession } from "../auth.js";
import { query } from "../db.js";
import { isWorkEmail, verifyPassword } from "../security.js";
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

export const authRouter = Router();

authRouter.post("/demo-request", signInLimiter, async (req, res) => {
  const parsed = demoRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: "Enter valid organisation details" });
  const email = parsed.data.workEmail.trim().toLowerCase();
  if (!isWorkEmail(email)) return res.status(422).json({ error: "Please use a work email address" });
  await query(
    `INSERT INTO tenant.demo_requests (full_name, organisation_name, work_email, message, ip_address)
     VALUES ($1, $2, $3, $4, $5)`,
    [parsed.data.fullName, parsed.data.organisationName, email, parsed.data.message || null, req.ip]
  );
  res.status(201).json({ status: "received" });
});

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
