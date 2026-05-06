// System prompts for each operation. Intentionally placeholder-grade —
// Slice 6 (`/v1/ask` E2E) tunes them with real schemas, few-shot
// examples, and prompt-cache discipline (docs/architecture.md §8 cost-control rule 3).
// Prompts live here so every provider reuses the same shape.

import type {
  ClassifyRequest,
  DisambiguateRequest,
  PlanRequest,
  SummarizeRequest,
} from "./types.ts";

export const CLASSIFY_SYSTEM = [
  "You classify a user utterance into one of four intents:",
  '- "create": the user wants to create a new database or schema ("a blog db", "db named messages", "tracker for my orders").',
  '- "data_query": read-only data lookup against an existing db (SELECT, aggregate, filter).',
  '- "meta": schema / metadata question about an existing db ("what tables do I have", "describe X").',
  '- "destructive": write or destructive op against an existing db (INSERT, UPDATE, DELETE, DROP).',
  'Respond with strict JSON: {"intent":"<one of the four>","confidence":<0-1 float>}.',
  "No prose, no code fences.",
].join("\n");

export const PLAN_SYSTEM = [
  "You translate a natural-language goal into a single SQL statement for the named dialect.",
  "Use the provided schema; do not invent tables or columns.",
  'Respond with strict JSON: {"sql":"<single SQL statement, no trailing semicolon>"}.',
  "No prose, no code fences, no explanation.",
].join("\n");

export const SUMMARIZE_SYSTEM = [
  "You summarize a small result set in plain English, in 1–3 sentences.",
  "Quote concrete numbers and named entities. No code blocks, no markdown.",
].join("\n");

export const DISAMBIGUATE_SYSTEM = [
  "You pick which of a user's existing databases best matches their goal.",
  "Inputs: a natural-language goal and a list of candidate databases (id + slug, sometimes a schema fingerprint).",
  "Pick the most likely match by reading the slug semantically — slugs are kebab-case names like 'orders-tracker-a4f', 'support-tickets-9xy'.",
  'If no candidate is a clear match, return {"chosenId":null,...} and explain why in one short sentence.',
  'Respond with strict JSON: {"chosenId":"<id-from-list-or-null>","confidence":<0-1 float>,"reason":"<one short sentence>"}.',
  "No prose outside JSON, no code fences.",
].join("\n");

export function buildClassifyUser(req: ClassifyRequest): string {
  return `Utterance: ${req.utterance}`;
}

export function buildPlanUser(req: PlanRequest): string {
  return [`Dialect: ${req.dialect}`, `Schema:\n${req.schema}`, `Goal: ${req.goal}`].join("\n\n");
}

export function buildSummarizeUser(req: SummarizeRequest): string {
  // Truncate to keep prompts small — docs/architecture.md §8 cost rule. Summarization
  // over thousands of rows is a Slice 6+ concern (paginate first).
  const sample = req.rows.slice(0, 50);
  return [`Goal: ${req.goal}`, `Rows (JSON):\n${JSON.stringify(sample)}`].join("\n\n");
}

export function buildDisambiguateUser(req: DisambiguateRequest): string {
  // Cap the candidate list defensively — the API hot path will rarely
  // hit this, but a runaway tenant with hundreds of DBs shouldn't blow
  // the cheap-tier prompt budget.
  const trimmed = req.candidates.slice(0, 25).map((c) => ({
    id: c.id,
    slug: c.slug,
    ...(c.schemaHash ? { schemaHash: c.schemaHash } : {}),
  }));
  return [`Goal: ${req.goal}`, `Candidates (JSON):\n${JSON.stringify(trimmed)}`].join("\n\n");
}
