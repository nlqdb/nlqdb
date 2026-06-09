# SK-DB-013 — BYO connect-time validation pipeline: one composition of parse → egress resolve-recheck, shared by both engines

Parent feature: [`db-adapter/FEATURE.md`](../FEATURE.md). Composes the three
landed connect-path primitives: the URL parsers
([`SK-DB-012`](./SK-DB-012-byo-connection-url-handling.md) /
[`SK-MULTIENG-006`](../../multi-engine-adapter/decisions/SK-MULTIENG-006-byo-clickhouse-connection-url.md)),
the egress guard ([`GLOBAL-035`](../../../decisions/GLOBAL-035-byo-egress-guard.md)),
and the DoH resolver it consumes (`packages/db/src/doh-resolver.ts`). Seal/open
primitive (the step *after* this one): [`apps/api/src/secret-envelope.ts`](../../../../apps/api/src/secret-envelope.ts)
([`GLOBAL-031`](../../../decisions/GLOBAL-031-byo-secret-envelope.md)).

- **Decision:** One pure module, `packages/db/src/byo-connect.ts`, exposes
  `validateByoConnection(engine, rawUrl, resolve)` — the single connect-time
  validation entry point both the BYO Postgres
  ([`SK-DB-011`](./SK-DB-011-byo-postgres-promoted.md)) and BYO ClickHouse
  ([`SK-MULTIENG-005`](../../multi-engine-adapter/decisions/SK-MULTIENG-005-byo-clickhouse-promoted.md))
  connect branches call before sealing and writing the D1 row. It runs the two
  validation primitives **in a load-bearing order**: (1) the engine's URL
  parser (`parseConnectionUrl` for `postgres`, `parseClickhouseUrl` for
  `clickhouse`) validates the shape pure + I/O-free, so a garbage paste fails
  loud ([`GLOBAL-012`](../../../decisions/GLOBAL-012-one-sentence-errors.md))
  before any network I/O and yields the only `host` worth resolving; then (2)
  `guardEgressHostResolved` (`GLOBAL-035`) guards that `host`, resolving a DNS
  name through the injected `resolve` and re-guarding every returned address,
  rejecting a literal-or-resolved private/loopback/metadata target fail-closed.
  On success it returns the **engine-tagged** parsed connection
  (`{ engine: "postgres", parsed } | { engine: "clickhouse", parsed }`) so the
  caller narrows on `engine` and reads the engine-specific shape (`secure`
  exists only for ClickHouse) without a cast; on failure it returns the
  primitive's one-sentence message verbatim, which never echoes the secret.
  The resolver is **injected, not constructed** here, so the module stays pure
  and zero-dependency; `connect.ts` supplies `createDohResolver()`. The module
  deliberately stops at validation — it does **not** seal the URL or touch D1;
  that is the `secret-envelope.ts` / route-handler boundary.
- **Core value:** Bullet-proof, Simple
- **Why:** Every "Next" for BYO Postgres and BYO ClickHouse names the same
  step — wire parse + `guardEgressHostResolved` + `createDohResolver` together
  at the connect boundary. Assembling that per engine inside the route handler
  is how the parse-before-resolve ordering, or the fail-closed bias, drifts on
  one of two paths and opens an SSRF hole; one composed primitive makes the
  safe ordering the only ordering, and is the natural place an auditor reads it
  once. Parse-before-guard is not cosmetic: the parse is free and I/O-free, so
  a malformed paste never costs a DoH round trip, and the resolver only ever
  sees a structurally valid host. Keeping the seal out of this module preserves
  the `packages/db` purity/ownership boundary
  ([`GLOBAL-021`](../../../decisions/GLOBAL-021-external-system-ownership.md),
  [`GLOBAL-013`](../../../decisions/GLOBAL-013-free-tier-bundle-budget.md): zero
  new deps), and lets it ship and be tested ahead of its `connect.ts` callers —
  the same pure-primitive-ahead-of-callers rhythm as `SK-DB-012`,
  `SK-MULTIENG-006`, and `secret-envelope.ts`. It is an internal primitive, not
  a new public capability, so it carries no
  [`GLOBAL-003`](../../../decisions/GLOBAL-003-all-surfaces-one-pr.md)
  surface-parity obligation of its own; that lands with the `/v1/db/connect`
  verb in `SK-DB-011`.
- **Consequence in code:** `packages/db/src/byo-connect.ts` exports
  `validateByoConnection` and the `ByoEngine` / `ValidatedByoConnection` /
  `ValidateByoConnectionResult` types, all re-exported from `@nlqdb/db`.
  `connect.ts` (both branches) calls it first — returning the `GLOBAL-012`
  message as the 400 body on failure — then seals the raw URL
  (`secret-envelope.ts`) and persists `parsed.redacted` for the connection
  pill. Tests in `packages/db/test/byo-connect.test.ts` assert the
  parse-before-resolve ordering (a bad shape and a literal private host both
  short-circuit without calling the resolver), the DNS-rebinding rejection, the
  fail-closed-on-resolver-error path, and that the password never survives into
  the returned `redacted`. A third BYO engine adds one `if` branch here, not a
  new composition.
- **Alternatives rejected:**
  - **Assemble parse + guard + resolver in the route handler.** Two copies of
    the ordering (one per engine) drift; the first copy that guards before it
    parses, or forgets to inject the resolver, is an SSRF regression. One owned
    composition (`GLOBAL-021`) is the fix.
  - **Guard first, then parse.** Spends a DoH round trip on a garbage paste and
    hands the resolver an unvalidated host string; parse-first is both cheaper
    and safer.
  - **Seal inside this module.** Pulls the AES-GCM envelope (`apps/api`) and the
    D1 write into `packages/db`, breaking the purity / ownership boundary that
    lets the primitive stay zero-dep and test without a Worker runtime.
  - **A flat (non-tagged) return shape.** Erases the `secure`-only-on-ClickHouse
    distinction and forces every caller to re-derive the engine; the
    discriminated union carries it for free.
- **Source:** canonical here · `SK-DB-011` / `SK-MULTIENG-005` (the
  `/v1/db/connect` shape + the shared `registerByoDb` path) · `SK-DB-012` /
  `SK-MULTIENG-006` (the parsers it composes) · `GLOBAL-035` (the egress guard +
  `createDohResolver`) · `GLOBAL-031` (the seal that runs after it) ·
  `GLOBAL-021` (Postgres + ClickHouse owned by `packages/db/`).
