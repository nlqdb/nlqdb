// The one HTTP client for an attached Cloudflare D1 (`GLOBAL-021`,
// `GLOBAL-043` item 6): D1 attaches with an API token + account id +
// database id, never a connection string. Every catalog read and DDL goes
// through the REST `query` endpoint
// (https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/);
// the Tier 1 workload is the GraphQL Analytics API's `d1QueriesAdaptiveGroups`
// (`readD1QueryInsights`).
// The host is fixed (`api.cloudflare.com`), so no egress guard is needed; the
// ids are checked before they reach the URL path. The token is the caller's
// to unseal and is never logged.

import { dbDurationMs } from "@nlqdb/otel";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import type { Row } from "../types.ts";

// One request runs every statement in order and returns one row set per
// statement. D1 binds no parameter into a `PRAGMA`, so the observer quotes its
// identifiers instead (`d1Literal`) and the batch carries bare SQL.
export type D1BatchFn = (statements: string[]) => Promise<Row[][]>;

export type D1Target = { accountId: string; databaseId: string; token: string };

// Account ids are 32 hex; D1 database ids are UUIDs.
const ACCOUNT_ID = /^[0-9a-f]{32}$/;
const DATABASE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// Cloudflare API requests must resolve within 30 s, so a hung socket never outlives that.
const TIMEOUT_MS = 30_000;

export class D1RestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "D1RestError";
  }
}

type QueryResponse = {
  success: boolean;
  errors?: { code: number; message: string }[];
  result?: { results?: Row[]; success?: boolean }[];
};

function checkTarget(target: D1Target): void {
  if (!ACCOUNT_ID.test(target.accountId))
    throw new Error("D1 account id must be 32 hex characters.");
  if (!DATABASE_ID.test(target.databaseId)) throw new Error("D1 database id must be a UUID.");
}

// One `db.query` span per request (`GLOBAL-014`); the SQL and token never go on it.
function withRequestSpan<T>(
  target: D1Target,
  operation: string,
  transport: string,
  run: () => Promise<T>,
): Promise<T> {
  return trace.getTracer("@nlqdb/db").startActiveSpan(
    "db.query",
    {
      attributes: {
        "db.system": "sqlite",
        "db.operation.name": operation,
        "db.namespace": target.databaseId,
        "nlqdb.transport": transport,
      },
    },
    async (span) => {
      const startedAt = performance.now();
      try {
        return await run();
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw err;
      } finally {
        dbDurationMs().record(performance.now() - startedAt, { operation });
        span.end();
      }
    },
  );
}

const post = (url: string, token: string, body: unknown, fetchFn: typeof fetch) =>
  fetchFn(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

export function d1RestBatch(target: D1Target, fetchFn: typeof fetch = fetch): D1BatchFn {
  checkTarget(target);
  const url = `https://api.cloudflare.com/client/v4/accounts/${target.accountId}/d1/database/${target.databaseId}/query`;
  return async (statements) => {
    if (statements.length === 0) return [];
    return withRequestSpan(target, "BATCH", "d1-rest", async () => {
      const res = await post(
        url,
        target.token,
        { batch: statements.map((sql) => ({ sql })) },
        fetchFn,
      );
      const body = (await res.json().catch(() => null)) as QueryResponse | null;
      if (!res.ok || !body?.success || body.result?.length !== statements.length) {
        const why = body?.errors?.map((e) => e.message).join("; ") || `HTTP ${res.status}`;
        throw new D1RestError(`D1 query failed: ${why}`, res.status);
      }
      return body.result.map((r) => r.results ?? []);
    });
  };
}

// One query text's sampled totals over a window, per run where averaged.
export type D1QueryInsight = {
  query: string;
  calls: number;
  meanMs: number;
  rowsRead: number;
  rowsReturned: number;
  rowsWritten: number;
  totalRowsRead: number;
};

// The selection `wrangler d1 insights` makes (workers-sdk
// `packages/wrangler/src/d1/insights.ts`, read 2026-11-03), heaviest total
// rows read first. The token needs Account Analytics Read. Sampled
// ("adaptive"), so `count` and `sum` are estimates; there is no percentile.
const INSIGHTS_QUERY = `query getD1QueriesOverviewQuery($accountTag: string, $filter: ZoneWorkersRequestsFilter_InputObject) {
  viewer {
    accounts(filter: {accountTag: $accountTag}) {
      d1QueriesAdaptiveGroups(limit: 100, filter: $filter, orderBy: [sum_rowsRead_DESC]) {
        sum { queryDurationMs rowsRead rowsWritten rowsReturned }
        avg { queryDurationMs rowsRead rowsWritten rowsReturned }
        count
        dimensions { query databaseId }
      }
    }
  }
}`;

type Metrics = Partial<
  Record<"queryDurationMs" | "rowsRead" | "rowsWritten" | "rowsReturned", number>
>;
type InsightsResponse = {
  data?: {
    viewer?: {
      accounts?: {
        d1QueriesAdaptiveGroups?: {
          sum?: Metrics;
          avg?: Metrics;
          count?: number;
          dimensions?: { query?: string };
        }[];
      }[];
    };
  } | null;
  errors?: { message: string }[] | null;
};

// The attached database's query texts between `since` and `until` (ISO
// hours; retention is 31 days), heaviest total rows read first.
export function readD1QueryInsights(
  target: D1Target,
  window: { since: string; until: string },
  fetchFn: typeof fetch = fetch,
): Promise<D1QueryInsight[]> {
  checkTarget(target);
  return withRequestSpan(target, "QUERY_INSIGHTS", "d1-graphql", async () => {
    const res = await post(
      "https://api.cloudflare.com/client/v4/graphql",
      target.token,
      {
        query: INSIGHTS_QUERY,
        operationName: "getD1QueriesOverviewQuery",
        variables: {
          accountTag: target.accountId,
          filter: {
            AND: [
              {
                datetimeHour_geq: window.since,
                datetimeHour_leq: window.until,
                databaseId: target.databaseId,
              },
            ],
          },
        },
      },
      fetchFn,
    );
    const body = (await res.json().catch(() => null)) as InsightsResponse | null;
    const groups = body?.data?.viewer?.accounts?.[0]?.d1QueriesAdaptiveGroups;
    if (!res.ok || body?.errors?.length || !groups) {
      const why = body?.errors?.map((e) => e.message).join("; ") || `HTTP ${res.status}`;
      throw new D1RestError(`D1 query insights failed: ${why}`, res.status);
    }
    return groups
      .filter((g) => g.dimensions?.query)
      .map((g) => ({
        query: g.dimensions?.query as string,
        calls: g.count ?? 0,
        meanMs: g.avg?.queryDurationMs ?? 0,
        rowsRead: g.avg?.rowsRead ?? 0,
        rowsReturned: g.avg?.rowsReturned ?? 0,
        rowsWritten: g.avg?.rowsWritten ?? 0,
        totalRowsRead: g.sum?.rowsRead ?? 0,
      }));
  });
}

// A SQLite string literal — how a `PRAGMA` takes a table or index name.
export function d1Literal(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}
