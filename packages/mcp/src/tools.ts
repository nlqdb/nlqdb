// Tool contracts + handlers for the MCP server. Transport-agnostic
// per `SK-MCP-007` — the same handlers run under the local-stdio
// transport (slice 2 of `SK-MCP-010`) and the hosted Streamable-HTTP
// transport (slice 3). Three tools per `SK-MCP-002`; no
// `nlqdb_create_database` (the create path is materialised by
// `nlqdb_query` on first reference).
//
// Auth posture for slice 2:
//   - `nlqdb_query` works against `pk_live_*` (pinned to one DB) and
//     `sk_live_*` / `sk_mcp_*` (when slice 1 lands).
//   - `nlqdb_list_databases` / `nlqdb_describe` require user-scoped
//     auth (`sk_live_*` or `sk_mcp_*`). Until slice 1 ships they
//     surface a typed `auth_required` error in the `SK-MCP-006`
//     shape — the host LLM gets one sentence + one next action.

import type { AskDiff, CandidateDb, NlqClient, NlqdbApiError } from "@nlqdb/sdk";
import { z } from "zod";

// MCP tool-error shape (SK-MCP-006). One sentence + one next action,
// plus an optional `details` slot for structured payloads (e.g.
// `ambiguous_db` candidate list) the agent can act on.
export type ToolError = {
  code: string;
  message: string;
  action: string;
  details?: Record<string, unknown>;
};

export type ToolResult<T> = { ok: T } | { err: ToolError };

// Optional plumbing for handler invocation: cancellation signal +
// a listDatabases memo so `handleDescribe` doesn't refetch on every
// call within one tool-handler context (`SK-MCP-010` perf note).
export type HandlerContext = {
  signal?: AbortSignal;
  // When present, used in place of `client.listDatabases()` for the
  // describe path. The server attaches a per-isolate TTL cache.
  listDatabasesCached?: () => Promise<{ databases: ListDatabaseRow[] }>;
};

// Row shape — mirrors the SDK's `DatabaseSummary` (without the
// `pkLive` field, which is sensitive and not relevant to an agent).
type ListDatabaseRow = {
  id: string;
  slug: string;
  displayName: string;
  schemaName?: string;
  engine: string;
  lastQueriedAt: number | null;
  createdAt: number;
};

// Raw input shapes registered with the MCP SDK (`ZodRawShapeCompat`).

export const queryInputShape = {
  db: z
    .string()
    .min(1)
    .describe("Database id or slug. Ignored when authenticated with a pk_live_ key."),
  q: z.string().min(1).describe("The natural-language goal — what you want from the database."),
  // SK-TRUST-001: destructive plans (INSERT/UPDATE/DELETE/DDL)
  // return a diff preview. The agent re-calls with `confirm: true`
  // to commit. Omit on read queries.
  confirm: z
    .boolean()
    .optional()
    .describe(
      "Set true to commit a destructive plan that previously returned requires_confirm. Default false (preview only).",
    ),
};

export type QueryInput = z.infer<z.ZodObject<typeof queryInputShape>>;

export const listDatabasesInputShape = {};

export type ListDatabasesInput = Record<string, never>;

export const describeInputShape = {
  db: z.string().min(1).describe("Database id or slug to describe."),
};

export type DescribeInput = z.infer<z.ZodObject<typeof describeInputShape>>;

// Output schemas. Hosts use these to know what to do with the
// `structuredContent` slot; agents use the descriptions to know how
// to reason about the response.

export const queryOutputShape = {
  rows: z.array(z.record(z.string(), z.unknown())).describe("Result rows; may be empty."),
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
      confidence: z.number(),
      cache_hit: z.boolean(),
    })
    .describe("Compiled SQL and plan metadata (SK-TRUST-002)."),
  // SK-TRUST-001 — destructive plans return these instead of rows.
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
  // SK-HDC-001 — when the query materialised a new DB on first
  // reference (no separate create tool per SK-MCP-002).
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

