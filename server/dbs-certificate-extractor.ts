import { config } from "./config.js";

export interface DbsCertificateExtraction {
  certificateNumber: string;
  issueDate: string | null;
  currentSurname: string;
  dateOfBirth: string | null;
  workforceType: "adult" | "child" | "adult_and_child" | "unknown";
  confidence: number;
  missingFields: string[];
  manualReviewReason: string | null;
}

const emptyExtraction: DbsCertificateExtraction = {
  certificateNumber: "",
  issueDate: null,
  currentSurname: "",
  dateOfBirth: null,
  workforceType: "unknown",
  confidence: 0,
  missingFields: ["certificateNumber", "issueDate", "currentSurname", "dateOfBirth"],
  manualReviewReason: "OpenAI document extraction is not configured."
};

const extractionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "certificateNumber",
    "issueDate",
    "currentSurname",
    "dateOfBirth",
    "workforceType",
    "confidence",
    "manualReviewReason"
  ],
  properties: {
    certificateNumber: { type: "string" },
    issueDate: { type: ["string", "null"] },
    currentSurname: { type: "string" },
    dateOfBirth: { type: ["string", "null"] },
    workforceType: { type: "string", enum: ["adult", "child", "adult_and_child", "unknown"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    manualReviewReason: { type: ["string", "null"] }
  }
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asDate(value: unknown) {
  const text = asString(value);
  if (!text) return null;
  const normalized = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (normalized) return text;
  const uk = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (!uk) return null;
  return `${uk[3]}-${uk[2].padStart(2, "0")}-${uk[1].padStart(2, "0")}`;
}

function normaliseWorkforce(value: unknown): DbsCertificateExtraction["workforceType"] {
  const text = asString(value).toLowerCase().replace(/[^a-z]+/g, "_");
  if (text.includes("adult") && text.includes("child")) return "adult_and_child";
  if (text.includes("adult")) return "adult";
  if (text.includes("child")) return "child";
  return "unknown";
}

function parseOutputText(payload: Record<string, unknown>) {
  const direct = asString(payload.output_text);
  if (direct) return direct;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    const content = Array.isArray(asRecord(item).content) ? asRecord(item).content as unknown[] : [];
    for (const part of content) {
      const text = asString(asRecord(part).text);
      if (text) return text;
    }
  }
  return "";
}

function parseExtraction(text: string): DbsCertificateExtraction {
  const jsonText = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  const parsed = asRecord(JSON.parse(jsonText));
  const certificateNumber = asString(parsed.certificateNumber).replace(/\s+/g, "");
  const issueDate = asDate(parsed.issueDate);
  const currentSurname = asString(parsed.currentSurname);
  const dateOfBirth = asDate(parsed.dateOfBirth);
  const workforceType = normaliseWorkforce(parsed.workforceType);
  const confidence = Math.max(0, Math.min(1, Number(parsed.confidence || 0)));
  const missingFields = [
    certificateNumber ? "" : "certificateNumber",
    issueDate ? "" : "issueDate",
    currentSurname ? "" : "currentSurname",
    dateOfBirth ? "" : "dateOfBirth"
  ].filter(Boolean);
  const manualReviewReason = missingFields.length || confidence < 0.75
    ? asString(parsed.manualReviewReason) || "The certificate could not be read with enough confidence."
    : null;
  return { certificateNumber, issueDate, currentSurname, dateOfBirth, workforceType, confidence, missingFields, manualReviewReason };
}

export async function extractDbsCertificateDetails(input: {
  filename: string;
  contentType: "application/pdf" | "image/jpeg" | "image/png";
  body: Buffer;
}): Promise<DbsCertificateExtraction> {
  if (!config.openaiApiKey) return emptyExtraction;
  const fileData = input.body.toString("base64");
  const content = input.contentType === "application/pdf"
    ? [
        {
          type: "input_text",
          text: "Extract DBS certificate details from this uploaded certificate. Return only JSON with keys certificateNumber, issueDate, currentSurname, dateOfBirth, workforceType, confidence, manualReviewReason. Dates must be YYYY-MM-DD. Use empty strings/null for uncertain fields. Do not infer details that are not visible."
        },
        {
          type: "input_file",
          filename: input.filename,
          file_data: fileData
        }
      ]
    : [
        {
          type: "input_text",
          text: "Extract DBS certificate details from this uploaded certificate image. Return only JSON with keys certificateNumber, issueDate, currentSurname, dateOfBirth, workforceType, confidence, manualReviewReason. Dates must be YYYY-MM-DD. Use empty strings/null for uncertain fields. Do not infer details that are not visible."
        },
        {
          type: "input_image",
          image_url: `data:${input.contentType};base64,${fileData}`,
          detail: "high"
        }
      ];
  try {
    const response = await fetch(`${config.openaiApiBaseUrl.replace(/\/$/, "")}/responses`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.openaiApiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: config.openaiModel,
        input: [{ role: "user", content }],
        text: {
          format: {
            type: "json_schema",
            name: "taskbridge_dbs_certificate_extraction",
            strict: true,
            schema: extractionJsonSchema
          }
        }
      }),
      signal: AbortSignal.timeout(30_000)
    });
    if (!response.ok) {
      return { ...emptyExtraction, manualReviewReason: `OpenAI extraction failed with status ${response.status}.` };
    }
    const payload = await response.json() as Record<string, unknown>;
    const outputText = parseOutputText(payload);
    if (!outputText) return { ...emptyExtraction, manualReviewReason: "OpenAI extraction returned no readable result." };
    return parseExtraction(outputText);
  } catch (error) {
    return {
      ...emptyExtraction,
      manualReviewReason: error instanceof Error ? error.message : "OpenAI extraction failed."
    };
  }
}
