import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeDbsProviderCallback } from "../server/integrations.js";

test("normalises Amiqus session completion into an approved DBS result", () => {
  const result = normalizeDbsProviderCallback({
    event: "session.completed",
    data: {
      session: {
        id: "amiqus_sess_123",
        status: "completed",
        outcome: "clear",
        report_url: "https://amiqus.example/reports/amiqus_sess_123"
      }
    }
  });

  assert.equal(result?.providerSessionId, "amiqus_sess_123");
  assert.equal(result?.status, "approved");
  assert.equal(result?.eventType, "session.completed");
  assert.equal(result?.evidenceReference, "https://amiqus.example/reports/amiqus_sess_123");
  assert.match(result?.expiryDate || "", /^\d{4}-\d{2}-\d{2}$/);
});

test("normalises failed DBS provider callback into rejected status", () => {
  const result = normalizeDbsProviderCallback({
    session_id: "amiqus_sess_456",
    status: "not_clear",
    evidence_reference: "case-456"
  });

  assert.equal(result?.providerSessionId, "amiqus_sess_456");
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
