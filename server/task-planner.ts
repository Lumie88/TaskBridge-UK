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
  { category: "Minor adaptations", terms: ["minor adaptation", "grab rail", "threshold ramp", "raised toilet", "bath board", "adaptation"] },
  { category: "Falls-risk triage", terms: ["fall", "falls", "unsteady", "mobility", "walking aid", "balance", "near miss"] },
  { category: "Lock repairs", terms: ["lock", "door security", "sticking door"] },
  { category: "Key safe and lock safety", terms: ["key safe", "keysafe", "spare key", "access code", "door access", "thumbturn"] },
  { category: "Deep cleaning", terms: ["deep clean", "grease", "dirty oven", "cleaning"] },
  { category: "Appliance safety checks", terms: ["appliance", "oven", "boiler", "electrical", "socket"] },
  { category: "Smoke and carbon monoxide alarm checks", terms: ["smoke alarm", "carbon monoxide", "co alarm", "fire alarm", "alarm battery"] },
  { category: "Trip hazard removal", terms: ["trip", "wire", "fall hazard", "clutter", "rug"] },
  { category: "Seasonal safety checks", terms: ["winter", "cold", "ice", "heatwave", "summer", "seasonal", "leaves", "salt"] },
  { category: "Repeat visit review", terms: ["repeat visit", "follow up", "follow-up", "again", "repeated", "still unsafe", "ongoing"] }
];

