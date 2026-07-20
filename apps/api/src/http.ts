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

import { ALLOWED_ENGINES, type Engine, isAllowedEngine } from "@nlqdb/db";
import { isModelPreset, MODEL_PRESETS, type ModelPreset } from "@nlqdb/llm";
import type { Context } from "hono";

export { ALLOWED_ENGINES, isAllowedEngine };

// SK-ASK-010 — hard server-side cap on goal length. Prevents unbounded
// LLM token cost from adversarially long inputs.
export const MAX_GOAL_LENGTH = 2000;

// `SK-SDK-009` — server cap on `/v1/run` SQL body; larger batches belong on a direct Postgres connection.
export const MAX_SQL_LENGTH = 64 * 1024;

export type GoalDbBody = { goal: string; dbId: string };
// SK-DB-010 — `engine` is optional on the create branch. When set the
// orchestrator skips the classifier; otherwise the goal-text classifier
// picks. Validated at parse time against the `Engine` literal in
// `@nlqdb/db`; an unknown string returns `invalid_engine` rather than
// silently coercing to a default.
// SK-PREMIUM-014 — `model` is the goal-first preset knob (SK-PREMIUM-003),
// validated at parse time against `MODEL_PRESETS`; an unknown string
// returns `invalid_model` rather than silently coercing to `auto`.
export type AskBody = {
  goal: string;
  dbId?: string;
  engine?: Engine;
  confirm?: boolean;
  model?: ModelPreset;
  source?: AskSource;
};

// SK-GTM-007 — first-touch acquisition source, forwarded by the web
// client on the create branch and persisted to `databases.source_json`.
// Telemetry, never load-bearing: a malformed `source` is dropped in
// `sanitizeAskSource`, never a 400 — attribution must not be able to
// fail a create.
export type AskSource = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  /** External referrer hostname (the client strips same-site referrers). */
  ref?: string;
  /** First-touch landing pathname. */
  landing?: string;
};

const ASK_SOURCE_KEYS = ["utm_source", "utm_medium", "utm_campaign", "ref", "landing"] as const;
const MAX_SOURCE_FIELD_LENGTH = 160;

