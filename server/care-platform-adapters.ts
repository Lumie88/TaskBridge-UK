import { z } from "zod";

export type CarePlatformProvider = "birdie" | "pass" | "cera" | "generic";
export type CarePlatformEventType = "care_note.created" | "risk_hazard.logged" | "service_user.updated" | "visit.completed";

export interface NormalizedServiceUser {
  externalId: string;
  fullName: string | null;
  address: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
  riskLevel: "standard" | "vulnerable_adult" | "high_risk";
  vulnerabilityNotes: string | null;
}

export interface NormalizedCarePlatformEvent {
  provider: CarePlatformProvider;
  eventType: CarePlatformEventType;
  eventId: string;
  occurredAt: string | null;
  serviceUser: NormalizedServiceUser;
  noteText: string | null;
  hazardText: string | null;
  preferredWindowStart: string | null;
  preferredWindowEnd: string | null;
  carerOnSite: boolean;
  externalTaskId: string | null;
  completionNotes: string | null;
  completedAt: string | null;
  raw: Record<string, unknown>;
}

const providerSchema = z.enum(["birdie", "pass", "cera", "generic"]);
const supportedEvents: CarePlatformEventType[] = ["care_note.created", "risk_hazard.logged", "service_user.updated", "visit.completed"];

export function parseCarePlatformProvider(value: string): CarePlatformProvider | null {
  const parsed = providerSchema.safeParse(value.toLowerCase());
  return parsed.success ? parsed.data : null;
}

export function normalizeCarePlatformEvent(provider: CarePlatformProvider, payload: unknown): NormalizedCarePlatformEvent | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const body = payload as Record<string, unknown>;
  const eventType = normalizeEventType(pickString(body, [
    "event_type", "eventType", "type", "name", "event", "resource.event"
  ]));
  if (!eventType) return null;

  const serviceUserSource = pickObject(body, ["service_user", "serviceUser", "resident", "client", "care_recipient", "person"]) || {};
  const externalId = pickString(serviceUserSource, ["id", "external_id", "externalId", "service_user_id", "serviceUserId"])
    || pickString(body, ["service_user_id", "serviceUserId", "resident_id", "client_id", "care_recipient_id"]);
  if (!externalId) return null;

  const eventId = pickString(body, ["id", "event_id", "eventId", "webhook_id", "webhookId"])
    || `${provider}:${eventType}:${externalId}:${pickString(body, ["note.id", "hazard.id", "updated_at", "created_at"]) || JSON.stringify(body).length}`;

  const noteText = pickString(body, [
    "note", "notes", "note.text", "note.body", "care_note", "careNote", "careNote.text", "content", "message"
  ]);
  const hazardText = pickString(body, [
    "hazard", "hazard.description", "risk.description", "risk", "risk_note", "riskNote", "summary", "description"
  ]);

  return {
    provider,
    eventType,
    eventId,
    occurredAt: pickString(body, ["occurred_at", "occurredAt", "created_at", "createdAt", "timestamp"]) || null,
    serviceUser: {
      externalId,
      fullName: pickString(serviceUserSource, ["name", "full_name", "fullName", "display_name", "displayName"]) || null,
      address: pickString(serviceUserSource, ["address", "full_address", "fullAddress", "home_address", "homeAddress"]) || null,
      town: pickString(serviceUserSource, ["town", "city", "locality"]) || null,
      county: pickString(serviceUserSource, ["county", "region"]) || null,
      postcode: pickString(serviceUserSource, ["postcode", "postal_code", "postalCode", "zip"]) || null,
      riskLevel: normalizeRiskLevel(pickValue(serviceUserSource, ["risk_level", "riskLevel", "is_vulnerable", "isVulnerable", "vulnerable"])),
      vulnerabilityNotes: pickString(serviceUserSource, ["vulnerability_notes", "vulnerabilityNotes", "safeguarding_notes", "safeguardingNotes"]) || null
    },
    noteText: noteText || null,
    hazardText: hazardText || null,
    preferredWindowStart: pickString(body, ["preferred_window_start", "preferredWindowStart", "visit_window.start", "visitWindow.start"]) || null,
    preferredWindowEnd: pickString(body, ["preferred_window_end", "preferredWindowEnd", "visit_window.end", "visitWindow.end"]) || null,
    carerOnSite: Boolean(pickValue(body, ["carer_on_site", "carerOnSite", "visit.carer_on_site", "visit.carerOnSite"])),
    externalTaskId: pickString(body, ["task_id", "taskId", "task.id", "work_order_id", "workOrderId", "visit.task_id", "visit.taskId"]) || null,
    completionNotes: pickString(body, ["completion_notes", "completionNotes", "visit.completion_notes", "visit.completionNotes", "visit.notes"]) || null,
    completedAt: pickString(body, ["completed_at", "completedAt", "visit.completed_at", "visit.completedAt"]) || null,
    raw: body
  };
}

function normalizeEventType(value: string | null): CarePlatformEventType | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  if (["care_note.created", "care_note_created", "note.created", "note_created", "carelog.created", "care_log.created"].includes(normalized)) return "care_note.created";
  if (["risk_hazard.logged", "risk_hazard_logged", "hazard.logged", "hazard_logged", "risk.logged", "risk_logged"].includes(normalized)) return "risk_hazard.logged";
  if (["service_user.updated", "service_user_updated", "resident.updated", "resident_updated", "client.updated", "client_updated", "care_recipient.updated"].includes(normalized)) return "service_user.updated";
  if (["visit.completed", "visit_completed", "task.completed", "task_completed", "work_order.completed", "work_order_completed"].includes(normalized)) return "visit.completed";
  return supportedEvents.includes(value as CarePlatformEventType) ? value as CarePlatformEventType : null;
}

function normalizeRiskLevel(value: unknown): NormalizedServiceUser["riskLevel"] {
  if (value === true) return "vulnerable_adult";
  const text = String(value || "").toLowerCase();
  if (text.includes("high")) return "high_risk";
  if (text.includes("vulnerable") || text === "true" || text === "yes") return "vulnerable_adult";
  return "standard";
}

function pickObject(source: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = pickValue(source, [path]);
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  }
  return null;
}

function pickString(source: Record<string, unknown>, paths: string[]) {
  const value = pickValue(source, paths);
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return null;
}

function pickValue(source: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = path.split(".").reduce<unknown>((current, key) => {
      if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
      return (current as Record<string, unknown>)[key];
    }, source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}
