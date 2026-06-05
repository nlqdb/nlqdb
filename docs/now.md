# Active focus

Five priorities every PR should be moving toward. This file is a
pointer; the decisions live in the linked FEATURE.md / SK / GLOBAL.
If this file disagrees with them, **they win**.

## 1. BIRD + Spider evals → engine north-star

[`quality-eval/FEATURE.md`](./features/quality-eval/FEATURE.md). Phase 2
slices 1–3c shipped. Next: first weekly measurement seeds
`apps/api/src/gate/eval-baseline.ts` so
[`GLOBAL-027`](./decisions/GLOBAL-027-pre-alpha-gate.md)'s
BIRD ≥ 0.65 / Spider ≥ 0.75 thresholds clear and the gate removes
itself. Headline KPI: free-vs-agentic-frontier delta per
[`SK-QUAL-004`](./features/quality-eval/decisions/SK-QUAL-004-free-vs-frontier-delta.md).
**Progress bar** (what's tried / not-tried, every number sourced):
[`progress/quality-score-source-of-truth.md`](./progress/quality-score-source-of-truth.md).
Latest lever: Cerebras (gpt-oss-120b) leads the free planner chain
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
of its callers like `secret-envelope.ts`. Next: `connect.ts` +
`registerByoDb` wiring + the `GLOBAL-003` surface set.

## 4. BYO ClickHouse

[`multi-engine-adapter/FEATURE.md`](./features/multi-engine-adapter/FEATURE.md)
(`SK-MULTIENG-005`). Promoted from Phase 4+ to active. Same
`registerByoDb` path as BYO Postgres (same
[`GLOBAL-031`](./decisions/GLOBAL-031-byo-secret-envelope.md) at-rest
seal); differences: native HTTP (no
Hyperdrive / TCP socket) and `system.columns` introspection.
Validator + OTel + anon posture per
[`SK-MULTIENG-004`](./features/multi-engine-adapter/FEATURE.md#sk-multieng-004).
Managed-Tinybird path from `SK-MULTIENG-002` unaffected.

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
