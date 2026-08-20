// The error registry — one entry per wire code (SK-ERR-001).
//
// Adding an error is ONE entry here; every surface (web, CLI, MCP, elements,
// SDK consumers) picks it up with zero edits because they render the wire's
// `message` + `action`. Never add a code to a surface's override table without
// adding it here first — the compile-time guard in `index.ts` fails the build
// if the registry and the SDK's `ApiErrorCode` union drift apart.
//
// Copy rules (GLOBAL-012): `message` is ONE sentence naming what happened;
// `action` is the single next thing the reader can do. Copy is parametric —
// the same code reads differently by cause, which is the whole point: a
// rejected BYOLLM key must never render as "try rephrasing".
//
// Params are a closed, secret-free schema. Bounded enums and slugs only. Raw
// provider messages, Postgres detail text, and keys must NEVER be put in
// params — they stay on the OTel span and the KV diag sink where operators
// (not tenants) read them.

import { z } from "zod";
import { defineError } from "./types.ts";

const KEYS_URL = "https://app.nlqdb.com/app/keys";
const SUPPORT = "email support@nlqdb.com";

// No declared params. Builders ignore the value; `renderError` omits the
// `params` key from the wire when the object is empty.
const NONE = z.object({});

// Bounded identifier: a provider slug, model id, table, or constraint name.
// The regex is the boundary guarantee — anything with spaces or punctuation
// (i.e. a raw upstream message) is dropped rather than echoed to the tenant.
const slug = (max: number) =>
  z
    .string()
    .regex(/^[A-Za-z0-9._:/-]+$/)
    .max(max)
    .optional()
    .catch(undefined);

// A short, server-authored sentence the API already composes for a few codes
// (connect failures, body validation). Length-capped; still server-authored,
// never an upstream error string.
const sentence = z.string().max(300).optional().catch(undefined);

const tableList = z.array(z.string().max(120)).max(200).default([]).catch([]);

// A database the surface can offer as a one-click pick.
const dbRef = z.object({ id: z.string().max(80), slug: z.string().max(120) });

// ── LLM cause enums (mirrors @nlqdb/llm `FailoverReason` + the dispatch lanes).
// Duplicated as literals rather than imported so this package stays dependency-
// free apart from zod; a drift test in @nlqdb/llm is not worth the coupling —
// an unknown reason falls through to the generic copy, never to a wrong action.
export const FAILOVER_REASONS = [
  "http_5xx",
  "http_4xx",
  "auth_denied",
  "rate_limited",
  "network",
  "timeout",
  "parse",
  "not_configured",
  "provider_error",
  "circuit_open",
  "hedge_lost",
  "unknown",
] as const;

export const LLM_LANES = ["free", "byollm", "premium", "frontier"] as const;

export type FailoverReasonParam = (typeof FAILOVER_REASONS)[number];
export type LlmLane = (typeof LLM_LANES)[number];

const llmFailedParams = z.object({
  reason: z.enum(FAILOVER_REASONS).optional().catch(undefined),
  lane: z.enum(LLM_LANES).optional().catch(undefined),
  provider: slug(40),
  model: slug(80),
});

// A rejected key / unconfigured provider on the user's OWN lane is theirs to
// fix; on a platform lane it is ours. `parse` means the model answered but the
// answer wasn't usable SQL — the only llm_failed cause where "rephrase" is
// honest advice. Everything else is a provider blip: transient.
function llmRecoverability(p: z.infer<typeof llmFailedParams>) {
  const ownLane = p.lane === "byollm";
  if (p.reason === "auth_denied" || p.reason === "not_configured") {
    return ownLane ? "user_config" : "operator";
  }
  if (p.reason === "parse") return "clarify";
  return "transient";
}

const providerLabel = (p: { provider?: string }) => p.provider ?? "provider";

