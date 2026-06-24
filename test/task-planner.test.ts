import assert from "node:assert/strict";
import test from "node:test";
import { analyzeCareNote, createTaskPlan, extractKeysafeInfo } from "../server/task-planner.js";

test("a care note containing multiple needs becomes separate reviewable tasks", async () => {
  const plan = await createTaskPlan(
    "The back path is slippery with moss. The kitchen cupboard handle is also loose and the sitting room windows need cleaning.",
    true
  );
  assert.ok(plan.length >= 2);
  assert.ok(plan.every((item) => item.safeguardingApplies));
  assert.ok(plan.some((item) => /garden|path/i.test(item.category)));
  assert.ok(plan.some((item) => /repair|window/i.test(item.category)));
});

test("keysafe information and safeguarding warnings are separated from task summaries", async () => {
  const note = "The path is unsafe. Keysafe code: 4182. The service user is usually alone.";
  assert.equal(extractKeysafeInfo(note), "4182");
  const analysis = await analyzeCareNote(note, true);
  assert.equal(analysis.keysafeInfo, "4182");
  assert.ok(analysis.safeguardingWarnings.length >= 2);
  assert.ok(analysis.suggestions.every((item) => !item.summary.includes("4182")));
});
