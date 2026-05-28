# SK-MULTIENG-005 — BYO ClickHouse promoted from Phase 4+ to active development; same `registerByoDb` path as BYO Postgres

- **Decision:** BYO ClickHouse ships in active development alongside
  the Tinybird adapter in `SK-MULTIENG-002`. The "Phase 4+,
  signal-gated on P6-persona inbound" timing in
  [`phase-plan.md §7`](../../../phase-plan.md) is **superseded** by
  this SK. The shape parallels
  [`SK-DB-011`](../../db-adapter/decisions/SK-DB-011-byo-postgres-promoted.md):
  `POST /v1/db/connect { connection_url, name? }`, `registerByoDb`
  provisioner path, AES-GCM connection blob in D1 with a Workers-held
  KEK. Two ClickHouse-specific differences pin here:
  - **(a) Native HTTP transport.** ClickHouse's native HTTP interface
    means Workers proxy directly — no TCP socket, no Hyperdrive. The
    user provides `https://<host>:8443` + credentials; the adapter
    `fetch()`es per query like the Neon HTTP adapter does for
    Postgres (`SK-DB-003`).
  - **(b) `system.columns` introspection.** Connect-time introspection
    queries `system.columns` (not `pg_catalog`); emits one table-card
    per existing table. The sibling concern from
    [`architecture.md §3.6.7`](../../../architecture.md#367-byo-postgres-phase-4-decided-shape)
    (last paragraph) applies: `readonly = 1` does **not** block DDL
    on ClickHouse — see `docs/research/personas.md` P6 — so the
    validator allowlist (`SK-MULTIENG-004`) is the load-bearing DDL
    guard, not the session setting.

  Validator + OTel + anon posture follow
  [`SK-MULTIENG-004`](../FEATURE.md#sk-multieng-004) unchanged
  (Pipe/table allowlist + `db.system = other_sql` + sign-in-only at
  adapter launch). Managed Tinybird path from `SK-MULTIENG-002` is
  unaffected — the engine-fit table now says "ClickHouse: managed
  Tinybird OR your own cluster," picked by the user via the same
  `engine: "clickhouse"` flag from `SK-DB-010`.
- **Core value:** Open source, Free, Effortless UX
- **Why:** Same reasoning as
  [`SK-DB-011`](../../db-adapter/decisions/SK-DB-011-byo-postgres-promoted.md):
  the Phase 4+ signal-gate was payment-infra-shaped; BYO carries no
  per-tenant infra cost to us (user pays for their ClickHouse
  cluster). Promoting BYO ClickHouse next to BYO Postgres turns the
  engine-fit table (`SK-MULTIENG-002`) from "default to managed
  Tinybird" into "managed Tinybird **or** your own cluster" — same
  UX, two backends, picked by the user. Heavy ClickHouse users (the
  P6 persona) tend to already operate a cluster; forcing them
  through Tinybird is a deal-breaker on day one. The persona-inbound
  gate in `phase-plan.md §7` conflated "show demand for *managed*
  ClickHouse" with "show demand for *connecting to existing*
  ClickHouse" — the latter has different signal (a user with a
  ClickHouse cluster will hit `db.connect`, not `db.create`).
- **Consequence in code:**
  - `apps/api/src/db-create/connect.ts` — the same `/v1/db/connect`
    handler from `SK-DB-011` dispatches on `engine` (Postgres vs
    ClickHouse) and calls the matching introspector.
  - `apps/api/src/db-create/introspect-clickhouse.ts` (new) — queries
    `system.columns` for the user's database; emits one table-card
    per table.
  - `packages/db/src/clickhouse-byo.ts` (new) — adapter that wraps the
    user's HTTP endpoint via `fetch`; reuses the validator from
    `SK-MULTIENG-004`; emits canonical `db.query` span with
    `db.system = other_sql`.
  - Surface parity per `GLOBAL-003`: `engine: "clickhouse"` is already
    on `db.create` per `SK-DB-010`; `db.connect` follows the same
    enum. CLI: `nlq db connect <url> --engine clickhouse --name <name>`.
- **Alternatives rejected:**
  - **Wait for P6-persona inbound per `phase-plan.md §7`.** See
    `SK-DB-011`'s *Alternatives rejected* — the signal-gate was for
    payment-infra work; persona-inbound is a separate question that
    does not apply to a feature requiring zero new platform spend.
  - **Ship BYO ClickHouse via the managed Tinybird path with
    credential pass-through.** Leaks Tinybird's auth model into the
    user's deployment; the user already has their own cluster and
    they don't want a Tinybird workspace in the loop.
  - **Add BYO ClickHouse as an SK on `db-adapter` (next to
    `SK-DB-011`).** `multi-engine-adapter` owns non-Postgres engines
    (`SK-MULTIENG-001`); cross-feature cohabitation is the right
    home. Pair-reading `SK-DB-011` and this SK is enabled by the
    explicit cross-link.
  - **Reuse the Tinybird adapter's HTTP client.** Tinybird wraps
    ClickHouse with a control-plane API (workspaces, tokens, Pipes);
    BYO talks to the user's cluster's native interface. Sharing code
    would force per-deployment branching in the wrapper that the
    surface-area saving doesn't justify.
- **Source:**
  [`architecture.md §3.6.7`](../../../architecture.md#367-byo-postgres-phase-4-decided-shape)
  (BYO shape — sibling note for ClickHouse) ·
  [`phase-plan.md §7`](../../../phase-plan.md) (the timing this SK
  supersedes) ·
  [`SK-DB-011`](../../db-adapter/decisions/SK-DB-011-byo-postgres-promoted.md)
  (parallel decision for Postgres) · `docs/research/personas.md` P6
  (the persona this slice addresses head-on)
