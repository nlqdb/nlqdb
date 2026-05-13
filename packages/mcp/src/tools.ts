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

import type { NlqClient, NlqdbApiError } from "@nlqdb/sdk";
import { z } from "zod";

// MCP tool-error shape (SK-MCP-006). Each handler returns either
// `{ ok: T }` or `{ err }`; the server layer maps `err` to MCP's
// `{ isError: true, content: [...] }` so the host LLM gets the
// `action` sentence in a place the agent can act on it.
export type ToolError = {
  code: string;
  message: string;
  action: string;
};

export type ToolResult<T> = { ok: T } | { err: ToolError };

// Raw shapes registered with the MCP SDK (`ZodRawShapeCompat`). The
// SDK exports a flat-shape input over the full `z.object(...)` form
// to keep its TS-inference cost bounded; we follow the same shape.

export const queryInputShape = {
  db: z
    .string()
    .min(1)
    .describe("Database id or slug. Ignored when authenticated with a pk_live_ key."),
  q: z.string().min(1).describe("The natural-language goal — what you want from the database."),
};

export type QueryInput = z.infer<z.ZodObject<typeof queryInputShape>>;

export const listDatabasesInputShape = {};

export type ListDatabasesInput = Record<string, never>;

export const describeInputShape = {
  db: z.string().min(1).describe("Database id or slug to describe."),
};

export type DescribeInput = z.infer<z.ZodObject<typeof describeInputShape>>;

export type QueryOutput = {
  rows: Record<string, unknown>[];
  rowCount: number;
  trace: {
    sql: string;
    confidence: number;
    cache_hit: boolean;
  };
};

export type ListDatabasesOutput = {
  databases: {
    id: string;
    slug: string;
    displayName: string;
    engine: string;
    lastQueriedAt: number | null;
    createdAt: number;
  }[];
};

export type DescribeOutput = {
  id: string;
  slug: string;
  displayName: string;
  engine: string;
  schemaName?: string;
};

// `nlqdb_query` — the only tool the agent prompt needs to know
// about. `db` is a hint (slug or id); the API resolves it
// deterministically per `SK-ASK-009` / `SK-HDC-011`. On `pk_live_*`
// auth the API ignores `db` (the key pins the DB); on user-scoped
// auth `db` selects.
export async function handleQuery(
  client: NlqClient,
  input: QueryInput,
): Promise<ToolResult<QueryOutput>> {
  try {
    const response = await client.ask({ goal: input.q, dbId: input.db });
    if (!("status" in response)) {
      // `AskCreateResult` — the create path materialised a new DB.
      // Surface as an info action so the agent re-queries.
      return {
        err: {
          code: "db_created",
          message: `Database '${input.db}' did not exist and was created.`,
          action: "Re-issue your query against the same db argument.",
        },
      };
    }
    return {
      ok: {
        rows: response.rows ?? [],
        rowCount: response.rowCount ?? response.rows?.length ?? 0,
        trace: {
          sql: response.trace?.sql ?? "",
          confidence: response.trace?.confidence ?? 0,
          cache_hit: response.trace?.cache_hit ?? false,
        },
      },
    };
  } catch (err) {
    return { err: mapSdkError(err) };
  }
}

// `nlqdb_list_databases` — enumerates the user's databases. Requires
// user-scoped auth (`sk_live_*` or `sk_mcp_*`). Until slice 1 ships,
// `pk_live_*` calls return `auth_required` from the API; the
// handler surfaces it in the `SK-MCP-006` shape.
export async function handleListDatabases(
  client: NlqClient,
): Promise<ToolResult<ListDatabasesOutput>> {
  try {
    const response = await client.listDatabases();
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

// `nlqdb_describe` — schema preview for one database. Slice 2 uses
// the listDatabases summary fields (slug, engine, schemaName)
// because a dedicated `/v1/databases/:id` is not yet shipped — when
// it lands, swap to a direct fetch (one-line change).
export async function handleDescribe(
  client: NlqClient,
  input: DescribeInput,
): Promise<ToolResult<DescribeOutput>> {
  try {
    const response = await client.listDatabases();
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

// Maps SDK errors into the `SK-MCP-006` tool-error shape — one
// sentence + one next action. Unknown errors collapse to a generic
// shape so the host LLM never sees a bare stack trace.
export function mapSdkError(err: unknown): ToolError {
  const apiErr = err as NlqdbApiError;
  const code = apiErr?.code ?? "unknown_error";

  if (code === "unauthorized" || apiErr?.httpStatus === 401) {
    return {
      code: "auth_required",
      message: "This tool requires a user-scoped key (sk_live_ or sk_mcp_).",
      action:
        "Wait for sk_mcp_* keys (Phase 2 slice 1) or use a pk_live_* key with nlqdb_query for a pinned database.",
    };
  }
  if (code === "low_confidence") {
    return {
      code: "low_confidence",
      message: apiErr?.body?.message ?? "The plan confidence was below the per-tier floor.",
      action: "Rephrase your goal with the specific table or column names you mean.",
    };
  }
  if (code === "ambiguous_db") {
    return {
      code: "ambiguous_db",
      message: "Multiple databases could match this goal.",
      action: "Re-issue the query with an explicit `db` argument.",
    };
  }
  if (code === "rate_limited" || apiErr?.httpStatus === 429) {
    return {
      code: "rate_limited",
      message: "Rate limit exceeded.",
      action: "Wait briefly and retry; rate limits reset within a minute.",
    };
  }
  return {
    code: String(code),
    message: apiErr?.message ?? "An unexpected error occurred.",
    action: "Retry once; if the error persists report it at nlqdb.com/issues.",
  };
}