export function sanitizeAskSource(value: unknown): AskSource | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const out: AskSource = {};
  for (const key of ASK_SOURCE_KEYS) {
    const v = raw[key];
    if (typeof v !== "string") continue;
    const trimmed = v.trim().slice(0, MAX_SOURCE_FIELD_LENGTH);
    if (trimmed.length > 0) out[key] = trimmed;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

// `invalid_engine` carries the offending value + the allowed list so
// SDK / CLI consumers can render a precise message ("`mysql` is not a
// supported engine; allowed values: postgres, clickhouse") without
// re-fetching the docs. GLOBAL-012 — error message renders as one
// sentence with the next action.
export type InvalidEngineBody = {
  error: "invalid_engine";
  value: unknown;
  allowed: Engine[];
};

// `invalid_model` mirrors `invalid_engine` for the SK-PREMIUM-003 preset
// knob — offending value + allowed presets, renderable as one sentence
// (GLOBAL-012).
export type InvalidModelBody = {
  error: "invalid_model";
  value: unknown;
  allowed: ModelPreset[];
};

// `goal_too_long` carries maxLength so SDK / CLI consumers can render
// a precise message without hard-coding the limit.
export type GoalTooLongBody = { error: "goal_too_long"; maxLength: number };

// `sql_too_long` mirrors `goal_too_long` for the `/v1/run` shape.
export type SqlTooLongBody = { error: "sql_too_long"; maxLength: number };

export type ParseErrorBody =
  | {
      error: "invalid_json" | "goal_required" | "dbId_required" | "sql_required" | "db_required";
    }
  | GoalTooLongBody
  | SqlTooLongBody
  | InvalidEngineBody
  | InvalidModelBody;

export type ParseError = {
  status: 400;
  body: ParseErrorBody;
};

// Materialised list mirror of ALLOWED_ENGINES for the wire envelope.
// Set has no JSON projection of its own; spreading once at module load
// keeps the per-request path allocation-free.
const ALLOWED_ENGINES_LIST: Engine[] = [...ALLOWED_ENGINES];

export function invalidEngineError(value: unknown): ParseError {
  return {
    status: 400,
    body: { error: "invalid_engine", value, allowed: ALLOWED_ENGINES_LIST },
  };
}

export type ParseResult<T> = { ok: true; body: T } | { ok: false; error: ParseError };

export async function parseGoalDbBody(c: Context): Promise<ParseResult<GoalDbBody>> {
  const raw = await parseJsonBody<{ goal?: unknown; dbId?: unknown }>(c);
  if (!raw.ok) return { ok: false, error: { status: 400, body: { error: "invalid_json" } } };
  if (typeof raw.body.goal !== "string" || raw.body.goal.trim().length === 0) {
    return { ok: false, error: { status: 400, body: { error: "goal_required" } } };
  }
  if (raw.body.goal.length > MAX_GOAL_LENGTH) {
    return {
      ok: false,
      error: { status: 400, body: { error: "goal_too_long", maxLength: MAX_GOAL_LENGTH } },
    };
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
  const raw = await parseJsonBody<{
    goal?: unknown;
    dbId?: unknown;
    engine?: unknown;
    confirm?: unknown;
    model?: unknown;
    source?: unknown;
  }>(c);
  if (!raw.ok) return { ok: false, error: { status: 400, body: { error: "invalid_json" } } };
  if (typeof raw.body.goal !== "string" || raw.body.goal.trim().length === 0) {
    return { ok: false, error: { status: 400, body: { error: "goal_required" } } };
  }
  if (raw.body.goal.length > MAX_GOAL_LENGTH) {
    return {
      ok: false,
      error: { status: 400, body: { error: "goal_too_long", maxLength: MAX_GOAL_LENGTH } },
    };
  }
  const body: AskBody = { goal: raw.body.goal };
  if (typeof raw.body.dbId === "string" && raw.body.dbId.length > 0) {
    body.dbId = raw.body.dbId;
  }
  if (raw.body.engine !== undefined) {
    if (!isAllowedEngine(raw.body.engine)) {
      return { ok: false, error: invalidEngineError(raw.body.engine) };
    }
    body.engine = raw.body.engine;
  }
  // SK-TRUST-001 — coerce truthy only; anything non-boolean is treated
  // as preview-mode so a malformed client can't bypass the gate.
  if (raw.body.confirm === true) {
    body.confirm = true;
  }
  // SK-PREMIUM-014 — preset knob. An empty string is treated as omitted
  // (same client convenience as dbId); unknown strings reject.
  if (raw.body.model !== undefined && raw.body.model !== "") {
    if (!isModelPreset(raw.body.model)) {
      return {
        ok: false,
        error: {
          status: 400,
          body: { error: "invalid_model", value: raw.body.model, allowed: [...MODEL_PRESETS] },
        },
      };
    }
    body.model = raw.body.model;
  }
  // SK-GTM-007 — attribution is telemetry: sanitize-or-drop, never 400.
  const source = sanitizeAskSource(raw.body.source);
  if (source !== undefined) {
    body.source = source;
  }
  return { ok: true, body };
}

// `/v1/run` body — shape check only; SQL validation runs inside the orchestrator.
export type RunBody = { sql: string; db: string };

// `dbOptional` lets the pk_live route auto-fill from the principal's pinned dbId after parse.
export async function parseRunBody(
  c: Context,
  opts: { dbOptional?: boolean } = {},
): Promise<ParseResult<RunBody>> {
  const raw = await parseJsonBody<{ sql?: unknown; db?: unknown }>(c);
  if (!raw.ok) return { ok: false, error: { status: 400, body: { error: "invalid_json" } } };
  if (typeof raw.body.sql !== "string" || raw.body.sql.trim().length === 0) {
    return { ok: false, error: { status: 400, body: { error: "sql_required" } } };
  }
  if (raw.body.sql.length > MAX_SQL_LENGTH) {
    return {
      ok: false,
      error: { status: 400, body: { error: "sql_too_long", maxLength: MAX_SQL_LENGTH } },
    };
  }
  const dbProvided = typeof raw.body.db === "string" && raw.body.db.length > 0;
  if (!dbProvided && !opts.dbOptional) {
    return { ok: false, error: { status: 400, body: { error: "db_required" } } };
  }
  return { ok: true, body: { sql: raw.body.sql, db: dbProvided ? (raw.body.db as string) : "" } };
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