// ── Constraint violations (Postgres SQLSTATE class 23). Names come from the
// tenant's own schema, so showing them back is safe and is the only way the
// message can be actionable.
// Kept literal-for-literal with `WriteConstraintKind` in
// apps/api/src/ask/types.ts, which `write-constraint.ts` derives from SQLSTATE.
const CONSTRAINT_KINDS = ["not_null", "foreign_key", "unique", "check", "exclusion"] as const;
export type ConstraintKind = (typeof CONSTRAINT_KINDS)[number];

const constraintParams = z.object({
  kind: z.enum(CONSTRAINT_KINDS).optional().catch(undefined),
  constraint: slug(120),
  table: slug(120),
  column: slug(120),
});

const onTable = (p: { table?: string }) => (p.table ? ` in ${p.table}` : "");
const named = (p: { constraint?: string }) => (p.constraint ? ` (${p.constraint})` : "");

// `orders.user_id` when both are known, else whichever is — the field a user's
// next message has to supply a real value for.
const fieldOf = (p: { table?: string; column?: string }) =>
  p.column ? (p.table ? `${p.table}.${p.column}` : p.column) : undefined;

// SK-TRUST-006 — an approved write that changed nothing. Which hop it happened
// on decides the honest sentence: a preview that found no matching rows is
// "nothing would change", a commit that reports 0 rows means the data moved
// under the preview.
const WRITE_PHASES = ["preview", "commit"] as const;

