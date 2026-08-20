import {
  assertOverrides,
  ERROR_CODES,
  type ErrorCode,
  isErrorCode,
  renderError,
} from "@nlqdb/errors";
import type { AskDiff, NlqClient, NlqdbApiError, RememberRequest } from "@nlqdb/sdk";
import { z } from "zod";

export type ToolError = {
  code: string;
  message: string;
  action: string;
  details?: Record<string, unknown>;
};

export type ToolResult<T> = { ok: T } | { err: ToolError };

export type HandlerContext = {
  signal?: AbortSignal;
  listDatabasesCached?: () => Promise<{ databases: ListDatabaseRow[] }>;
};

type ListDatabaseRow = {
  id: string;
  slug: string;
  displayName: string;
  schemaName?: string;
  engine: string;
  lastQueriedAt: number | null;
  createdAt: number;
};

export const queryInputShape = {
  db: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Target database id or slug. Optional: omit to let nlqdb pick — it auto-targets your only DB (or creates one from the goal when you have none), and on multiple DBs returns ambiguous_db with candidate ids to choose from. Ignored for pk_live_ keys (already scoped to one DB).",
    ),
  q: z
    .string()
    .min(1)
    .describe(
      "The natural-language goal. Example: 'top 5 customers by revenue this year'. Name tables explicitly when you know them; avoid pronouns.",
    ),
  confirm: z
    .boolean()
    .optional()
    .describe(
      "Destructive writes are two calls: the first (confirm absent) returns requires_confirm: true plus a diff preview; show the diff, then re-call with confirm: true to commit. Read-only queries ignore this.",
    ),
  // SK-PREMIUM-014 — goal-first preset knob (SK-PREMIUM-003); the enum
  // never names a concrete model, so the no-model-string-in-surfaces
  // rule holds.
  model: z
    .enum(["auto", "fast", "best"])
    .optional()
    .describe(
      "Model preset: 'fast' pins the free built-in chain, 'best' requires a frontier model (errors model_unavailable unless the account stored a BYOLLM key or has a paid plan), omit/'auto' lets nlqdb pick.",
    ),
};

export type QueryInput = z.infer<z.ZodObject<typeof queryInputShape>>;

export const listDatabasesInputShape = {};

export type ListDatabasesInput = Record<string, never>;

export const describeInputShape = {
  db: z.string().min(1).describe("Database id or slug to describe."),
};

export type DescribeInput = z.infer<z.ZodObject<typeof describeInputShape>>;

export const rememberInputShape = {
  db: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Optional. The agent_memory_v1 database id (db_agent_memory_v1_…). Omit on first use and this tool will find (or provision) your account's memory DB automatically and return the new dbId in the result — pass that on subsequent calls. A non-memory DB is rejected with wrong_preset and the recovery is the same: omit `db` to auto-provision.",
    ),
  kind: z
    .enum(["fact", "episode", "entity"])
    .describe(
      "Which memory table to write into. Prefer 'entity' for anything with a current state (a project, a person, a config) — an entity is the CURRENT SNAPSHOT and upserts on (agent+kind+name), so re-remembering refreshes it in place instead of accumulating stale rows. Use 'fact' for a statement whose truth is time-bound (a status update, an observation, an idea) — give it a ttlSeconds when it's transient. Use 'episode' for one conversation/tool turn (append-only log).",
    ),
  payload: z
    .record(z.string(), z.unknown())
    .describe(
      "Kind-specific fields. fact: { content, kind?, tags?, source? }. episode: { role, content, tool_calls?, tokens? }. entity: { kind, canonical_name, properties? }. " +
        "Write for the queries you'll ask later: fact kind + tags become GROUP BY columns — reuse a small lower_snake kind vocabulary (leaving every row on the default 'fact' makes categories unqueryable) and tag every id/topic the row touches. " +
        "Entities are current snapshots: keep the state in `properties` (JSONB) and re-remember the entity to update it — an upsert on (agent, kind, canonical_name) replaces properties when provided, so re-send the whole object. Prefer updating an entity over accumulating facts about it. " +
        "Supersede rather than accumulate: when a fact becomes wrong or outdated, write the corrected fact (same tags) rather than piling on — old facts fade via ttlSeconds; entities are refreshed in place. " +
        "Make content one self-describing sentence, so a row reads correctly on its own in a result set.",
    ),
  endUserId: z.string().optional().describe("Optional end-user scope (facts / episodes)."),
  threadId: z
    .string()
    .optional()
    .describe("Optional thread/conversation scope (facts / episodes)."),
  ttlSeconds: z
    .number()
    .optional()
    .describe(
      "Optional TTL in seconds — sets expires_at on a fact. Expired facts stop appearing in queries (RLS filters them out) and are physically evicted opportunistically on subsequent writes, so memory forgets what it no longer needs. Set this on any fact whose relevance is time-bound (a status, an observation, a hypothesis) — a day for daily standups, a week for weekly plans, a month for quarterly context. Facts without a TTL live forever; entities never expire (update them in place instead).",
    ),
};

