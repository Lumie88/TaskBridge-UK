import assert from "node:assert/strict";
import { test } from "node:test";
import { config } from "../server/config.js";
import { familyPaymentSmsBody, normalizeDbsProviderCallback, sendTwilioSms } from "../server/integrations.js";

test("normalises nested DBS provider completion into an approved DBS result", () => {
  const result = normalizeDbsProviderCallback({
    event: "application.completed",
    data: {
      application: {
        id: "ddc_app_123",
        status: "completed",
        outcome: "clear",
        certificate_reference: "DDC-CERT-123"
      }
    }
  });

  assert.equal(result?.providerSessionId, "ddc_app_123");
  assert.equal(result?.status, "approved");
  assert.equal(result?.eventType, "application.completed");
  assert.equal(result?.evidenceReference, "DDC-CERT-123");
  assert.match(result?.expiryDate || "", /^\d{4}-\d{2}-\d{2}$/);
});

test("normalises failed DBS provider callback into rejected status", () => {
  const result = normalizeDbsProviderCallback({
    application_id: "ddc_app_456",
    status: "not_clear",
    evidence_reference: "case-456"
  });

  assert.equal(result?.providerSessionId, "ddc_app_456");
  assert.equal(result?.status, "rejected");
  assert.equal(result?.evidenceReference, "case-456");
  assert.equal(result?.expiryDate, null);
});

test("normalises DDC application callback into an approved DBS result", () => {
  const result = normalizeDbsProviderCallback({
    event_type: "application.complete",
    application_id: "ddc_app_789",
    result: "clear",
    certificate_reference: "DDC-CERT-789",
    expiry_date: "2027-07-31"
  });

  assert.equal(result?.providerSessionId, "ddc_app_789");
  assert.equal(result?.status, "approved");
  assert.equal(result?.eventType, "application.complete");
  assert.equal(result?.evidenceReference, "DDC-CERT-789");
  assert.equal(result?.expiryDate, "2027-07-31");
});

test("family payment SMS includes the secure payment link and amount", () => {
  const body = familyPaymentSmsBody({
    payerName: "Ade",
    taskPublicId: "TB-123",
    amount: 75,
    currency: "GBP",
    paymentUrl: "https://www.growingfig.com/family-payment/token"
  });

  assert.match(body, /Hello Ade/);
  assert.match(body, /GBP 75\.00/);
  assert.match(body, /https:\/\/www\.growingfig\.com\/family-payment\/token/);
});

test("Twilio SMS retries with fallback sender when alphanumeric sender is rejected", async () => {
  const previous = {
    sid: config.twilioAccountSid,
    token: config.twilioAuthToken,
    from: config.twilioFromNumber,
    fallback: config.twilioFallbackFromNumber
  };
  const originalFetch = globalThis.fetch;
  const senders: string[] = [];
  config.twilioAccountSid = "AC_test";
  config.twilioAuthToken = "auth_test";
  config.twilioFromNumber = "TaskBridge";
  config.twilioFallbackFromNumber = "+447460077297";
  globalThis.fetch = async (_url, init) => {
    const body = init?.body as URLSearchParams;
    senders.push(body.get("From") || "");
    if (senders.length === 1) {
      return new Response(JSON.stringify({ code: 21612, message: "The From phone number is not a valid, SMS-capable inbound phone number or short code for your account." }), { status: 400 });
    }
    return new Response(JSON.stringify({ sid: "SM123", status: "queued" }), { status: 201 });
  };

  try {
    const result = await sendTwilioSms("+447760861579", "TaskBridge test");
    assert.deepEqual(senders, ["TaskBridge", "+447460077297"]);
    assert.equal(result.status, "queued");
    assert.equal(result.providerMessageId, "SM123");
    assert.equal(result.from, "+447460077297");
  } finally {
    config.twilioAccountSid = previous.sid;
    config.twilioAuthToken = previous.token;
    config.twilioFromNumber = previous.from;
    config.twilioFallbackFromNumber = previous.fallback;
    globalThis.fetch = originalFetch;
  }
});