export const REGISTRY = {
  // ── Target database ────────────────────────────────────────────────────
  db_not_found: defineError({
    httpStatus: 404,
    recoverability: "user_config",
    params: NONE,
    message: () => "No database of yours matched that id.",
    action: () => "Pick a different database, or create a new one and ask again.",
  }),
  db_unreachable: defineError({
    httpStatus: 502,
    recoverability: "transient",
    params: NONE,
    message: () => "nlqdb couldn't reach that database just now.",
    action: () => "Try again in a moment; if it persists, check the database is running.",
  }),
  db_misconfigured: defineError({
    httpStatus: 502,
    recoverability: "operator",
    params: NONE,
    message: () => "That database's stored connection is no longer usable.",
    action: () => "Reconnect it, then ask again.",
  }),
  schema_unavailable: defineError({
    // 422, not 502: the DB answered, we just couldn't read its shape.
    httpStatus: 422,
    recoverability: "transient",
    params: NONE,
    message: () => "nlqdb couldn't read that database's schema just now.",
    action: () => "Try again in a moment.",
  }),
  // SK-ASK-016 — the plan named a relation the target DB doesn't have.
  schema_mismatch: defineError({
    httpStatus: 409,
    recoverability: "clarify",
    params: z.object({ referencedTables: tableList, schemaTables: tableList }),
    message: (p) =>
      p.referencedTables.length > 0
        ? `This database has no ${p.referencedTables.join(", ")} ${p.referencedTables.length === 1 ? "table" : "tables"}.`
        : "That query names a table this database doesn't have.",
    action: (p) =>
      p.schemaTables.length > 0
        ? `Ask about one of its tables instead: ${p.schemaTables.slice(0, 5).join(", ")}${p.schemaTables.length > 5 ? ` (+${p.schemaTables.length - 5} more)` : ""}.`
        : "Rephrase using a table this database has, or create a new database for it.",
  }),
  // SK-ASK-030 — Postgres SQLSTATE class 23. Deterministic: the write is
  // wrong, not the connection. Retrying replays it, which is exactly the
  // 2026-08-18 `23503` incident that surfaced as "couldn't reach the database".
  write_constraint: defineError({
    httpStatus: 409,
    recoverability: "clarify",
    params: constraintParams,
    // Every branch opens with "Nothing was written": the first thing the reader
    // needs is that the data is unchanged. Naming the exact field is what makes
    // the next message answerable — identifiers only, never the values.
    message: (p) => {
      const field = fieldOf(p);
      switch (p.kind) {
        case "foreign_key":
          return `Nothing was written — ${field ?? "that link"} has to point at a row that already exists.`;
        case "unique":
          return `Nothing was written — ${field ?? "that value"} already exists.`;
        case "not_null":
          return `Nothing was written — ${field ?? "a required field"} can't be empty.`;
        case "check":
        case "exclusion":
          return `Nothing was written — ${field ?? "those values"} broke a rule this database enforces${named(p)}.`;
        default:
          return `Nothing was written — the database rejected those values${field ? ` for ${field}` : ""}.`;
      }
    },
    action: (p) => {
      switch (p.kind) {
        case "foreign_key":
          return "Name an existing related row (or create it first), then ask again.";
        case "unique":
          return "Use a different value, or ask to update the existing row instead.";
        case "not_null":
          return "Include that field in your request, then ask again.";
        default:
          return "Try different values, then ask again.";
      }
    },
  }),
  // SK-TRUST-006 — the write ran (or previewed) and matched nothing. GLOBAL-011:
  // say so plainly instead of rendering an empty success that reads as "done".
  write_no_rows: defineError({
    httpStatus: 409,
    recoverability: "clarify",
    params: z.object({
      phase: z.enum(WRITE_PHASES).optional().catch(undefined),
      verb: slug(20),
      table: slug(120),
    }),
    // `commit` and `preview` are genuinely different facts: one ran and changed
    // nothing, the other never ran at all. Collapsing them would be the
    // silent-lie GLOBAL-011 forbids.
    message: (p) =>
      p.phase === "commit"
        ? `Nothing was changed${onTable(p)} — that ran but matched no rows.`
        : `Nothing to write${onTable(p)} — no rows matched, so it was not run.`,
    action: (p) =>
      p.phase === "commit"
        ? "Check the rows still match — something may have changed them since the preview — then ask again."
        : "Say which row you mean, or widen the filter, then ask again.",
  }),
  // SK-ASK-030 — SQLSTATE class 22 (data exception): bad cast, out of range,
  // division by zero. Deterministic like class 23.
  invalid_value: defineError({
    httpStatus: 409,
    recoverability: "clarify",
    params: z.object({ pgCode: slug(8) }),
    message: () => "One of the values in that query didn't fit its column.",
    action: () =>
      "Restate the goal with values that match the column types (dates, numbers, enums).",
  }),

  // ── Planning ───────────────────────────────────────────────────────────
  llm_failed: defineError({
    httpStatus: (p) => {
      const r = llmRecoverability(p);
      if (r === "user_config" || r === "clarify") return 409;
      return r === "operator" ? 503 : 502;
    },
    recoverability: llmRecoverability,
    params: llmFailedParams,
    message: (p) => {
      if (p.reason === "auth_denied") {
        return p.lane === "byollm"
          ? `Your ${providerLabel(p)} API key was rejected.`
          : "nlqdb's own model credentials were rejected.";
      }
      if (p.reason === "not_configured") {
        return p.lane === "byollm"
          ? `No ${providerLabel(p)} model is configured for your key.`
          : "No planning model is configured on this deployment.";
      }
      if (p.reason === "rate_limited") {
        return p.lane === "byollm"
          ? `Your ${providerLabel(p)} account is rate-limited right now.`
          : "The planning models are rate-limited right now.";
      }
      if (p.reason === "parse") return "The model's answer wasn't valid SQL for that goal.";
      if (p.lane === "byollm") {
        return `Your ${providerLabel(p)} model${p.model ? ` ${p.model}` : ""} didn't return a usable plan.`;
      }
      return "The planning models are unavailable right now.";
    },
    action: (p) => {
      if (p.reason === "auth_denied" || p.reason === "not_configured") {
        return p.lane === "byollm"
          ? `Check the key at ${KEYS_URL}, or switch the model back to auto.`
          : `Try again in a minute; if it persists, ${SUPPORT}.`;
      }
      if (p.reason === "parse") {
        return "Rephrase the goal naming the exact tables and columns you mean.";
      }
      if (p.lane === "byollm") return "Retry, or switch the model back to auto.";
      return "Try again in a minute.";
    },
  }),
  sql_rejected: defineError({
    httpStatus: 400,
    recoverability: "clarify",
    params: z.object({ reason: slug(60) }),
    message: (p) => SQL_REJECT_COPY[p.reason ?? ""]?.[0] ?? "That query was rejected.",
    action: (p) =>
      SQL_REJECT_COPY[p.reason ?? ""]?.[1] ?? "Rephrase the goal in plain English and ask again.",
  }),
  // SK-ASK-014 / SK-ASK-026 — the goal was ambiguous; `reason` is the
  // server-authored prompt and `options` are re-sendable goals the surface
  // renders as chips (web) / numbered choices (CLI) / structured options (MCP).
  clarify_required: defineError({
    httpStatus: 409,
    recoverability: "clarify",
    params: z.object({
      clarification: slug(40),
      reason: sentence,
      options: z
        .array(
          z.object({
            label: z.string().max(160),
            goal: z.string().max(2000),
            forceNoPin: z.boolean().optional(),
          }),
        )
        .max(10)
        .default([])
        .catch([]),
      pinned_db: dbRef.nullable().optional().catch(undefined),
    }),
    message: (p) => p.reason ?? "That goal could mean a few different things.",
    action: (p) =>
      p.options.length > 0
        ? "Pick one of the offered interpretations, or ask again more specifically."
        : p.clarification === "create_or_query_pinned"
          ? "Ask again without pinning a database to create a new one, or rephrase it as a question about this one."
          : "Ask again naming exactly which rows you mean.",
  }),
  ambiguous_db: defineError({
    httpStatus: 409,
    recoverability: "clarify",
    params: z.object({
      candidate_dbs: z.array(dbRef).max(20).default([]).catch([]),
    }),
    message: () => "More than one of your databases could answer that.",
    action: (p) =>
      p.candidate_dbs.length > 0
        ? `Say which one you mean (${p.candidate_dbs
            .slice(0, 3)
            .map((d) => d.slug)
            .join(", ")}).`
        : "Say which database you mean, then ask again.",
  }),
  low_confidence: defineError({
    httpStatus: 409,
    recoverability: "clarify",
    params: z.object({
      alternatives: z.array(z.string().max(2000)).max(10).default([]).catch([]),
    }),
    message: () => "nlqdb wasn't confident enough in the plan to run it.",
    action: (p) =>
      p.alternatives.length > 0
        ? "Pick one of the offered readings, or rephrase with the exact table and column names."
        : "Rephrase with the exact table and column names you mean.",
  }),

  // ── Model / lane selection ─────────────────────────────────────────────
  model_unavailable: defineError({
    httpStatus: 409,
    recoverability: "user_config",
    // SK-PREMIUM-013 — `link` deep-links the page that resolves it, so a
    // non-interactive surface can print a URL rather than stranding the caller.
    params: z.object({ link: z.string().max(300).optional().catch(undefined) }),
    message: () =>
      'The "best" preset needs a frontier model, and this account has no provider key or paid plan.',
    action: () => `Add your own provider key at ${KEYS_URL}, or drop the model preset.`,
  }),
  invalid_model: defineError({
    httpStatus: 400,
    recoverability: "bug",
    params: NONE,
    message: () => "`model` must be one of auto, fast, or best.",
    action: () => "Send a valid preset, or omit the field.",
  }),
  invalid_engine: defineError({
    httpStatus: 400,
    recoverability: "bug",
    params: z.object({
      allowed: z.array(z.string().max(40)).max(20).default([]).catch([]),
    }),
    message: () => "That database engine isn't supported.",
    action: (p) =>
      p.allowed.length > 0
        ? `Use one of: ${p.allowed.join(", ")}.`
        : "Use a supported engine, then retry.",
  }),
  invalid_byollm_key: defineError({
    httpStatus: 400,
    recoverability: "user_config",
    params: z.object({ message: sentence }),
    message: (p) => p.message ?? "That provider key was the wrong shape.",
    action: () => `Check the key's format at ${KEYS_URL}, then save it again.`,
  }),
  byollm_unavailable: defineError({
    httpStatus: 503,
    recoverability: "operator",
    params: NONE,
    message: () => "This deployment can't store provider keys right now.",
    action: () => `Try again shortly; if it persists, ${SUPPORT}.`,
  }),
  byollm_requires_session: defineError({
    httpStatus: 400,
    recoverability: "user_config",
    params: NONE,
    message: () => "Sending your own provider key needs a signed-in session.",
    action: () => "Sign in, or save the key to your account instead of sending it per request.",
  }),

  // ── Identity ───────────────────────────────────────────────────────────
  unauthorized: defineError({
    httpStatus: 401,
    recoverability: "user_config",
    params: NONE,
    message: () => "This call wasn't authenticated.",
    action: () => `Sign in again, or use a key minted at ${KEYS_URL}.`,
  }),
  // The session store (Better Auth over KV/D1) threw while verifying the
  // caller — a transient storage blip, NOT a signed-out session. Distinct
  // from `unauthorized` (401, "sign in again") so a KV/D1 hiccup never tells
  // a signed-in user to re-authenticate. `transient` ⇒ `retryable`, so the
  // SDK's 5xx retry replays it and the dashboard self-heals; only an
  // exhausted retry reaches the user, with copy that keeps them calm.
  auth_unavailable: defineError({
    httpStatus: 503,
    recoverability: "transient",
    params: NONE,
    message: () => "nlqdb couldn't verify your session just now.",
    action: () => "Try again in a moment — you're still signed in.",
  }),
  // SK-ANON-010/012 — the anonymous budget ran out. `cap` names which one so
  // the action can be honest about what signing in buys.
  auth_required: defineError({
    httpStatus: 401,
    recoverability: "user_config",
    params: z.object({
      cap: slug(40),
      // Where the surface should send them. Server-built (`buildSignInUrl`),
      // so it's a trusted value, not caller input.
      signInUrl: z.string().max(500).optional().catch(undefined),
      window: slug(20),
      resetAt: z.number().int().min(0).optional().catch(undefined),
    }),
    message: (p) =>
      p.cap === "anon_device_cap"
        ? "You've used up what nlqdb allows without an account on this device."
        : p.cap === "anon_global_cap"
          ? "nlqdb's shared anonymous budget is used up for now."
          : "This call needs an account.",
    action: () => "Sign in to continue — your prompt is saved.",
  }),
  forbidden: defineError({
    httpStatus: 403,
    recoverability: "user_config",
    params: z.object({ reason: slug(60) }),
    message: (p) =>
      p.reason === "read_only_principal" || p.reason === "pk_live_read_only"
        ? "This key is read-only, so it can't change data."
        : "This key isn't allowed to do that.",
    action: () => "Use a full-account key (sk_live_ or sk_mcp_) and retry.",
  }),
  account_required: defineError({
    httpStatus: 403,
    recoverability: "user_config",
    params: NONE,
    message: () => "This call needs an account-scoped key; a public embed key isn't enough.",
    action: () => `Mint an account key at ${KEYS_URL} and retry.`,
  }),
  connect_requires_account: defineError({
    httpStatus: 403,
    recoverability: "user_config",
    params: NONE,
    message: () => "Connecting a database needs a signed-in account session.",
    action: () => "Sign in, then connect the database once.",
  }),
  challenge_required: defineError({
    httpStatus: 428,
    recoverability: "user_config",
    params: NONE,
    message: () => "nlqdb needs to check you're human before running that.",
    action: () => "Complete the check, then retry.",
  }),
  rate_limited: defineError({
    httpStatus: 429,
    recoverability: "transient",
    params: z.object({
      limit: z.number().int().min(0).optional().catch(undefined),
      count: z.number().int().min(0).optional().catch(undefined),
      resetAt: z.number().int().min(0).optional().catch(undefined),
    }),
    message: (p) =>
      p.limit !== undefined && p.count !== undefined
        ? `You've used ${p.count} of ${p.limit} requests in this window.`
        : "You're going faster than this tier allows.",
    action: () => "Wait a moment, then retry.",
  }),

  // ── Request shape (the caller's code is wrong) ─────────────────────────
  invalid_json: defineError({
    httpStatus: 400,
    recoverability: "bug",
    params: NONE,
    message: () => "The request body wasn't valid JSON.",
    action: () => "Send a JSON object, then retry.",
  }),
  invalid_body: defineError({
    httpStatus: 400,
    recoverability: "bug",
    params: z.object({ reason: sentence }),
    message: (p) => p.reason ?? "The request body was invalid.",
    action: () => "Correct the field named above, then retry.",
  }),
  invalid_request: defineError({
    httpStatus: 400,
    recoverability: "user_config",
    params: z.object({ message: sentence }),
    message: (p) => p.message ?? "nlqdb couldn't accept that request.",
    action: () => "Correct the values named above, then retry.",
  }),
  invalid_scope: defineError({
    httpStatus: 400,
    recoverability: "bug",
    params: NONE,
    message: () => "`agentId`, `endUserId`, and `threadId` must be strings.",
    action: () => "Send strings (or omit the fields), then retry.",
  }),
  invalid_email: defineError({
    httpStatus: 400,
    recoverability: "bug",
    params: NONE,
    message: () => "That email address wasn't valid.",
    action: () => "Send a valid address, then retry.",
  }),
  goal_required: defineError({
    httpStatus: 400,
    recoverability: "bug",
    params: NONE,
    message: () => "No goal was sent.",
    action: () => 'Send a plain-English goal (e.g. "top 5 customers by revenue").',
  }),
  goal_too_long: defineError({
    httpStatus: 400,
    recoverability: "clarify",
    params: z.object({ maxLength: z.number().int().min(1).optional().catch(undefined) }),
    message: (p) =>
      p.maxLength !== undefined
        ? `That goal is longer than the ${p.maxLength}-character limit.`
        : "That goal is too long.",
    action: () => "Shorten it to the essential question, then ask again.",
  }),
  dbId_required: defineError({
    httpStatus: 400,
    recoverability: "bug",
    params: NONE,
    message: () => "This call needs an explicit database id.",
    action: () => "Send a `dbId`, then retry.",
  }),
  db_required: defineError({
    httpStatus: 400,
    recoverability: "bug",
    params: NONE,
    message: () => "This call needs a target database.",
    action: () => "Send a `db` id, then retry.",
  }),
  sql_required: defineError({
    httpStatus: 400,
    recoverability: "bug",
    params: NONE,
    message: () => "No SQL was sent.",
    action: () => "Send a single SQL statement, or use the plain-English endpoint instead.",
  }),
  sql_too_long: defineError({
    httpStatus: 400,
    recoverability: "bug",
    params: z.object({ maxLength: z.number().int().min(1).optional().catch(undefined) }),
    message: (p) =>
      p.maxLength !== undefined
        ? `That SQL is longer than the ${p.maxLength}-character limit.`
        : "That SQL is too long.",
    action: () => "Split it up, or run the batch on a direct database connection.",
  }),

  // ── Connect / provisioning ─────────────────────────────────────────────
  introspection_failed: defineError({
    httpStatus: 502,
    recoverability: "user_config",
    params: z.object({ message: sentence }),
    message: (p) => p.message ?? "nlqdb couldn't read that database's schema.",
    action: () => "Check the host is reachable and the credentials are current, then retry.",
  }),
  sealing_unconfigured: defineError({
    httpStatus: 503,
    recoverability: "operator",
    params: NONE,
    message: () => "This deployment can't seal database credentials right now.",
    action: () => `Try again shortly; if it persists, ${SUPPORT}.`,
  }),
  secret_unconfigured: defineError({
    httpStatus: 503,
    recoverability: "operator",
    params: NONE,
    message: () => "This deployment is missing a secret it needs for that call.",
    action: () => `Try again shortly; if it persists, ${SUPPORT}.`,
  }),
  unconfigured: defineError({
    httpStatus: 503,
    recoverability: "operator",
    params: NONE,
    message: () => "That feature isn't configured on this deployment.",
    action: () => `Try again shortly; if it persists, ${SUPPORT}.`,
  }),
  wrong_preset: defineError({
    httpStatus: 409,
    recoverability: "user_config",
    params: NONE,
    message: () => "That database isn't an agent-memory database, so it has no memory tables.",
    action: () => "Retry without naming a database and nlqdb will use (or create) your memory one.",
  }),
  key_not_found: defineError({
    httpStatus: 404,
    recoverability: "user_config",
    params: NONE,
    message: () => "No key of yours matched that id.",
    action: () => `Check the list at ${KEYS_URL}, then retry.`,
  }),
  // ── Guided import (`/v1/import/*`) ─────────────────────────────────────
  import_not_found: defineError({
    httpStatus: 404,
    recoverability: "user_config",
    params: NONE,
    message: () => "That import draft no longer exists.",
    action: () => "Start the import again.",
  }),
  import_busy: defineError({
    httpStatus: 409,
    recoverability: "transient",
    params: NONE,
    message: () => "That import is already running.",
    action: () => "Wait for it to finish, then check the result.",
  }),
  unknown_pack: defineError({
    httpStatus: 400,
    recoverability: "bug",
    params: z.object({ allowed: z.array(z.string().max(60)).max(50).default([]).catch([]) }),
    message: () => "That import pack doesn't exist.",
    action: (p) =>
      p.allowed.length > 0 ? `Use one of: ${p.allowed.join(", ")}.` : "Pick a supported pack.",
  }),
  source_required: defineError({
    httpStatus: 400,
    recoverability: "bug",
    params: NONE,
    message: () => "No source was given for that import.",
    action: () => "Name the source to import from, then retry.",
  }),
  invalid_preset: defineError({
    httpStatus: 400,
    recoverability: "bug",
    params: z.object({ allowed: z.array(z.string().max(60)).max(50).default([]).catch([]) }),
    message: () => "That schema preset doesn't exist.",
    action: (p) =>
      p.allowed.length > 0 ? `Use one of: ${p.allowed.join(", ")}.` : "Pick a supported preset.",
  }),
  preset_disabled: defineError({
    httpStatus: 400,
    recoverability: "operator",
    params: NONE,
    message: () => "That preset isn't enabled on this deployment.",
    action: () => "Create the database without a preset, or ask the operator to enable it.",
  }),
  preset_engine_conflict: defineError({
    httpStatus: 400,
    recoverability: "bug",
    params: NONE,
    message: () => "That preset doesn't run on the engine you asked for.",
    action: () => "Drop the engine override, or pick a preset that supports it.",
  }),
  provision_failed: defineError({
    httpStatus: 502,
    recoverability: "transient",
    params: NONE,
    message: () => "nlqdb couldn't finish creating that database.",
    action: () => "Try again in a moment; nothing was left half-created.",
  }),
  create_requires_session: defineError({
    httpStatus: 403,
    recoverability: "user_config",
    params: NONE,
    message: () => "Creating a database needs a signed-in account session.",
    action: () => "Sign in, then create it — your goal is saved.",
  }),

  // ── Anonymous-token adoption + bearer parsing ──────────────────────────
  invalid_bearer: defineError({
    httpStatus: 400,
    recoverability: "bug",
    params: NONE,
    message: () => "The Authorization header wasn't a usable bearer token.",
    action: () => "Send `Authorization: Bearer <key>`, then retry.",
  }),
  invalid_token: defineError({
    httpStatus: 400,
    recoverability: "user_config",
    params: NONE,
    message: () => "That anonymous token isn't valid.",
    action: () => "Start a new session; anything you built anonymously may have expired.",
  }),
  token_taken: defineError({
    httpStatus: 409,
    recoverability: "user_config",
    params: NONE,
    message: () => "That anonymous session was already claimed by another account.",
    action: () => "Carry on in this account — nothing more to do here.",
  }),
  adopt_failed: defineError({
    httpStatus: 500,
    recoverability: "bug",
    params: NONE,
    message: () => "nlqdb couldn't move your anonymous work into this account.",
    action: () => `Retry once; if it persists, ${SUPPORT}.`,
  }),

  // ── OAuth connect (`/v1/db/connect/oauth/*`) ───────────────────────────
  oauth_not_configured: defineError({
    httpStatus: 503,
    recoverability: "operator",
    params: NONE,
    message: () => "This deployment isn't set up to connect that provider by OAuth.",
    action: () => "Connect it with a connection URL instead.",
  }),
  pick_expired: defineError({
    httpStatus: 410,
    recoverability: "user_config",
    params: NONE,
    message: () => "That connection choice expired before it was confirmed.",
    action: () => "Start the connection again.",
  }),

  internal_error: defineError({
    httpStatus: 500,
    recoverability: "bug",
    params: NONE,
    message: () => "Something broke inside nlqdb on that call.",
    action: () => `Retry once; if it persists, ${SUPPORT} with the time of the call.`,
  }),

  // ── Client-side sentinels. Never sent by the API; produced by the SDK /
  // CLI so every surface can render one shape for every failure.
  network_error: defineError({
    httpStatus: 0,
    recoverability: "transient",
    params: NONE,
    message: () => "Couldn't reach nlqdb.",
    action: () => "Check your connection, then retry.",
  }),
  non_json_response: defineError({
    httpStatus: 0,
    recoverability: "transient",
    params: NONE,
    message: () => "nlqdb returned a response this client couldn't read.",
    action: () => `Retry once; if it persists, ${SUPPORT}.`,
  }),
  aborted: defineError({
    httpStatus: 0,
    recoverability: "transient",
    params: NONE,
    message: () => "That call was cancelled.",
    action: () => "Run it again when you're ready.",
  }),
  unknown_error: defineError({
    httpStatus: 500,
    recoverability: "bug",
    params: NONE,
    message: () => "Something unexpected went wrong.",
    action: () => `Retry once; if it persists, ${SUPPORT} with the time of the call.`,
  }),
} as const;

