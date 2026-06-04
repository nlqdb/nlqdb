# Phase plan

Canonical phase plan and exit gates. Extracted from `architecture.md` §10
to keep that doc under the D4 20 KB shard cap; cross-refs there now link
here.

**Navigation:** [architecture.md](./architecture.md) (system design) ·
[decisions.md](./decisions.md) (cross-cutting `GLOBAL-NNN`) ·
[features/](./features/) (per-feature `FEATURE.md` with status) ·
[performance.md](./performance.md) (SLOs and budgets).

If a sentence here disagrees with a feature, **the feature wins**. This
document owns the phase ordering, the items in each phase, and the
measurable exit gate. Feature-level decisions (the `SK-*` blocks) own the
*how*. Exit gates from Phase 1.5 onward reference KPI floors defined in
[`GLOBAL-025`](./decisions/GLOBAL-025-north-star.md) (engine quality,
onboarding, UX). LLM strategy across all phases is fixed by
[`GLOBAL-026`](./decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md).

---

## 0. Operative rules

Apply to every phase:

- Ship the on-ramp first. A user must reach first value before any new
  surface ships.
- Vertical slices, not horizontal layers. Each slice ships end-to-end.
- Every shipped feature must measurably advance at least one
  north-star ([`GLOBAL-025`](./decisions/GLOBAL-025-north-star.md))
  — engine quality, onboarding, UX, or performance — AND must
  not degrade any of the others.
- Every phase has a measurable exit gate. No gate, no phase rollover.
- **Strict-$0 forever for the free tier** ([`GLOBAL-013`](./decisions/GLOBAL-013-free-tier-bundle-budget.md)
  + [`GLOBAL-026`](./decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md)).
  Free LLM chain is permanent; hosted premium routes only on paid
  plans; BYOLLM is available on every tier.
- Dogfood from Phase 0. Every surface used by the team before it ships
  to a stranger.
- New monetization or scaling work is **gated on demand-signal**, not
  on phase number — see §6 below.

---

## 1. Phase 0 — Foundations

**Theme:** the stack stands up end-to-end for one developer. No traffic.

- Monorepo with Bun workspaces (`apps/web`, `apps/api`, `packages/…`, `cli/`).
- Cloudflare Workers + KV + D1 + R2 provisioned via wrangler from CI.
- LLM adapter (`classify|plan|summarize|embed`) with strict-$0 provider chain.
- Plan cache in KV keyed by `(schema_hash, query_hash)`.
- Auth scaffold: Better Auth, magic link + GitHub OAuth, anonymous-mode adoption.
- One Postgres adapter (Neon HTTP) + schema-per-DB tenancy.
- `POST /v1/ask` orchestrator (read/write path) end-to-end.

No public onboarding in Phase 0 by design — auth API ships ahead of its UI.

**Exit gate:** curl to `/v1/ask` against a fixture db returns a real answer
in <2s p50; CI green in <90s; provider failover exercised; $0 spent.

---

## 2. Phase 1 — On-ramp (public soft launch)

**Theme:** the goal-first 60-second flow works for a stranger.

- Marketing site `nlqdb.com` (static Astro, AEO basics, JSON-LD, `llms.txt`).
- Chat surface `nlqdb.com/app` — streaming, three-part response (answer/
  data/trace), Cmd+K, Cmd+/ trace toggle.
- Anonymous-mode end-to-end (72h localStorage token; adopt via one SQL
  row on sign-in).
- Sign-in: magic link + GitHub OAuth; session cookie `__Secure-session`.
- Hosted db.create — typed-plan + Zod validator + deterministic compiler
  + Neon provisioner.
- `<nlq-data>` v0 — `goal=` attribute; templates `table`, `list`, `kv`.
- Copy-snippet: every chat-generated embed has `pk_live_<dbId>`
  pre-inlined.
- API keys: `pk_live_` (per-db, read-only) + `sk_live_` (account-scoped)
  from dashboard.
- Resend, Sentry, Cloudflare Web Analytics (`GLOBAL-034`), LogSnag wired.

**Exit gate:** 4/5 unguided user-tests complete 60s on-ramp; p50 < 400ms
(cache hit); p95 < 1.5s (cache miss); Lighthouse 100/100/100/100; still
$0/mo.

---

## 3. Phase 1.5 — Trust + Telemetry

**Theme:** the funnel converts and we know *why*.

