# SK-DB-002 — Phase 0 hosted adapter: Postgres via `@neondatabase/serverless`

- **Decision:** The **hosted** Phase-0 adapter is exactly one adapter —
  `createPostgresAdapter()` over `@neondatabase/serverless` HTTP. No `pg`, no
  query-builder, no connection-pooling middleware **on the hosted path**. Phase 3
  widens to `clickhouse` (via Tinybird) per `SK-MULTIENG-002`; the seam is
  `Engine` plus a parallel `createXxxAdapter()`. **Scope note:** the "no
  `postgres-js`" clause governs the hosted adapter only. The **BYO** Postgres
  path (a user's own, non-Neon database) uses **postgres.js over Workers
  `connect()` sockets** per
  [`SK-DBCONN-002`](../../byo-connect/decisions/SK-DBCONN-002-byo-postgres-driver-postgres-js.md),
  because `neon()` speaks a Neon-only HTTP protocol and cannot reach a non-Neon host.
- **Core value:** Free, Simple, Bullet-proof
- **Why:** Workers don't keep TCP sockets warm across requests, so a pooled
  driver is dead weight for the hosted per-query HTTP model on the free tier.
  Neon's HTTP driver round-trips per query but sidesteps the pool problem and
  fits the 3 MiB bundle ceiling (`GLOBAL-013`). One hosted engine in Phase 0
  means one set of failure modes to learn before adding more. The BYO path is a
  different context — the target is *not* Neon — so it needs a real Postgres wire
  client; that carve-out lives in `SK-DBCONN-002`, not here.
- **Consequence in code:** The hosted adapter imports only
  `@neondatabase/serverless` + `@opentelemetry/*`. `packages/db` additionally
  carries `postgres` (postgres.js) for the BYO path (`SK-DBCONN-002`), so the
  old "`@nlqdb/db` depends only on `@neondatabase/serverless`" invariant is
  superseded: the guard is now "no new Postgres driver on the **hosted** adapter,
  and no `pg` / query-builder / `redis` in `packages/db/` without a decision."
- **Alternatives rejected:**
  - `pg` with an external pooler (PgBouncer / Neon Pooler) — works but doubles
    the moving parts and the bundle weight; saves nothing in Phase 0.
  - Drizzle/Kysely on top — adds a query-builder layer; we emit raw SQL from the
    planner, the adapter just runs it.
  - One driver for both hosted and BYO — impossible: `neon()` is Neon-only and a
    generic client is heavier than the hosted HTTP path needs; the two contexts
    keep the driver each fits (`SK-DBCONN-002`).
