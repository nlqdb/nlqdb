# nlqdb — Performance & Observability

The "fast" promise made concrete: **SLOs** (§1), the **per-stage latency
budgets** that sum to fit them (§2), the **span / metric / label catalog**
(§3), **instrumentation hookpoints** (§4), **sampling + cost discipline**
for the Grafana Cloud free tier (§5), and **dashboards-as-code** (§6).
Out of scope: architectural rationale ([architecture.md](./architecture.md)),
phased plan ([phase-plan.md](./phase-plan.md)), provisioned infra
([runbook.md](./runbook.md)).

---

## 1. SLOs

| Surface                          | p50      | p99      | Notes                                     |
| :------------------------------- | :------- | :------- | :---------------------------------------- |
| `GET /v1/health`                 | < 5 ms   | < 50 ms  | Pure JSON serialize, no I/O.              |
| `POST /v1/ask` — **cache hit**   | < 200 ms | < 500 ms | Plan in KV, just execute SQL.             |
| `POST /v1/ask` — **cache miss**  | < 1.5 s  | < 3.5 s  | Full LLM plan + execute + (opt) summarize. |
| `POST /v1/run`                   | < 200 ms | < 500 ms | Raw-SQL escape hatch (`GLOBAL-015`) — no LLM, mirrors `/v1/ask` cache-hit budget. |
| `GET /api/auth/callback/github`  | < 200 ms | < 1.0 s  | OAuth code exchange + DB user upsert.     |
| `POST /v1/auth/device`           | < 50 ms  | < 200 ms | DB write only.                            |
| `POST /v1/auth/device/token`     | < 100 ms | < 500 ms | DB read + write + JWT sign.               |
| `POST /v1/auth/refresh`          | < 50 ms  | < 200 ms | KV/DB read + JWT sign.                    |

**Error rate:** < 0.1 % 5xx, rolling 1 h, per route.
**Availability:** 99.5 % through Phase 1 → 99.9 % post-PMF.

A breach of either p50 or p99 over the rolling window is a **release-blocking
regression**: the offending slice gets reverted before the next slice starts.

---

## 2. Latency budgets

Each stage gets a p50 and p99 that sum to the SLO with non-zero headroom;
anything over budget at PR time fails CI (§4: every slice instruments +
asserts its own stage).

### 2.1 `POST /v1/ask` — cache hit

| #  | Stage                                         | p50    | p99    |
| :- | :-------------------------------------------- | :----- | :----- |
| 1  | Edge ingress (warm Worker)                    | 5 ms   | 30 ms  |
| 2  | Auth verify (HMAC-SHA256 on internal JWT)     | 2 ms   | 5 ms   |
| 3  | Rate-limit check (KV read)                    | 5 ms   | 15 ms  |
| 4  | Schema-hash + query-hash compute              | 1 ms   | 5 ms   |
| 5  | Plan-cache lookup (KV read, **hit**)          | 5 ms   | 15 ms  |
| 6  | Neon DB execute (HTTP fetch)                  | 100 ms | 350 ms |
| 7  | Response serialize + edge egress              | 5 ms   | 20 ms  |
|    | **Total**                                     | **123 ms** | **440 ms** |
|    | Headroom vs SLO                               | 77 ms  | 60 ms  |

### 2.2 `POST /v1/ask` — cache miss (worst case: with summarize)

| #  | Stage                                         | p50    | p99    |
| :- | :-------------------------------------------- | :----- | :----- |
| 1  | Edge ingress (warm)                           | 5 ms   | 30 ms  |
| 2  | Auth verify                                   | 2 ms   | 5 ms   |
| 3  | Rate-limit check (KV)                         | 5 ms   | 15 ms  |
| 4  | Schema/query hash                             | 1 ms   | 5 ms   |
| 5  | Plan-cache lookup (KV, **miss**)              | 5 ms   | 15 ms  |
| 6  | LLM **plan** (NL → SQL)                       | 600 ms | 1500 ms |
| 7  | SQL parse + schema-fit validate               | 5 ms   | 20 ms  |
| 8  | Neon DB execute                               | 100 ms | 350 ms |
| 9  | LLM **summarize** (conditional — see below)   | 300 ms | 800 ms |
| 10 | Plan-cache write (KV)                         | 5 ms   | 20 ms  |
| 11 | Response serialize + egress                   | 5 ms   | 20 ms  |
|    | **Total (with summarize)**                    | **1033 ms** | **2780 ms** |
|    | **Total (no summarize)**                      | **733 ms**  | **1980 ms** |
|    | Headroom vs SLO                               | 467 ms / 767 ms | 720 ms / 1520 ms |

