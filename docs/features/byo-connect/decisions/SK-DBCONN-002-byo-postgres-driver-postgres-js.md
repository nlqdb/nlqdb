# SK-DBCONN-002 — BYO Postgres runs on postgres.js over Workers `connect()` sockets, not the Neon HTTP driver

- **Decision:** Both BYO-Postgres call sites — connect-time introspection
  (`db-connect/build-deps.ts`) and the `/v1/ask` BYO runner (`ask/build-deps.ts`)
  — open a real Postgres wire-protocol TCP connection via **postgres.js**
  (`postgres` npm, over the Workers `connect()` socket API, `nodejs_compat`),
  through one owning module `packages/db/src/postgres-byo.ts` (`openByoPostgres`,
  `GLOBAL-021`). The Neon serverless driver's HTTP mode (`neon(url)`) is removed
  from the BYO path. TLS is `ssl: "require"` (the Workers runtime performs the
  handshake + cert verification); `prepare: false` for Supavisor transaction-pooler
  compatibility; the socket connects lazily and is closed in a `finally` at both
  sites. This supersedes the implicit Neon-HTTP-for-BYO implementation that shipped
  inside `SK-DBCONN-001`.
- **Core value:** Bullet-proof, Open source, Effortless UX
- **Why:** `neon(url)` only speaks Neon's SQL-over-HTTP protocol — it POSTs to a
  Neon-only `fetchEndpoint`. A non-Neon Postgres exposes no such endpoint, so
  every introspection/query fetch threw and connect returned `introspection_failed`
  for **any** non-Neon host (e.g. Supabase) — defeating the point of BYO. postgres.js
  is the maintained client with first-class Workers `connect()` support, so it talks
  the actual Postgres wire protocol to any host. The `neon()` HTTP driver stays
  correct — and unchanged — for the **hosted** Neon databases (`runHostedPgQuery`,
  the memory path, `db-create`), which really are Neon; only the BYO path, which is
  by definition not Neon, changes.
- **Consequence in code:** `packages/db` gains a `postgres` dependency and
  `postgres-byo.ts`; `apps/api` imports **no** Postgres driver directly (the earlier
  `@neondatabase/serverless` carve-out in `db-connect/build-deps.ts` is gone). Bundle
  delta ~+23 KiB gzipped, far inside `GLOBAL-013`'s 3 MiB. This **amends `SK-DB-002`**
  ("no `postgres-js` in `packages/db`"), which is now scoped to the hosted adapter.
  No live Postgres in the unit env, so the mapping is unit-tested via an injected
  postgres.js-shaped stub (`packages/db/test/postgres-byo.test.ts`) and end-to-end
  via [`manual-test-postgres.md`](../manual-test-postgres.md).
- **Alternatives rejected:**
  - **node-postgres (`pg`).** Heavier bundle and a pool model that buys nothing on
    Workers (no warm sockets, `SK-DB-003`); postgres.js's Workers socket support is
    leaner.
  - **Neon WebSocket mode + a self-hosted `wsproxy`.** Extra always-on infra per BYO
    host — contradicts the $0 free-tier posture (`GLOBAL-013`) — to make a
    Neon-shaped driver reach non-Neon hosts, when a real Postgres client already does.
  - **Keep `neon()` HTTP for BYO.** The bug itself: Neon-only, so non-Neon BYO cannot
    work.
- **Source:** research P2, 2026-08 — postgres.js README (Cloudflare Workers support,
  `ssl` values, `sql.unsafe(query, params) -> Result[]` with `.count`, `sql.end`);
  Cloudflare Hyperdrive postgres.js guide (`fetch_types:false`, per-request client);
  Supabase × Workers (Supavisor transaction pooler ⇒ `prepare:false`); workerd#3514
  (unclosed sockets exhaust the connection cap → close in `finally`).