export type RememberInput = z.infer<z.ZodObject<typeof rememberInputShape>>;

export const rememberOutputShape = {
  id: z
    .union([z.string(), z.number()])
    .describe("Id of the materialised (or upserted) memory row."),
  kind: z.enum(["fact", "episode", "entity"]),
  materialised_at: z.string().describe("Server timestamp the row was written."),
  expires_at: z.string().optional().describe("Present only when a fact TTL was set."),
  dbId: z
    .string()
    .optional()
    .describe(
      "The agent_memory_v1 database the row landed in. Present when this tool resolved the DB for you (input `db` omitted, adopted an existing memory DB, or auto-provisioned a new one). Pass it as `db` on subsequent calls to skip the resolution step.",
    ),
  db_created: z
    .boolean()
    .optional()
    .describe(
      "True when this call provisioned a new agent_memory_v1 database because the account had none.",
    ),
};

export type RememberOutput = z.infer<z.ZodObject<typeof rememberOutputShape>>;

export const connectDatabaseInputShape = {
  engine: z
    .enum(["clickhouse", "postgres"])
    .describe("Which engine the existing database runs — 'clickhouse' or 'postgres'."),
  connection_url: z
    .string()
    .min(1)
    .describe(
      "The full connection URL for the database, including credentials (e.g. postgres://user:pass@host:5432/db or https://host:8443?user=…). Stored sealed server-side and never echoed back.",
    ),
  name: z
    .string()
    .optional()
    .describe("Optional display name for the connection; defaults to the database/host name."),
};

export type ConnectDatabaseInput = z.infer<z.ZodObject<typeof connectDatabaseInputShape>>;

// SECURITY — the result deliberately omits `connection_url` / pkLive so the
// secret a host just passed in is never reflected back into the transcript.
export const connectDatabaseOutputShape = {
  dbId: z.string().describe("Id of the newly connected database; pass it as `db` to nlqdb_query."),
  name: z.string().describe("Resolved display name for the connection."),
  engine: z.enum(["clickhouse", "postgres"]).describe("The engine that was connected."),
  schemaPreview: z
    .string()
    .describe("A preview of the discovered schema (tables/columns) the agent can now query."),
  credential: z
    .literal("stored_sealed")
    .describe("The connection URL was stored sealed server-side; it is never returned."),
};

export type ConnectDatabaseOutput = z.infer<z.ZodObject<typeof connectDatabaseOutputShape>>;

export const queryOutputShape = {
  rows: z
    .array(z.record(z.string(), z.unknown()))
    .describe(
      "Result rows, capped at 200 for response size. When rowsTruncated is true, totalRowCount holds the full count — refine the query rather than paging.",
    ),
  rowCount: z.number().describe("Number of rows the underlying query produced."),
  rowsTruncated: z
    .boolean()
    .optional()
    .describe(
      "True when rows were truncated for response-size safety; totalRowCount is the full count.",
    ),
  totalRowCount: z
    .number()
    .optional()
    .describe("Full row count before truncation; only present when rowsTruncated is true."),
  trace: z
    .object({
      sql: z.string(),
      // SK-PREMIUM-013 — surface which model answered so an MCP host can tell
      // "which model am I using?" (was previously stripped at this boundary).
      model: z.string(),
      confidence: z.number(),
      cache_hit: z.boolean(),
    })
    .describe("Compiled SQL, the model that answered, and plan metadata (SK-TRUST-002)."),
  requires_confirm: z
    .boolean()
    .optional()
    .describe(
      "True when the plan is destructive and not yet committed. Show diff, then re-call with confirm: true.",
    ),
  diff: z
    .object({
      verb: z.string(),
      table: z.string(),
      affectedRows: z.number(),
      summary: z.string(),
    })
    .optional()
    .describe("Diff preview body. Only present when requires_confirm is true."),
  db_created: z
    .boolean()
    .optional()
    .describe("True when the database was created on this call. dbId carries the new id."),
  dbId: z.string().optional(),
  displayName: z.string().optional(),
};

