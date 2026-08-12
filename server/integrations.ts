import { config } from "./config.js";

type JsonRecord = Record<string, unknown>;
type SmsDeliveryResult = {
  status: string;
  provider: string;
  providerMessageId: string | null;
  providerError?: string | null;
  from?: string | null;
};

export type DbsStatus = "pending" | "approved" | "rejected" | "unclear";

export type StartDbsVerificationInput = {
  handymanId: string;
  fullName: string;
  email?: string | null;
  mobile?: string | null;
  checkType: "basic_dbs" | "enhanced_dbs";
  callbackUrl: string;
};

export type DbsProviderSession = {
  provider: string;
  providerSessionId: string;
  status: DbsStatus;
  invitationUrl: string | null;
  raw: JsonRecord;
};

export type NormalizedDbsCallback = {
  providerSessionId: string;
  status: DbsStatus;
  outcome: string | null;
  expiryDate: string | null;
  evidenceReference: string | null;
  eventType: string;
  raw: JsonRecord;
};

async function providerPost(url: string, apiKey: string, payload: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      ...headers
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Provider request failed with status ${response.status}${text ? `: ${text.slice(0, 240)}` : ""}`);
  }
  return response.json() as Promise<JsonRecord>;
}

function readPath(source: unknown, paths: string[]) {
  for (const path of paths) {
    const value = path.split(".").reduce<unknown>((current, key) => {
      if (current && typeof current === "object" && key in current) return (current as JsonRecord)[key];
      return undefined;
    }, source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : value === undefined || value === null ? "" : String(value);
}

function twilioConfigured() {
  return Boolean(config.twilioAccountSid && config.twilioAuthToken && config.twilioFromNumber);
}

function twilioSenderOptions() {
  return Array.from(new Set([config.twilioFromNumber, config.twilioFallbackFromNumber].map((value) => value.trim()).filter(Boolean)));
}

async function twilioErrorMessage(response: Response) {
  const text = await response.text().catch(() => "");
  if (!text) return `Twilio request failed with status ${response.status}`;
  try {
    const payload = JSON.parse(text) as { message?: string; code?: number | string };
    const detail = [payload.code ? `code ${payload.code}` : "", payload.message || ""].filter(Boolean).join(": ");
    return detail || `Twilio request failed with status ${response.status}`;
  } catch {
    return `Twilio request failed with status ${response.status}: ${text.slice(0, 160)}`;
  }
}

export async function sendTwilioSms(to: string, body: string): Promise<SmsDeliveryResult> {
  if (!twilioConfigured()) return { status: "not_configured", provider: "none", providerMessageId: null };
  let lastError = "Twilio SMS failed";
  for (const from of twilioSenderOptions()) {
    try {
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.twilioAccountSid}/Messages.json`, {
        method: "POST",
        headers: {
          authorization: `Basic ${Buffer.from(`${config.twilioAccountSid}:${config.twilioAuthToken}`).toString("base64")}`,
          "content-type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          From: from,
          To: to,
          Body: body,
          ...(config.twilioStatusCallbackUrl ? { StatusCallback: config.twilioStatusCallbackUrl } : {})
        }),
        signal: AbortSignal.timeout(15_000)
      });
      if (!response.ok) {
        lastError = await twilioErrorMessage(response);
        continue;
      }
      const result = await response.json() as { sid?: string; status?: string };
      return { status: result.status || "queued", provider: "twilio", providerMessageId: result.sid || null, from };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Twilio SMS failed";
    }
  }
  return { status: "failed", provider: "twilio", providerMessageId: null, providerError: lastError };
}

function normaliseStatus(value: unknown): DbsStatus {
  const status = asString(value).toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  if (["approved", "clear", "cleared", "passed", "pass", "verified", "complete", "completed", "success"].includes(status)) return "approved";
  if (["rejected", "failed", "fail", "not_clear", "not_cleared", "barred", "declined", "unsuccessful"].includes(status)) return "rejected";
  if (["pending", "created", "started", "in_progress", "processing", "awaiting_candidate", "awaiting_applicant"].includes(status)) return "pending";
  return "unclear";
}

function defaultDbsExpiryDate() {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() + config.dbsApprovalValidityMonths);
  return date.toISOString().slice(0, 10);
}

function pickProviderSessionId(payload: JsonRecord) {
  return asString(readPath(payload, [
    "providerSessionId",
    "sessionId",
    "session_id",
    "applicationId",
    "application_id",
    "applicantReference",
    "applicant_reference",
    "id",
    "data.id",
    "data.application.id",
    "application.id",
    "data.session_id",
    "data.session.id",
    "session.id",
    "resource.id",
    "payload.session.id"
  ]));
}

