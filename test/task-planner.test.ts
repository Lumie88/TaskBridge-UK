import assert from "node:assert/strict";
import test from "node:test";
import { analyzeCareNote, createTaskPlan, deterministicTaskPlan, extractKeysafeInfo, hasKeysafeAccessInfo, postProcessSuggestions } from "../server/task-planner.js";

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

test("keysafe information in care notes is not auto-filled into access instructions", async () => {
  const note = "The path is unsafe. Keysafe code: 4182. The service user is usually alone.";
  assert.equal(extractKeysafeInfo(note), null);
  const analysis = await analyzeCareNote(note, true);
  assert.equal(analysis.keysafeInfo, null);
  assert.ok(analysis.safeguardingWarnings.length >= 2);
  assert.ok(analysis.suggestions.every((item) => !item.summary.includes("4182")));
  assert.ok(analysis.suggestions.every((item) => !/key safe/i.test(item.category)));
});

test("keysafe access notes are ignored for task creation and left for coordinator entry", () => {
  const note = "Please use the keysafe by the rear porch. Code is 4182. Clear moss from the path.";
  const accessInfo = extractKeysafeInfo(note);
  const plan = deterministicTaskPlan(note, true);

  assert.equal(hasKeysafeAccessInfo(note), true);
  assert.equal(accessInfo, null);
  assert.ok(plan.some((item) => item.category === "Path clearing"));
  assert.ok(plan.every((item) => item.category !== "Key safe and lock safety"));
});

test("actual keysafe or lock faults still become a safety task", () => {
  const plan = deterministicTaskPlan("The keysafe is jammed and the front door lock is sticking.", true);

  assert.ok(plan.some((item) => item.category === "Key safe and lock safety"));
});

test("keysafe repair wording is not mistaken for an access code", async () => {
  const note = "Got the key from the keysafe, Janet was fine. did her personal care. we noticed the keysafe is loose, screw is out of the wall. locked the door and secured the key in the keysafe";
  const analysis = await analyzeCareNote(note, true);

  assert.equal(analysis.keysafeInfo, null);
  assert.ok(analysis.suggestions.some((item) => item.category === "Key safe and lock safety"));
  assert.ok(analysis.suggestions.every((item) => item.category !== "Loose rail repair"));
  assert.ok(analysis.suggestions.every((item) => item.category !== "Lock repairs"));
  assert.ok(analysis.suggestions.every((item) => item.summary !== "loose"));
});

test("ungrounded AI rail and lock suggestions are replaced by the real keysafe fixture issue", () => {
  const note = "Got the key from the keysafe, Janet was fine. did her personal care. we noticed the keysafe is loose, screw is out of the wall. locked the door and secured the key in the keysafe";
  const grounded = postProcessSuggestions(note, [
    { category: "Loose rail repair", summary: "Loose rail repair required.", urgency: "low", safeguardingApplies: true },
    { category: "Lock repairs", summary: "Lock repairs required.", urgency: "low", safeguardingApplies: true }
  ]);
  const categories = grounded.map((item) => item.category);

  assert.deepEqual(categories, ["Key safe and lock safety"]);
});

test("socket and bulb faults are not mistaken for seasonal or appliance work", () => {
  const note = "Got to Janet apartment, all fine, about leaving, notice the socket is blown out and one of the bulbs in the living area is also blown out. locked up and secured the key in the keysafe";
  const plan = deterministicTaskPlan(note, true);
  const categories = plan.map((item) => item.category);
  const electrical = plan.find((item) => item.category === "Electrical safety checks");

  assert.ok(categories.includes("Electrical safety checks"));
  assert.ok(categories.every((item) => item !== "Seasonal safety checks"));
  assert.ok(categories.every((item) => item !== "Appliance safety checks"));
  assert.match(electrical?.summary || "", /socket is blown out/i);
  assert.match(electrical?.summary || "", /bulbs? in the living area/i);
});

test("ungrounded AI seasonal and appliance suggestions fall back to electrical work", () => {
  const note = "Got to Janet apartment, all fine, about leaving, notice the socket is blown out and one of the bulbs in the living area is also blown out. locked up and secured the key in the keysafe";
  const grounded = postProcessSuggestions(note, [
    { category: "Appliance safety checks", summary: "Appliance safety checks required.", urgency: "low", safeguardingApplies: true },
    { category: "Seasonal safety checks", summary: "Seasonal safety checks required.", urgency: "low", safeguardingApplies: true }
  ]);
  const categories = grounded.map((item) => item.category);

  assert.deepEqual(categories, ["Electrical safety checks"]);
  assert.match(grounded[0].summary, /socket is blown out/i);
  assert.match(grounded[0].summary, /bulbs? in the living area/i);
});

test("Age UK-style home safety notes map to practical check categories", () => {
  const plan = deterministicTaskPlan(
    "Repeat visit requested after another near fall. Please check the key safe, smoke alarm, CO alarm and seasonal ice risk by the back step.",
    true
  );
  const categories = plan.map((item) => item.category);
  assert.ok(categories.includes("Falls-risk triage"));
  assert.ok(categories.includes("Key safe and lock safety"));
  assert.ok(categories.includes("Smoke and carbon monoxide alarm checks"));
  assert.ok(categories.includes("Seasonal safety checks"));
  assert.ok(categories.includes("Repeat visit review"));
});
