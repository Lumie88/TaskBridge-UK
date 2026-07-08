import assert from "node:assert/strict";
import test from "node:test";
import { config } from "../server/config.js";
import { evidenceFileUrl } from "../server/media.js";

test("visit evidence file URLs are derived only from TaskBridge storage keys", () => {
  config.objectStoragePublicBaseUrl = "https://storage.example/taskbridge";

  assert.equal(
    evidenceFileUrl("visit-evidence/task-123/before_photo/photo.jpg"),
    "https://storage.example/taskbridge/visit-evidence/task-123/before_photo/photo.jpg"
  );

  assert.throws(
    () => evidenceFileUrl("https://attacker.example/fake-after-photo.jpg"),
    /Evidence storage path is invalid/
  );
  assert.throws(
    () => evidenceFileUrl("handyman-onboarding/invitation-123/enhanced_dbs/file.pdf"),
    /Evidence storage path is invalid/
  );
});
