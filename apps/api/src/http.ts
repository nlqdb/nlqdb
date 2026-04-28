// Tiny HTTP helpers for the Hono handlers.
//
// `parseGoalDbBody` was duplicated verbatim across `/v1/ask` and
// `/v1/chat/messages` — extracting keeps the validation contract
// (and its error envelope shape) in one place. Future `/v1/*`
// endpoints that take `{goal, dbId}` use the same helper so a
// fielded change (e.g. allowing `dbId` to be inferred) lands once.

import type { Context } from "hono";

export type GoalDbBody = { goal: string; dbId: string };

export type ParseError = {
  status: 400;
  body: { error: "invalid_json" | "goal_required" | "dbId_required" };
};

export type ParseResult = { ok: true; body: GoalDbBody } | { ok: false; error: ParseError };

export async function parseGoalDbBody(c: Context): Promise<ParseResult> {
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
