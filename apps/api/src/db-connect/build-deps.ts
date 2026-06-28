// Production deps for `connectByoDb`. Mirrors `db-create/build-deps.ts`
// (the hosted-create counterpart): the route handler calls this once per
// request to assemble the deps object the pure orchestrator expects, so a
// future swap (different resolver, different query backend) lands in one
// place.
//
// Skill cross-refs:
// - `docs/architecture.md §3.6.7` — BYO connect path.
// - GLOBAL-031 — secret envelope (`kekFromEnv`, AAD `dbconn:<dbId>`).
// - GLOBAL-035 — DNS-rebind egress guard (the injected `resolve`).

// GLOBAL-021 exception: the BYO Postgres introspector needs the raw Neon
// client to issue its `information_schema` reads against the user's own
// connection string (the `DatabaseAdapter.execute()` seam in `@nlqdb/db`
// is bound to the hosted connection, not an arbitrary BYO URL). Owner of
// `@neondatabase/serverless` remains `packages/db/`; this import is the
// documented one-file carve-out, matching `db-create/build-deps.ts`.
import { neon } from "@neondatabase/serverless";
import {
  buildClickhouseByoQuery,
  type ClickhouseConnSpec,
  createDohResolver,
  type Row,
} from "@nlqdb/db";
import { apiKeyHmacSecret, mintPkLiveKey } from "../api-keys.ts";
import { kekFromEnv } from "../secret-envelope.ts";
import type { ConnectByoDeps, PostgresIntrospectQueryFn } from "./connect.ts";

export function buildConnectByoDeps(envBindings: Cloudflare.Env): ConnectByoDeps {
  return {
    resolve: createDohResolver(),
    kek: kekFromEnv(envBindings),
    d1: envBindings.DB,
    randomSuffix: defaultRandomSuffix,
    mintPkLive: (dbId, tenantId) =>
      mintPkLiveKey(envBindings.DB, apiKeyHmacSecret(envBindings), dbId, tenantId),
    // A fresh resolver per builder call keeps the egress re-guard (GLOBAL-035)
    // running on every introspection fetch against the BYO ClickHouse host.
    buildClickhouseQuery: (spec: ClickhouseConnSpec) =>
      buildClickhouseByoQuery(spec, { resolve: createDohResolver() }),
    buildPostgresQuery: buildNeonIntrospectQuery,
  };
}

// 6-char random suffix for the dbId tail — same convention as
// `db-create/build-deps.ts` (`db_<slug>_<6 hex>`), bounded so the full id
// fits Postgres's 63-char identifier limit.
function defaultRandomSuffix(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 6);
}

// Wrap a raw BYO Postgres URL in a `PostgresQueryFn` the introspector
// accepts. `neon(url, { fullResults: true })` returns the row + rowCount
// shape the introspector reads. The egress guard already ran at validate
// time (`validateByoConnection`); Neon's HTTP fetch dials the same host.
function buildNeonIntrospectQuery(rawUrl: string): PostgresIntrospectQueryFn {
  const sql = neon(rawUrl, { fullResults: true });
  return async (text: string, params: unknown[], signal?: AbortSignal) => {
    signal?.throwIfAborted();
    const result = await sql.query(text, params ?? []);
    return {
      rows: (result.rows as Row[]) ?? [],
      rowCount: result.rowCount ?? 0,
    };
  };
}
