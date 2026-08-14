import assert from "node:assert/strict";
import test from "node:test";
import { parseServiceUserCsv, SERVICE_USER_CSV_TEMPLATE } from "../server/service-user-csv.js";

test("service user CSV template contains the required directory headers", () => {
  const [headers] = SERVICE_USER_CSV_TEMPLATE.split(/\r?\n/);
  assert.match(headers, /full_name/);
  assert.match(headers, /address/);
  assert.match(headers, /postcode/);
  assert.match(headers, /risk_level/);
  assert.match(headers, /carers_required_per_visit/);
  assert.match(headers, /preferred_carer_gender/);
});

test("service user CSV import accepts quoted fields and normalises risk levels", () => {
  const result = parseServiceUserCsv(`reference,full_name,address,town,county,postcode,risk_level,carers_required_per_visit,preferred_carer_gender,vulnerability_notes
CARE-1,"Janet Hart","Flat 4, 12 Example Road",Peterborough,Cambridgeshire,pe1 1aa,Vulnerable adult,1,no preference,"Lives alone, carer attends"
CARE-2,"Mo Ali","1 ""Rose"" Court",Cambridge,Cambridgeshire,CB1 1AA,high risk,double-up,female,"Needs two-person access review"`);

  assert.deepEqual(result.errors, []);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].riskLevel, "vulnerable_adult");
  assert.equal(result.rows[0].carersRequiredPerVisit, 1);
  assert.equal(result.rows[0].preferredCarerGender, "no_preference");
  assert.equal(result.rows[0].postcode, "PE1 1AA");
  assert.equal(result.rows[0].vulnerabilityNotes, "Lives alone, carer attends");
  assert.equal(result.rows[1].address, "1 \"Rose\" Court");
  assert.equal(result.rows[1].riskLevel, "high_risk");
  assert.equal(result.rows[1].carersRequiredPerVisit, 2);
  assert.equal(result.rows[1].preferredCarerGender, "female");
});

test("service user CSV import reports row-level validation without losing valid rows", () => {
  const result = parseServiceUserCsv(`name,address,town,county,postcode
Valid Person,10 High Street,Leeds,West Yorkshire,LS1 1AA
X,No,Leeds,West Yorkshire,L`);

  assert.equal(result.rows.length, 1);
  assert.ok(result.errors.some((error) => error.includes("CSV row 3")));
});

test("service user CSV import rejects duplicated references in one file", () => {
  const result = parseServiceUserCsv(`reference,name,address,town,county,postcode
REF-1,Valid Person,10 High Street,Leeds,West Yorkshire,LS1 1AA
REF-1,Second Person,11 High Street,Leeds,West Yorkshire,LS1 1AB`);

  assert.equal(result.rows.length, 1);
  assert.ok(result.errors.some((error) => error.includes("duplicated")));
});
