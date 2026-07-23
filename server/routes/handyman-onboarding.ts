import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { asyncHandler } from "../async-handler.js";
import { audit } from "../audit.js";
import { query, withTransaction } from "../db.js";
import { createComplianceDocumentUpload, verifyComplianceDocumentUpload } from "../media.js";
import { encryptField, hashToken } from "../security.js";

const serviceOptions = [
  "Lawn mowing",
  "Garden clearance",
  "Window cleaning",
  "Gutter cleaning",
  "Pressure washing",
  "Path clearing",
  "Loose rail repair",
  "Lock repairs",
  "Door and handle repairs",
  "Minor plumbing",
  "Painting and decorating",
  "Furniture assembly",
  "Curtain and blind fitting",
  "Smoke and carbon monoxide alarm fitting",
  "Deep cleaning",
  "Appliance safety checks",
  "Trip hazard removal",
  "Home safety inspection"
] as const;

const documentType = z.enum(["identity", "public_liability_insurance", "enhanced_dbs", "qualification"]);
const contentType = z.enum(["application/pdf", "image/jpeg", "image/png"]);

const uploadSchema = z.object({
  documentType,
  contentType,
  sizeBytes: z.number().int().positive().max(15 * 1024 * 1024)
});

const submittedDocumentSchema = z.object({
  documentType,
  storageKey: z.string().min(20).max(500),
  originalFilename: z.string().min(1).max(255),
  contentType,
  sizeBytes: z.number().int().positive().max(15 * 1024 * 1024),
  reference: z.string().trim().max(160).optional().default(""),
  issueDate: z.string().date().nullable().optional(),
  expiryDate: z.string().date().nullable().optional(),
  qualificationTitle: z.string().trim().max(160).optional().default("")
});

const completionSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  mobile: z.string().regex(/^\+[1-9]\d{7,14}$/, "Enter a mobile number in international format"),
  postcode: z.string().trim().min(5).max(12),
  hourlyRate: z.number().positive().max(500),
  services: z.array(z.enum(serviceOptions)).min(1).max(serviceOptions.length),
  insurance: z.object({
    providerName: z.string().trim().min(2).max(160),
    policyReference: z.string().trim().min(2).max(160),
    expiryDate: z.string().date()
  }),
  dbs: z.object({
    route: z.enum(["already_enhanced", "needs_application", "basic_or_not_sure"]),
    certificateReference: z.string().trim().max(160).optional().default(""),
    issueDate: z.string().date().optional().nullable(),
    workforceType: z.enum(["adult", "child", "adult_and_child", "unknown"]).default("unknown"),
    updateServiceConsent: z.boolean().default(false),
    applicationRequested: z.boolean().default(false)
  }),
  documents: z.array(submittedDocumentSchema).min(2).max(8),
  safeguardingDeclaration: z.literal(true),
  dataAccuracyConfirmation: z.literal(true),
  privacyNoticeAccepted: z.literal(true)
}).superRefine((data, ctx) => {
  if (data.dbs.route === "already_enhanced") {
    if (!data.dbs.certificateReference || data.dbs.certificateReference.length < 2) {
      ctx.addIssue({ code: "custom", path: ["dbs", "certificateReference"], message: "Enter the Enhanced DBS certificate reference" });
    }
    if (!data.dbs.issueDate) {
      ctx.addIssue({ code: "custom", path: ["dbs", "issueDate"], message: "Enter the Enhanced DBS issue date" });
    }
    if (!data.documents.some((document) => document.documentType === "enhanced_dbs")) {
      ctx.addIssue({ code: "custom", path: ["documents"], message: "Upload the Enhanced DBS certificate evidence" });
    }
  }
});

interface InvitationAccessRow {
  id: string;
  trader_id: string;
  email: string;
  expires_at: string;
  status: string;
  display_name: string;
}

type ActiveInvitationResult =
  | { invitation: InvitationAccessRow }
  | { status: number; error: string };

const onboardingLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

export const handymanOnboardingRouter = Router();
handymanOnboardingRouter.use(onboardingLimiter);

handymanOnboardingRouter.get("/:token", asyncHandler(async (req, res) => {
  const access = await findInvitation(req.params.token);
  if (!access) return res.status(404).json({ error: "Registration invitation was not found" });
  if (access.status === "submitted") return res.status(409).json({ error: "This registration has already been submitted" });
  if (access.status !== "pending" || new Date(access.expires_at) <= new Date()) {
    if (access.status === "pending") await markExpired(access.id);
    return res.status(410).json({ error: "This registration invitation has expired" });
  }
  res.json({
    handyman: { fullName: access.display_name, email: access.email },
    expiresAt: access.expires_at,
    serviceOptions,
    requiredDocuments: ["identity", "public_liability_insurance", "enhanced_dbs"]
  });
}));

