import type { AskDiff, CandidateDb, NlqClient, NlqdbApiError, RememberRequest } from "@nlqdb/sdk";
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
    .describe(
      "The agent_memory_v1 database id (db_agent_memory_v1_…). Provision one with db.create { preset: 'agent_memory_v1' }; a non-memory DB is rejected with wrong_preset.",
    ),
  kind: z
    .enum(["fact", "episode", "entity"])
    .describe(
      "Which memory table to write into: 'fact' (a durable statement to recall later), 'episode' (one conversation/tool turn), or 'entity' (a person/project/thing — upserts on agent+kind+name).",
    ),
  payload: z
    .record(z.string(), z.unknown())
    .describe(
      "Kind-specific fields. fact: { content, kind?, tags?, source? }. episode: { role, content, tool_calls?, tokens? }. entity: { kind, canonical_name, properties? }.",
    ),
  endUserId: z.string().optional().describe("Optional end-user scope (facts / episodes)."),
  threadId: z
    .string()
    .optional()
    .describe("Optional thread/conversation scope (facts / episodes)."),
  ttlSeconds: z
    .number()
    .optional()
    .describe("Optional TTL in seconds — sets expires_at on a fact so it can be swept later."),
};

export type RememberInput = z.infer<z.ZodObject<typeof rememberInputShape>>;