Inserted between Phase 1 and Phase 2 because the failure mode that
sinks NL-to-SQL products is *syntactically-right, semantically-wrong*
answers — a query that executes and looks plausible but joins the
wrong table or omits a filter. The server-side validator
([`sql-allowlist`](./features/sql-allowlist/FEATURE.md),
[research-receipts §1](./research-receipts.md)) catches structural
errors; trust UX catches the silent-semantic ones at the user
surface. And no monetization or scaling decision can be data-driven
without the demand-signal events landing first. Both deliverables
are governed by
[`GLOBAL-023`](./decisions/GLOBAL-023-trust-ux-baseline.md) and
[`GLOBAL-024`](./decisions/GLOBAL-024-demand-signal-telemetry.md);
implementation lives in [`trust-ux`](./features/trust-ux/FEATURE.md)
and across every existing feature.

- **Trust UX baseline** ([`GLOBAL-023`](./decisions/GLOBAL-023-trust-ux-baseline.md)):
  every write/DDL path shows a diff before commit; every response carries
  the compiled SQL (or compiled plan) as a trace; low-confidence plans
  refuse rather than guess.
- **Demand-signal telemetry** ([`GLOBAL-024`](./decisions/GLOBAL-024-demand-signal-telemetry.md)):
  every 4xx "not supported", every rate-limit hit, every wishlist click,
  every anon-mode TTL warning fires a typed product event. Captures
  intent without payment infra.
- **`nlqdb.surface` label** added to existing metrics so per-feature
  usage breakdown is queryable (db.create vs anon vs chat vs MCP vs CLI).

**Exit gate:** every Phase 1 surface emits a `surface` label and a
demand-signal event on the documented failure paths; trust-UX diff
preview measurably reduces the destructive-op retry rate in user
tests; **north-star baselines measured** — TTFV, first-query success,
destructive-op retry rate, and BIRD-dev/Spider 2.0-lite EM on the
free chain all have a recorded `2026-05` value per the
[`GLOBAL-025`](./decisions/GLOBAL-025-north-star.md) KPI table.

**Status (2026-05):** capture-pipe shipped. `SK-EVENTS-010` +
`SK-EVENTS-011` wired every documented "not yet" path plus the
marketing-page wishlist click; `SK-TRUST-001` + `SK-TRUST-002` shipped
diff preview and trace on `/v1/ask` write paths; `nlqdb.surface` label
flows on every metric. Remaining gate item — destructive-op
retry-rate reduction (user-test signal) — measures off Phase 2
distribution, not new engineering.

---

## 4. Phase 2 — Distribution (agent + developer surfaces)

**Theme:** make it a developer ecosystem. **Ordered intentionally** —
MCP first because the 2026 MCP registry is the active distribution
channel (9 k+ servers, agent shelves in every IDE); CLI second because
it composes on the same auth/SDK; framework wrappers third.

1. **MCP server** — hosted (`mcp.nlqdb.com`, Cloudflare Worker +
   Durable Objects) + local stdio (`@nlqdb/mcp`). The unique-in-market
   primitive is `db.create` via MCP — every MCP-Postgres alternative
   requires a pre-provisioned DB.
2. **CLI `nlq`** (Go) — `nlq new`, bare `nlq "…"`, **`nlq run` for raw
   query** (the [`GLOBAL-015`](./decisions/GLOBAL-015-power-user-escape-hatch.md)
   escape hatch), device-code auth, OS-keychain. `nlq mcp install`
   auto-detects hosts.
3. **SDK `runSql()`** — parity with CLI per
   [`GLOBAL-002`](./decisions/GLOBAL-002-behavior-parity.md) /
   [`GLOBAL-003`](./decisions/GLOBAL-003-all-surfaces-one-pr.md). Ships
   in the same release as `nlq run` so all surfaces have the escape
   hatch on the same day.
4. **`<nlq-action>` write-counterpart element.**
5. **Framework wrappers** — `@nlqdb/{react,next,vue,nuxt,svelte,sveltekit,astro,solid}` and the
   `Nlqdb` Swift Package. Drop-in components + SSR-safe lazy CE
   registration + `/server` `sk_live_*` factories where the framework
   has one. See [`framework-wrappers/FEATURE.md`](./features/framework-wrappers/FEATURE.md) and [`sdk-swift/FEATURE.md`](./features/sdk-swift/FEATURE.md).
6. **CSV upload** in chat.
7. **Docs site** `docs.nlqdb.com`.
8. **Custom domains for embeds** via Cloudflare for SaaS (first 100
   zones free).

