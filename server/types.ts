export type UserRole = "care_coordinator" | "care_manager" | "taskbridge_admin" | "taskbridge_super_admin";

export interface AuthContext {
  sessionId: string;
  userId: string;
  agencyId: string | null;
  fullName: string;
  email: string;
  role: UserRole;
}

export interface TaskSuggestion {
  category: string;
  summary: string;
  urgency: "low" | "medium" | "high" | "urgent";
  safeguardingApplies: boolean;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
      rawBody?: Buffer;
    }
  }
}