// `nlqdb_query` — the only tool the agent prompt needs to know
// about. The API materialises a new DB on first reference (no
// `nlqdb_create_database` per SK-MCP-002); destructive plans return
// `requires_confirm: true` + a diff (SK-TRUST-001) — the agent
// shows the diff and re-calls with `confirm: true`.
export async function handleQuery(
  client: NlqClient,
  input: QueryInput,
  ctx: HandlerContext = {},
): Promise<ToolResult<QueryOutput>> {
  try {
    const askOpts: { signal?: AbortSignal } = {};
    if (ctx.signal) askOpts.signal = ctx.signal;
    const askReq: Parameters<NlqClient["ask"]>[0] = { goal: input.q, dbId: input.db };
    if (input.confirm !== undefined) askReq.confirm = input.confirm;

    const response = await client.ask(askReq, askOpts);

    if (!("status" in response)) {
      // SK-HDC-001 — first-reference create. Surfaced as ok so the
      // agent gets the new dbId in one turn (no error-state confusion).
      return {
        ok: {
          rows: [],
          rowCount: 0,
          trace: { sql: "", confidence: 0, cache_hit: false },
          db_created: true,
          dbId: response.db,
          displayName: response.displayName,
        },
      };
    }

    // SK-TRUST-001 — destructive plan preview path. Returns the diff
    // for the agent / user to review; commit requires confirm: true.
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

// `nlqdb_list_databases` — enumerates the user's databases. Requires
// user-scoped auth; surfaces a typed `auth_required` until slice 1
// ships sk_live_/sk_mcp_ keys (SK-MCP-010).
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

// `nlqdb_describe` — schema preview for one database. Uses the
// `listDatabasesCached` memo (per-isolate TTL ~5 s) to keep multi-
// describe agent loops cheap. When `/v1/databases/:id` lands,
// replace the cache lookup with a direct fetch.
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

// Narrow `Trace` to the fields the agent benefits from — `sql`,
// `confidence`, `cache_hit`. The full SK-TRUST-002 trace block has
// more (plan_id, model) but those bloat token cost without helping
// the agent reason.
function traceOf(trace: { sql: string; confidence: number; cache_hit: boolean }) {
  return { sql: trace.sql, confidence: trace.confidence, cache_hit: trace.cache_hit };
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
  trace: { sql: string; confidence: number; cache_hit: boolean },
): QueryOutput {
  return { rows, rowCount, trace: traceOf(trace) };
}

// Maps SDK errors into the `SK-MCP-006` tool-error shape. Known codes
// get a tailored next-action; the catch-all reports only the code so
// raw SDK strings don't leak to the host LLM (mild defence against
// internal-detail leakage).
export function mapSdkError(err: unknown): ToolError {
  const apiErr = err as NlqdbApiError | undefined;
  const code = apiErr?.code ?? "unknown_error";
  const httpStatus = apiErr?.httpStatus ?? 0;
  const body = apiErr?.body ?? null;

  if (code === "unauthorized" || httpStatus === 401) {
    return {
      code: "auth_required",
      message: "This tool requires a user-scoped key (sk_live_ or sk_mcp_).",
      action:
        "Wait for sk_mcp_* keys (Phase 2 slice 1) or use a pk_live_* key with nlqdb_query for a pinned database.",
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
    return {
      code: "rate_limited",
      message: "Rate limit exceeded.",
      action: "Wait briefly and retry; rate limits reset within a minute.",
    };
  }
  if (code === "aborted") {
    return {
      code: "aborted",
      message: "The tool call was cancelled.",
      action: "Re-call when you're ready.",
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
  // SK-TRUST-003 alternatives ride on the open-ended ApiErrorBody —
  // SDK types it as a Record-ish shape. Forward verbatim so the
  // agent can pick one.
  const alt = (body as unknown as { alternatives?: unknown }).alternatives;
  if (Array.isArray(alt) && alt.length > 0) return { alternatives: alt };
  return undefined;
}
