import assert from "node:assert/strict";
import test from "node:test";
import { decryptField, encryptField, hashPassword, hashToken, isWorkEmail, verifyPassword } from "../server/security.js";

test("passwords are hashed and verified without storing plaintext", async () => {
  const password = "A-long-care-workspace-password";
  const hash = await hashPassword(password);
  assert.notEqual(hash, password);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword("incorrect-password", hash), false);
});

test("encrypted fields round trip and use randomized ciphertext", () => {
  const value = "21 Market Street, London";
  const first = encryptField(value);
  const second = encryptField(value);
  assert.notEqual(first, second);
  assert.equal(decryptField(first), value);
  assert.equal(decryptField(second), value);
});

test("work email validation blocks common personal providers", () => {
  assert.equal(isWorkEmail("manager@care-agency.co.uk"), true);
  assert.equal(isWorkEmail("manager@gmail.com"), false);
  assert.equal(isWorkEmail("manager@yahoo.co.uk"), false);
});

test("token hashes are stable and do not expose the token", () => {
  const token = "one-time-visit-token";
  assert.equal(hashToken(token), hashToken(token));
  assert.equal(hashToken(token).includes(token), false);
});