function pickInvitationUrl(payload: JsonRecord) {
  return asString(readPath(payload, [
    "invitationUrl",
    "invitation_url",
    "url",
    "hosted_url",
    "session_url",
    "data.url",
    "data.hosted_url",
    "data.invitation_url",
    "data.session.url",
    "session.url"
  ])) || null;
}

export function normalizeDbsProviderCallback(body: JsonRecord): NormalizedDbsCallback | null {
  const providerSessionId = pickProviderSessionId(body);
  if (!providerSessionId) return null;

  const statusSource = readPath(body, [
    "status",
    "outcome",
    "result",
    "data.status",
    "data.outcome",
    "data.result",
    "data.application.status",
    "data.application.outcome",
    "data.application.result",
    "data.session.status",
    "data.session.outcome",
    "session.status",
    "session.outcome",
    "check.status",
    "check.outcome"
  ]);
  const status = normaliseStatus(statusSource);
  const expiryDate = asString(readPath(body, [
    "expiryDate",
    "expiry_date",
    "expires_at",
    "data.expiry_date",
    "data.expires_at",
    "data.application.expiry_date",
    "data.application.expires_at",
    "data.session.expiry_date",
    "session.expiry_date",
    "check.expiry_date"
  ])) || (status === "approved" ? defaultDbsExpiryDate() : null);

  const eventType = asString(readPath(body, ["event", "event_type", "type", "data.event", "data.type"])) || "dbs.callback";
  const outcome = asString(readPath(body, [
    "outcome",
    "result",
    "message",
    "data.outcome",
    "data.result",
    "data.message",
    "data.application.outcome",
    "data.application.result",
    "data.application.message",
    "session.outcome"
  ])) || null;
  const evidenceReference = asString(readPath(body, [
    "evidenceReference",
    "evidence_reference",
    "certificate_reference",
    "data.evidence_reference",
    "data.certificate_reference",
    "data.application.evidence_reference",
    "data.application.certificate_reference",
    "report_url"
  ])) || providerSessionId;

  return { providerSessionId, status, outcome, expiryDate, evidenceReference, eventType, raw: body };
}

function normalizeDbsSessionResponse(provider: string, payload: JsonRecord): DbsProviderSession {
  return {
    provider,
    providerSessionId: pickProviderSessionId(payload) || asString(readPath(payload, [
      "applicationId",
      "application_id",
      "applicantReference",
      "applicant_reference",
      "data.applicationId",
      "data.application_id",
      "data.application.id",
      "application.id",
      "result.application_id"
    ])),
    status: normaliseStatus(readPath(payload, ["status", "data.status", "data.application.status", "session.status"])) === "unclear"
      ? "pending"
      : normaliseStatus(readPath(payload, ["status", "data.status", "data.application.status", "session.status"])),
    invitationUrl: pickInvitationUrl(payload),
    raw: payload
  };
}

function ddcApplicationPayload(input: StartDbsVerificationInput) {
  const packageCode = input.checkType === "enhanced_dbs"
    ? config.ddcEnhancedPackageCode
    : config.ddcBasicPackageCode;
  return {
    applicantReference: `taskbridge-${input.handymanId}`,
    accountCode: config.ddcAccountCode || undefined,
    locationCode: config.ddcLocationCode || undefined,
    packageCode,
    checkType: input.checkType,
    applicant: {
      externalId: input.handymanId,
      fullName: input.fullName,
      email: input.email || undefined,
      mobile: input.mobile || undefined
    },
    webhookUrl: input.callbackUrl,
    callbackUrl: input.callbackUrl,
    metadata: {
      taskbridgeHandymanId: input.handymanId,
      provider: "ddc",
      requestedCheck: input.checkType
    }
  };
}

export async function startDbsVerification(input: StartDbsVerificationInput): Promise<DbsProviderSession> {
  const provider = config.dbsProviderKind.toLowerCase();
  if (provider === "ddc") {
    if (!config.ddcApiBaseUrl || !config.ddcApiToken) throw new Error("DDC API base URL and token are not configured");
    const baseUrl = config.ddcApiBaseUrl.replace(/\/$/, "");
    const path = config.ddcApplicationPath.startsWith("/") ? config.ddcApplicationPath : `/${config.ddcApplicationPath}`;
    const response = await providerPost(`${baseUrl}${path}`, config.ddcApiToken, ddcApplicationPayload(input), {
      authorization: `Bearer ${config.ddcApiToken}`,
      "idempotency-key": `taskbridge-ddc-${input.handymanId}-${input.checkType}`
    });
    const session = normalizeDbsSessionResponse("ddc", response);
    if (!session.providerSessionId) throw new Error("DDC did not return an application/session identifier");
    return session;
  }

  if (!config.dbsProviderApiUrl) throw new Error("DBS verification provider is not configured");
  const response = await providerPost(config.dbsProviderApiUrl, config.dbsProviderApiKey, input);
  const session = normalizeDbsSessionResponse(provider || "generic", response);
  if (!session.providerSessionId) throw new Error("DBS provider did not return a session identifier");
  return session;
}

