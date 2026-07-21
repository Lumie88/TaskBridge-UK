export type UserRole = "care_coordinator" | "care_manager" | "taskbridge_admin" | "taskbridge_super_admin";

export interface User {
  id: string;
  agencyId: string | null;
  fullName: string;
  email: string;
  role: UserRole;
}

export interface TaskSuggestion {
  category: string;
  summary: string;
  urgency: "low" | "medium" | "high" | "urgent";
  safeguardingApplies?: boolean;
}

export type PaymentRoute = "agency" | "family_representative" | "council_personal_budget";

export interface TaskPayment {
  route: PaymentRoute;
  status: "agency_invoice" | "awaiting_family_payment" | "family_paid" | "funding_pending" | "funding_approved" | "payment_waived";
  payerName: string | null;
  payerEmail: string | null;
  payerPhone: string | null;
  fundingReference: string | null;
  fundingNotes: string | null;
}

export interface CoordinatorTask {
  id: string;
  resident: { displayName: string; initials: string };
  category: string;
  urgency: string;
  status: string;
  summary: string;
  note: string;
  vulnerableAdult: boolean;
  ringFenceRequired: boolean;
  carerOnSite: boolean;
  safeguardingRisk?: { score: number; band: string; factors: string[] };
  preferredWindow: { start: string | null; end: string | null };
  payment: TaskPayment;
  createdAt: string;
  assignedHandyman: null | {
    displayName: string;
    network: string | null;
    scheduledStart: string | null;
    scheduledEnd: string | null;
  };
  completion: null | { beforePhotoUrl: string | null; afterPhotoUrl: string | null; notes: string | null };
}

export interface AdminTask {
  id: string;
  agencyName: string;
  residentInitials: string;
  category: string;
  urgency: string;
  status: string;
  summary: string;
  vulnerableAdult: boolean;
  ringFenceRequired: boolean;
  safeguardingRisk?: { score: number; band: string; factors: string[] };
  payment: TaskPayment;
  assignedHandyman: string | null;
  createdAt: string;
}

export interface Candidate {
  id: string;
  displayName: string;
  network: string | null;
  hourlyRate: number;
  qualityScore: number;
  dbsStatus: string;
  dbsExpiryDate: string | null;
  insuranceStatus: string;
  eligible: boolean;
  reasons: string[];
  distanceMiles: number;
  score: number;
}
