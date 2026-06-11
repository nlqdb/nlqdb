# Active focus

Five priorities every PR should be moving toward. This file is a
pointer; the decisions live in the linked FEATURE.md / SK / GLOBAL.
If this file disagrees with them, **they win**.

## 1. BIRD + Spider evals → engine north-star

[`quality-eval/FEATURE.md`](./features/quality-eval/FEATURE.md). Phase 2
slices 1–3c shipped. Next: a first manual eval run seeds
`apps/api/src/gate/eval-baseline.ts` so
[`GLOBAL-027`](./decisions/GLOBAL-027-pre-alpha-gate.md)'s
BIRD ≥ 0.65 / Spider ≥ 0.75 thresholds clear and the gate removes
itself. Headline KPI: free-vs-agentic-frontier delta per
[`SK-QUAL-004`](./features/quality-eval/decisions/SK-QUAL-004-free-vs-frontier-delta.md).
**Progress bar** (what's tried / not-tried, every number sourced):
[`progress/quality-score-source-of-truth.md`](./progress/quality-score-source-of-truth.md).
Latest levers: BIRD scorer parity — positional value tuples so output
aliases/casing no longer false-mismatch correct values, matching canonical
`evaluation.py`
([`SK-QUAL-010`](./features/quality-eval/decisions/SK-QUAL-010-bird-positional-tuple-parity.md)),
on top of result-shape planner directives — exact projection +
REAL-cast ratios
([`SK-LLM-027`](./features/llm-router/decisions/SK-LLM-027-result-shape-directives.md)),
on top of static few-shot exemplars in the planner prompt
([`SK-LLM-026`](./features/llm-router/decisions/SK-LLM-026-static-few-shot-plan-exemplars.md),
DAIL-SQL) and free-chain planner robustness — greedy-decoding
parity on the Workers AI leg
([`SK-LLM-024`](./features/llm-router/decisions/SK-LLM-024-greedy-decoding-parity.md))
+ a JSON-recovery fallback for the `gpt-oss-120b` reasoning head's
preamble leaks
([`SK-LLM-025`](./features/llm-router/decisions/SK-LLM-025-json-recovery-fallback.md)),
and the Cerebras head
([`SK-LLM-023`](./features/llm-router/decisions/SK-LLM-023-cerebras-planner-tier.md)).

## 2. BYOLLM (every tier, 0% markup)

[`premium-tier/FEATURE.md`](./features/premium-tier/FEATURE.md)
(`SK-PREMIUM-008`) +
[`llm-router/FEATURE.md`](./features/llm-router/FEATURE.md)
(`SK-LLM-016`). Resolved by
[`GLOBAL-026`](./decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md);
no payment infra required. Landed in `packages/llm`: the provider factory
([`SK-LLM-019`](./features/llm-router/decisions/SK-LLM-019-byollm-provider-factory.md))
— `createByollmProvider` proxies the user's own key through AI Gateway's
unified endpoint and resolves the `BYOLLM_<user_id>` namespace to a
per-tenant `cf-aig-cache-key` — plus the lane selector
([`SK-LLM-020`](./features/llm-router/decisions/SK-LLM-020-byollm-lane-selector.md)):
`selectDispatchLane` (the single source of truth for the
header→account→premium→free precedence), `buildByollmRouter` (single-provider
lane router, no free-chain failover, fail-loud per
[`GLOBAL-012`](./decisions/GLOBAL-012-one-sentence-errors.md)), and the
redacted `llm.dispatch_lane` span attributes. The per-request
`x-nlq-byollm-key` header lane is now wired on the HTTP `/v1/ask` surface
([`SK-LLM-021`](./features/llm-router/decisions/SK-LLM-021-byollm-header-wiring.md)):
`apps/api/src/ask/byollm.ts` parses the `<provider>:<model>:<key>` value,
gates it signed-in-only (fail-loud per
[`GLOBAL-012`](./decisions/GLOBAL-012-one-sentence-errors.md)), and
`resolveAskRouter` swaps in `buildByollmRouter` (accepting the AI Gateway
compat slugs `openai` / `anthropic` / `google-ai-studio`). The TypeScript
SDK ([`SK-SDK-010`](./features/sdk/FEATURE.md)) and the `nlq` CLI
(`nlq byollm set|status|clear`,
[`SK-CLI-016`](./features/cli/decisions/SK-CLI-016-byollm-keychain.md)) now
set that header (signed-in only). The at-rest primitive the account-stored
lane was blocked on has landed:
[`GLOBAL-031`](./decisions/GLOBAL-031-byo-secret-envelope.md)'s
`apps/api/src/secret-envelope.ts` — one AES-256-GCM envelope + one
Workers-held KEK (`BYO_SECRET_KEK`), AAD-bound per owner — is the shared
seal for both BYOLLM keys and BYO Postgres/ClickHouse URLs. The
account-stored lane now rides it
([`SK-PREMIUM-012`](./features/premium-tier/decisions/SK-PREMIUM-012-account-stored-byollm-storage.md)):
an `api_keys` `scope = "byollm"` row (sealed envelope in `key_hash`, context
`byollm:<tenantId>`, one per account), session-only
`POST/GET/DELETE /v1/keys/byollm`, and the `/v1/ask` step-2 resolution
(`resolveAskRouter`'s `accountCredential`, fail-loud on an unopenable blob;
`llm.byollm_source ∈ {header, account}`). The TypeScript SDK now wraps that
account lane
([`SK-SDK-011`](./features/sdk/FEATURE.md)): `setByollm` / `getByollmStatus`
/ `clearByollm` (signed-in only; key write-only).
Next: premium-eligibility, and the remaining `GLOBAL-003` surface parity
(MCP `byollm` param, CLI account-store verbs, elements + `/app/keys`) —
tracked in [`premium-tier/FEATURE.md`](./features/premium-tier/FEATURE.md)
Open questions per
[`GLOBAL-003`](./decisions/GLOBAL-003-all-surfaces-one-pr.md).

## 3. BYO Postgres

[`db-adapter/FEATURE.md`](./features/db-adapter/FEATURE.md)
(`SK-DB-011`). Promoted from Phase 4+ to active. Shape locked in
[`architecture.md §3.6.7`](./architecture.md#367-byo-postgres-phase-4-decided-shape):
`POST /v1/db/connect`, `provisionDb` vs `registerByoDb` split,
AES-GCM blob with Workers-held KEK (now the shared
[`GLOBAL-031`](./decisions/GLOBAL-031-byo-secret-envelope.md)
`secret-envelope.ts` seal, context `dbconn:<dbId>`), validator from
`sql-allowlist` applies unchanged. All surfaces in one PR per `GLOBAL-003`.
[`phase-plan.md §7`](./phase-plan.md) marks it promoted; shape per
§3.6.7 unchanged. First connect-path primitive landed:
`packages/db/src/connection-url.ts`
([`SK-DB-012`](./features/db-adapter/decisions/SK-DB-012-byo-connection-url-handling.md))
— `parseConnectionUrl` validates the `connection_url` at the wire boundary
(fail-loud per [`GLOBAL-012`](./decisions/GLOBAL-012-one-sentence-errors.md))
and yields the password/query-stripped redacted display that is the only
form allowed on a span/log/UI; the full URL still rides the `GLOBAL-031`
seal. Pure, zero-dep, owned by `packages/db` per `GLOBAL-021`, shipped ahead
of its callers like `secret-envelope.ts`. The shared connect-time SSRF
egress guard now also landed:
[`GLOBAL-035`](./decisions/GLOBAL-035-byo-egress-guard.md)'s
`packages/db/src/egress-guard.ts` — `guardEgressHost` rejects a literal
private/loopback/link-local/metadata host (incl. the IPv4-mapped/6to4/NAT64
IPv6 forms + decimal/hex/octal encodings, fail-loud per
[`GLOBAL-012`](./decisions/GLOBAL-012-one-sentence-errors.md)) and flags a
DNS name for the connect-time resolve-then-recheck a pure parser can't do.
That recheck's pure composition now also landed — `guardEgressHostResolved`
re-guards each address an injected DoH resolver returns, failing closed
([`GLOBAL-035`](./decisions/GLOBAL-035-byo-egress-guard.md)) — and so has the
production resolver it consumes: `packages/db/src/doh-resolver.ts`'s
`createDohResolver`, a Cloudflare 1.1.1.1 DoH JSON lookup (A + AAAA in
parallel, bare-IP answers only, `AbortController`-bounded, fail-loud, one
`dns.resolve` span). The composition that wires those primitives into one
connect-time entry point now also landed:
[`SK-DB-013`](./features/db-adapter/decisions/SK-DB-013-byo-connect-validation-pipeline.md)'s
`packages/db/src/byo-connect.ts` — `validateByoConnection(engine, rawUrl, resolve)`
parses the URL (`SK-DB-012`) then runs `guardEgressHostResolved` on the parsed
host in a load-bearing parse-before-resolve order, the DoH resolver injected,
returning the engine-tagged parsed connection or a fail-loud message
([`GLOBAL-012`](./decisions/GLOBAL-012-one-sentence-errors.md)) that never echoes
the secret; it stops at validation (no seal, no D1), staying pure + zero-dep and
shared with BYO ClickHouse. The connect-time read of the user's *existing* schema
now also landed:
[`SK-DB-014`](./features/db-adapter/decisions/SK-DB-014-byo-postgres-introspection.md)'s
`packages/db/src/introspect-postgres.ts` — `introspectPostgres(query, schema)`
turns a live BYO schema into a faithful read-model (columns ordered by
`attnum` + `format_type` types + nullability, ordered primary/foreign keys) via
three fixed `pg_catalog` queries (never one-per-table; composite keys stay
ordinal-aligned via `unnest`, the schema always bound as `$1`), all under one
`db.introspect` span ([`GLOBAL-014`](./decisions/GLOBAL-014-otel-on-external-calls.md))
and fail-loud ([`GLOBAL-012`](./decisions/GLOBAL-012-one-sentence-errors.md)) on a
query error so the caller never seals a half-read schema. It reads through the
injected `SK-DB-006` query seam, shipped ahead of its `registerByoDb` caller.
Next: `connect.ts` + `registerByoDb` wiring (validate via `validateByoConnection`
with `createDohResolver()` → open → `introspectPostgres` → render
`schema_text`/`schema_hash` → seal per `GLOBAL-031`) + the `GLOBAL-003` surface
set.

## 4. BYO ClickHouse

[`multi-engine-adapter/FEATURE.md`](./features/multi-engine-adapter/FEATURE.md)
(`SK-MULTIENG-005`). Promoted from Phase 4+ to active. Same
`registerByoDb` path as BYO Postgres (same
[`GLOBAL-031`](./decisions/GLOBAL-031-byo-secret-envelope.md) at-rest
seal); differences: native HTTP (no
Hyperdrive / TCP socket) and `system.columns` introspection.
Validator + OTel + anon posture per
[`SK-MULTIENG-004`](./features/multi-engine-adapter/FEATURE.md#sk-multieng-004).
Managed-Tinybird path from `SK-MULTIENG-002` unaffected. First connect-path
primitive landed: `packages/db/src/clickhouse-connection-url.ts`
([`SK-MULTIENG-006`](./features/multi-engine-adapter/decisions/SK-MULTIENG-006-byo-clickhouse-connection-url.md))
— `parseClickhouseUrl` validates the HTTP-interface `connection_url` at the
wire boundary (fail-loud per
[`GLOBAL-012`](./decisions/GLOBAL-012-one-sentence-errors.md); a ClickHouse
client DSN scheme — `clickhouse://` … — or a database-in-the-path paste is
rejected with a pointer to the plain HTTP endpoint) and yields a redacted
display **rebuilt from an allowlist of safe parts** — so the password
(userinfo *or* `?password=` query param per the ClickHouse HTTP docs) and every
other query setting are structurally absent; the full URL rides the
`GLOBAL-031` seal. The deliberate ClickHouse parallel of `SK-DB-012` (the
`SK-DB-002` parallel-adapter pattern), pure, zero-dep, owned by `packages/db`
per `GLOBAL-021`, shipped ahead of its `connect.ts` / `introspect-clickhouse.ts`
callers. The connect-time SSRF egress guard's deterministic half landed as the
shared [`GLOBAL-035`](./decisions/GLOBAL-035-byo-egress-guard.md)
`packages/db/src/egress-guard.ts` (BYO ClickHouse needs it most — the
Worker `fetch()`es the user host directly, no Hyperdrive proxy), and its async
sibling `guardEgressHostResolved` now lands the DNS resolve-then-recheck a
pure parser can't do — re-guarding each address an injected DoH resolver
returns, failing closed (narrowing, not closing, the rebind window). The
production resolver that injection needs now landed too —
`packages/db/src/doh-resolver.ts`'s `createDohResolver` (shared with BYO
Postgres; Cloudflare 1.1.1.1 DoH JSON, A + AAAA, bare-IP answers only,
fail-loud). The shared connect-time composition
([`SK-DB-013`](./features/db-adapter/decisions/SK-DB-013-byo-connect-validation-pipeline.md)'s
`validateByoConnection`, `packages/db/src/byo-connect.ts`) wires parse →
`guardEgressHostResolved` into one entry point and takes an `engine:
"clickhouse"` branch, so this path reuses it rather than re-assembling the
ordering. The connect-time read of the user's *existing* schema now also landed —
the deliberate ClickHouse parallel of Postgres `SK-DB-014`:
[`SK-MULTIENG-007`](./features/multi-engine-adapter/decisions/SK-MULTIENG-007-byo-clickhouse-introspection.md)'s
`packages/db/src/introspect-clickhouse.ts` — `introspectClickhouse(query, database)`
reads a live BYO schema into a faithful read-model via two fixed `system.*`
queries (`system.tables` for the authoritative table list + effective
`primary_key` *expression*, `system.columns` for verbatim column types), run
concurrently, never one-per-table. Not a generalisation of the PG reader:
ClickHouse has no foreign keys (none in the model), its primary key is an
expression surfaced verbatim (never reconstructed from a column-order guess), and
nullability lives in the type — derived from the *outermost* wrapper so
`LowCardinality(Nullable(String))` is nullable but `Array(Nullable(String))`
stays non-nullable. Views / materialized views / temp tables are excluded in SQL
so none leaks back as a table. One `db.introspect` span (`db.system=other_sql`
per [`SK-MULTIENG-004`](./features/multi-engine-adapter/FEATURE.md#sk-multieng-004),
[`GLOBAL-014`](./decisions/GLOBAL-014-otel-on-external-calls.md)), fail-loud
([`GLOBAL-012`](./decisions/GLOBAL-012-one-sentence-errors.md)) on a query error
so the caller never seals a half-read schema. It reads through an injected
`ClickhouseQueryFn` seam (the parallel of `SK-DB-006`'s), shipped ahead of its
`clickhouse-byo.ts` / `registerByoDb` callers. Next: the `clickhouse-byo.ts`
adapter + the `registerByoDb` ClickHouse branch (validate via
`validateByoConnection` with `createDohResolver()` → open → `introspectClickhouse`
→ render `schema_text`/`schema_hash` → seal per `GLOBAL-031`) + the `GLOBAL-003`
surface set; the residual TOCTOU backstop stays open per `GLOBAL-035`.

## 5. BYO OTel collectors

[`byo-otel/FEATURE.md`](./features/byo-otel/FEATURE.md)
(`SK-BYOTEL-001`). Direction pinned to **egress** —
per-tenant configurable OTLP exporter destination so nlqdb's
emitted telemetry (per
[`observability/FEATURE.md`](./features/observability/FEATURE.md))
ships to your Grafana / Honeycomb / Datadog / self-hosted collector.
Fits [`GLOBAL-019`](./decisions/GLOBAL-019-apache2-open-source-core.md).
Ingress (the [`otel-grafana-pivot`](./research/otel-grafana-pivot.md))
is a separate strategic pivot, not this feature. Next: slice 1
resolves config unit + dual-emit + sampling + KEK envelope.

---

Reference (load on demand, not by default):
[`architecture.md`](./architecture.md) ·
[`runbook.md`](./runbook.md) ·
[`phase-plan.md`](./phase-plan.md) ·
[`founder-playbook.md`](./founder-playbook.md) ·
[`competitors.md`](./competitors.md) ·
[`research/`](./research/) ·
[`history/`](./history/).