export const rememberOutputShape = {
  id: z
    .union([z.string(), z.number()])
    .describe("Id of the materialised (or upserted) memory row."),
  kind: z.enum(["fact", "episode", "entity"]),
  materialised_at: z.string().describe("Server timestamp the row was written."),
  expires_at: z.string().optional().describe("Present only when a fact TTL was set."),
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
          trace: { sql: "", model: "", confidence: 0, cache_hit: false },
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

export async function handleRemember(
  client: NlqClient,
  input: RememberInput,
  ctx: HandlerContext = {},
): Promise<ToolResult<RememberOutput>> {
  try {
    const opts: { signal?: AbortSignal } = {};
    if (ctx.signal) opts.signal = ctx.signal;
    // The server (`memory/remember.ts`) is the source of truth for the
    // per-kind payload shape; the flat tool schema keeps `payload` loose
    // and lets that validation report a one-sentence reason.
    const req = {
      db: input.db,
      kind: input.kind,
      payload: input.payload,
      ...(input.endUserId !== undefined ? { endUserId: input.endUserId } : {}),
      ...(input.threadId !== undefined ? { threadId: input.threadId } : {}),
      ...(input.ttlSeconds !== undefined ? { ttlSeconds: input.ttlSeconds } : {}),
    } as RememberRequest;
    const res = await client.remember(req, opts);
    const out: RememberOutput = {
      id: res.id,
      kind: res.kind,
      materialised_at: res.materialised_at,
      ...(res.expires_at ? { expires_at: res.expires_at } : {}),
    };
    return { ok: out };
  } catch (err) {
    return { err: mapSdkError(err) };
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

// Strips raw SDK strings on the unknown bucket so internal details don't reach the host LLM.
export function mapSdkError(err: unknown): ToolError {
  const apiErr = err as NlqdbApiError | undefined;
  const code = apiErr?.code ?? "unknown_error";
  const httpStatus = apiErr?.httpStatus ?? 0;
  const body = apiErr?.body ?? null;

  if (code === "unauthorized" || httpStatus === 401) {
    return {
      code: "auth_required",
      // Both sk_ keys are full-access (SK-APIKEYS-001 / SK-MCP-012); they
      // differ by purpose, not capability — name which to mint for what.
      message:
        "This tool requires a user-scoped key — sk_mcp_ (minted per MCP host) or sk_live_ (a backend/server secret).",
      action:
        "Mint one at https://app.nlqdb.com/app/keys, then re-launch this host so it picks up the new credentials.",
    };
  }
  // Read-only principal tried to write memory (`/v1/memory/remember` 403).
  // Checked before the generic 403 branch so the action names the real fix.
  if (code === "forbidden") {
    return {
      code: "forbidden",
      message: "This key is read-only, so it can't write memory.",
      action:
        "Use a user-scoped key (sk_live_ or sk_mcp_) to write; pk_live_ embeds can only query.",
    };
  }
  // SK-DBCONN-001 — connect on an anonymous session. Checked before the
  // generic 403 so the action names the real fix (sign in), not a key swap.
  if (code === "connect_requires_account") {
    return {
      code: "connect_requires_account",
      message: "Connecting a database needs an account; this is an anonymous session.",
      action:
        "Sign in at https://app.nlqdb.com and re-launch this host with an account-scoped key (sk_live_ or sk_mcp_).",
    };
  }
  if (code === "account_required" || httpStatus === 403) {
    return {
      code: "account_required",
      message: "This tool needs an account-scoped key; a pk_live_ embed key is not enough.",
      action: "Re-launch with a sk_live_ or sk_mcp_ key minted at https://app.nlqdb.com/app/keys.",
    };
  }
  if (code === "low_confidence") {
    const details = readAlternatives(body);
    return {
      code: "low_confidence",
      message: body?.message ?? "The plan confidence was below the per-tier floor.",
      action: details
        ? "Re-call with one of the alternatives in `details.alternatives`, or rephrase with the exact table/column names you mean."
        : "Rephrase your goal with the specific table or column names you mean.",
      ...(details ? { details } : {}),
    };
  }
  if (code === "ambiguous_db") {
    const candidates = body?.candidate_dbs as CandidateDb[] | undefined;
    return {
      code: "ambiguous_db",
      message: "Multiple databases could match this goal.",
      action: candidates?.length
        ? `Re-call with an explicit \`db\` argument (e.g. ${candidates
            .slice(0, 3)
            .map((c) => `\`${c.slug}\``)
            .join(", ")}).`
        : "Re-call with an explicit `db` argument.",
      ...(candidates?.length ? { details: { candidate_dbs: candidates } } : {}),
    };
  }
  if (code === "rate_limited" || httpStatus === 429) {
    // SK-RL-004 — the 429 body carries `resetAt` (epoch seconds). Surface
    // the real wait when present; otherwise state the documented
    // fixed-window behaviour (SK-RL-002: 60s window) rather than guess.
    const retryAfter = readRetryAfterSeconds(body);
    return {
      code: "rate_limited",
      message: "Rate limit exceeded.",
      action:
        retryAfter !== undefined
          ? `Wait ${retryAfter}s before retrying — the rate-limit window resets then.`
          : "Wait up to 60s before retrying; the per-minute window resets on the minute boundary.",
    };
  }
  if (code === "wrong_preset") {
    return {
      code: "wrong_preset",
      message:
        "That database isn't an agent-memory database, so it has no facts/episodes/entities tables.",
      action:
        "Provision one with the agent_memory_v1 preset (db.create { preset: 'agent_memory_v1' }), then remember into it.",
    };
  }
  if (code === "aborted") {
    return {
      code: "aborted",
      message: "The tool call was cancelled.",
      action: "Re-call when you're ready.",
    };
  }
  // SK-DBCONN-001 connect failures carry an actionable, server-authored
  // `message` worth surfacing verbatim. The server never echoes the
  // connection URL into the message, so this is safe.
  if (code === "invalid_request" || code === "introspection_failed") {
    return {
      code: String(code),
      message: body?.message ?? "Could not connect to the database.",
      action:
        "Check the engine and connection URL are correct (HTTPS, reachable host, valid credentials), then re-call.",
    };
  }
  if (code === "sealing_unconfigured") {
    return {
      code: "sealing_unconfigured",
      message: "This deployment can't seal database credentials right now.",
      action: "Retry shortly; if it persists email support@nlqdb.com.",
    };
  }
  return {
    code: String(code),
    message: "An unexpected error occurred.",
    action:
      "Retry once; if the error persists email support@nlqdb.com with the tool name and time.",
  };
}

function readAlternatives(body: NlqdbApiError["body"]): Record<string, unknown> | undefined {
  if (!body) return undefined;
  const alt = (body as unknown as { alternatives?: unknown }).alternatives;
  if (Array.isArray(alt) && alt.length > 0) return { alternatives: alt };
  return undefined;
}

// `resetAt` is on the wire (SK-RL-004) but not in the SDK's ApiErrorBody
// type, so read it defensively like readAlternatives does. It's an epoch
// second; return whole seconds from now until the window resets.
function readRetryAfterSeconds(body: NlqdbApiError["body"]): number | undefined {
  if (!body) return undefined;
  const resetAt = (body as unknown as { resetAt?: unknown }).resetAt;
  if (typeof resetAt !== "number" || !Number.isFinite(resetAt)) return undefined;
  return Math.max(0, Math.round(resetAt - Date.now() / 1000));
}
