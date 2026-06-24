import type { Request } from "express";
import { query } from "./db.js";

export async function audit(req: Request, action: string, entityType: string, entityId: string, metadata: Record<string, unknown> = {}) {
  const auth = req.auth;
  await query(
    `INSERT INTO audit.audit_logs
      (actor_user_id, actor_role, agency_id, action, entity_type, entity_id, ip_address, user_agent, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [auth?.userId || null, auth?.role || null, auth?.agencyId || null, action, entityType, entityId, req.ip, req.get("user-agent") || null, metadata]
  );
}