handymanOnboardingRouter.post("/:token/upload-url", asyncHandler(async (req, res) => {
  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.issues[0]?.message || "Invalid document" });
  const access = await activeInvitation(req.params.token);
  if (!("invitation" in access)) return res.status(access.status).json({ error: access.error });
  const upload = await createComplianceDocumentUpload(
    access.invitation.id,
    parsed.data.documentType,
    parsed.data.contentType,
    parsed.data.sizeBytes
  );
  res.json(upload);
}));

handymanOnboardingRouter.post("/:token/complete", asyncHandler(async (req, res) => {
  const parsed = completionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.issues[0]?.message || "Invalid registration details" });
  const data = parsed.data;
  const requiredTypes = ["identity", "public_liability_insurance"];
  if (requiredTypes.some((type) => data.documents.filter((document) => document.documentType === type).length !== 1)) {
    return res.status(422).json({ error: "Identity and insurance documents are required" });
  }
  if (new Date(`${data.insurance.expiryDate}T23:59:59Z`) <= new Date()) {
    return res.status(422).json({ error: "Public liability insurance must be current" });
  }
  if (data.dbs.issueDate && new Date(`${data.dbs.issueDate}T00:00:00Z`) > new Date()) {
    return res.status(422).json({ error: "Enhanced DBS issue date cannot be in the future" });
  }
  const access = await activeInvitation(req.params.token);
  if (!("invitation" in access)) return res.status(access.status).json({ error: access.error });

  await Promise.all(data.documents.map((document) => verifyComplianceDocumentUpload(
    access.invitation.id,
    document.documentType,
    document.storageKey,
    document.contentType,
    document.sizeBytes
  )));

  const result = await withTransaction(null, async (client) => {
    const locked = await client.query<InvitationAccessRow>(
      `SELECT i.id::text, i.trader_id::text, i.email::text, i.expires_at::text, i.status,
              t.display_name
       FROM trader.onboarding_invitations i
       JOIN trader.traders t ON t.id = i.trader_id
       WHERE i.token_hash = $1 FOR UPDATE`,
      [hashToken(req.params.token)]
    );
    const invitation = locked.rows[0];
    if (!invitation || invitation.status !== "pending" || new Date(invitation.expires_at) <= new Date()) {
      throw Object.assign(new Error("Registration invitation is no longer active"), { statusCode: 409 });
    }
    const compactPostcode = data.postcode.toUpperCase().replace(/\s+/g, "");
    const outwardMatch = compactPostcode.match(/^([A-Z]{1,2}\d[A-Z\d]?)/);
    const postcodeArea = outwardMatch?.[1] || compactPostcode.slice(0, 4);
    await client.query(
      `UPDATE trader.traders SET display_name = $2, encrypted_full_name = $3, encrypted_mobile = $4,
              postcode_area = $5, hourly_rate = $6, status = 'inactive'
       WHERE id = $1`,
      [invitation.trader_id, data.fullName, encryptField(data.fullName), encryptField(data.mobile), postcodeArea, data.hourlyRate]
    );
    await client.query("DELETE FROM trader.trader_services WHERE trader_id = $1", [invitation.trader_id]);
    for (const service of data.services) {
      await client.query(
        "INSERT INTO trader.trader_services (trader_id, service_category) VALUES ($1, $2)",
        [invitation.trader_id, service]
      );
    }

    const documentIds = new Map<string, string>();
    for (const document of data.documents) {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO trader.onboarding_documents
          (trader_id, invitation_id, document_type, storage_key, original_filename_ciphertext,
           content_type, size_bytes, document_reference_ciphertext, issue_date, expiry_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id::text`,
        [invitation.trader_id, invitation.id, document.documentType, document.storageKey,
          encryptField(document.originalFilename), document.contentType, document.sizeBytes,
          document.reference ? encryptField(document.reference) : null,
          document.issueDate || null, document.expiryDate || null]
      );
      documentIds.set(document.documentType, inserted.rows[0].id);
      if (document.documentType === "qualification") {
        await client.query(
          `INSERT INTO trader.qualifications (trader_id, qualification_type, title, evidence_url, expiry_date)
           VALUES ($1, 'self_submitted', $2, $3, $4)`,
          [invitation.trader_id, document.qualificationTitle || "Trade qualification",
            `private-object://${document.storageKey}`, document.expiryDate || null]
        );
      }
    }
    const enhancedDbsDocumentId = documentIds.get("enhanced_dbs");
    await client.query(
      `INSERT INTO trader.dbs_verifications
        (trader_id, status, outcome, evidence_reference, provider_name, provider_payload,
         verification_route, enhanced_dbs_eligible, workforce_type, update_service_consent, update_service_status)
       VALUES ($1, 'pending', $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        invitation.trader_id,
        dbsOutcome(data.dbs.route, data.dbs.issueDate || null, data.dbs.updateServiceConsent),
        enhancedDbsDocumentId ? `onboarding-document:${enhancedDbsDocumentId}` : null,
        data.dbs.route === "needs_application" ? "dbs_umbrella_route" : "manual",
        {
          certificateReferenceSupplied: Boolean(data.dbs.certificateReference),
          applicationRequested: data.dbs.applicationRequested,
          route: data.dbs.route
        },
        data.dbs.route === "already_enhanced" ? "self_submitted_certificate"
          : data.dbs.route === "needs_application" ? "umbrella_application_required" : "basic_or_not_sure",
        data.dbs.route !== "basic_or_not_sure",
        data.dbs.workforceType,
        data.dbs.updateServiceConsent,
        data.dbs.updateServiceConsent ? "consented_pending_check" : "not_checked"
      ]
    );
    const insuranceDocument = data.documents.find((document) => document.documentType === "public_liability_insurance")!;
    await client.query(
      `INSERT INTO trader.insurance_records
        (trader_id, status, provider_name, policy_reference_ciphertext, expiry_date, evidence_url)
       VALUES ($1, 'pending', $2, $3, $4, $5)`,
      [invitation.trader_id, data.insurance.providerName, encryptField(data.insurance.policyReference),
        data.insurance.expiryDate, `private-object://${insuranceDocument.storageKey}`]
    );
    await client.query(
      `INSERT INTO trader.onboarding_submissions
        (trader_id, invitation_id, postcode_hash, safeguarding_declaration,
         data_accuracy_confirmation, privacy_notice_accepted_at)
       VALUES ($1, $2, $3, true, true, clock_timestamp())`,
      [invitation.trader_id, invitation.id, hashToken(compactPostcode)]
    );
    await client.query(
      `UPDATE trader.onboarding_invitations
       SET status = 'submitted', submitted_at = clock_timestamp() WHERE id = $1`,
      [invitation.id]
    );
    return { traderId: invitation.trader_id };
  });

  await audit(req, "handyman.onboarding.submitted", "trader", result.traderId);
  res.status(201).json({ status: "submitted", message: "Registration submitted for TaskBridge compliance review" });
}));