export async function dispatchToHandymanNetwork(payload: JsonRecord) {
  if (!config.handymanNetworkApiUrl) {
    return { providerBookingId: `internal_${Date.now()}`, status: "recorded_without_provider" };
  }
  const provider = config.handymanNetworkProvider.toLowerCase();
  if (provider === "taskrabbit") {
    return providerPost(`${config.handymanNetworkApiUrl.replace(/\/$/, "")}/v3/restricted-booking`, config.handymanNetworkApiKey, {
      restricted_pool: true,
      task_id: payload.taskId,
      trader_id: payload.selectedTraderId,
      category: payload.category,
      notes: payload.taskSummary,
      visit_url: payload.visitUrl,
      scheduled_window: payload.scheduledWindow,
      safeguards: payload.requiredSafeguards
    });
  }
  if (provider === "checkatrade") {
    return providerPost(`${config.handymanNetworkApiUrl.replace(/\/$/, "")}/api/v1/dispatched-jobs`, config.handymanNetworkApiKey, {
      job_reference: payload.taskId,
      member_reference: payload.selectedTraderId,
      category: payload.category,
      summary: payload.taskSummary,
      private_pool_only: true,
      secure_visit_url: payload.visitUrl,
      scheduled_window: payload.scheduledWindow,
      required_safeguards: payload.requiredSafeguards
    });
  }
  return providerPost(config.handymanNetworkApiUrl, config.handymanNetworkApiKey, payload);
}

export async function cancelHandymanNetworkBooking(payload: JsonRecord) {
  if (!config.handymanNetworkCancelApiUrl) return { status: "not_configured" };
  return providerPost(config.handymanNetworkCancelApiUrl, config.handymanNetworkApiKey, payload);
}

export async function sendSecureVisitLink(payload: JsonRecord) {
  const mobile = String(payload.mobile || "");
  const visitUrl = String(payload.visitUrl || "");
  if (twilioConfigured()) return sendTwilioSms(mobile, `TaskBridge visit assigned. Use this secure one-use link to check in, upload evidence and check out: ${visitUrl}`);
  if (!config.smsProviderApiUrl) return { status: "not_configured", provider: "none", providerMessageId: null };
  return providerPost(config.smsProviderApiUrl, config.smsProviderApiKey, payload);
}

export async function sendHandymanOnboardingSms(input: {
  mobile: string | null | undefined;
  fullName: string;
  invitationUrl: string;
  expiresAt: string;
}) {
  const mobile = String(input.mobile || "").trim();
  if (!mobile) return { status: "not_configured" as const, provider: "none", providerMessageId: null };
  const expiry = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" })
    .format(new Date(input.expiresAt));
  const body = `TaskBridge: You are invited to complete your handyman onboarding. Use this secure link before ${expiry}: ${input.invitationUrl}`;
  if (twilioConfigured()) return sendTwilioSms(mobile, body);
  if (!config.smsProviderApiUrl) return { status: "not_configured" as const, provider: "none", providerMessageId: null };
  return providerPost(config.smsProviderApiUrl, config.smsProviderApiKey, { ...input, mobile, body });
}

export function familyPaymentSmsBody(input: {
  payerName?: string | null;
  taskPublicId: string;
  amount: number;
  currency: string;
  paymentUrl: string;
}) {
  const greeting = input.payerName?.trim() ? `Hello ${input.payerName.trim()}, ` : "";
  return `${greeting}TaskBridge payment request for approved home-safety work ${input.taskPublicId}: ${input.currency.toUpperCase()} ${input.amount.toFixed(2)}. Pay securely by card: ${input.paymentUrl}`;
}

