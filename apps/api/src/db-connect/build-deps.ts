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

// GLOBAL-021: the BYO Postgres driver (postgres.js over Workers `connect()`
// sockets, `SK-DBCONN-002`) lives entirely in `@nlqdb/db` as `openByoPostgres`,
// so — unlike the earlier Neon-HTTP introspector — this module imports NO
// Postgres driver directly. There is no `@neondatabase/serverless` carve-out
// here anymore; the seam is a `@nlqdb/db` factory, matching the BYO ClickHouse
// one alongside it.
import {
  buildClickhouseByoQuery,
  type ClickhouseConnSpec,
  createDohResolver,
  openByoPostgres,
} from "@nlqdb/db";
import { apiKeyHmacSecret, mintPkLiveKey } from "../api-keys.ts";
import { kekFromEnv } from "../secret-envelope.ts";
import type { ConnectByoDeps } from "./connect.ts";

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
    // postgres.js over Workers `connect()` sockets (`SK-DBCONN-002`) — opens a
    // real Postgres TCP connection so introspection works against ANY Postgres
    // (Supabase / RDS / self-hosted), not just Neon HTTP. The egress guard
    // already ran at validate time (`validateByoConnection`); the socket dials
    // the same host.
    buildPostgresQuery: openByoPostgres,
  };
}

// 6-char random suffix for the dbId tail — same convention as
// `db-create/build-deps.ts` (`db_<slug>_<6 hex>`), bounded so the full id
// fits Postgres's 63-char identifier limit.
function defaultRandomSuffix(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 6);
}
