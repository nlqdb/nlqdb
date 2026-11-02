// The one HTTP client for an attached Cloudflare D1 (`GLOBAL-021`,
// `GLOBAL-043` item 6): D1 attaches with an API token + account id +
// database id, never a connection string, and every catalog read and DDL goes
// through the REST `query` endpoint
// (https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/).
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

export function d1RestBatch(target: D1Target, fetchFn: typeof fetch = fetch): D1BatchFn {
  if (!ACCOUNT_ID.test(target.accountId))
    throw new Error("D1 account id must be 32 hex characters.");
  if (!DATABASE_ID.test(target.databaseId)) throw new Error("D1 database id must be a UUID.");
  const url = `https://api.cloudflare.com/client/v4/accounts/${target.accountId}/d1/database/${target.databaseId}/query`;
  return async (statements) => {
    if (statements.length === 0) return [];
    // One `db.query` span per request (`GLOBAL-014`); the SQL and token never go on it.
    return trace.getTracer("@nlqdb/db").startActiveSpan(
      "db.query",
      {
        attributes: {
          "db.system": "sqlite",
          "db.operation.name": "BATCH",
          "db.namespace": target.databaseId,
          "nlqdb.transport": "d1-rest",
        },
      },
      async (span) => {
        const startedAt = performance.now();
        try {
          const res = await fetchFn(url, {
            method: "POST",
            headers: {
              authorization: `Bearer ${target.token}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({ batch: statements.map((sql) => ({ sql })) }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
          });
          const body = (await res.json().catch(() => null)) as QueryResponse | null;
          if (!res.ok || !body?.success || body.result?.length !== statements.length) {
            const why = body?.errors?.map((e) => e.message).join("; ") || `HTTP ${res.status}`;
            throw new D1RestError(`D1 query failed: ${why}`, res.status);
          }
          return body.result.map((r) => r.results ?? []);
        } catch (err) {
          span.recordException(err as Error);
          span.setStatus({ code: SpanStatusCode.ERROR });
          throw err;
        } finally {
          dbDurationMs().record(performance.now() - startedAt, { operation: "BATCH" });
          span.end();
        }
      },
    );
  };
}

// A SQLite string literal — how a `PRAGMA` takes a table or index name.
export function d1Literal(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}