export async function sendFamilyPaymentSms(input: {
  mobile: string | null | undefined;
  payerName?: string | null;
  taskPublicId: string;
  amount: number;
  currency: string;
  paymentUrl: string;
}) {
  const mobile = String(input.mobile || "").trim();
  if (!mobile) return { status: "not_configured" as const, provider: "none", providerMessageId: null };
  const body = familyPaymentSmsBody(input);
  if (twilioConfigured()) return sendTwilioSms(mobile, body);
  if (!config.smsProviderApiUrl) return { status: "not_configured" as const, provider: "none", providerMessageId: null };
  return providerPost(config.smsProviderApiUrl, config.smsProviderApiKey, { ...input, mobile, body });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[character]!);
}

function emailAddressFromHeader(value: string) {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] || value).trim();
}

let cachedZohoAccessToken: { token: string; expiresAt: number } | null = null;

async function getZohoAccessToken() {
  if (cachedZohoAccessToken && cachedZohoAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedZohoAccessToken.token;
  }
  if (config.zohoRefreshToken && config.zohoClientId && config.zohoClientSecret) {
    const baseUrl = config.zohoAccountsBaseUrl.replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/oauth/v2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: config.zohoRefreshToken,
        grant_type: "refresh_token",
        client_id: config.zohoClientId,
        client_secret: config.zohoClientSecret
      }),
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) throw new Error(`Zoho token refresh failed with status ${response.status}`);
    const payload = await response.json() as { access_token?: string; expires_in?: number };
    if (!payload.access_token) throw new Error("Zoho token refresh did not return an access token");
    cachedZohoAccessToken = {
      token: payload.access_token,
      expiresAt: Date.now() + Math.max(Number(payload.expires_in || 3600) - 120, 60) * 1000
    };
    return cachedZohoAccessToken.token;
  }
  return config.zohoMailOAuthToken;
}

export async function sendHandymanOnboardingInvite(input: {
  email: string;
  fullName: string;
  invitationUrl: string;
  expiresAt: string;
}) {
  const safeName = escapeHtml(input.fullName);
  const safeUrl = escapeHtml(input.invitationUrl);
  const expiry = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/London" })
    .format(new Date(input.expiresAt));
  return sendEmail({
    to: input.email,
    subject: "Your TaskBridge handyman onboarding invite",
    text: `Hello ${input.fullName},\n\nThank you for your interest in joining TaskBridge.\n\nWe have reviewed your application and would like you to complete the next stage of handyman onboarding. Use this secure one-use link before ${expiry}:\n${input.invitationUrl}\n\nWhat you will need:\n- Proof of identity\n- Public liability insurance details\n- Any DBS evidence you already hold\n- Trade or business details where relevant\n\nEnhanced DBS evidence is reviewed only where the role is legally eligible.\n\nTaskBridge Support`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#111827"><p>Hello ${safeName},</p><p>Thank you for your interest in joining <strong>TaskBridge</strong>.</p><p>We have reviewed your application and would like you to complete the next stage of handyman onboarding.</p><p><a href="${safeUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700">Complete handyman onboarding</a></p><p>This secure one-use link expires on <strong>${escapeHtml(expiry)}</strong>.</p><p>Please have these ready:</p><ul><li>Proof of identity</li><li>Public liability insurance details</li><li>Any DBS evidence you already hold</li><li>Trade or business details where relevant</li></ul><p>Enhanced DBS evidence is reviewed only where the role is legally eligible.</p><p>TaskBridge Support</p></div>`
  });
}