export type QueryOutput = z.infer<z.ZodObject<typeof queryOutputShape>>;

export const listDatabasesOutputShape = {
  databases: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      displayName: z.string(),
      engine: z.string(),
      lastQueriedAt: z.number().nullable(),
      createdAt: z.number(),
    }),
  ),
};

export type ListDatabasesOutput = z.infer<z.ZodObject<typeof listDatabasesOutputShape>>;

export const describeOutputShape = {
  id: z.string(),
  slug: z.string(),
  displayName: z.string(),
  engine: z.string(),
  schemaName: z.string().optional(),
};

export type DescribeOutput = z.infer<z.ZodObject<typeof describeOutputShape>>;

export async function handleQuery(
  client: NlqClient,
  input: QueryInput,
  ctx: HandlerContext = {},
): Promise<ToolResult<QueryOutput>> {
  try {
    const askOpts: { signal?: AbortSignal } = {};
    if (ctx.signal) askOpts.signal = ctx.signal;
    const askReq: Parameters<NlqClient["ask"]>[0] = { goal: input.q };
    if (input.db !== undefined) askReq.dbId = input.db;
    if (input.confirm !== undefined) askReq.confirm = input.confirm;
    if (input.model !== undefined) askReq.model = input.model;

    const response = await client.ask(askReq, askOpts);

    if (!("status" in response)) {
      return {
        ok: {
          rows: [],
          rowCount: 0,
          // SK-TRUST-002 — the create response's trace carries the
          // compiled DDL that provisioned the schema.
          trace: traceOf(response.trace),
          db_created: true,
          dbId: response.db,
          displayName: response.displayName,
        },
      };
    }

    if (response.requires_confirm) {
      return {
        ok: {
          rows: [],
          rowCount: 0,
          trace: traceOf(response.trace),
          requires_confirm: true,
          ...(response.diff ? { diff: diffOf(response.diff) } : {}),
        },
      };
    }

    return { ok: buildQueryOutput(response.rows, response.rowCount, response.trace) };
  } catch (err) {
    return { err: mapSdkError(err) };
  }
}

export async function handleListDatabases(
  client: NlqClient,
  ctx: HandlerContext = {},
): Promise<ToolResult<ListDatabasesOutput>> {
  try {
    const opts: { signal?: AbortSignal } = {};
    if (ctx.signal) opts.signal = ctx.signal;
    const response = await client.listDatabases(opts);
    return {
      ok: {
        databases: response.databases.map((d) => ({
          id: d.id,
          slug: d.slug,
          displayName: d.displayName,
          engine: d.engine,
          lastQueriedAt: d.lastQueriedAt,
          createdAt: d.createdAt,
        })),
      },
    };
  } catch (err) {
    return { err: mapSdkError(err) };
  }
}

export async function handleDescribe(
  client: NlqClient,
  input: DescribeInput,
  ctx: HandlerContext = {},
): Promise<ToolResult<DescribeOutput>> {
  try {
    const opts: { signal?: AbortSignal } = {};
    if (ctx.signal) opts.signal = ctx.signal;
    const response = ctx.listDatabasesCached
      ? await ctx.listDatabasesCached()
      : await client.listDatabases(opts);
    const match = response.databases.find((d) => d.id === input.db || d.slug === input.db);
    if (!match) {
      return {
        err: {
          code: "db_not_found",
          message: `No database matches '${input.db}'.`,
          action: "Call nlqdb_list_databases to see available databases.",
        },
      };
    }
    return {
      ok: {
        id: match.id,
        slug: match.slug,
        displayName: match.displayName,
        engine: match.engine,
        ...(match.schemaName ? { schemaName: match.schemaName } : {}),
      },
    };
  } catch (err) {
    return { err: mapSdkError(err) };
  }
}

// A memory DB id is the deterministic marker the server uses to gate
// `/v1/memory/remember` (`isAgentMemoryV1Db` in
// `apps/api/src/db-create/presets/agent-memory-v1.ts` — a DB id counts
// iff it starts with `db_agent_memory_v1_`). Mirroring the check here
// lets the MCP tool find an existing memory DB and skip the create.
function isAgentMemoryDbId(id: string): boolean {
  return id.startsWith("db_agent_memory_v1_");
}