const keysafeAccessPattern = /\b(?:key\s*safe|keysafe|spare\s+key|access\s+code|door\s+code|entry\s+code)\b/i;
const keysafeWorkPattern = /\b(?:key\s*safe|keysafe|spare\s+key|access\s+code|door\s+access|thumbturn|lock)\b.*\b(?:broken|stuck|jammed|loose|damaged|faulty|not\s+working|cannot\s+open|won't\s+open|wont\s+open|replace|repair|check|inspect|review|unsafe|concern)\b|\b(?:broken|stuck|jammed|loose|damaged|faulty|unsafe|check|inspect|review|repair|replace)\b.*\b(?:key\s*safe|keysafe|lock|door\s+access|thumbturn)\b/i;
const accessActionPattern = /\b(?:key|keys)\b.*\b(?:from|in|into|back\s+in|returned|secured|left)\b.*\b(?:key\s*safe|keysafe)\b|\b(?:key\s*safe|keysafe)\b.*\b(?:key|keys|access)\b/i;
const railWorkPattern = /\b(?:rail|handrail|grab\s*rail|banister)\b.*\b(?:loose|broken|damaged|repair|fix|unsafe|wobbly)\b|\b(?:loose|broken|damaged|wobbly|unsafe)\b.*\b(?:rail|handrail|grab\s*rail|banister)\b/i;
const lockWorkPattern = /\b(?:lock|door\s+security|sticking\s+door)\b.*\b(?:broken|stuck|jammed|loose|damaged|faulty|not\s+working|cannot\s+open|won't\s+open|wont\s+open|replace|repair|check|inspect|review|unsafe|concern)\b|\b(?:broken|stuck|jammed|loose|damaged|faulty|unsafe|check|inspect|review|repair|replace)\b.*\b(?:lock|door\s+security|sticking\s+door)\b/i;

function inferredUrgency(note: string): TaskSuggestion["urgency"] {
  if (/immediate|emergency|cannot exit|active fire|urgent/i.test(note)) return "urgent";
  if (/fall|slip|unsafe|broken|high risk/i.test(note)) return "high";
  if (/soon|worsening|concern/i.test(note)) return "medium";
  return "low";
}

function noteForTaskMatching(note: string) {
  return sentenceParts(note)
    .filter((part) => !(keysafeAccessPattern.test(part) && !keysafeWorkPattern.test(part)))
    .join(". ");
}

function shouldUseCategory(rule: { category: string }, note: string) {
  if (rule.category === "Loose rail repair") return railWorkPattern.test(note);
  if (rule.category === "Lock repairs") return lockWorkPattern.test(note);
  if (rule.category !== "Key safe and lock safety") return true;
  return keysafeWorkPattern.test(note);
}

function taskSummaryForCategory(category: string) {
  if (category === "Key safe and lock safety") {
    return "Check the reported key-safe, lock or door-access concern and make the access route safe. Do not include the access code in the task summary.";
  }
  return `${category} required following a care-team home safety observation. Review the reported condition and make the area safe.`;
}

export function deterministicTaskPlan(note: string, vulnerable: boolean): TaskSuggestion[] {
  const taskNote = noteForTaskMatching(note);
  const lower = taskNote.toLowerCase();
  const urgency = inferredUrgency(note);
  const matches = categoryRules.filter((rule) => shouldUseCategory(rule, note) && rule.terms.some((term) => lower.includes(term)));
  const selected = matches.length ? matches : [{ category: "Home safety inspection", terms: [] }];
  return selected.map((rule) => ({
    category: rule.category,
    summary: taskSummaryForCategory(rule.category),
    urgency,
    safeguardingApplies: vulnerable
  }));
}

export async function createTaskPlan(note: string, vulnerable: boolean) {
  if (config.googleGeminiApiKey) {
    const gemini = await createGeminiTaskPlan(note, vulnerable);
    const processed = postProcessSuggestions(note, gemini);
    if (processed.length) return processed;
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
  return postProcessSuggestions(note, plannerResponseSchema.parse(await response.json()).suggestions);
}

async function createGeminiTaskPlan(note: string, vulnerable: boolean) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.googleGeminiModel)}:generateContent?key=${encodeURIComponent(config.googleGeminiApiKey)}`;
  const prompt = [
    "You are TaskBridge's care-note safety task planner for UK homecare operations.",
    "Return only valid JSON matching this exact shape:",
    '{"suggestions":[{"category":"string","summary":"string","urgency":"low|medium|high|urgent","safeguardingApplies":true}]}',
    "Rules:",
    "- Split a note into separate practical home-safety tasks when it contains more than one issue.",
    "- Keep summaries free of keysafe codes, entry codes, phone numbers, and unnecessary resident personal data.",
    "- Treat keysafe codes, spare-key locations, and access instructions as encrypted access information, not as a work task.",
    "- Create a Key safe and lock safety task only when the note says the keysafe, lock, door access, or thumbturn is broken, unsafe, stuck, damaged, or needs checking/repair.",
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

export function postProcessSuggestions(note: string, suggestions: TaskSuggestion[]) {
  const accessOnlyKeysafe = hasKeysafeAccessInfo(note) && !keysafeWorkPattern.test(note);
  const redacted = suggestions
    .filter((suggestion) => isGroundedSuggestion(note, suggestion, accessOnlyKeysafe))
    .map((suggestion) => ({
      ...suggestion,
      summary: redactAccessInfo(suggestion.summary)
    }));
  if (!redacted.length && keysafeWorkPattern.test(note)) {
    return [keysafeSafetySuggestion(note, suggestions[0]?.safeguardingApplies || false)];
  }
  return mergeGroundedSuggestions(note, redacted.length ? redacted : deterministicTaskPlan(note, suggestions[0]?.safeguardingApplies || false));
}

function isGroundedSuggestion(note: string, suggestion: TaskSuggestion, accessOnlyKeysafe: boolean) {
  if (accessOnlyKeysafe && /key\s*safe|keysafe|lock|access/i.test(suggestion.category)) return false;
  if (/loose\s+rail|handrail|grab\s*rail|banister/i.test(suggestion.category) && !railWorkPattern.test(note)) return false;
  if (/lock\s+repair|door\s+lock/i.test(suggestion.category) && !lockWorkPattern.test(note)) return false;
  return true;
}

function mergeGroundedSuggestions(note: string, suggestions: TaskSuggestion[]) {
  if (!keysafeWorkPattern.test(note) || suggestions.some((item) => item.category === "Key safe and lock safety")) {
    return suggestions;
  }
  const vulnerable = suggestions[0]?.safeguardingApplies || false;
  return [
    ...suggestions.filter((item) => !/loose\s+rail|handrail|grab\s*rail|banister|lock\s+repair/i.test(item.category)),
    keysafeSafetySuggestion(note, vulnerable)
  ];
}

function keysafeSafetySuggestion(note: string, vulnerable: boolean): TaskSuggestion {
  return {
    category: "Key safe and lock safety",
    summary: taskSummaryForCategory("Key safe and lock safety"),
    urgency: inferredUrgency(note),
    safeguardingApplies: vulnerable
  };
}

function redactAccessInfo(value: string) {
  return value
    .replace(/\b(?:key\s*safe|keysafe|access|entry|door)\s*(?:code|pin|passcode)?\s*(?:is|:|-)?\s*[a-z0-9-]{3,16}\b/gi, "access details recorded separately")
    .replace(/\b\d{4,8}\b/g, "access details recorded separately");
}

function sentenceParts(note: string) {
  return note
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim().replace(/[.!?]+$/, ""))
    .filter(Boolean);
}

export function hasKeysafeAccessInfo(note: string) {
  return keysafeAccessPattern.test(note);
}

export function extractKeysafeInfo(note: string) {
  const parts = sentenceParts(note);
  const accessIndex = parts.findIndex((part) => keysafeAccessPattern.test(part));
  const accessSentence = parts[accessIndex];
  if (!accessSentence) return null;
  const nextSentence = parts[accessIndex + 1] || "";
  const codeSource = [accessSentence, nextSentence].find((part) => /\b(?:code|passcode|pin|number)\b/i.test(part)) || accessSentence;
  const explicitCode = codeSource.match(/\b(?:code|passcode|pin|number)\s*(?:is|:|-)?\s*([a-z0-9-]{3,16})\b/i);
  const keysafeCode = codeSource.match(/\b(?:key\s*safe|keysafe)\s*(?:code|passcode|pin)\s*(?:is|:|-)?\s*([a-z0-9-]{3,16})\b|\b(?:access|entry|door)\s+code\s*(?:is|:|-)?\s*([a-z0-9-]{3,16})\b/i);
  const code = explicitCode?.[1] || keysafeCode?.[1] || null;
  const cleaned = [accessSentence, codeSource === nextSentence ? nextSentence : ""].filter(Boolean).join(". ").replace(/\s+/g, " ").trim();
  if (code && cleaned.length <= code.length + 18) return `Key-safe access code: ${code}`;
  if (!code && accessActionPattern.test(cleaned)) return "Key kept in key-safe; access code not provided.";
  if (!code && keysafeWorkPattern.test(cleaned)) return null;
  return cleaned;
}

export async function analyzeCareNote(note: string, vulnerable: boolean) {
  const suggestions = await createTaskPlan(note, vulnerable);
  const warnings: string[] = [];
  if (vulnerable) warnings.push("Vulnerable-adult safeguarding controls apply: DBS status, insurance and supervision route must be reviewed before assignment.");
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