9. **Quality-eval harness** ([`quality-eval`](./features/quality-eval/FEATURE.md))
   — BIRD-dev + Spider 2.0-lite + an internal eval over `db.create`
   schemas, run weekly, accuracy reported per
   [`llm-router`](./features/llm-router/FEATURE.md) tier and per
   dispatch lane (free / BYOLLM / hosted-premium). **Promoted from
   Phase 3** because the engine north-star
   ([`GLOBAL-025`](./decisions/GLOBAL-025-north-star.md)) is
   unprovable without it. Slice-1 status in the footer below.
10. **BYOLLM dispatch** — per
   [`GLOBAL-026`](./decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md),
   every user (free or paid) can paste a provider key and route
   through it at 0% markup. Ships now because no payment infra is
   required; the hosted-premium lane stays dark until §6 trips.

**Not in Phase 2 by default:** Stripe live, Lago, Listmonk, and the
hosted-premium LLM lane (architectural slot landed in §10 above; meter
stays off). These all turn on when §6 trips.

**Exit gate:** MCP installed in 3+ distinct host apps; 1 agent product
publicly uses nlqdb as memory; 3 non-engineers complete CSV analysis
<10 min unassisted; inference cost <$1/mo per active anon-or-signed-in
user. **North-star floors cleared** per
[`GLOBAL-025`](./decisions/GLOBAL-025-north-star.md): BIRD-dev EM
≥ 60% on the free chain, ≥ 80% on agentic-frontier (free-vs-agentic
delta ≤ 25 pp; single-model frontier reported informationally per
[`GLOBAL-025`](./decisions/GLOBAL-025-north-star.md)); TTFV p50 ≤ 60 s,
first-query success ≥ 70%; destructive-op retry rate measurably below
the no-preview baseline.