Two stages are conditional: the merged `route` call (`ask/route-ask.ts`,
SK-ASK-009) runs only when `dbId` is absent (§2.3); stage 9 (summarize)
only when the row count exceeds the threshold (default 5) or the query is
conversational, so most fact lookups skip it.

### 2.3 `POST /v1/ask` — `dbId` resolution prelude (dbId omitted)

`SK-ASK-009`. One cheap-tier `llm.route` call decides
`{kind, targetDbId, referencedTables}` from goal + dbset + recent-tables
MRU, in parallel with `listDatabasesForTenant`; its short-circuits (0 dbs /
recent-table verb hit / slug match) keep most multi-DB sends off a full LLM
round-trip.

| Path                                                                 | p50    | p99    |
| :------------------------------------------------------------------- | :----- | :----- |
| 0 dbs (deterministic create, no LLM)                                 | 100 ms | 400 ms |
| 1 db (auto-target, no LLM)                                           | 100 ms | 400 ms |
| 2+ dbs, recent-table substring + verb match (no LLM)                 | 100 ms | 400 ms |
| 2+ dbs, full LLM `route` (worst case; one cheap-tier call)           | 115 ms | 445 ms |

Worst case adds 115/445 ms onto §2.2: **1148 ms p50 / 3225 ms p99**
with summarize, **848 / 2425 ms** without — both inside the 1.5 s /
3.5 s SLO (352 / 275 ms p99 headroom). Guardrails: `route` timeout
1500 ms (cheap-tier); the `llm.route` span carries `nlqdb.ask.dbid_resolution`
= the fast-path that won (values owned by SK-ASK-009).

### 2.4 `GET /api/auth/callback/github`

| Stage                                  | p50    | p99    |
| :------------------------------------- | :----- | :----- |
| Edge + auth-state cookie verify        | 5 ms   | 20 ms  |
| GitHub OAuth code exchange (HTTP)      | 80 ms  | 400 ms |
| GitHub user fetch                      | 60 ms  | 300 ms |
| DB upsert user + create session        | 30 ms  | 150 ms |
| Cookie set + 302                       | 5 ms   | 30 ms  |
| **Total**                              | **180 ms** | **900 ms** |

### 2.5 Provider-side latencies (reference numbers)

| Provider                     | Operation         | p50    | p99    | Notes                            |
| :--------------------------- | :---------------- | :----- | :----- | :------------------------------- |
| Cloudflare Workers AI        | route (Llama 8B)  | 80 ms  | 300 ms | Same-region edge — fastest.      |
| Cloudflare Workers AI        | plan              | 500 ms | 1200 ms | Heavier model.                  |
| Gemini 2.0 Flash             | route / plan      | 150 ms / 700 ms | 500 ms / 1800 ms |                     |
| Groq (GPT OSS 20B/120B)      | route / plan      | 100 ms / 400 ms | 400 ms / 1000 ms | Cheap-tier default; 120B is the planner failover. |
| OpenRouter (fallback)        | plan              | 1000 ms| 3000 ms | Multi-provider failover only.    |
| Neon HTTP (us-east-1)        | SELECT (warm)     | 80 ms  | 300 ms | Cold pool can spike to 1 s.      |
| Cloudflare D1 (read, warm)   | SELECT            | 10 ms  | 30 ms  | listDatabasesForTenant prelude.  |
| Cloudflare KV              | get / put         | 5 ms   | 15 ms / 25 ms |                           |

These are budgets, not measurements; §7 governs replacing them with real
values once the dashboards (§6) exist.

---

## 3. Span / metric / label catalog

Canonical names. Every slice MUST use these — no one-off variants.

### 3.1 Span names