// SK-ASK-026 — the allowlist's reject reasons. One [message, action] pair per
// reason; the flat "that query was rejected" is the fallback for a reason the
// registry hasn't met yet.
const SQL_REJECT_COPY: Record<string, [string, string]> = {
  drop_statement: [
    "Dropping tables isn't something nlqdb will do from a plain-English goal.",
    "Create a fresh database instead if you want to start over.",
  ],
  truncate_statement: [
    "Emptying a whole table isn't a one-step action here.",
    "Delete rows with a filter, naming which ones to remove.",
  ],
  delete_without_where: [
    "That would delete every row in the table.",
    "Add a filter naming which rows to remove, then ask again.",
  ],
  update_without_where: [
    "That would update every row in the table.",
    "Add a filter (e.g. \"… where status = 'open'\"), then ask again.",
  ],
  grant_or_revoke: [
    "Changing database permissions isn't supported here.",
    "Manage access from your database provider instead.",
  ],
  alter_statement: [
    "Changing a table's structure isn't supported here.",
    "Create a new database with the shape you want instead.",
  ],
  disallowed_verb: [
    "That kind of statement isn't allowed here.",
    "Ask for what you want in plain English instead.",
  ],
  disallowed_function: [
    "That query uses a function nlqdb doesn't allow.",
    "Rephrase the goal without that function.",
  ],
  multi_statement: [
    "That came through as several statements at once.",
    "Ask for one thing at a time.",
  ],
  parse_failed: [
    "nlqdb couldn't turn that into a valid query.",
    "Rephrase the goal, naming the tables and columns you mean.",
  ],
  empty: ["That came through empty.", "Send a plain-English goal, then retry."],
  expected_data_modification: [
    "That goal asked to change data but planned as a read.",
    "Say explicitly what to insert, update, or delete.",
  ],
  write_via_repair: [
    "A retry of that query tried to change data, which the read path won't run.",
    "Ask for the change explicitly so it goes through the preview gate.",
  ],
  // SK-TRUST-006 — the preview couldn't be built, so the write is not offered.
  preview_unavailable: [
    "nlqdb couldn't preview what that write would change, so it didn't run it.",
    "Rephrase the change more specifically, then ask again.",
  ],
};