function dbsOutcome(route: "already_enhanced" | "needs_application" | "basic_or_not_sure", issueDate: string | null, updateServiceConsent: boolean) {
  if (route === "already_enhanced") {
    return `Self-submitted Enhanced DBS certificate${issueDate ? ` issued ${issueDate}` : ""}; pending TaskBridge certificate and Update Service verification${updateServiceConsent ? "" : " (Update Service consent not supplied)"}`;
  }
  if (route === "needs_application") {
    return "Enhanced DBS application route requested. Admin must route to an eligible DBS umbrella body before vulnerable-adult approval.";
  }
  return "Basic DBS, no DBS, or unclear DBS position declared. Restrict to non-vulnerable or supervised work until admin review.";
}

async function findInvitation(token: string) {
  const result = await query<InvitationAccessRow>(
    `SELECT i.id::text, i.trader_id::text, i.email::text, i.expires_at::text, i.status,
            t.display_name
     FROM trader.onboarding_invitations i
     JOIN trader.traders t ON t.id = i.trader_id
     WHERE i.token_hash = $1`,
    [hashToken(token)]
  );
  return result.rows[0] || null;
}

async function activeInvitation(token: string): Promise<ActiveInvitationResult> {
  const invitation = await findInvitation(token);
  if (!invitation) return { status: 404, error: "Registration invitation was not found" } as const;
  if (invitation.status !== "pending") return { status: 409, error: "Registration invitation is no longer active" } as const;
  if (new Date(invitation.expires_at) <= new Date()) {
    await markExpired(invitation.id);
    return { status: 410, error: "Registration invitation has expired" } as const;
  }
  return { invitation } as const;
}

async function markExpired(invitationId: string) {
  await query(
    "UPDATE trader.onboarding_invitations SET status = 'expired' WHERE id = $1 AND status = 'pending'",
    [invitationId]
  );
}
