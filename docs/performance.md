# nlqdb — Performance & Observability

The "fast" promise made concrete. This doc pins:

1. **SLOs** we promise to users (§1).
2. **Per-stage latency budgets** that sum to fit the SLOs (§2).
3. **Span / metric / label catalog** so dashboards aren't a snowflake of one-off names (§3).
4. **Slice-by-slice instrumentation hookpoints** so each upcoming PR ships with the right OTel calls (§4).
5. **Sampling + cost discipline** for the Grafana Cloud free tier (§5).
6. **Dashboards-as-code** layout (§6).

Not in scope: architectural rationale (see [./architecture.md](./architecture.md)),
phased plan (see [./phase-plan.md](./phase-plan.md)), current
state of provisioned infra (see [./runbook.md](./runbook.md)).

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

Each stage gets a per-stage p50 and p99. Stages sum to the SLO with
non-zero headroom. Anything that goes over budget at PR time fails CI
(see §4: every slice instruments + asserts its own stage).

### 2.1 `POST /v1/ask` — cache hit

The hot path. Plan exists in KV; we just look it up, execute SQL, return.

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

The cold path. LLM dominates; everything else has to stay tight.

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

The merged `route` LLM call (`apps/api/src/ask/route-ask.ts`,
SK-ASK-009) runs **only** when `dbId` is absent — see §2.3 for that
prelude. Pinned-dbId calls skip it entirely.

**Summarize is conditional** — only runs when the result row count is
above a threshold (default 5) or when the route classifier flagged
the query as conversational. Most fact-lookup queries return raw rows
and skip stage 10 entirely.

### 2.3 `POST /v1/ask` — `dbId` resolution prelude (dbId omitted)

`SK-ASK-009`. Runs **only** when the request omits `dbId`. One merged
`routeAsk` call (cheap-tier `llm.route` op) decides
`{kind, targetDbId, referencedTables}` from the goal + dbset +
recent-tables MRU. `routeAsk` runs in parallel with
`listDatabasesForTenant`; its own short-circuits (0 dbs /
recent-table verb hit / slug match) keep most multi-DB sends off a
full LLM round-trip.

| Path                                                                 | p50    | p99    |
| :------------------------------------------------------------------- | :----- | :----- |
| 0 dbs (deterministic create, no LLM)                                 | 100 ms | 400 ms |
| 1 db (auto-target, no LLM)                                           | 100 ms | 400 ms |
| 2+ dbs, recent-table substring + verb match (no LLM)                 | 100 ms | 400 ms |
| 2+ dbs, full LLM `route` (worst case; one cheap-tier call)           | 115 ms | 445 ms |

The merged `route` call replaces yesterday's two cheap-tier calls
(`classify` + `disambiguate`) with one — halving the LLM round-trips
on the dbId-absent path. Worst case adds 115/445 ms onto the §2.2
cache-miss budget: **1148 ms p50 / 3225 ms p99** with summarize,
**848 ms p50 / 2425 ms p99** without — both inside the 1.5s / 3.5s
SLO with 352 / 275 ms p99 headroom on the worst path.

Operational guardrails:
- `route` timeout 1500 ms (cheap-tier, `DEFAULT_TIMEOUTS_MS`).
- Span `llm.route` per LLM attempt; `nlqdb.ask.dbid_resolution`
  attribute records which fast-path won (`slug_fastpath` /
  `recent_table_fastpath` / `single_db_auto` / `llm_auto_target` /
  `ambiguous_409` / `zero_dbs_create_fallback`).
- Recent-tables MRU per principal (SK-ASK-012 / WS1) caps at 100
  entries; `routeAsk` projects `(dbId, table)` into the prompt.

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
| Gemini 2.0 Flash             | route             | 150 ms | 500 ms |                                  |
| Gemini 2.0 Flash             | plan              | 700 ms | 1800 ms |                                  |
| Groq (Llama 3.1 8B Instant)  | route / engine_classify | 100 ms | 400 ms | Cheap-tier hot path; chain default. |
| Groq (Llama 3.1 70B)         | plan              | 400 ms | 1000 ms | Fastest paid.                    |
| OpenRouter (fallback)        | plan              | 1000 ms| 3000 ms | Used only on multi-provider failover. |
| Neon HTTP (us-east-1)        | SELECT (warm)     | 80 ms  | 300 ms | Cold pool can spike to 1 s.      |
| Cloudflare D1 (read, warm)   | SELECT            | 10 ms  | 30 ms  | listDatabasesForTenant prelude.  |
| Cloudflare KV (read, hot)    | get               | 5 ms   | 15 ms  |                                  |
| Cloudflare KV (write)        | put               | 5 ms   | 25 ms  |                                  |

