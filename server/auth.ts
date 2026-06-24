import type { NextFunction, Request, RequestHandler, Response } from "express";
import { config } from "./config.js";
import { query } from "./db.js";
import { createOpaqueToken, hashToken } from "./security.js";
import type { AuthContext, UserRole } from "./types.js";

export const SESSION_COOKIE = "tb_session";
const secureCookie = config.appOrigin.startsWith("https://");

interface SessionRow {
  session_id: string;
  user_id: string;
  agency_id: string | null;
  full_name: string;
  email: string;
  role: UserRole;
}

export function publicUser(auth: AuthContext) {
  return {
    id: auth.userId,
    agencyId: auth.agencyId,
    fullName: auth.fullName,
    email: auth.email,
    role: auth.role
  };
}

export async function createSession(req: Request, res: Response, userId: string) {
  const rawToken = createOpaqueToken();
  const expiresAt = new Date(Date.now() + config.sessionTtlHours * 60 * 60 * 1000);
  await query(
    `INSERT INTO auth.sessions (user_id, token_hash, ip_address, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, hashToken(rawToken), req.ip, req.get("user-agent") || null, expiresAt]
  );
  res.cookie(SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    path: "/",
    expires: expiresAt
  });
}

export async function revokeSession(req: Request, res: Response) {
  const rawToken = req.cookies?.[SESSION_COOKIE];
  if (rawToken) {
    await query("UPDATE auth.sessions SET revoked_at = clock_timestamp() WHERE token_hash = $1", [hashToken(rawToken)]);
  }
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: secureCookie, sameSite: "lax", path: "/" });
}

export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const rawToken = req.cookies?.[SESSION_COOKIE];
    if (!rawToken) return next();
    const result = await query<SessionRow>(
      `SELECT s.id::text AS session_id, u.id::text AS user_id, u.agency_id::text, u.full_name,
              u.email::text, u.role
       FROM auth.sessions s
       JOIN auth.users u ON u.id = s.user_id
       WHERE s.token_hash = $1
         AND s.revoked_at IS NULL
         AND s.expires_at > clock_timestamp()
         AND u.status = 'active'
         AND u.deleted_at IS NULL`,
      [hashToken(rawToken)]
    );
    const row = result.rows[0];
    if (row) {
      req.auth = {
        sessionId: row.session_id,
        userId: row.user_id,
        agencyId: row.agency_id,
        fullName: row.full_name,
        email: row.email,
        role: row.role
      };
      void query("UPDATE auth.sessions SET last_seen_at = clock_timestamp() WHERE id = $1", [row.session_id]).catch(() => undefined);
    }
    next();
  } catch (error) {
    next(error);
  }
};

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) return res.status(401).json({ error: "Authentication required" });
  next();
}

export function requireRoles(...roles: UserRole[]): RequestHandler {
  return (req, res, next) => {
    if (!req.auth) return res.status(401).json({ error: "Authentication required" });
    if (!roles.includes(req.auth.role)) return res.status(403).json({ error: "You do not have permission for this action" });
    next();
  };
}

export function requireAgency(req: Request, res: Response, next: NextFunction) {
  if (!req.auth?.agencyId) return res.status(403).json({ error: "Agency access required" });
  next();
}