| Span                          | Wraps                                          |
| :---------------------------- | :--------------------------------------------- |
| `http.server.request`         | Outermost — already standard OTel.             |
| `nlqdb.auth.verify`           | Internal JWT HMAC verify.                      |
| `nlqdb.ratelimit.check`       | D1 UPSERT for the per-principal rate-limit window. `SK-MCP-009` keys buckets via `principal.ts::rateLimitBucketKey` — sk_live/sk_mcp get one bucket per `api_keys.id`; session/anon/pk_live key by `principal.id`. |
| `nlqdb.ask`                   | Top-level wrapper for `/v1/ask` request.       |
| `nlqdb.cache.plan.lookup`     | KV read for cached plan (label `hit=true/false`). |
| `nlqdb.cache.plan.write`      | KV write of new plan.                          |
| `nlqdb.cache.first_query.{lookup,commit}` | KV read/write of the `user.first_query` emit marker (`ask/orchestrate.ts`); emit-then-commit, both non-fatal (a failed commit re-emits next request). |
| `nlqdb.recent_tables.lookup`  | KV read of principal's recent-tables MRU (`SK-ASK-012`). |
| `nlqdb.recent_tables.touch`   | KV read-merge-write pushing new tables onto the MRU (`SK-ASK-012`); `ctx.waitUntil` on `/v1/ask`, inline on create. |
| `nlqdb.diag.write`            | KV write persisting a swallowed failure's SQLSTATE (`SK-ASK-023`) — KV is the durable channel since previews log nowhere. Swallowed; never blocks the error path. |
| `llm.route`                   | Merged kind + dbId classification (SK-ASK-009). One cheap-tier call per cache-miss / dbId-absent send; replaces the older `llm.classify` + `llm.disambiguate` pair. |
| `llm.plan`                    | NL → SQL generation.                           |
| `llm.summarize`               | Result summarization (conditional).            |
| `llm.schema_infer`            | Hosted db.create — NL → typed `SchemaPlan` (SK-HDC-002, SK-HDC-003). |
| `llm.engine_classify`         | Hosted db.create — goal text → engine pick (SK-DB-010, SK-MULTIENG-002). Parent carries `nlqdb.engine_classify.fallback_reason ∈ {deferred, below_floor, provider_failed, unknown_string}`. |
| `nlqdb.sql.validate`          | SQL parse + schema-fit check.                  |
| `db.query`                    | Neon HTTP execute — standard OTel `db.*`. Attributes: `db.system=postgresql`, `db.operation.name`, `db.statement` (PII-redacted SQL text). |
| `db.transaction`              | One Neon HTTP `transaction([...])` round-trip; no per-statement `db.query` nests under it. Always `db.system=postgresql`; on failure `db.transaction.error_sqlstate` (SK-HDC-017). Emitters: db.create provision batch (SK-HDC-012 — adds `db.transaction.statement_count`, `db.transaction.batch_call=true`) and the ACL retarget (SK-ANON-003 / SK-ASK-024 — adds `nlqdb.anon.adopt.regrant_db_id`; heal stamps `nlqdb.ask.acl_healed` on the request span). |
| `db.query` (Neon keep-warm)   | SK-HDC-014 — every-4-min `SELECT 1` cron ping; discriminator `nlqdb.cron="keep_warm"`. Owner: `db-create/pg-client.ts:keepNeonWarm`. |
| `nlqdb.auth.oauth.callback`   | `/api/auth/callback/{github,google}` flow.     |
| `nlqdb.anon.adopt`            | Better Auth `after`-hook adoption hop (SK-ANON-012): wraps `recordAnonAdoption()` (SK-ANON-003) on magic-link / OAuth callback when `__Secure-anon-bearer` is present. Carries `nlqdb.user.id`, `nlqdb.anon.adopt.outcome ∈ {adopted, replay, invalid_cookie, invalid_token, token_taken, internal}`. Owner: `apps/api/src/auth.ts`. |
| `nlqdb.webhook.stripe`        | Stripe webhook handler.                        |
| `nlqdb.billing.checkout.create` | Stripe Checkout Session create (SK-STRIPE-004). One per `POST /v1/billing/checkout`. Carries `nlqdb.billing.plan`, `nlqdb.user.id`, `nlqdb.billing.checkout_session_id`. |
| `nlqdb.billing.portal.create` | Stripe Billing Portal Session create (SK-STRIPE-008). One per `POST /v1/billing/portal`. Carries `nlqdb.user.id`, `nlqdb.billing.portal_session_id`. |
| `nlqdb.billing.premium.{meter_event,overage_item,reconcile}` | Hosted-premium Stripe calls (SK-PREMIUM-017, GLOBAL-014), all dark until `PREMIUM_METER_LIVE`: `meter_event` = Billing Meter event create (carries `nlqdb.premium.event_id`); `overage_item` = lazy overage subscription-item attach; `reconcile` = daily meter-summary cross-check (carries `nlqdb.premium.reconcile_cross_checked`). ERROR on Stripe failure; best-effort, never breaks `/v1/ask`. |
| `nlqdb.events.emit`           | Product-event sink dispatch (LogSnag + PostHog). Wrapped in `ctx.waitUntil` (off the response path). Server-side only. |
| `nlqdb.events.sink.query_log` | Tinybird `query_log` Data Source write; one per events-batch. Carries `nlqdb.events.{batch_size,rows_written,circuit_open}`, `http.response.status_code` (`SK-EVENTS-009`). |
| `nlqdb.events.sink.posthog` | PostHog `/batch` fan-out; one per events-batch. Carries `nlqdb.events.batch_size`, `http.response.status_code`. Best-effort — ERROR on failure, never affects ack/retry (`SK-EVENTS-013`). |
| `nlqdb.workload_analyser.run` | W5 daily cron parent span. Carries `nlqdb.workload_analyser.{query_log_rows, proposals, reshapes_applied, errors, elapsed_ms}` (`SK-MIGRATE-001`). |
| `nlqdb.workload_analyser.reshape` | One child span per `ReshapeProposal` the cron dispatches. Carries `nlqdb.workload_analyser.{kind, db_id, pipe_pre_existed?, pipe_name?}`. ERROR on a Tinybird create-reject or `schema_hash`-drift rollback (`SK-MIGRATE-004/006`). |
| `db.query` (Tinybird Pipes mgmt) | Per-call span around `createPipe` / `dropPipe` / `getPipe`. Attributes `db.system=other_sql`, `db.operation.name ∈ {PIPE_CREATE, PIPE_DROP, PIPE_GET}`, `db.tinybird.pipe`. Latency on `nlqdb.db.duration_ms{operation}` (`SK-MIGRATE-001`). |
| `dns.resolve`                 | One span per BYO connect-time egress resolve (`GLOBAL-035`); A + AAAA DoH legs nest under it. Attributes `server.address`, `dns.question.name`, `dns.answer.count`; ERROR on fail-loud. Owner: `packages/db/src/doh-resolver.ts`. |
| `nlqdb.mcp.http.request`     | `SK-MCP-009` — every hosted-MCP Worker request before `OAuthProvider` dispatch (`GET /health` skipped). Attributes `http.{request.method,route,response.status_code}`; an `OAuthProvider` error adds `nlqdb.mcp.auth.{error_code,error_status,error_description}` and flips status to ERROR. Owner: `apps/mcp/src/index.ts`. |
| `nlqdb.grants.{mint,list,revoke}` | The `/v1/grants` cross-tenant read-grant control plane (`SK-EKP-008`). Each carries `nlqdb.user.id` plus its own `nlqdb.grants.<verb>.outcome`; mint adds `.db_id`, list adds `.count`, revoke adds `.grant_id` and is fail-closed within the 30 s bound. |
| `nlqdb.pack.import.{create,advance,retry,delete}` | The shared goal-pack import runner (`SK-PIVOT-021`, D-08). One per `/v1/packs/imports*` call. Carries `nlqdb.pack.id`, `nlqdb.pack.import.{id,phase,db_id}` and `nlqdb.pack.import.outcome` (`ok`, `idempotent_replay`, `auth_required`, `db_required`, `source_unavailable`, `rate_limited`, `import_busy`, `phase_failed`, `internal_error`). |
| `nlqdb.pack.source.{fetch,archive}` | A pack adapter's source reads (`GLOBAL-014`): `fetch` = a GitHub REST call (commit pin), `archive` = the codeload `tar.gz`. Carry `server.address`, `http.response.status_code`, `nlqdb.pack.source.{outcome,commit,entries}`. |

