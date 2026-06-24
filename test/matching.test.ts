import assert from "node:assert/strict";
import test from "node:test";
import { evaluateTrader, haversineMiles, type MatchableTask, type MatchableTrader } from "../server/matching.js";

const task: MatchableTask = {
  category: "Garden Path Clearing",
  vulnerableAdult: true,
  latitude: 51.5074,
  longitude: -0.1278,
  radiusMiles: 15
};

const eligibleTrader: MatchableTrader = {
  id: "trader-1",
  status: "active",
  services: ["Garden Path Clearing"],
  dbsStatus: "approved",
  dbsExpiryDate: "2030-01-01",
  insuranceStatus: "verified",
  insuranceExpiryDate: "2030-01-01",
  latitude: 51.52,
  longitude: -0.11,
  hourlyRate: 35,
  qualityScore: 95,
  available: true
};

test("eligible vulnerable-adult work requires every safeguarding control", () => {
  const result = evaluateTrader(task, eligibleTrader, new Date("2026-06-23T12:00:00Z"));
  assert.equal(result.eligible, true);
  assert.deepEqual(result.reasons, []);
});

test("a carer being present cannot make pending DBS eligible", () => {
  const result = evaluateTrader(task, { ...eligibleTrader, dbsStatus: "pending" }, new Date("2026-06-23T12:00:00Z"));
  assert.equal(result.eligible, false);
  assert.match(result.reasons.join(" "), /Enhanced DBS/);
});

test("expired insurance blocks all assignments", () => {
  const result = evaluateTrader(task, { ...eligibleTrader, insuranceExpiryDate: "2025-01-01" }, new Date("2026-06-23T12:00:00Z"));
  assert.equal(result.eligible, false);
  assert.match(result.reasons.join(" "), /insurance/);
});

test("Haversine distance returns a plausible London to Birmingham distance", () => {
  const miles = haversineMiles(51.5074, -0.1278, 52.4862, -1.8904);
  assert.ok(miles > 95 && miles < 110);
});

