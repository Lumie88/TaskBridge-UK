import assert from "node:assert/strict";
import test from "node:test";
import { config } from "../server/config.js";
import { evidenceFileUrl, verifyEvidenceObjectSignature } from "../server/media.js";

test("visit evidence file URLs are derived only from TaskBridge storage keys", () => {
  config.objectStoragePublicBaseUrl = "https://storage.example/taskbridge";

  const storageKey = "visit-evidence/task-123/before_photo/photo.jpg";
  const url = new URL(evidenceFileUrl(storageKey));
  assert.equal(`${url.origin}${url.pathname}`, "https://storage.example/taskbridge/visit-evidence/task-123/before_photo/photo.jpg");
  assert.ok(url.searchParams.get("sig"));
  assert.doesNotThrow(() => verifyEvidenceObjectSignature(storageKey, url.searchParams.get("sig") || undefined));
  assert.throws(() => verifyEvidenceObjectSignature(storageKey, undefined), /signature is missing/);
  assert.throws(() => verifyEvidenceObjectSignature(storageKey, "tampered"), /signature is invalid/);

  assert.throws(
    () => evidenceFileUrl("https://attacker.example/fake-after-photo.jpg"),
    /Evidence storage path is invalid/
  );
  assert.throws(
    () => evidenceFileUrl("handyman-onboarding/invitation-123/enhanced_dbs/file.pdf"),
    /Evidence storage path is invalid/
  );
});
