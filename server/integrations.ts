import { config } from "./config.js";

async function providerPost(url: string, apiKey: string, payload: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error(`Provider request failed with status ${response.status}`);
  return response.json() as Promise<Record<string, unknown>>;
}

export async function startDbsVerification(payload: Record<string, unknown>) {
  if (!config.dbsProviderApiUrl) throw new Error("DBS verification provider is not configured");
  return providerPost(config.dbsProviderApiUrl, config.dbsProviderApiKey, payload);
}

export async function dispatchToHandymanNetwork(payload: Record<string, unknown>) {
  if (!config.handymanNetworkApiUrl) {
    return { providerBookingId: `internal_${Date.now()}`, status: "recorded_without_provider" };
  }
  return providerPost(config.handymanNetworkApiUrl, config.handymanNetworkApiKey, payload);
}

export async function cancelHandymanNetworkBooking(payload: Record<string, unknown>) {
  if (!config.handymanNetworkCancelApiUrl) return { status: "not_configured" };
  return providerPost(config.handymanNetworkCancelApiUrl, config.handymanNetworkApiKey, payload);
}

export async function sendSecureVisitLink(payload: Record<string, unknown>) {
  if (config.twilioAccountSid && config.twilioAuthToken && config.twilioFromNumber) {
    const mobile = String(payload.mobile || "");
    const visitUrl = String(payload.visitUrl || "");
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.twilioAccountSid}/Messages.json`, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${config.twilioAccountSid}:${config.twilioAuthToken}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        From: config.twilioFromNumber,
        To: mobile,
        Body: `TaskBridge visit assigned. Use this secure one-use link to check in, upload evidence and check out: ${visitUrl}`
      }),
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) throw new Error(`Twilio request failed with status ${response.status}`);
    const result = await response.json() as { sid?: string; status?: string };
    return { status: result.status || "queued", provider: "twilio", providerMessageId: result.sid || null };
  }
  if (!config.smsProviderApiUrl) return { status: "not_configured", provider: "none", providerMessageId: null };
  return providerPost(config.smsProviderApiUrl, config.smsProviderApiKey, payload);
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

export async function sendHandymanOnboardingInvite(input: {
  email: string;
  fullName: string;
  invitationUrl: string;
  expiresAt: string;
}) {
  if (!config.emailProviderApiKey || !config.emailFromAddress) {
    return { status: "not_configured" as const, providerMessageId: null };
  }
  const safeName = escapeHtml(input.fullName);
  const safeUrl = escapeHtml(input.invitationUrl);
  const expiry = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/London" })
    .format(new Date(input.expiresAt));
  try {
    const response = await fetch(config.emailProviderApiUrl, {
      method: "POST",
      headers: {
        "authorization": `Bearer ${config.emailProviderApiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        from: config.emailFromAddress,
        to: [input.email],
        subject: "Complete your TaskBridge handyman registration",
        text: `Hello ${input.fullName},\n\nTaskBridge has invited you to complete secure handyman registration. Open this one-use link before ${expiry}:\n${input.invitationUrl}\n\nYou will need identity, public liability insurance and Enhanced DBS evidence.`,
        html: `<p>Hello ${safeName},</p><p>TaskBridge has invited you to complete secure handyman registration.</p><p><a href="${safeUrl}">Complete your registration</a></p><p>This one-use link expires on ${escapeHtml(expiry)}. You will need identity, public liability insurance and Enhanced DBS evidence.</p>`
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

async function sendEmail(input: { to: string; subject: string; text: string; html: string }) {
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

export async function sendDemoRequestReceipt(input: { email: string; fullName: string; organisationName: string }) {
  return sendEmail({
    to: input.email,
    subject: "Your TaskBridge demo request",
    text: `Hello ${input.fullName},\n\nWe have received the demo request for ${input.organisationName}. A TaskBridge specialist will review your requirements and contact you to arrange a focused walkthrough. No resident data is needed for the demonstration.`,
    html: `<p>Hello ${escapeHtml(input.fullName)},</p><p>We have received the demo request for <strong>${escapeHtml(input.organisationName)}</strong>.</p><p>A TaskBridge specialist will review your requirements and contact you to arrange a focused walkthrough. No resident data is needed for the demonstration.</p>`
  });
}