**Status (2026-05):**
**Item 1 — MCP server** — `SK-MCP-010` slices 1–3c shipped: `sk_live_`/`sk_mcp_*` mint, `packages/mcp/` stdio with three tools, `apps/mcp/` Cloudflare Worker on `mcp.nlqdb.com` (Streamable-HTTP at `/mcp`), `workers-oauth-provider` + `McpAgent` Durable Object sessions per `SK-MCP-011..014` (cross-Worker callback bridge mints `sk_mcp_*` server-side, DO revalidation cache for 1 s revocation), per-bucket rate-limit (all `sk_*` keyed by `rl:${api_keys.id}` per `SK-MCP-009`; migration 0014 renames `user_id` → `bucket_key`), auth-failure observability (`nlqdb.mcp.http.request` span + `nlqdb.mcp.auth.failures.total{error_code,status}`). Remaining: slice 4 (`nlq mcp install` host-detect) — see [`mcp-server/FEATURE.md`](./features/mcp-server/FEATURE.md) + [`cli/FEATURE.md`](./features/cli/FEATURE.md).
**Item 2 — CLI** bootstrap + key-management + raw-SQL slices shipped: data verbs (`ask`, `new`, bare-form, `db list/create`, `query`, `use`, `whoami`, `logout`, `mcp detect`, `update`), credential store (keychain + AES-GCM fallback per `SK-CLI-009`), state/config (`SK-CLI-010/013`), update check (`SK-CLI-015`), MCP detect (`SK-CLI-011`), `nlq keys list/revoke` (`SK-APIKEYS-010/011`) backed by `GET/DELETE /v1/keys[/:id]`, `nlq run [--db <id>] <sql>` + SDK `client.runSql()` + `POST /v1/run` (`SK-SDK-009`/`GLOBAL-015`, all three surfaces one PR per `GLOBAL-003`; same `/v1/ask` allow-list, DDL still rejected, pk_live writes rejected per `SK-APIKEYS-003`). Deferred verbs (`login`, `mcp install` key-write, `chat`, `keys rotate`) gated on `POST /v1/auth/device` + `POST /v1/keys/:id/rotate` — see [`cli/FEATURE.md`](./features/cli/FEATURE.md). **Dashboard `/app/keys` shipped** per [`SK-APIKEYS-012`](./features/api-keys/decisions/SK-APIKEYS-012-dashboard-ui.md) — copy-once mint + confirm-revoke; SDK `client.mintKey()` added.
**Item 4 — `<nlq-action>` v0.1 shipped** in `packages/elements/src/action-element.ts` per [`SK-ELEM-010..013`](./features/elements/decisions/): preview→Apply via [`SK-TRUST-001`](./features/trust-ux/FEATURE.md)'s diff hop, FormData → goal-text suffix, cookie-session auth (cross-origin write-token deferred — see [`api-keys/FEATURE.md`](./features/api-keys/FEATURE.md)). Bundle < 6 KB gzipped (`SK-ELEM-007`).
**Item 5 — framework wrappers — shipped:** `@nlqdb/{react,next,vue,nuxt,svelte,sveltekit,astro,solid}` + native Swift Package `Nlqdb` (`packages/nlqdb-swift`) all P1 · Shipped per [`progress.md §0`](./progress.md#0-surface-status-matrix--single-source-of-truth); React Native / Expo / Python / Go remain Phase 2 P1.
**Item 9 — quality-eval — slices 1 + 2 + 3a + 3b + 3c shipped:** `tools/eval/` workspace, BIRD Mini-Dev SQLite runner, free + single-model frontier lanes, multiset EX scorer. Slice 2 added baseline diff (`tools/eval/baseline-2026-06-15.json`), McNemar's paired-binary test (`SK-QUAL-006`), regression detection on `feature.eval.regression` events (threshold + McNemar parallel triggers), `feature.eval.weekly` summary emission via `POST /v1/events/eval` (bearer-token → Cloudflare Queues → LogSnag `#north-star`), weekly Mon 04:00 UTC cron. **Slice 3a (`SK-QUAL-007`):** Spider 2.0-lite SQLite-subset loader (`tools/eval/src/datasets/spider2-lite.ts`) — pulls upstream `xlang-ai/Spider2@main` (547 rows; HF mirror stale at 260), filters to 135 `local###`. **Slice 3b (`SK-QUAL-008`) shipped:** TypeScript port of `compare_pandas_table` / `compare_multi_pandas_table` (`tools/eval/src/score.ts`) + minimal pandas-CSV parser (`tools/eval/src/csv.ts`); per-instance gold CSV(s) + `condition_cols` / `ignore_order` resolved off-disk via a sparse-cloned `evaluation_suite/gold/` cache. All 135 `local###` rows now contribute to `spider_accuracy`. **Slice 3c (`SK-QUAL-009`) shipped:** bounded `withExecRetry` helper (`tools/eval/src/exec-retry.ts`) wraps `plan() → score()` for the `free` + new `agentic-frontier` lanes (production-aligned `maxAttempts: 3`, exec-error-only, threads `PlanRequest.previousAttempt` per `GLOBAL-022`); single-model `frontier` retained unscaffolded as the ablation reference per `SK-QUAL-004`. New headline KPI `free_vs_agentic_frontier_delta` flows through `EvalReport` + `FeatureEvalWeeklyEvent.freeVsAgenticFrontierDelta` + the LogSnag card per `GLOBAL-025`. Internal `db.create` eval deferred to a later slice (depends on privacy-stripped R2 export). Multi-model frontier expansion (GPT-5, Gemini 2.5 Pro) deferred until Sonnet 4.6 baseline lands.

---

## 5. Phase 3 — The engine (the moat)

- Query Log → Workload Analyzer → Migration Orchestrator.
- ClickHouse via Tinybird as second engine (analytics; daily reshape
  via Pipes).
- **Hobby $10 + Pro $25 live + hosted-premium LLM lane lit up**
  ([`GLOBAL-026`](./decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md))
  — flat subscription + included monthly request allowance per
  [`SK-PREMIUM-009`](./features/premium-tier/decisions/SK-PREMIUM-009-hosted-premium-meter.md)
  (~200 Hobby / ~600 Pro) + soft-meter overage at provider list + 0%
  markup. Ships only if §6 has tripped; otherwise stays a Phase 4
  deliverable.
- Self-hosted classifier on single A10G Modal once ~50k queries/day.
- Continuous backups to R2 with PITR (7d free, 30d Hobby+).
- Team workspaces.
- Self-host container image at `ghcr.io/nlqdb/api`.
- **Semantic-layer promotion gate** — when the
  [`quality-eval`](./features/quality-eval/FEATURE.md) free-chain EM
  drops below the unscaffolded threshold per
  [`SK-QUAL-002`](./features/quality-eval/FEATURE.md), promote
  [`docs/future/semantic-layer.md`](./future/semantic-layer.md) into
  an active feature. (The harness itself ships in Phase 2.)

**Exit gate:** ≥100 successful auto-migrations with zero user-visible
downtime; 50 paying customers across tiers (if monetization shipped);
otherwise ≥200 weekly-active users. **North-star floors per
[`GLOBAL-025`](./decisions/GLOBAL-025-north-star.md):** BIRD-dev EM
≥ 72% on free chain, ≥ 88% on agentic-frontier (free-vs-agentic
delta ≤ 16 pp); Spider 2.0-lite EM ≥ 15% on free chain, ≥ 25% on
frontier (SQLite subset only — Spider 2.0-lite ships no PG rows);
TTFV p50 ≤ 30 s; first-query success ≥ 85%; Sean-Ellis "very
disappointed" ≥ 40% (PMF) — measured monthly per
[`founder-playbook.md` §2](./founder-playbook.md).

---

## 6. Monetization + scaling trigger

**Building** the payment flow is never gated — implement it, ship it in
Stripe **test mode**, and keep the live button behind a flag. What a
demand-signal gates is **turning it on for real users**: Stripe **live**
mode, real charges, the exposed live pricing button, Lago metering,
Listmonk marketing email, and cost-incurring scaling (Cloudflare Pro,
Neon Launch). None of those turn on by phase number; they turn on when
one signal trips — whichever happens first:

| Signal | Threshold | What it unlocks |
|---|---|---|
| Unsolicited inbound asking how to pay | ≥ 5 across GH / Discord / email | Revealed preference. Founder-led pricing conversation; turn the live button on (a $1 founding-supporter tier is a cheap hard-signal layer). |
| Test-mode Stripe Checkout completion rate | ≥ 30% over 50 sessions | Strong enough to commit to Stripe live + Hobby $10 + Lago. |

Thresholds are starting heuristics, not measured truths — adjust on
first contact with traffic. The cost ladder in
[`README.md`](../README.md) ("pay only when someone pays you") is the
same rule: free to build before the signal, no spending or charging
until it trips.

**Reconciliation with the persona-validation plan.** The "2 convert to paid
Hobby" criterion in [`personas.md §10.4`](./research/personas.md) is downstream
of this trigger (measurable only after Stripe live ships). Phase 1 close
therefore requires: (a) all personas.md qualitative criteria, AND (b) §6 has
tripped and Stripe live shipped, OR (c) a deliberate decision to ship without
paid validation if §6 hasn't tripped within the quarter.

**What is *not* §6-gated.** Per
[`GLOBAL-026`](./decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md),
**BYOLLM ships in Phase 2** for every tier (no payment infra needed) and the
**hosted-premium dispatch slot** lands in the same slice (router precedence,
span names, schema columns). §6 gates only the *meter firing*: until it trips
the hosted-premium lane is flagged dark with no path from "paid user" to "we
billed Stripe for tokens". Lighting it is then a flag flip, not a refactor.

**Scaling triggers (infra, not billing; `GLOBAL-033`):** shard / migrate the
single D1 at **70% of its daily-read quota (rolling 7-day) or 10k DAU**,
whichever first; stay single-region us-east through Phase 2 and add an EU Neon
read-replica when the **first EU paying customer** signs (latency-, not
capacity-driven).

---

## 7. Phase 4+ — Beyond v1

- **BYO Postgres + BYO ClickHouse** (`POST /v1/db/connect`) — **promoted out
  of Phase 4+ to active dev** per [`SK-DB-011`](./features/db-adapter/decisions/SK-DB-011-byo-postgres-promoted.md)
  / [`SK-MULTIENG-005`](./features/multi-engine-adapter/decisions/SK-MULTIENG-005-byo-clickhouse-promoted.md);
  shared `registerByoDb` path, shape in [`architecture.md §3.6.7`](./architecture.md#367-byo-postgres-phase-4-decided-shape).
  Engine-specifics + the superseded signal-gate live in those SKs.
- **Embeddable NL library** ("Stripe of NL-Q" — their app, their end-users) and
  **notebook-style multi-query docs** — both **parked** as speculative scope
  (`GLOBAL-033`): revisit only when a paying / design-partner customer asks. A
  notebook is a BI tool (`architecture.md §8` not-building).
- Enterprise (SSO, audit log, on-prem).
- More engines (TimescaleDB, Typesense, pgvector at scale).
- `<nlq-stream>` real-time element.

---

## 8. Always-on (cross-phase)

- Build-in-public cadence: 1 long-form blog/week, 3 threads/week. See
  [`docs/research/email-and-marketing.md`](./research/email-and-marketing.md)
  and [`docs/founder-playbook.md`](./founder-playbook.md) for the
  channel + recruitment + interview cadence.
- Security hygiene: Trivy + CodeQL on every PR; secret rotation
  quarterly; Dependabot monthly.
- Inference cost monitoring: weekly Grafana; if any free provider hits
  70% of daily quota for 3 days → light up paid tier.
- Free-tier abuse: per-IP + per-account rate limits day 1; PoW on
  signup if needed.
- Quarterly forced LLM failover in production for 1h.
- Weekly automated backup-restore drill.
