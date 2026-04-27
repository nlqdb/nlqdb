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
  let raw: { goal?: unknown; dbId?: unknown };
  try {
    raw = (await c.req.json()) as typeof raw;
  } catch {
    return { ok: false, error: { status: 400, body: { error: "invalid_json" } } };
  }
  if (typeof raw.goal !== "string" || raw.goal.trim().length === 0) {
    return { ok: false, error: { status: 400, body: { error: "goal_required" } } };
  }
  if (typeof raw.dbId !== "string" || raw.dbId.length === 0) {
    return { ok: false, error: { status: 400, body: { error: "dbId_required" } } };
  }
  return { ok: true, body: { goal: raw.goal, dbId: raw.dbId } };
}
