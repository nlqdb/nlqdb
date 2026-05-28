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

## 2. BYOLLM (every tier, 0% markup)

[`premium-tier/FEATURE.md`](./features/premium-tier/FEATURE.md)
(`SK-PREMIUM-008`) +
[`llm-router/FEATURE.md`](./features/llm-router/FEATURE.md)
(`SK-LLM-016`). Resolved by
[`GLOBAL-026`](./decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md);
no payment infra required. Next: ship the dispatch slice end-to-end —
`api_keys.scope = "byollm"`, per-request `x-nlq-byollm-key` header,
AI-Gateway `BYOLLM_<user_id>` namespace, fail-loud per
[`GLOBAL-012`](./decisions/GLOBAL-012-one-sentence-errors.md). All
surfaces (HTTP / SDK / CLI / MCP / elements) in one PR per
[`GLOBAL-003`](./decisions/GLOBAL-003-all-surfaces-one-pr.md).

## 3. BYO Postgres

[`db-adapter/FEATURE.md`](./features/db-adapter/FEATURE.md)
(`SK-DB-011`). Promoted from Phase 4+ to active. Shape locked in
[`architecture.md §3.6.7`](./architecture.md#367-byo-postgres-phase-4-decided-shape):
`POST /v1/db/connect`, `provisionDb` vs `registerByoDb` split,
AES-GCM blob with Workers-held KEK, validator from `sql-allowlist`
applies unchanged. All surfaces in one PR per `GLOBAL-003`.
[`phase-plan.md §7`](./phase-plan.md) still lists this under Phase 4+;
bring that into sync in the same PR that lands the work.

## 4. BYO ClickHouse

[`multi-engine-adapter/FEATURE.md`](./features/multi-engine-adapter/FEATURE.md)
(`SK-MULTIENG-005`). Promoted from Phase 4+ to active. Same
`registerByoDb` path as BYO Postgres; differences: native HTTP (no
Hyperdrive / TCP socket) and `system.columns` introspection.
Validator + OTel + anon posture per
[`SK-MULTIENG-004`](./features/multi-engine-adapter/FEATURE.md#sk-multieng-004).
Managed-Tinybird path from `SK-MULTIENG-002` unaffected.

## 5. BYO OTel collectors

[`byo-otel/FEATURE.md`](./features/byo-otel/FEATURE.md) — planned
stub. **Direction unresolved (P4 / D1 / D2 — don't write code until
this is answered):** is this (a) user-configurable OTLP exporter
destination so nlqdb's emitted telemetry goes to *your* Grafana /
Honeycomb / Datadog / self-hosted collector — small, additive, fits
[`GLOBAL-019`](./decisions/GLOBAL-019-apache2-open-source-core.md); or
(b) nlqdb ingests user telemetry — the
[`otel-grafana-pivot`](./research/otel-grafana-pivot.md) strategic
pivot. Two different products. Resolve before code lands.

---

Reference (load on demand, not by default):
[`architecture.md`](./architecture.md) ·
[`runbook.md`](./runbook.md) ·
[`phase-plan.md`](./phase-plan.md) ·
[`founder-playbook.md`](./founder-playbook.md) ·
[`competitors.md`](./competitors.md) ·
[`research/`](./research/) ·
[`history/`](./history/).