### 3.2 Metric names

Counters (suffix `.total`):

- `nlqdb.requests.total{route, status_class}` — every request.
- `nlqdb.cache.plan.hits.total` / `nlqdb.cache.plan.misses.total`.
- `nlqdb.llm.calls.total{provider, operation, status}` — `status ∈ {ok, error, hedge_lost}` (SK-LLM-014 cancelled hedge legs; filter `status="error"` for real failures).
- `nlqdb.llm.failover.total{from_provider, to_provider, reason}` — `reason` includes `hedge_lost` (SK-LLM-014) plus the failure reasons.
- `nlqdb.errors.total{class, route}`.
- `nlqdb.auth.events.total{type, outcome}` — sign-in / refresh / logout.
- `nlqdb.events.sink.query_log.failures.total{status_class}` — Tinybird `query_log` write failures (non-2xx or fetch threw). Trip signal for the events-worker circuit-breaker (`SK-EVENTS-009`).
- `nlqdb.retry.total{stage, reason}` — GLOBAL-022 retries (SK-ASK-013, SK-SDK-008). `stage ∈ {route, plan, exec, sdk}`. Attempts, not requests. Sustained climb = release-blocking.
- `nlqdb.mcp.auth.failures.total{error_code, status}` — `SK-MCP-009` slice 3c. Hosted-MCP `OAuthProvider` error responses from its `onError` callback. `error_code` ∈ workers-oauth-provider 0.6's set (`invalid_request`, `invalid_client`, `invalid_grant`, `invalid_token`, `temporarily_unavailable`, …); `status` is the HTTP code. Distinguishes probe traffic from misconfiguration.
- `nlqdb.premium.cap_hit.total` / `nlqdb.premium.overflow_fallback_events.total` — hosted-premium fall-throughs to the free chain (SK-PREMIUM-006 / SK-PREMIUM-011). No per-customer label; aggregate only.

