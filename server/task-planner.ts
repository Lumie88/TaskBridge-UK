import { z } from "zod";
import { config } from "./config.js";
import type { TaskSuggestion } from "./types.js";

const suggestionSchema = z.object({
  category: z.string().min(2).max(120),
  summary: z.string().min(5).max(500),
  urgency: z.enum(["low", "medium", "high", "urgent"]),
  safeguardingApplies: z.boolean()
});

const plannerResponseSchema = z.object({ suggestions: z.array(suggestionSchema).min(1).max(12) });

const categoryRules = [
  { category: "Lawn mowing", terms: ["lawn", "mow", "grass"] },
  { category: "Garden clearance", terms: ["garden", "bramble", "weed", "overgrown", "overgrowth"] },
  { category: "Window cleaning", terms: ["window", "glass"] },
  { category: "Path clearing", terms: ["path", "moss", "algae", "pavement", "slippery", "gravel"] },
  { category: "Loose rail repair", terms: ["rail", "handrail", "grab rail", "banister", "loose"] },
  { category: "Lock repairs", terms: ["lock", "door security", "sticking door"] },
  { category: "Deep cleaning", terms: ["deep clean", "grease", "dirty oven", "cleaning"] },
  { category: "Appliance safety checks", terms: ["appliance", "oven", "boiler", "electrical", "socket"] },
  { category: "Trip hazard removal", terms: ["trip", "wire", "fall hazard", "clutter", "rug"] }
];

function inferredUrgency(note: string): TaskSuggestion["urgency"] {
  if (/immediate|emergency|cannot exit|active fire|urgent/i.test(note)) return "urgent";
  if (/fall|slip|unsafe|broken|high risk/i.test(note)) return "high";
  if (/soon|worsening|concern/i.test(note)) return "medium";
  return "low";
}

export function deterministicTaskPlan(note: string, vulnerable: boolean): TaskSuggestion[] {
  const lower = note.toLowerCase();
  const urgency = inferredUrgency(note);
  const matches = categoryRules.filter((rule) => rule.terms.some((term) => lower.includes(term)));
  const selected = matches.length ? matches : [{ category: "Home safety inspection", terms: [] }];
  return selected.map((rule) => ({
    category: rule.category,
    summary: `${rule.category} required following a care-team home safety observation. Review the reported condition and make the area safe.`,
    urgency,
    safeguardingApplies: vulnerable
  }));
}

export async function createTaskPlan(note: string, vulnerable: boolean) {
  if (config.googleGeminiApiKey) {
    const gemini = await createGeminiTaskPlan(note, vulnerable);
    if (gemini.length) return gemini;
  }
  if (!config.aiTaskPlannerUrl) return deterministicTaskPlan(note, vulnerable);
  const response = await fetch(config.aiTaskPlannerUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(config.aiTaskPlannerApiKey ? { authorization: `Bearer ${config.aiTaskPlannerApiKey}` } : {})
    },
    body: JSON.stringify({
      note,
      vulnerableAdult: vulnerable,
      allowedCategories: categoryRules.map((rule) => rule.category)
    }),
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) throw new Error(`AI task planner failed with status ${response.status}`);
  return plannerResponseSchema.parse(await response.json()).suggestions;
}

async function createGeminiTaskPlan(note: string, vulnerable: boolean) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.googleGeminiModel)}:generateContent?key=${encodeURIComponent(config.googleGeminiApiKey)}`;
  const prompt = [
    "You are TaskBridge's care-note safety task planner for UK homecare operations.",
    "Return only valid JSON matching this exact shape:",
    '{"suggestions":[{"category":"string","summary":"string","urgency":"low|medium|high|urgent","safeguardingApplies":true}]}',
    "Rules:",
    "- Split a note into separate practical home-safety tasks when it contains more than one issue.",
    "- Keep summaries free of keysafe codes, phone numbers, and unnecessary resident personal data.",
    "- Use only practical low-risk home support categories unless the note clearly requires escalation.",
    "- Mark safeguardingApplies from the vulnerableAdult flag.",
    `Allowed categories: ${categoryRules.map((rule) => rule.category).join(", ")}.`,
    `vulnerableAdult: ${vulnerable}`,
    `Care note: ${note}`
  ].join("\n");
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
      }),
      signal: AbortSignal.timeout(12_000)
    });
    if (!response.ok) return [];
    const payload = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
    if (!text) return [];
    return plannerResponseSchema.parse(JSON.parse(text)).suggestions;
  } catch {
    return [];
  }
}

export function extractKeysafeInfo(note: string) {
  const match = note.match(/key\s*safe(?:\s*(?:code|passcode|pin))?\s*(?:is|:|-)?\s*([a-z0-9-]{3,16})/i);
  return match?.[1] || null;
}

export async function analyzeCareNote(note: string, vulnerable: boolean) {
  const suggestions = await createTaskPlan(note, vulnerable);
  const warnings: string[] = [];
  if (vulnerable) warnings.push("Vulnerable-adult safeguarding controls and Enhanced DBS verification are mandatory.");
  if (/alone|unaccompanied|no carer|without (?:a )?carer/i.test(note)) {
    warnings.push("The note may indicate an unaccompanied visit; TaskBridge administration must review the visit controls.");
  }
  if (/aggressive|violence|weapon|threat/i.test(note)) {
    warnings.push("The note contains a potential personal-safety concern requiring operational review.");
  }
  return {
    suggestions,
    keysafeInfo: extractKeysafeInfo(note),
    safeguardingWarnings: warnings
  };
}
