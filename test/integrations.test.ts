import assert from "node:assert/strict";
import { test } from "node:test";
import { familyPaymentSmsBody, normalizeDbsProviderCallback } from "../server/integrations.js";

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