Histograms (latency in ms — explicit `_ms` suffix):

- `nlqdb.ask.duration_ms{cache_hit, summarized}`.
- `nlqdb.llm.duration_ms{provider, operation}`.
- `nlqdb.db.duration_ms{operation}`.
- `nlqdb.kv.duration_ms{operation}`.

Other histograms (non-latency):

- `nlqdb.events.sink.query_log.batch_size` (unit `rows`) — events written to Tinybird `query_log` per flush. Bounded by the Cloudflare Queue consumer's `max_batch_size` (currently 100).
- `nlqdb.premium.cost_per_query_usd` (unit `usd`) / `nlqdb.premium.tokens_per_query` (unit `token`) `{provider, model, sized}` — hosted-premium per-query COGS + token footprint, the SK-PREMIUM-010 allowance-calibration inputs. Bounded labels only; hosted-premium lane, dark until `PREMIUM_METER_LIVE`.

Gauges:

- `nlqdb.tenants.active{window}` — sampled hourly.
- `nlqdb.recent_tables.entries{principal_kind}` — post-touch MRU length (`SK-ASK-012`).
- `nlqdb.premium.meter_reconcile_drift_usd_cents` — daily internal-ledger vs Stripe drift (SK-PREMIUM-017); cron-set, unlabelled. Per-(customer, period) allowance is D1-sourced, never a gauge label (§3.3 user-grain ban).

### 3.3 Label conventions

Always use these label keys; never invent variants like `tenant`, `tenant-id`, `tenantId`.

| Label                  | Cardinality concern  | Notes                                              |
| :--------------------- | :------------------- | :------------------------------------------------- |
| `nlqdb.tenant_id`      | Bounded by tenant ct | Free tier: keep < 5 k tenants per stack.           |
| `nlqdb.user_id`        | **High** — gated     | Only on auth events; never on per-request metrics. |
| `nlqdb.engine`         | Low (1-3)            | `postgres`, `clickhouse` (Phase 3 via Tinybird).   |
| `nlqdb.cache_hit`      | 2                    | `true` / `false`.                                  |
| `llm.provider`         | Low (4)              | `cf-ai`, `gemini`, `groq`, `openrouter`.           |
| `llm.model`            | Low (~10)            | Provider-specific; pin via env config.             |
| `db.system`            | 2                    | `postgresql` (PG); `other_sql` (ClickHouse via Tinybird). |
| `route`                | Low (~20)            | `/v1/ask`, `/v1/health`, `/v1/auth/*`.             |
| `status_class`         | 5                    | `2xx` / `3xx` / `4xx` / `5xx` / `transport` (NOT raw status). `transport` = fetch-throws (no HTTP status), used by the query_log failures counter (`SK-EVENTS-009`). |
| `principal_kind`       | ~7                   | Principal kind, never an id (`user`/`anon`/`pk_live`/`sk_live`/`sk_mcp`/`session`/`unknown`). On `nlqdb.recent_tables.entries` (`SK-ASK-012`). |
| `nlqdb.surface`        | 5                    | `hero` / `chat` / `embed` / `mcp` / `cli`. Span attr on `nlqdb.ask`, `nlqdb.chat.turn`, `nlqdb.databases.create` + `feature.*` events (`SK-EVENTS-010`); derived once via `surfaceFromPrincipal()`. |
| `status` (on `llm.calls.total`) | 3              | `ok` / `error` / `hedge_lost` (SK-LLM-014, cancelled hedge legs); filter `status="error"` for real failures. |
| `reason` (on `llm.failover.total`) | bounded     | `FailoverReason` set + `hedge_lost` (SK-LLM-014). |
| `nlqdb.cron`            | bounded (~3)        | On `db.query` keep-warm pings (SK-HDC-014); pinned to `wrangler.toml` crons. |
| `sized`                | 3                   | `standard` / `large` / `refused` — hosted-premium cost/token histograms (SK-PREMIUM-010). |
| `nlqdb.llm.hedge_lost`  | 2 (boolean)         | Span-only on `llm.<op>` for a hedge-cancelled leg (SK-LLM-014); `hedge_lost=true`. Not a metric label. |
| `llm.dispatch_lane` / `llm.billed_to` / `llm.byollm_provider` / `llm.byollm_source` / `llm.model_preset` / `llm.byollm_degraded` | 3 / 3 / ~5 / 2 / 3 / 1 | Ask-span only (SK-LLM-020, GLOBAL-026): lane `free`/`byollm`/`premium`; billed-to `platform`/`byollm`/`metered`; byollm slug (not the model); source `header`/`account` (SK-PREMIUM-012); preset `auto`/`fast`/`best`, stamped only when the request sent one (SK-PREMIUM-014 §6 demand signal); `byollm_degraded=gateway_unconfigured` stamped only when the ambient account lane fell back to the free chain because AI Gateway is unset (SK-LLM-021). Not metric labels. |

