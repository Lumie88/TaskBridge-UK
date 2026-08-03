import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "./config.js";

interface StripeCheckoutSession {
  id: string;
  url: string | null;
}

export interface StripeCheckoutInput {
  amountPence: number;
  currency: string;
  customerEmail: string;
  taskPublicId: string;
  sessionId: string;
  taskId: string;
  token: string;
  description: string;
}

export interface StripeCheckoutCompletedSession {
  id: string;
  payment_status?: string;
  amount_total?: number;
  currency?: string;
  customer_details?: { name?: string | null; email?: string | null };
  metadata?: Record<string, string>;
  payment_intent?: string | null;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: { object: unknown };
}

export interface StripePaymentExpectation {
  amount: string | number;
  currency: string;
}

export function stripeConfigured() {
  return Boolean(config.stripeSecretKey);
}

export async function createStripeCheckoutSession(input: StripeCheckoutInput) {
  if (!config.stripeSecretKey) throw Object.assign(new Error("Stripe is not configured"), { statusCode: 503 });
  const body = new URLSearchParams({
    mode: "payment",
    success_url: `${config.appOrigin}/family-payment/${encodeURIComponent(input.token)}?payment=stripe-success`,
    cancel_url: `${config.appOrigin}/family-payment/${encodeURIComponent(input.token)}?payment=stripe-cancelled`,
    customer_email: input.customerEmail,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": input.currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(input.amountPence),
    "line_items[0][price_data][product_data][name]": `TaskBridge home-safety work ${input.taskPublicId}`,
    "line_items[0][price_data][product_data][description]": input.description.slice(0, 900),
    "metadata[familyPaymentSessionId]": input.sessionId,
    "metadata[taskId]": input.taskId,
    "metadata[taskPublicId]": input.taskPublicId,
    "payment_intent_data[metadata][familyPaymentSessionId]": input.sessionId,
    "payment_intent_data[metadata][taskId]": input.taskId,
    "payment_intent_data[metadata][taskPublicId]": input.taskPublicId
  });

  const response = await fetch(`${config.stripeApiBaseUrl}/v1/checkout/sessions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.stripeSecretKey}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body
  });
  const payload = await response.json().catch(() => ({})) as { error?: { message?: string } } & Partial<StripeCheckoutSession>;
  if (!response.ok || !payload.id || !payload.url) {
    throw Object.assign(new Error(payload.error?.message || "Stripe checkout session could not be created"), { statusCode: 502 });
  }
  return { id: payload.id, url: payload.url };
}

export async function retrieveStripeCheckoutSession(sessionId: string) {
  if (!config.stripeSecretKey) throw Object.assign(new Error("Stripe is not configured"), { statusCode: 503 });
  const response = await fetch(`${config.stripeApiBaseUrl}/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { authorization: `Bearer ${config.stripeSecretKey}` }
  });
  const payload = await response.json().catch(() => ({})) as { error?: { message?: string } } & Partial<StripeCheckoutSession>;
  if (!response.ok || !payload.id || !payload.url) {
    throw Object.assign(new Error(payload.error?.message || "Stripe checkout session could not be retrieved"), { statusCode: 502 });
  }
  return { id: payload.id, url: payload.url };
}

export function verifyStripeWebhook(rawBody: Buffer, signatureHeader: string | undefined) {
  if (!config.stripeWebhookSecret) throw Object.assign(new Error("Stripe webhook secret is not configured"), { statusCode: 503 });
  if (!signatureHeader) throw Object.assign(new Error("Stripe signature is missing"), { statusCode: 401 });
  const parts = signatureHeader.split(",").reduce<Record<string, string[]>>((acc, part) => {
    const [key, value] = part.split("=", 2);
    if (!key || !value) return acc;
    acc[key] = [...(acc[key] || []), value];
    return acc;
  }, {});
  const timestamp = parts.t?.[0];
  const signatures = parts.v1 || [];
  if (!timestamp || signatures.length === 0) throw Object.assign(new Error("Stripe signature is malformed"), { statusCode: 401 });
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) throw Object.assign(new Error("Stripe signature timestamp is outside tolerance"), { statusCode: 401 });
  const expected = createHmac("sha256", config.stripeWebhookSecret).update(`${timestamp}.${rawBody.toString("utf8")}`).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const valid = signatures.some((signature) => {
    const signatureBuffer = Buffer.from(signature, "hex");
    return signatureBuffer.length === expectedBuffer.length && timingSafeEqual(signatureBuffer, expectedBuffer);
  });
  if (!valid) throw Object.assign(new Error("Stripe signature verification failed"), { statusCode: 401 });
  return JSON.parse(rawBody.toString("utf8")) as StripeWebhookEvent;
}

export function isCheckoutCompletedSession(value: unknown): value is StripeCheckoutCompletedSession {
  return Boolean(value && typeof value === "object" && typeof (value as StripeCheckoutCompletedSession).id === "string");
}

export function assertStripeCheckoutMatchesPayment(session: StripeCheckoutCompletedSession, expected: StripePaymentExpectation) {
  const expectedAmount = Math.round(Number(expected.amount) * 100);
  const expectedCurrency = expected.currency.toLowerCase();
  if (!Number.isFinite(expectedAmount) || expectedAmount < 0) {
    throw Object.assign(new Error("TaskBridge payment amount is invalid"), { statusCode: 422 });
  }
  if (session.amount_total !== expectedAmount || session.currency?.toLowerCase() !== expectedCurrency) {
    throw Object.assign(new Error("Stripe payment amount or currency did not match TaskBridge session"), { statusCode: 409 });
  }
}
