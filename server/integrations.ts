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
  if (!config.smsProviderApiUrl) return { status: "not_configured" };
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