**Cardinality rule:** total combined series < 8 k (Grafana Cloud free-tier
ceiling 10 k, 2 k headroom). The bounds above are designed to fit; any new
label must be added here AND get a CI cardinality assertion.

---

## 4. Instrumentation requirement (standing rule)

Every new slice — route, LLM provider, engine, or event sink — MUST ship,
in the same PR:

1. Its spans + metrics, named per the §3 catalog (no one-off variants).
2. A **vitest assertion** (OTel in-memory exporter) that each new
   span/metric is emitted. Missing instrumentation fails CI.
3. A **budget assertion** in the same test — if measured p50 exceeds
   1.5× the §2 budget, fail.

---

## 5. Sampling + cost discipline

Grafana Cloud free-tier ceilings (2026-04): metrics 10 k active series;
logs 50 GB/mo; traces 50 GB/mo. Sampling rules to stay well under:

| Path                                | Trace sample rate |
| :---------------------------------- | :---------------- |
| `/v1/health`                        | 0 % (never)       |
| `/v1/ask` cache hit                 | 1 %               |
| `/v1/ask` cache miss                | 100 %             |
| `/v1/auth/*`                        | 100 %             |
| Any request returning 5xx           | 100 % (override sampler) |
| Any request returning 4xx           | 10 %              |
| Stripe webhook                      | 100 %             |

**Metrics:** 60 s resolution; histograms use 8 buckets (0.005, 0.025, 0.1,
0.25, 0.5, 1, 2.5, 5 s) — enough for p50/p95/p99, cheap on series count.
**Logs:** errors at INFO+; else DEBUG only when `NLQDB_LOG_LEVEL=debug`
(off in prod). Never log secrets, query contents, or PII (tenant_id only).
At 80 % of any ceiling the §6 alert fires; we raise thresholds or split
stacks before paying.

---

## 6. Dashboards-as-code

Deferred until Phase 1 traffic warrants a tuned view (tracked in
`features/observability/FEATURE.md`); spans + metrics already export via
OTLP. When they land: JSON in `ops/grafana/dashboards/`, provisioned from
CI on merge to `main` (UI edits lose to the next CI run). Alerts land
alongside: SLO p99 over budget 5 min or error rate > 0.5 % for 10 min →
page; LLM failover > 5 %/1 h, Grafana series > 8 k, or KV/D1/R2 usage
> 80 % → ticket.

---

## 7. How this doc evolves

- **Budget changes** require a PR stating the measurement that motivated it.
- **New routes** add a row to §1 (SLO) + §2 (budget) + §4 (hooks), same PR.
- **New providers / engines** add to §2.5 + §3.3; backfill measurements within a week.
- **New metrics / labels** require a cardinality estimate in the PR; the CI cardinality assertion catches the rest.