These are *measured-then-budgeted* numbers — when a slice lands its
instrumentation, the dashboards (§6) will show actual p50/p99 per
provider, and §2.5 gets updated with real values.

---

## 3. Span / metric / label catalog

Canonical names. Every slice MUST use these — no one-off variants.

### 3.1 Span names

| Span                          | Wraps                                          |
| :---------------------------- | :--------------------------------------------- |
| `http.server.request`         | Outermost — already standard OTel.             |
| `nlqdb.auth.verify`           | Internal JWT HMAC verify.                      |
| `nlqdb.ratelimit.check`       | D1 UPSERT for the per-principal rate-limit window. `SK-MCP-009` slice 3c keys buckets via `apps/api/src/principal.ts::rateLimitBucketKey` — sk_live and sk_mcp principals get one bucket per `api_keys.id` (no per-prefix special-casing); sessions, anon, and pk_live continue to key by `principal.id`. |
| `nlqdb.ask`                   | Top-level wrapper for `/v1/ask` request.       |
| `nlqdb.ask.hash`              | Schema-hash + query-hash compute.              |
| `nlqdb.cache.plan.lookup`     | KV read for cached plan (label `hit=true/false`). |
| `nlqdb.cache.plan.write`      | KV write of new plan.                          |
| `nlqdb.recent_tables.lookup`  | KV read of principal's recent-tables MRU (`SK-ASK-012`). |
| `nlqdb.recent_tables.touch`   | KV read-merge-write to push new tables onto the MRU (`SK-ASK-012`). `ctx.waitUntil` on `/v1/ask`; awaited inline on create. |
| `llm.route`                   | Merged kind + dbId classification (SK-ASK-009). One cheap-tier call per cache-miss / dbId-absent send; replaces the older `llm.classify` + `llm.disambiguate` pair. |
| `llm.plan`                    | NL → SQL generation.                           |
| `llm.summarize`               | Result summarization (conditional).            |
| `llm.schema_infer`            | Hosted db.create — NL → typed `SchemaPlan` (SK-HDC-002, SK-HDC-003). |
| `llm.engine_classify`         | Hosted db.create — goal text → engine pick (SK-DB-010, SK-MULTIENG-002). Parent carries `nlqdb.engine_classify.fallback_reason ∈ {deferred, below_floor, provider_failed, unknown_string}` (absent when LLM pick was used). |
| `nlqdb.sql.validate`          | SQL parse + schema-fit check.                  |
| `db.query`                    | Neon HTTP execute — standard OTel `db.*`. Attributes: `db.system=postgresql`, `db.operation.name`, `db.statement` (PII-redacted SQL text). |
| `db.transaction`              | One span around the db.create provisioner's batched DDL + RLS + sample-row apply (`apps/api/src/db-create/neon-provision.ts`). SK-HDC-012 — wraps a single Neon HTTP `transaction([...])` round-trip (one server-side `BEGIN/COMMIT`), no per-statement `db.query` spans nest under it on the happy path. Carries `db.system=postgresql`, `db.transaction.statement_count`, `db.transaction.batch_call=true`. Latency expectation collapses from N×RTT to 1×RTT. |
| `db.query` (Neon keep-warm)   | SK-HDC-014 — `SELECT 1` from the every-4-minutes Neon keep-warm cron. Carries `db.system=postgresql`, `db.operation=SELECT`, `db.statement="SELECT 1"`, and the discriminator `nlqdb.cron="keep_warm"` so dashboards can split keep-warm pings from user queries on the same `db.query` chart. Lives in `apps/api/src/db-create/build-deps.ts:keepNeonWarm`. |
| `nlqdb.auth.oauth.callback`   | `/api/auth/callback/{github,google}` flow.     |
| `nlqdb.anon.adopt`            | Better Auth `after` middleware adoption hop (SK-ANON-012). Wraps `recordAnonAdoption()` (the SK-ANON-003 D1 row-update) on successful magic-link verify / OAuth callback when a `__Secure-anon-bearer` cookie is present. Carries `nlqdb.user.id`, `nlqdb.anon.adopt.outcome ∈ {adopted, replay, invalid_cookie, invalid_token, token_taken, internal}`. Owner: `apps/api/src/auth.ts` after-hook. |
| `nlqdb.webhook.stripe`        | Stripe webhook handler.                        |
| `nlqdb.events.emit`           | Product-event sink dispatch (LogSnag; PostHog optional Phase 2). Wrapped in `ctx.waitUntil` so it runs after the response — zero user-facing latency. Server-side only. |
| `nlqdb.events.sink.query_log` | Tinybird `query_log` Data Source write. One per consumed events-batch. Carries `nlqdb.events.batch_size`, `http.response.status_code`, `nlqdb.events.rows_written`, `nlqdb.events.circuit_open`. Owner: `apps/events-worker/src/sinks/query-log.ts` calling `@nlqdb/db/clickhouse-tinybird/query-log.ts` (`SK-EVENTS-009`). |
| `nlqdb.workload_analyser.run` | W5 daily cron parent span. Carries `nlqdb.workload_analyser.{query_log_rows, proposals, reshapes_applied, errors, elapsed_ms}`. One per `scheduled()` invocation. Owner: `apps/api/src/workload-analyser/cron.ts` (`SK-MIGRATE-001`). |
| `nlqdb.workload_analyser.reshape` | One child span per `ReshapeProposal` the cron dispatches. Carries `nlqdb.workload_analyser.{kind, db_id, pipe_pre_existed?, pipe_name?}`. ERROR status when the Tinybird API rejects the create or `schema_hash` drift forces a rollback (`SK-MIGRATE-004`/`SK-MIGRATE-006`). |
| `db.query` (Tinybird Pipes mgmt) | Per-call span around `createPipe` / `dropPipe` / `getPipe`. Attributes `db.system=other_sql`, `db.operation.name ∈ {PIPE_CREATE, PIPE_DROP, PIPE_GET}`, `db.tinybird.pipe`. Latency on `nlqdb.db.duration_ms{operation}` alongside `PIPE_CALL` / `EVENTS_WRITE`. Owner: `packages/db/src/clickhouse-tinybird/pipe-management.ts` (`SK-MIGRATE-001`). |
| `nlqdb.mcp.http.request`     | `SK-MCP-009` slice 3c — wraps every hosted-MCP Worker request before `OAuthProvider` dispatches (skipped on `GET /health` so route-monitor pings don't add trace volume). Attributes: `http.request.method`, `http.route`, `http.response.status_code`. On `OAuthProvider` error responses `onError` decorates the active span with `nlqdb.mcp.auth.error_code`, `nlqdb.mcp.auth.error_status`, `nlqdb.mcp.auth.error_description` and flips its status to ERROR — so trace queries filtering on `span.status=ERROR` surface auth failures alongside 5xx. Owner: `apps/mcp/src/index.ts`. |

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
- `nlqdb.gate.checks.total{outcome, bypass_reason, principal_kind}` — SK-GATE-008 pre-alpha-gate funnel (label values in §3.3).
- `nlqdb.mcp.auth.failures.total{error_code, status}` — `SK-MCP-009` slice 3c. Hosted-MCP `OAuthProvider` error responses from its `onError` callback. `error_code` ∈ workers-oauth-provider 0.6's set (`invalid_request`, `invalid_client`, `invalid_grant`, `invalid_token`, `temporarily_unavailable`, …); `status` is the HTTP code. Distinguishes probe traffic from misconfiguration.

Histograms (latency in ms — explicit `_ms` suffix):

- `nlqdb.ask.duration_ms{cache_hit, summarized}`.
- `nlqdb.llm.duration_ms{provider, operation}`.
- `nlqdb.db.duration_ms{operation}`.
- `nlqdb.kv.duration_ms{operation}`.

Other histograms (non-latency):

- `nlqdb.events.sink.query_log.batch_size` (unit `rows`) — events written to Tinybird `query_log` per flush. Bounded by the Cloudflare Queue consumer's `max_batch_size` (currently 100).

Gauges:

- `nlqdb.tenants.active{window}` — sampled hourly.
- `nlqdb.recent_tables.entries{principal_kind}` — post-touch MRU length (`SK-ASK-012`).

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
| `principal_kind`       | ~7                   | Principal kind, never an id (`user`/`anon`/`pk_live`/`sk_live`/`sk_mcp`/`session`/`unknown`). On `nlqdb.recent_tables.entries` (`SK-ASK-012`) + `nlqdb.gate.checks.total` (`SK-GATE-008`). |
| `outcome` / `bypass_reason` | 2 / 6           | On `nlqdb.gate.checks.total` (`SK-GATE-008`): `{pass,block}` / `{env_bypass,open,allowlist,invite_code,invite_invalid,none}`. |
| `nlqdb.surface`        | 5                    | `hero` / `chat` / `embed` / `mcp` / `cli`. Span attr on `nlqdb.ask`, `nlqdb.chat.turn`, `nlqdb.databases.create` + `feature.*` events (`SK-EVENTS-010`); derived once via `surfaceFromPrincipal()`. |
| `status` (on `llm.calls.total`) | 3              | `ok` / `error` / `hedge_lost` (SK-LLM-014, cancelled hedge legs); filter `status="error"` for real failures. |
| `reason` (on `llm.failover.total`) | bounded     | `FailoverReason` set + `hedge_lost` (SK-LLM-014). |
| `nlqdb.cron`            | bounded (~3)        | On `db.query` keep-warm pings (SK-HDC-014); pinned to `wrangler.toml` crons. |
| `nlqdb.llm.hedge_lost`  | 2 (boolean)         | Span-only on `llm.<op>` spans for a hedge-cancelled leg (SK-LLM-014); filter `hedge_lost=true`. Not a metric label. |
| `llm.dispatch_lane` / `llm.billed_to` / `llm.byollm_provider` | 3 / 3 / ~5 | Span-only on the ask span (SK-LLM-020, GLOBAL-026): lane `free`/`byollm`/`premium`; billed-to `platform`/`byollm`/`metered`; byollm upstream slug (not the model). Not metric labels. |

**Cardinality rule:** total combined series < 8 k (Grafana Cloud free
tier ceiling at 10 k, leave 2 k headroom). The above bounds are
designed to fit. Any new label must be added here AND get a
cardinality assertion in CI.

---

## 4. Slice-by-slice instrumentation plan

Every slice from 3 onward MUST include:

1. The spans + metrics in the table below.
2. A **vitest assertion** that each new span/metric was emitted
   (using OTel's in-memory test exporter). Missing instrumentation
   fails CI.
3. A **budget assertion** in the same test — if measured p50 in the
   test exceeds 1.5× the §2 budget, fail.

| Slice | New spans                                              | New metrics                                                      | CI assertion                            |
| :---- | :----------------------------------------------------- | :--------------------------------------------------------------- | :-------------------------------------- |
| 3 — Neon adapter      | `db.query` (label `db.system=postgresql`, `db.operation.name`) | `nlqdb.db.duration_ms{operation}`                                | span emitted; p50 < 200 ms in test.     |
| 4 — LLM router        | `llm.route` / `llm.plan` / `llm.summarize` / `llm.schema_infer` / `llm.engine_classify` (label `llm.provider`, `llm.model`) | `nlqdb.llm.calls.total`, `nlqdb.llm.duration_ms`, `nlqdb.llm.failover.total` | failover counter increments on forced provider failure. `llm.schema_infer` lands in Phase 1 alongside hosted db.create. `llm.route` replaces the older `llm.classify` + `llm.disambiguate` pair (SK-ASK-009). |
| 5 — Better Auth       | `nlqdb.auth.verify`, `nlqdb.auth.oauth.callback`, `nlqdb.events.emit` (new sign-in only) | `nlqdb.auth.events.total`                                        | sign-in success + failure both emit OTel events; first-time sign-in fires exactly one `user.registered` into the sink (asserted with stub sink — real `LOGSNAG_TOKEN` not required in CI). |
| 6 — `/v1/ask` E2E     | `nlqdb.ask` (parent), `nlqdb.cache.plan.lookup` / `write`, `nlqdb.sql.validate`, `nlqdb.ratelimit.check`, `nlqdb.cache.first_query.lookup` / `commit`, `nlqdb.events.emit` (first-query only) | `nlqdb.ask.duration_ms`, `nlqdb.cache.plan.hits.total` / `misses.total` | end-to-end span tree present; cache hit on second identical request; `user.first_query` fires exactly once per user (via the lookup-then-emit-then-commit pattern). **Also:** Better Auth `session.cookieCache` enabled + KV revocation-set check on every session read (DESIGN §4.3, §4.5). Pair lands together — cookie cache without the revocation hook would regress the "≤2s revocation" guarantee. Drops `nlqdb.auth.verify` from D1-bound (~30 ms p99) to HMAC + KV (~6 ms p99). |
| 7 — Stripe webhook    | `nlqdb.webhook.stripe`, `nlqdb.events.emit`            | `nlqdb.requests.total{route="/v1/stripe/webhook"}`               | signature verify span emitted; `billing.subscription_created` / `billing.subscription_canceled` map 1:1 to events fired into the sink (asserted with stub sink). No `trial.*` events — PLAN §5.3 has no Stripe trial period. |

The **OTel SDK + OTLP exporter** lands as part of Slice 3 (one-time
infrastructure). All later slices just call into it.

---

## 5. Sampling + cost discipline

Grafana Cloud free tier ceilings (current as of 2026-04):

- **Metrics:** 10 k active series.
- **Logs:** 50 GB / mo.
- **Traces:** 50 GB / mo.

Sampling rules to stay well under:

| Path                                | Trace sample rate |
| :---------------------------------- | :---------------- |
| `/v1/health`                        | 0 % (never)       |
| `/v1/ask` cache hit                 | 1 %               |
| `/v1/ask` cache miss                | 100 %             |
| `/v1/auth/*`                        | 100 %             |
| Any request returning 5xx           | 100 % (override sampler) |
| Any request returning 4xx           | 10 %              |
| Stripe webhook                      | 100 %             |

**Metrics:** all metrics aggregated at 60 s resolution; histograms
use 8 buckets (0.005, 0.025, 0.1, 0.25, 0.5, 1, 2.5, 5 s) — enough
for p50/p95/p99, cheap on series count.

**Logs:** errors at INFO+; everything else at DEBUG only when
`NLQDB_LOG_LEVEL=debug` (off in prod). Never log secrets, query
contents, or PII (tenant_id only).

If any of the three ceilings approaches 80 %, the alert fires (see §6)
and we either raise sampling thresholds or split telemetry across two
stacks before paying.

---

## 6. Dashboards-as-code

Live in `ops/grafana/dashboards/` as JSON, deployed via Grafana
Cloud's `/api/dashboards/db` provisioning endpoint from CI on merge
to `main`. Never edited in the Grafana UI — UI changes are detected
on the next CI run and the JSON wins.

Initial dashboards (deferred until Phase 1 traffic warrants a tuned view; spans + metrics are already exported via OTLP):

| Dashboard            | What it shows                                                              |
| :------------------- | :------------------------------------------------------------------------- |
| `nlqdb-overview`     | All §1 SLOs at a glance, error rate, request rate. Single-pane oncall view. |
| `nlqdb-ask-pipeline` | Per-stage p50/p99 from §2 budgets vs actual; cache hit ratio; LLM provider mix. |
| `nlqdb-providers`    | LLM provider latency comparison, failover rate, error rate per provider.   |
| `nlqdb-auth`         | Sign-in success rate, token refresh rate, OAuth callback p99.              |

Alerts (provisioned alongside dashboards):

- Any SLO p99 over budget for 5 min → page.
- Error rate > 0.5 % for 10 min → page.
- LLM provider failover rate > 5 % over 1 h → ticket.
- Grafana Cloud series count > 8 k → ticket (cost ceiling approach).
- KV / D1 / R2 quota usage > 80 % → ticket.

---

## 7. How this doc evolves

- **Budget changes** require a PR; the PR description must state the
  measurement that motivated the change.
- **New routes** add a row to §1 (SLO) AND §2 (budget) AND §4
  (instrumentation hooks) in the same PR.
- **New providers / engines** add to §2.5 (provider numbers) and
  §3.3 (label values). Backfill measurements within a week of landing.
- **New metrics / labels** require a cardinality estimate in the PR
  description; the CI cardinality assertion catches the rest.