// Founder dogfood 2026-08-18: an agent connected to the hosted MCP
// server and called `nlqdb_remember` on an account that had DBs but no
// memory DB. The server returned `wrong_preset` with the recovery
// instruction "db.create { preset: 'agent_memory_v1' }" — but the MCP
// surface exposes no `db.create` tool. Auto-create was gated on
// zero-DB accounts, so the agent dead-ended.
//
// Fix: `nlqdb_remember` self-provisions. When `db` is omitted, or the
// caller-supplied `db` is not a memory DB (or does not exist), this
// handler:
//   1. lists databases and adopts the first `db_agent_memory_v1_*` it
//      finds (idempotent across sessions);
//   2. if none exists, calls `createDatabase({ preset: 'agent_memory_v1' })`
//      — the server-side path already accepts sk_mcp keys under the
//      `MEMORY_PRESET` flag (SK-HDC-020 / SK-HDC-021);
//   3. re-runs the write against the resolved DB and returns `dbId`
//      (and `db_created: true` on a fresh provision) so the agent can
//      pin the id on the next call.
export async function handleRemember(
  client: NlqClient,
  input: RememberInput,
  ctx: HandlerContext = {},
): Promise<ToolResult<RememberOutput>> {
  const opts: { signal?: AbortSignal } = {};
  if (ctx.signal) opts.signal = ctx.signal;

  // Fast path: caller pinned a plausible memory DB. Try it once.
  let firstAttemptErr: unknown | undefined;
  if (input.db && isAgentMemoryDbId(input.db)) {
    const direct = await tryRemember(client, input, input.db, opts);
    if (direct.kind === "ok") return { ok: direct.value };
    if (!isResolvableDbError(direct.err)) return { err: mapSdkError(direct.err) };
    firstAttemptErr = direct.err;
  } else if (input.db) {
    // Non-memory-shaped id → try it once so a real error (auth, invalid
    // payload, rate limit) surfaces before we start creating databases.
    const direct = await tryRemember(client, input, input.db, opts);
    if (direct.kind === "ok") return { ok: direct.value };
    if (!isResolvableDbError(direct.err)) return { err: mapSdkError(direct.err) };
    firstAttemptErr = direct.err;
  }

  // Auto-resolve: find an existing memory DB, else provision one. When
  // resolve itself fails and we had a first-attempt error, surface the
  // first error — it's typically more actionable (the mapped
  // wrong_preset / db_not_found action already names the recovery).
  const resolved = await resolveMemoryDb(client, opts);
  if (resolved.kind === "err") {
    return { err: mapSdkError(firstAttemptErr ?? resolved.err) };
  }

  const attempt = await tryRemember(client, input, resolved.dbId, opts);
  if (attempt.kind === "ok") {
    return {
      ok: {
        ...attempt.value,
        dbId: resolved.dbId,
        ...(resolved.created ? { db_created: true } : {}),
      },
    };
  }
  return { err: mapSdkError(attempt.err) };
}

type TryRememberOutcome = { kind: "ok"; value: RememberOutput } | { kind: "err"; err: unknown };

async function tryRemember(
  client: NlqClient,
  input: RememberInput,
  dbId: string,
  opts: { signal?: AbortSignal },
): Promise<TryRememberOutcome> {
  try {
    const req = {
      db: dbId,
      kind: input.kind,
      payload: input.payload,
      ...(input.endUserId !== undefined ? { endUserId: input.endUserId } : {}),
      ...(input.threadId !== undefined ? { threadId: input.threadId } : {}),
      ...(input.ttlSeconds !== undefined ? { ttlSeconds: input.ttlSeconds } : {}),
    } as RememberRequest;
    const res = await client.remember(req, opts);
    const value: RememberOutput = {
      id: res.id,
      kind: res.kind,
      materialised_at: res.materialised_at,
      ...(res.expires_at ? { expires_at: res.expires_at } : {}),
    };
    return { kind: "ok", value };
  } catch (err) {
    return { kind: "err", err };
  }
}

// An error we can recover from by locating (or creating) the memory DB
// and retrying. Anything else is a real failure the caller should see
// verbatim (auth, forbidden, rate limit, invalid payload, …).
function isResolvableDbError(err: unknown): boolean {
  const apiErr = err as NlqdbApiError | undefined;
  const code = apiErr?.code;
  return code === "wrong_preset" || code === "db_not_found";
}

type ResolveOutcome =
  | { kind: "ok"; dbId: string; created: boolean }
  | { kind: "err"; err: unknown };

