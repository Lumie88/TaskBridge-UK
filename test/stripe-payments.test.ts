import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import http from "node:http";
import test from "node:test";
import { createApp } from "../server/app.js";
import { config } from "../server/config.js";
import { assertStripeCheckoutMatchesPayment, verifyStripeWebhook, type StripeCheckoutCompletedSession } from "../server/stripe.js";

test("Stripe webhook signatures are verified against the raw body", () => {
  const previousSecret = config.stripeWebhookSecret;
  config.stripeWebhookSecret = "whsec_test_secret";
  const rawBody = Buffer.from(JSON.stringify({
    id: "evt_test",
    type: "checkout.session.completed",
    data: { object: { id: "cs_test_123" } }
  }));
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", config.stripeWebhookSecret).update(`${timestamp}.${rawBody.toString("utf8")}`).digest("hex");

  try {
    const event = verifyStripeWebhook(rawBody, `t=${timestamp},v1=${signature}`);
    assert.equal(event.id, "evt_test");
    assert.throws(
      () => verifyStripeWebhook(rawBody, `t=${timestamp},v1=${"0".repeat(64)}`),
      /Stripe signature verification failed/
    );
  } finally {
    config.stripeWebhookSecret = previousSecret;
  }
});

test("Stripe checkout completion must match the TaskBridge payment amount and currency", () => {
  const paidSession: StripeCheckoutCompletedSession = {
    id: "cs_test_123",
    payment_status: "paid",
    amount_total: 12500,
    currency: "gbp"
  };

  assert.doesNotThrow(() => assertStripeCheckoutMatchesPayment(paidSession, { amount: "125.00", currency: "GBP" }));
  assert.throws(
    () => assertStripeCheckoutMatchesPayment({ ...paidSession, amount_total: 12400 }, { amount: "125.00", currency: "GBP" }),
    /amount or currency did not match/
  );
  assert.throws(
    () => assertStripeCheckoutMatchesPayment({ ...paidSession, currency: "usd" }, { amount: "125.00", currency: "GBP" }),
    /amount or currency did not match/
  );
});

test("manual family payment confirmation is blocked when Stripe is configured", async () => {
  const previousSecretKey = config.stripeSecretKey;
  const previousAllowedOrigins = config.allowedOrigins;
  config.stripeSecretKey = "stripe_unit_secret";
  config.allowedOrigins = ["http://127.0.0.1"];
  const server = http.createServer(createApp());

  try {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert(address && typeof address === "object");
    const response = await fetch(`http://127.0.0.1:${address.port}/api/family/payments/test-token/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payerName: "Test Payer", confirmationReference: "anything" })
    });
    const payload = await response.json() as { error?: string };

    assert.equal(response.status, 409);
    assert.equal(payload.error, "Card payments must be completed through Stripe Checkout");
  } finally {
    config.stripeSecretKey = previousSecretKey;
    config.allowedOrigins = previousAllowedOrigins;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
