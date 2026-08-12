// BYO Postgres live connection — opens a real Postgres wire-protocol TCP
// connection to a user-supplied ("bring your own") database over the Cloudflare
// Workers `connect()` socket API via postgres.js. It is the Postgres sibling of
// `clickhouse-byo.ts`: the single transport the connect-time introspector
// (`SK-DB-014`) and the `/v1/ask` BYO-Postgres runner both bind to, owned by
// `packages/db` (`GLOBAL-021`) so the Postgres driver import for the BYO path
// lives in exactly one place.
//
// Why postgres.js, not the Neon HTTP driver (`SK-DBCONN-002`): `neon(url)`
// speaks Neon's SQL-over-HTTP protocol — it POSTs to a Neon-only
// `fetchEndpoint`, so it can only talk to Neon-hosted Postgres. A non-Neon BYO
// Postgres (Supabase, RDS, self-hosted) exposes no such endpoint, so every
// introspection / query fetch throws and the connect verb returned
// `introspection_failed` for any non-Neon host. postgres.js opens a real
// Postgres TCP connection through the Workers `connect()` socket API
// (`nodejs_compat`, set in `wrangler.toml`), which every Postgres speaks.
//
// TLS: managed Postgres (Supabase, RDS) requires TLS. `ssl: "require"` forces
// the SSL negotiation; on Workers the runtime performs the TLS handshake and
// certificate verification against its own trust store (the pg client cannot
// override it), so a publicly-trusted cert — e.g. the Supabase pooler —
// verifies without extra config. A host presenting a privately-signed cert is
// therefore unsupported for now (the runtime, not the client, owns verification).
//
// `prepare: false`: the Supabase transaction-mode pooler (Supavisor, port 6543)
// rejects server-side prepared statements. postgres.js `unsafe()` already
// defaults prepared statements off, and setting it connection-wide keeps any
// future tagged-template use pooler-safe too.
//
// Lifecycle: postgres.js connects lazily (no socket until the first query is
// issued) and the socket MUST be closed — an unclosed Workers TCP socket
// lingers and, accumulated across requests, exhausts the runtime's 6-connection
// cap and deadlocks (workerd#3514). Both call sites `close()` in a `finally`.
//
// Sources (P2, 2026-08): postgres.js README (Cloudflare Workers support,
// `ssl` values, `sql.unsafe(query, params) -> Result[]` with `.count`,
// `sql.end`); Cloudflare Hyperdrive postgres.js guide (`fetch_types:false`,
// per-request client); Supabase × Cloudflare Workers (Supavisor transaction
// pooler needs `prepare:false`); workerd#3514 (close-or-deadlock).

import postgres from "postgres";
import type { PostgresQueryFn } from "./postgres.ts";
import type { QueryResult, Row } from "./types.ts";

// Minimal structural shape of the postgres.js `sql` tag this module uses —
// enough to inject a stub in unit tests (no live Postgres in the unit env)
// without pulling the driver's full type surface. `unsafe` / a transaction's
// query both resolve to a row array carrying postgres.js's `.count`.
type ByoResult = Row[] & { count?: number };
type ByoSql = {
  unsafe: (query: string, params?: unknown[]) => Promise<ByoResult>;
  begin: <T>(cb: (tx: { unsafe: ByoSql["unsafe"] }) => Promise<T>) => Promise<T>;
  end: (opts?: { timeout?: number }) => Promise<void>;
};

export type ByoPostgresOptions = {
  // Injected for tests (the `SK-DB-006` seam): a postgres.js-shaped factory.
  // Production uses the real `postgres` driver with Workers-tuned options.
  driver?: (url: string) => ByoSql;
};

export type ByoPostgresConnection = {
  // One parameterised statement (`$1` placeholders) → `{ rows, rowCount }`.
  // The seam `introspectPostgres` (`SK-DB-014`) binds to at connect time.
  query: PostgresQueryFn;
  // One transaction — `SET LOCAL statement_timeout = <timeout>` then the user
  // SQL — so a runaway BYO query is wall-clock bounded server-side and the
  // timeout scopes correctly even behind a transaction-mode pooler (which
  // assigns a backend per transaction). Returns the user statement's rows.
  runBounded: (sql: string, statementTimeout: string, signal?: AbortSignal) => Promise<QueryResult>;
  // Close the socket. Idempotent and never throws — a close failure must not
  // turn a successful introspection / query into an error.
  close: () => Promise<void>;
};

function defaultDriver(url: string): ByoSql {
  return postgres(url, {
    ssl: "require",
    prepare: false,
    // One connection per request — no cross-request pool (`SK-DB-003`); the
    // connect-time introspector's concurrent reads serialise on it, which is
    // fine for a one-off connect and keeps us well under the Workers cap.
    max: 1,
    // Skip the array/enum type-catalog probe round-trip on connect: the
    // introspector reads `format_type` text directly and the runner returns
    // rows as-received, so parsed array types are never needed.
    fetch_types: false,
    // Bound the initial connect so a black-holed host fails fast instead of
    // hanging the connect handshake or the `/v1/ask` request behind it.
    connect_timeout: 10,
  }) as unknown as ByoSql;
}

export function openByoPostgres(url: string, opts: ByoPostgresOptions = {}): ByoPostgresConnection {
  const sql = (opts.driver ?? defaultDriver)(url);

  // A postgres.js `Result` is an Array subclass carrying extra enumerable
  // props (`count`, `columns`, …); spread to a plain `Row[]` so consumers see
  // the same clean row array the Neon driver's `result.rows` gave them, and
  // read the affected/returned count off `.count` before spreading.
  const toResult = (raw: ByoResult): QueryResult => ({
    rows: [...raw] as Row[],
    rowCount: raw.count ?? raw.length,
  });

  const query: PostgresQueryFn = async (text, params, signal) => {
    signal?.throwIfAborted();
    return toResult(await sql.unsafe(text, params ?? []));
  };

  const runBounded = async (
    userSql: string,
    statementTimeout: string,
    signal?: AbortSignal,
  ): Promise<QueryResult> => {
    signal?.throwIfAborted();
    return toResult(
      await sql.begin(async (tx) => {
        // `SET LOCAL` scopes the timeout to this transaction only. The timeout
        // is a controlled constant from the caller, not user input.
        await tx.unsafe(`SET LOCAL statement_timeout = '${statementTimeout}'`);
        return tx.unsafe(userSql);
      }),
    );
  };

  return {
    query,
    runBounded,
    close: () => sql.end({ timeout: 5 }).catch(() => {}),
  };
}
