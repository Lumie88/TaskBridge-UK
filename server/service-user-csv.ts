export type ServiceUserRiskLevel = "standard" | "vulnerable_adult" | "high_risk";
export type PreferredCarerGender = "no_preference" | "female" | "male";

export interface ServiceUserCsvRow {
  reference: string;
  fullName: string;
  address: string;
  town: string;
  county: string;
  postcode: string;
  riskLevel: ServiceUserRiskLevel;
  carersRequiredPerVisit: number;
  preferredCarerGender: PreferredCarerGender;
  vulnerabilityNotes: string;
}

export interface ServiceUserCsvParseResult {
  rows: ServiceUserCsvRow[];
  errors: string[];
}

const MAX_SERVICE_USER_IMPORT_ROWS = 500;

export const SERVICE_USER_CSV_TEMPLATE = [
  ["reference", "full_name", "address", "town", "county", "postcode", "risk_level", "carers_required_per_visit", "preferred_carer_gender", "vulnerability_notes"],
  ["", "Janet Hart", "Flat 4, 12 Example Road", "Peterborough", "Cambridgeshire", "PE1 1AA", "vulnerable_adult", "2", "female", "Lives alone; double-up care call required"]
].map((row) => row.map(csvEscape).join(",")).join("\r\n") + "\r\n";

export function parseServiceUserCsv(csvText: string): ServiceUserCsvParseResult {
  const records = parseCsvRecords(csvText);
  if (!records.length) return { rows: [], errors: ["CSV file is empty"] };

  const headers = records[0].map(normalizeHeader);
  const body = records.slice(1).filter((record) => record.some((value) => value.trim()));
  const errors: string[] = [];
  const rows: ServiceUserCsvRow[] = [];
  const seenReferences = new Set<string>();

  if (body.length > MAX_SERVICE_USER_IMPORT_ROWS) {
    return { rows: [], errors: [`CSV can import up to ${MAX_SERVICE_USER_IMPORT_ROWS} service users at a time`] };
  }

  body.forEach((record, index) => {
    const source = Object.fromEntries(headers.map((header, headerIndex) => [header, record[headerIndex]?.trim() || ""]));
    const line = index + 2;
    const row = normalizeServiceUserRow(source);
    const rowErrors = validateServiceUserRow(row, line);

    if (row.reference) {
      const key = row.reference.toLowerCase();
      if (seenReferences.has(key)) rowErrors.push(`CSV row ${line}: reference "${row.reference}" is duplicated in this file`);
      seenReferences.add(key);
    }

    if (rowErrors.length) {
      errors.push(...rowErrors);
      return;
    }
    rows.push(row);
  });

  if (!rows.length && !errors.length) errors.push("CSV file does not contain any service-user rows");
  return { rows, errors };
}

function normalizeServiceUserRow(row: Record<string, string>): ServiceUserCsvRow {
  return {
    reference: firstValue(row, ["reference", "service_user_reference", "service_user_id", "external_service_user_id"]),
    fullName: firstValue(row, ["full_name", "service_user_full_name", "name", "service_user_name"]),
    address: firstValue(row, ["address", "street_address", "home_address"]),
    town: firstValue(row, ["town", "city"]),
    county: firstValue(row, ["county", "region"]),
    postcode: firstValue(row, ["postcode", "post_code", "postal_code"]).toUpperCase(),
    riskLevel: normalizeRiskLevel(firstValue(row, ["risk_level", "safeguarding_status", "status"])),
    carersRequiredPerVisit: normalizeCarersRequired(firstValue(row, ["carers_required_per_visit", "carers_required", "number_of_carers", "visit_carers", "double_up"])),
    preferredCarerGender: normalizePreferredCarerGender(firstValue(row, ["preferred_carer_gender", "carer_gender", "gender_preference", "gender_requirement"])),
    vulnerabilityNotes: firstValue(row, ["vulnerability_notes", "safeguarding_notes", "notes", "visit_controls"])
  };
}

function validateServiceUserRow(row: ServiceUserCsvRow, line: number) {
  const errors: string[] = [];
  if (row.reference.length > 80) errors.push(`CSV row ${line}: reference must be 80 characters or fewer`);
  if (row.fullName.length < 2 || row.fullName.length > 160) errors.push(`CSV row ${line}: full_name must be 2-160 characters`);
  if (row.address.length < 5 || row.address.length > 500) errors.push(`CSV row ${line}: address must be 5-500 characters`);
  if (row.town.length < 2 || row.town.length > 120) errors.push(`CSV row ${line}: town must be 2-120 characters`);
  if (row.county.length < 2 || row.county.length > 120) errors.push(`CSV row ${line}: county must be 2-120 characters`);
  if (row.postcode.length < 5 || row.postcode.length > 12) errors.push(`CSV row ${line}: postcode must be 5-12 characters`);
  if (![1, 2].includes(row.carersRequiredPerVisit)) errors.push(`CSV row ${line}: carers_required_per_visit must be 1 or 2`);
  if (!["no_preference", "female", "male"].includes(row.preferredCarerGender)) errors.push(`CSV row ${line}: preferred_carer_gender must be no_preference, female or male`);
  if (row.vulnerabilityNotes.length > 2000) errors.push(`CSV row ${line}: vulnerability_notes must be 2000 characters or fewer`);
  return errors;
}

function normalizeRiskLevel(value: string): ServiceUserRiskLevel {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (["high", "high_risk", "urgent", "enhanced"].includes(normalized)) return "high_risk";
  if (["vulnerable", "vulnerable_adult", "adult_at_risk", "safeguarded"].includes(normalized)) return "vulnerable_adult";
  return "standard";
}

function normalizeCarersRequired(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return 1;
  if (["2", "two", "double", "double_up", "double-up", "yes", "y", "true"].includes(normalized)) return 2;
  if (["1", "one", "single", "single_carer", "single-carer", "no", "n", "false"].includes(normalized)) return 1;
  return Number.parseInt(normalized, 10);
}

function normalizePreferredCarerGender(value: string): PreferredCarerGender {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (["female", "woman", "women", "f"].includes(normalized)) return "female";
  if (["male", "man", "men", "m"].includes(normalized)) return "male";
  return "no_preference";
}

function parseCsvRecords(csvText: string) {
  const records: string[][] = [];
  let record: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const next = csvText[index + 1];

    if (char === "\"" && quoted && next === "\"") {
      value += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      record.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      record.push(value);
      value = "";
      if (record.some((item) => item.trim())) records.push(record);
      record = [];
      if (char === "\r" && next === "\n") index += 1;
    } else {
      value += char;
    }
  }

  record.push(value);
  if (record.some((item) => item.trim())) records.push(record);
  return records;
}

function firstValue(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = row[key]?.trim();
    if (value) return value;
  }
  return "";
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function csvEscape(value: string) {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}