async function sendEmail(input: { to: string; subject: string; text: string; html: string }) {
  const provider = config.emailProviderKind.toLowerCase();
  if (provider === "zoho") {
    if (!config.zohoMailAccountId || !config.emailFromAddress ||
        (!config.zohoMailOAuthToken && (!config.zohoRefreshToken || !config.zohoClientId || !config.zohoClientSecret))) {
      return { status: "not_configured" as const, providerMessageId: null };
    }
    try {
      const accessToken = await getZohoAccessToken();
      const baseUrl = config.zohoMailApiBaseUrl.replace(/\/$/, "");
      const response = await fetch(`${baseUrl}/api/accounts/${encodeURIComponent(config.zohoMailAccountId)}/messages`, {
        method: "POST",
        headers: {
          "accept": "application/json",
          "authorization": `Zoho-oauthtoken ${accessToken}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          fromAddress: emailAddressFromHeader(config.emailFromAddress),
          toAddress: input.to,
          subject: input.subject,
          content: input.html,
          mailFormat: "html",
          askReceipt: "no",
          encoding: "UTF-8"
        }),
        signal: AbortSignal.timeout(15_000)
      });
      if (!response.ok) return { status: "failed" as const, providerMessageId: null };
      const payload = await response.json().catch(() => ({})) as JsonRecord;
      const providerMessageId = asString(readPath(payload, ["data.messageId", "data.message_id", "messageId", "message_id", "id"])) || null;
      return { status: "sent" as const, providerMessageId };
    } catch {
      return { status: "failed" as const, providerMessageId: null };
    }
  }

  if (!config.emailProviderApiKey || !config.emailFromAddress) {
    return { status: "not_configured" as const, providerMessageId: null };
  }
  try {
    const response = await fetch(config.emailProviderApiUrl, {
      method: "POST",
      headers: { authorization: `Bearer ${config.emailProviderApiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: config.emailFromAddress,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html
      }),
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) return { status: "failed" as const, providerMessageId: null };
    const payload = await response.json().catch(() => ({})) as { id?: string };
    return { status: "sent" as const, providerMessageId: payload.id || null };
  } catch {
    return { status: "failed" as const, providerMessageId: null };
  }
}

export async function sendStaffOnboardingInvite(input: {
  email: string;
  fullName: string;
  organisationName: string;
  roleLabel: string;
  invitationUrl: string;
  expiresAt: string;
}) {
  const expiry = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/London" })
    .format(new Date(input.expiresAt));
  return sendEmail({
    to: input.email,
    subject: `Set up your ${input.organisationName} TaskBridge access`,
    text: `Hello ${input.fullName},\n\nYou have been invited as ${input.roleLabel}. Create your TaskBridge password using this one-use link before ${expiry}:\n${input.invitationUrl}`,
    html: `<p>Hello ${escapeHtml(input.fullName)},</p><p>You have been invited as <strong>${escapeHtml(input.roleLabel)}</strong> for ${escapeHtml(input.organisationName)}.</p><p><a href="${escapeHtml(input.invitationUrl)}">Set up your TaskBridge access</a></p><p>This one-use link expires on ${escapeHtml(expiry)}.</p>`
  });
}

export async function sendCareIntegrationRequirementsEmail(input: {
  email: string;
  contactName: string;
  organisationName: string;
}) {
  const checklist = [
    "Care-management provider: Birdie / PASS / Cera / Other",
    "Environment: sandbox/test or production",
    "API base URL",
    "Agency, workspace, branch, or account ID",
    "API access token or API key",
    "Webhook signing secret for inbound events sent to TaskBridge",
    "Callback URL requirements for TaskBridge status/completion updates",
    "Allowed IPs or allowlisting requirements",
    "OpenAPI/Swagger docs or provider integration guide",
    "Supported event types, such as care note created, risk/hazard logged, service user updated, visit/task completed"
  ];
  const textChecklist = checklist.map((item, index) => `${index + 1}. ${item}`).join("\n");
  const htmlChecklist = checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return sendEmail({
    to: input.email,
    subject: `TaskBridge care-management integration details for ${input.organisationName}`,
    text: `Hello ${input.contactName},\n\nThank you for onboarding ${input.organisationName} with TaskBridge.\n\nYou indicated that you want to connect your care-management system to TaskBridge. Please reply with the details below, or forward this to your care-management provider or integration contact.\n\nRequired details:\n${textChecklist}\n\nTaskBridge supports per-agency credentials, so each care agency can use its own provider workspace, token, webhook secret and callback settings.\n\nTaskBridge Support`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#111827"><p>Hello ${escapeHtml(input.contactName)},</p><p>Thank you for onboarding <strong>${escapeHtml(input.organisationName)}</strong> with TaskBridge.</p><p>You indicated that you want to connect your care-management system to TaskBridge. Please reply with the details below, or forward this to your care-management provider or integration contact.</p><p><strong>Required details</strong></p><ol>${htmlChecklist}</ol><p>TaskBridge supports per-agency credentials, so each care agency can use its own provider workspace, token, webhook secret and callback settings.</p><p>TaskBridge Support</p></div>`
  });
}

export async function sendDemoRequestReceipt(input: { email: string; fullName: string; organisationName: string }) {
  return sendEmail({
    to: input.email,
    subject: "Your TaskBridge demo request",
    text: `Hello ${input.fullName},\n\nWe have received the demo request for ${input.organisationName}. A TaskBridge specialist will review your requirements and contact you to arrange a focused walkthrough. No resident data is needed for the demonstration.`,
    html: `<p>Hello ${escapeHtml(input.fullName)},</p><p>We have received the demo request for <strong>${escapeHtml(input.organisationName)}</strong>.</p><p>A TaskBridge specialist will review your requirements and contact you to arrange a focused walkthrough. No resident data is needed for the demonstration.</p>`
  });
}