async function resolveMemoryDb(
  client: NlqClient,
  opts: { signal?: AbortSignal },
): Promise<ResolveOutcome> {
  try {
    const list = await client.listDatabases(opts);
    const existing = list.databases.find((d) => isAgentMemoryDbId(d.id));
    if (existing) return { kind: "ok", dbId: existing.id, created: false };
  } catch (err) {
    return { kind: "err", err };
  }

  try {
    // SK-HDC-020 — deterministic preset create; server pins engine=postgres.
    // `name` gives the DB a human-legible label in the account rail.
    const created = await client.createDatabase({
      preset: "agent_memory_v1",
      name: "Agent memory",
    });
    return { kind: "ok", dbId: created.dbId, created: true };
  } catch (err) {
    return { kind: "err", err };
  }
}

export async function handleConnectDatabase(
  client: NlqClient,
  input: ConnectDatabaseInput,
  ctx: HandlerContext = {},
): Promise<ToolResult<ConnectDatabaseOutput>> {
  try {
    const opts: { signal?: AbortSignal } = {};
    if (ctx.signal) opts.signal = ctx.signal;
    // The SDK transmits `connectionUrl` only in the JSON body and never
    // echoes it into a thrown error (`SK-DBCONN-001`).
    const res = await client.databases.connect(
      {
        engine: input.engine,
        connectionUrl: input.connection_url,
        ...(input.name !== undefined ? { name: input.name } : {}),
      },
      opts,
    );
    // SECURITY — return only non-secret fields; the connection URL and the
    // freshly-minted pkLive are dropped so neither re-enters the transcript.
    return {
      ok: {
        dbId: res.dbId,
        name: res.name,
        engine: res.engine === "clickhouse" ? "clickhouse" : "postgres",
        schemaPreview: res.schemaPreview,
        credential: "stored_sealed",
      },
    };
  } catch (err) {
    return { err: mapSdkError(err) };
  }
}

function traceOf(trace: { sql: string; model: string; confidence: number; cache_hit: boolean }) {
  return {
    sql: trace.sql,
    model: trace.model,
    confidence: trace.confidence,
    cache_hit: trace.cache_hit,
  };
}

function diffOf(diff: AskDiff) {
  return {
    verb: diff.verb,
    table: diff.table,
    affectedRows: diff.affectedRows,
    summary: diff.summary,
  };
}

function buildQueryOutput(
  rows: Record<string, unknown>[],
  rowCount: number,
  trace: { sql: string; model: string; confidence: number; cache_hit: boolean },
): QueryOutput {
  return { rows, rowCount, trace: traceOf(trace) };
}

// SK-ERR-001 — the API renders one sentence + the next action from the shared
// `@nlqdb/errors` registry, so this boundary is a pass-through, not a copy table.
// What remains below is the sparse set of codes where an MCP host genuinely needs
// a different action from a human's: name the tool to re-call, or the credential
// to re-launch with. Every other code — including any added tomorrow — arrives
// already phrased, so it can never regress to "An unexpected error occurred."
//
// `assertOverrides` type-checks the keys against the registry, so a typo or a
// retired code fails the build instead of silently never firing.

// The one place a genuinely-opaque failure lands: a non-API throw with no code
// at all. GLOBAL-012 bans this phrasing for anything we can explain.
// Sourced from the registry so there is exactly one wording for it.
export const GENERIC_ERROR_MESSAGE = renderError("unknown_error").message;
const GENERIC_ERROR_ACTION =
  "Retry once; if the error persists email support@nlqdb.com with the tool name and time.";

// `action` may read the code's params (a rate-limit window, a candidate list) —
// the same parametric copy the registry does, just in the host's voice.
type Override = {
  message?: string;
  action: string | ((params: Record<string, unknown>) => string);
};

