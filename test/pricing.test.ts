import assert from "node:assert/strict";
import test from "node:test";
import { requiresLargerJobApproval, splitIncludedMargin } from "../server/pricing";

test("TaskBridge margin is included inside the fixed customer price", () => {
  const price = splitIncludedMargin(60);

  assert.equal(price.totalAmount, 60);
  assert.equal(price.handymanAmount, 52.17);
  assert.equal(price.platformFee, 7.83);
});

test("larger scope jobs are flagged for approval before release", () => {
  assert.equal(requiresLargerJobApproval("Garden clearance", "Clear path and garden"), true);
  assert.equal(requiresLargerJobApproval("Minor plumbing", "Whole house leak review needed"), true);
  assert.equal(requiresLargerJobApproval("Grab rail fitting", "Fit one supplied grab rail"), false);
});
