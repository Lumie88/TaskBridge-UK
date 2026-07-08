import { randomUUID } from "node:crypto";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "./config.js";

const allowedTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

const allowedComplianceTypes: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png"
};

const complianceDocumentTypes = new Set([
  "identity",
  "public_liability_insurance",
  "enhanced_dbs",
  "qualification"
]);

function storageClient() {
  if (!config.objectStorageEndpoint || !config.objectStorageAccessKeyId || !config.objectStorageSecretAccessKey || !config.objectStorageBucket) {
    throw Object.assign(new Error("Secure photo storage is not configured"), { statusCode: 503 });
  }
  return new S3Client({
    region: config.objectStorageRegion,
    endpoint: config.objectStorageEndpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.objectStorageAccessKeyId,
      secretAccessKey: config.objectStorageSecretAccessKey
    }
  });
}

export async function createEvidenceUpload(
  taskId: string,
  evidenceType: "before_photo" | "after_photo",
  contentType: string,
  sizeBytes: number
) {
  const extension = allowedTypes[contentType];
  if (!extension) throw Object.assign(new Error("Photo must be JPEG, PNG or WebP"), { statusCode: 422 });
  if (sizeBytes <= 0 || sizeBytes > 10 * 1024 * 1024) {
    throw Object.assign(new Error("Photo must be smaller than 10 MB"), { statusCode: 422 });
  }
  const key = `visit-evidence/${taskId}/${evidenceType}/${randomUUID()}.${extension}`;
  const command = new PutObjectCommand({
    Bucket: config.objectStorageBucket,
    Key: key,
    ContentType: contentType,
    ContentLength: sizeBytes,
    Metadata: { task: taskId, evidence: evidenceType }
  });
  const uploadUrl = await getSignedUrl(storageClient(), command, { expiresIn: 300 });
  const publicBase = config.objectStoragePublicBaseUrl.replace(/\/$/, "");
  if (!publicBase) throw Object.assign(new Error("Secure photo storage public URL is not configured"), { statusCode: 503 });
  return {
    uploadUrl,
    storageKey: key,
    fileUrl: `${publicBase}/${key}`,
    headers: { "content-type": contentType }
  };
}

export function evidenceFileUrl(storageKey: string) {
  if (!storageKey.startsWith("visit-evidence/")) {
    throw Object.assign(new Error("Evidence storage path is invalid"), { statusCode: 422 });
  }
  const publicBase = config.objectStoragePublicBaseUrl.replace(/\/$/, "");
  if (!publicBase) throw Object.assign(new Error("Secure photo storage public URL is not configured"), { statusCode: 503 });
  return `${publicBase}/${storageKey}`;
}

export async function verifyEvidenceUpload(
  taskId: string,
  evidenceType: "before_photo" | "after_photo",
  storageKey: string,
  contentType: string,
  sizeBytes: number
) {
  const expectedPrefix = `visit-evidence/${taskId}/${evidenceType}/`;
  if (!storageKey.startsWith(expectedPrefix)) {
    throw Object.assign(new Error("Uploaded evidence does not belong to this visit"), { statusCode: 422 });
  }
  try {
    const result = await storageClient().send(new HeadObjectCommand({ Bucket: config.objectStorageBucket, Key: storageKey }));
    if (result.ContentType !== contentType || Number(result.ContentLength) !== sizeBytes ||
        result.Metadata?.task !== taskId || result.Metadata?.evidence !== evidenceType) {
      throw new Error("metadata_mismatch");
    }
  } catch {
    throw Object.assign(new Error("Visit evidence could not be verified after upload"), { statusCode: 422 });
  }
}

export async function createComplianceDocumentUpload(
  invitationId: string,
  documentType: string,
  contentType: string,
  sizeBytes: number
) {
  const extension = allowedComplianceTypes[contentType];
  if (!extension || !complianceDocumentTypes.has(documentType)) {
    throw Object.assign(new Error("Compliance documents must be PDF, JPEG or PNG"), { statusCode: 422 });
  }
  if (sizeBytes <= 0 || sizeBytes > 15 * 1024 * 1024) {
    throw Object.assign(new Error("Each compliance document must be smaller than 15 MB"), { statusCode: 422 });
  }
  const key = `handyman-onboarding/${invitationId}/${documentType}/${randomUUID()}.${extension}`;
  const command = new PutObjectCommand({
    Bucket: config.objectStorageBucket,
    Key: key,
    ContentType: contentType,
    ContentLength: sizeBytes,
    Metadata: { invitation: invitationId, document: documentType }
  });
  const uploadUrl = await getSignedUrl(storageClient(), command, { expiresIn: 300 });
  return {
    uploadUrl,
    storageKey: key,
    headers: { "content-type": contentType }
  };
}

export async function verifyComplianceDocumentUpload(
  invitationId: string,
  documentType: string,
  storageKey: string,
  contentType: string,
  sizeBytes: number
) {
  const expectedPrefix = `handyman-onboarding/${invitationId}/${documentType}/`;
  if (!storageKey.startsWith(expectedPrefix)) {
    throw Object.assign(new Error("Uploaded document does not belong to this invitation"), { statusCode: 422 });
  }
  try {
    const result = await storageClient().send(new HeadObjectCommand({ Bucket: config.objectStorageBucket, Key: storageKey }));
    if (result.ContentType !== contentType || Number(result.ContentLength) !== sizeBytes ||
        result.Metadata?.invitation !== invitationId || result.Metadata?.document !== documentType) {
      throw new Error("metadata_mismatch");
    }
  } catch {
    throw Object.assign(new Error("A compliance document could not be verified after upload"), { statusCode: 422 });
  }
}

export async function createComplianceDocumentReviewUrl(storageKey: string) {
  if (!storageKey.startsWith("handyman-onboarding/")) {
    throw Object.assign(new Error("Compliance document path is invalid"), { statusCode: 422 });
  }
  return getSignedUrl(
    storageClient(),
    new GetObjectCommand({ Bucket: config.objectStorageBucket, Key: storageKey }),
    { expiresIn: 300 }
  );
}
