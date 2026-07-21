import Constants from "expo-constants";

const configuredBaseUrl = (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) || "https://www.growingfig.com";

export interface Visit {
  status: string;
  category: string;
  summary: string;
  address: string;
  handyman: string;
  preferredWindow: { start: string | null; end: string | null };
  mandatedInstruction: string;
}

export interface UploadTicket {
  uploadUrl: string;
  storageKey: string;
  headers?: Record<string, string>;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${configuredBaseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers
    }
  });
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new ApiError(payload.error || "Something went wrong", response.status);
  return payload as T;
}

export async function getVisit(token: string) {
  return api<{ visit: Visit }>(`/api/visit/${encodeURIComponent(token)}`);
}

export async function acceptVisit(token: string) {
  return api<{ status: string }>(`/api/visit/${encodeURIComponent(token)}/accept`, { method: "POST" });
}

export async function declineVisit(token: string, reason: string) {
  return api<{ status: string }>(`/api/visit/${encodeURIComponent(token)}/decline`, {
    method: "POST",
    body: JSON.stringify({ reason })
  });
}

export async function checkInVisit(token: string, latitude: number, longitude: number) {
  return api<{ status: string; distanceMiles: number }>(`/api/visit/${encodeURIComponent(token)}/check-in`, {
    method: "POST",
    body: JSON.stringify({ latitude, longitude })
  });
}

export async function createEvidenceUpload(token: string, fileName: string, evidenceType: "before_photo" | "after_photo", contentType: string, sizeBytes: number) {
  return api<UploadTicket>(`/api/visit/${encodeURIComponent(token)}/evidence-upload-url`, {
    method: "POST",
    body: JSON.stringify({ fileName, evidenceType, contentType, sizeBytes })
  });
}

export async function recordBeforeEvidence(token: string, storageKey: string, contentType: string, sizeBytes: number) {
  return api<{ status: string }>(`/api/visit/${encodeURIComponent(token)}/evidence`, {
    method: "POST",
    body: JSON.stringify({ evidenceType: "before_photo", storageKey, contentType, sizeBytes })
  });
}

export async function completeVisit(token: string, completionNotes: string, afterPhotoStorageKey: string, afterPhotoContentType: string, afterPhotoSizeBytes: number) {
  return api<{ status: string }>(`/api/visit/${encodeURIComponent(token)}/complete`, {
    method: "POST",
    body: JSON.stringify({ completionNotes, afterPhotoStorageKey, afterPhotoContentType, afterPhotoSizeBytes })
  });
}
