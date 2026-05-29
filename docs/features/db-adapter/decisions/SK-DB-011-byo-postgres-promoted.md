# SK-DB-011 — BYO Postgres promoted from Phase 4+ to active development; the shape locked in §3.6.7 is the contract

- **Decision:** BYO Postgres ships as an active workstream alongside
  the Phase 2 surfaces; the "Phase 4+, signal-gated" timing in
  [`phase-plan.md §7`](../../../phase-plan.md) is **superseded** by
  this SK. The shape from
  [`architecture.md §3.6.7`](../../../architecture.md#367-byo-postgres-phase-4-decided-shape)
  is unchanged and binding: `POST /v1/db/connect { connection_url,
  name? }`, `provisionDb(plan)` vs `registerByoDb(connection_url,
  plan)` split (already done per `SK-HDC-007`), per-db AES-GCM blob in
  D1 with a Workers-held KEK, validator from `sql-allowlist` applies
  unchanged, role model `read` / `write` / `admin` per §3.6.7,
  function reject-list per `SK-SQLAL-008`. Surface parity per
  [`GLOBAL-003`](../../../decisions/GLOBAL-003-all-surfaces-one-pr.md)
  — HTTP / SDK / CLI / MCP / elements all carry `/v1/db/connect` in
  the same PR.
- **Core value:** Open source, Free, Effortless UX
- **Why:** The Phase 4+ signal-gate
  ([`phase-plan.md §6`](../../../phase-plan.md) + §7) was written when
  payment infrastructure was the bottleneck the signal-gate
  protected. BYO is the opposite: it requires **no** payment
  infrastructure, runs on the user's own Postgres bill, and is the
  most direct expression of the open-source / no-lock-in promise in
  [`GLOBAL-019`](../../../decisions/GLOBAL-019-apache2-open-source-core.md).
  The engine-quality north-star
  ([`GLOBAL-025`](../../../decisions/GLOBAL-025-north-star.md)) is
  also measured on real production schemas; BYO is the channel
  through which non-Neon schemas reach the eval surface, feeding the
  free-vs-frontier delta in
  [`quality-eval/FEATURE.md`](../../quality-eval/FEATURE.md).
  Promoting BYO does not introduce per-tenant infra cost (user pays
  for their Postgres) so
  [`GLOBAL-013`](../../../decisions/GLOBAL-013-free-tier-bundle-budget.md)
  stays intact.
- **Consequence in code:**
  - `apps/api/src/db-create/connect.ts` (new) — `POST /v1/db/connect`
    handler; calls `registerByoDb` instead of `provisionDb`; persists
    the AES-GCM connection blob in D1
    (`databases.connection_blob` column via a new migration). KEK
    lives in Workers Secret Store.
  - `apps/api/src/db-create/introspect.ts` (new) — `pg_catalog` query
    on connect; emits one table-card per existing table. No
    `pg_dump`.
  - `packages/db/src/postgres.ts` — adapter accepts the resolved
    `connection_url` from the registry; underlying call shape
    (`SK-DB-001`) unchanged.
  - SDK / CLI / MCP / elements all surface the verb in the same PR
    per `GLOBAL-003`: CLI `nlq db connect <url> --name <name>` +
    `nlq role read|write|admin` per §3.6.7; MCP `nlqdb_connect_db`
    tool; SDK `client.connectDb({ connectionUrl, name? })`;
    `<nlq-data>` hard-pinned to the `read` role per §3.6.7.
  - KEK rotation procedure is the residual open question carved out
    in the parent FEATURE.md.
- **Alternatives rejected:**
  - **Keep BYO at Phase 4+ until §6 demand-signal trips.** The
    demand-signal-gate was designed for payment-infra work; BYO is
    not payment-infra. Conflating the two delays the open-source
    promise without protecting any constraint.
  - **Ship BYO without the surface-parity set in the same PR.**
    Violates `GLOBAL-003`; this is exactly the failure mode that doc
    was written to prevent.
  - **Treat BYO as a separate feature folder (`docs/features/byo-pg/`).**
    The adapter, validator, and provisioner split already live in
    `db-adapter` + `hosted-db-create` + `sql-allowlist`. A new folder
    would re-document the same shape; promotion-via-SK is the cheap
    edit.
  - **Skip the role model (single `connection_url`).** Power users
    want `read`-only API keys on a write-capable BYO DB; §3.6.7's
    three-role design is the answer. Removing it would push role
    enforcement into the user's hand-rolled SQL.
- **Source:**
  [`architecture.md §3.6.7`](../../../architecture.md#367-byo-postgres-phase-4-decided-shape)
  (the shape) ·
  [`phase-plan.md §7`](../../../phase-plan.md) (the timing this SK
  supersedes) · `SK-HDC-007` (provisioner split already done) · prior
  Open question "Phase 4 BYO Postgres" (now resolved by this SK;
  KEK-rotation sub-question retained in the parent FEATURE.md)
