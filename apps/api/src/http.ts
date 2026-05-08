// Tiny HTTP helpers for the Hono handlers.
//
// Two parsers, one per endpoint shape:
//   - `parseGoalDbBody` — `{ goal, dbId }` both required (chat).
//   - `parseAskBody`    — `{ goal, dbId?, engine? }` (the `/v1/ask` shape;
//     dbId-omitted routes the create branch — SK-ASK-001 / SK-HDC-001;
//     `engine?` is the SK-DB-010 power-user override that pins the
//     engine on the create branch and skips the classifier LLM call).
//
// `parseGoalBody` (goal-only) was retired with /v1/demo/ask
// (SK-WEB-008): the marketing surface now hits /v1/ask with an
// anon bearer, and `parseAskBody` covers the goal-only shape via
// dbId being optional.

import type { Engine } from "@nlqdb/db";
import type { Context } from "hono";

export type GoalDbBody = { goal: string; dbId: string };
// SK-DB-010 — `engine` is optional on the create branch. When set the
// orchestrator skips the classifier; otherwise the goal-text classifier
// picks. Validated at parse time against the `Engine` literal in
// `@nlqdb/db`; an unknown string returns `invalid_engine` rather than
// silently coercing to a default.
export type AskBody = { goal: string; dbId?: string; engine?: Engine };

export type ParseError = {
  status: 400;
  body: { error: "invalid_json" | "goal_required" | "dbId_required" | "invalid_engine" };
};

// Single source of truth for the allowed engine values on the wire.
// Mirrors `Engine` from `@nlqdb/db`; a Set lookup keeps the
// validation O(1) and centralises the rejection message.
const ALLOWED_ENGINES: ReadonlySet<Engine> = new Set<Engine>(["postgres", "clickhouse"]);

export function isAllowedEngine(value: unknown): value is Engine {
  return typeof value === "string" && ALLOWED_ENGINES.has(value as Engine);
}

export type ParseResult<T> = { ok: true; body: T } | { ok: false; error: ParseError };

export async function parseGoalDbBody(c: Context): Promise<ParseResult<GoalDbBody>> {
  const raw = await parseJsonBody<{ goal?: unknown; dbId?: unknown }>(c);
  if (!raw.ok) return { ok: false, error: { status: 400, body: { error: "invalid_json" } } };
  if (typeof raw.body.goal !== "string" || raw.body.goal.trim().length === 0) {
    return { ok: false, error: { status: 400, body: { error: "goal_required" } } };
  }
  if (typeof raw.body.dbId !== "string" || raw.body.dbId.length === 0) {
    return { ok: false, error: { status: 400, body: { error: "dbId_required" } } };
  }
  return { ok: true, body: { goal: raw.body.goal, dbId: raw.body.dbId } };
}

// `/v1/ask` parser — dbId is optional. An omitted dbId routes
// the kind=create branch (SK-HDC-001). An empty-string dbId is
// treated as omitted (clients that always send the field shouldn't
// have to special-case "first call before a DB exists").
//
// SK-DB-010 — `engine` is optional on the create branch. Unknown
// strings reject with `invalid_engine`; absent is fine and routes
// through the classifier.
export async function parseAskBody(c: Context): Promise<ParseResult<AskBody>> {
  const raw = await parseJsonBody<{ goal?: unknown; dbId?: unknown; engine?: unknown }>(c);
  if (!raw.ok) return { ok: false, error: { status: 400, body: { error: "invalid_json" } } };
  if (typeof raw.body.goal !== "string" || raw.body.goal.trim().length === 0) {
    return { ok: false, error: { status: 400, body: { error: "goal_required" } } };
  }
  const body: AskBody = { goal: raw.body.goal };
  if (typeof raw.body.dbId === "string" && raw.body.dbId.length > 0) {
    body.dbId = raw.body.dbId;
  }
  if (raw.body.engine !== undefined) {
    if (!isAllowedEngine(raw.body.engine)) {
      return { ok: false, error: { status: 400, body: { error: "invalid_engine" } } };
    }
    body.engine = raw.body.engine;
  }
  return { ok: true, body };
}

// JSON body reader that swallows the parse exception into a typed
// result. Caller decides the error envelope — `parseGoalDbBody` wraps
// it as `{ error: "invalid_json" }`; ad-hoc handlers wrap it however
// they like. Returns `{ ok: false }` on missing/malformed JSON.
export async function parseJsonBody<T>(c: Context): Promise<{ ok: true; body: T } | { ok: false }> {
  try {
    return { ok: true, body: (await c.req.json()) as T };
  } catch {
    return { ok: false };
  }
}