const OVERRIDES: Partial<Record<ErrorCode, Override>> = assertOverrides({
  // sk_mcp_ ⊂ sk_live_ (SK-APIKEYS-015): an MCP key reaches every tool here but
  // cannot connect a BYO database, so name it first — a host config should hold
  // the narrower credential.
  unauthorized: {
    message:
      "This tool requires a user-scoped key — sk_mcp_ (an MCP key, scoped to one MCP host + device) or sk_live_ (a full-account backend secret).",
    action:
      "Mint an MCP key at https://app.nlqdb.com/app/keys, then re-launch this host so it picks up the new credentials.",
  },
  auth_required: {
    action:
      "Mint an MCP key at https://app.nlqdb.com/app/keys, then re-launch this host so it picks up the new credentials.",
  },
  forbidden: {
    action: "Use a user-scoped key (sk_mcp_ or sk_live_) to write; pk_live_ embeds can only query.",
  },
  account_required: {
    action: "Re-launch with an sk_mcp_ MCP key minted at https://app.nlqdb.com/app/keys.",
  },
  // SK-DBCONN-001 — never name sk_mcp_ here: re-launching with another MCP key
  // would fail identically.
  connect_requires_account: {
    action:
      "Connect it once at https://app.nlqdb.com (signed in), or re-launch this host with an sk_live_ key. Every other tool works on the MCP key.",
  },
  db_not_found: {
    action:
      "Call nlqdb_list_databases for valid ids; for agent memory, re-call nlqdb_remember without `db` and it will adopt (or provision) the memory DB automatically.",
  },
  wrong_preset: {
    action:
      "Re-call nlqdb_remember without `db` — it adopts your existing agent_memory_v1 database, or provisions one for you if none exists.",
  },
  sql_required: {
    message: "This tool doesn't run raw SQL.",
    action: "Use nlqdb_query with a natural-language goal instead.",
  },
  // SK-RL-004 — an agent decides *when* to re-call, so give it the number of
  // seconds rather than a human's "wait a moment".
  rate_limited: {
    action: (p) => {
      const resetAt = p["resetAt"];
      if (typeof resetAt === "number" && Number.isFinite(resetAt)) {
        const wait = Math.max(0, Math.round(resetAt - Date.now() / 1000));
        return `Wait ${wait}s before retrying — the rate-limit window resets then.`;
      }
      // SK-RL-002 documents a 60s fixed window; state it rather than guess.
      return "Wait up to 60s before retrying; the per-minute window resets on the minute boundary.";
    },
  },
  // Point at the tool that resolves the ambiguity, not at a human's picker.
  ambiguous_db: {
    action: "Re-call with an explicit `db` argument — nlqdb_list_databases has the ids.",
  },
  clarify_required: {
    action:
      "Re-call `q` with one of the goals in `details.options`, or name exactly which rows you mean.",
  },
  // GLOBAL-040 — a below-floor plan arrives as `clarify_required`
  // (`clarification: "low_confidence"`, options = candidate readings), handled
  // by the entry above; there is no standalone `low_confidence` code.
});

// Every code this boundary can phrase — the registry itself, now that nothing
// here keeps a hand-maintained list. Exported for the anti-regression sweep.
export const KNOWN_ERROR_CODES: readonly string[] = ERROR_CODES;

// Structured payloads a host/agent can act on programmatically. The copy comes
// from the registry; this only lifts the machine-readable half out of `params`
// onto `details`.
function detailsFor(code: string, params: Record<string, unknown> | undefined) {
  if (!params) return undefined;
  const lift = (key: string) => {
    const v = params[key];
    return Array.isArray(v) && v.length > 0 ? { [key]: v } : undefined;
  };
  if (code === "ambiguous_db") return lift("candidate_dbs");
  if (code === "clarify_required") return lift("options");
  return undefined;
}

// Strips raw SDK strings on the unknown bucket so internal details never reach
// the host LLM.
export function mapSdkError(err: unknown): ToolError {
  const apiErr = err as NlqdbApiError | undefined;
  const code = apiErr?.code ?? "unknown_error";
  const body = apiErr?.body ?? null;
  // A streamed ask error arrives flat (`{code, table, …}`); a JSON error nests
  // the same fields under `params`. Read either shape — the registry's schema
  // ignores the extra top-level keys — so copy and details render for both.
  const params = (body?.params ?? body ?? undefined) as Record<string, unknown> | undefined;

  // A registry code: render the wire copy, then apply the sparse MCP override.
  // `renderError` covers the SDK-only sentinels (network_error, aborted, …),
  // which have no wire body of their own.
  if (isErrorCode(code)) {
    const wire = body?.message
      ? { message: body.message, action: body.action ?? "" }
      : renderError(code, params);
    const override = OVERRIDES[code];
    const details = detailsFor(code, params);
    const action =
      typeof override?.action === "function"
        ? override.action(params ?? {})
        : (override?.action ?? wire.action);
    return {
      code,
      message: override?.message ?? wire.message,
      action,
      ...(details ? { details } : {}),
    };
  }

  // A code newer than this MCP build. The server already phrased it — surface
  // that rather than the generic bucket, which is what left `nlqdb_remember`
  // opaque before SK-ERR-001.
  if (body?.message) {
    return {
      code: String(code),
      message: body.message,
      action: body.action ?? GENERIC_ERROR_ACTION,
    };
  }

  return { code: String(code), message: GENERIC_ERROR_MESSAGE, action: GENERIC_ERROR_ACTION };
}
