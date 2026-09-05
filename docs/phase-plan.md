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
*how*. Phase 2 and Phase 3 exit on the
[`GLOBAL-041`](./decisions/GLOBAL-041-autonomous-dba.md) Phase A / Phase B
gates; the onboarding / UX / performance floors are in
[`GLOBAL-025`](./decisions/GLOBAL-025-north-star.md). LLM strategy across all phases is fixed by
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
  clarify rather than guess — a guided one-click turn, not a dead-end
  ([`GLOBAL-040`](./decisions/GLOBAL-040-guided-turn-not-dead-end.md)).
- **Demand-signal telemetry** ([`GLOBAL-024`](./decisions/GLOBAL-024-demand-signal-telemetry.md)):
  every 4xx "not supported", every rate-limit hit, every wishlist click,
  every anon-mode TTL warning fires a typed product event. Captures
  intent without payment infra.
- **`nlqdb.surface` label** added to existing metrics so per-feature
  usage breakdown is queryable (db.create vs anon vs chat vs MCP vs CLI).

**Exit gate:** every Phase 1 surface emits a `surface` label and a
demand-signal event on the documented failure paths; trust-UX diff
preview measurably reduces the destructive-op retry rate in user
tests; the onboarding / UX instruments (TTFV, first-10-queries success,
destructive-op retry rate) exist per the
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
   — BIRD-dev + Spider 2.0-lite accuracy per
   [`llm-router`](./features/llm-router/FEATURE.md) tier and dispatch
   lane, kept as a **CI regression alarm only** (`GLOBAL-041`): fails on a
   > 5 pp drop vs the last green run on a fixed sample; no floor, no
   weekly re-measure, not a KPI.
10. **BYOLLM dispatch** — per
   [`GLOBAL-026`](./decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md),
   every user (free or paid) can paste a provider key and route
   through it at 0% markup. Ships now because no payment infra is
   required; the hosted-premium lane lit 2026-08-14 (§6 tripped).

**Not in Phase 2 by default:** Listmonk. (The hosted-premium
LLM lane, wired in §10 above, turned on when §6 tripped —
live 2026-08-14.)

**Exit gate:** **Phase A of [`GLOBAL-041`](./decisions/GLOBAL-041-autonomous-dba.md)
shipped, and nothing else** — widen-on-write live and first-insert
inference rate ≥ 95 % on the Phase A dogfood workload defined there (the
`/daily` loop's own writes through `@nlqdb/sdk`; first 200 unseen-field
inserts in a 14-day window). No BIRD/Spider floor, no MCP-host count, no
CSV user test, no TTFV — TTFV gates Phase 3.

**Status (2026-05):**
**Item 1 — MCP server** — `SK-MCP-010` slices 1–3c shipped: `sk_live_`/`sk_mcp_*` mint, `packages/mcp/` stdio with three tools, `apps/mcp/` Cloudflare Worker on `mcp.nlqdb.com` (Streamable-HTTP at `/mcp`), `workers-oauth-provider` + `McpAgent` Durable Object sessions per `SK-MCP-011..014` (cross-Worker callback bridge mints `sk_mcp_*` server-side, DO revalidation cache for 1 s revocation), per-bucket rate-limit (all `sk_*` keyed by `rl:${api_keys.id}` per `SK-MCP-009`; migration 0014 renames `user_id` → `bucket_key`), auth-failure observability (`nlqdb.mcp.http.request` span + `nlqdb.mcp.auth.failures.total{error_code,status}`). Remaining: slice 4 (`nlq mcp install` host-detect) — see [`mcp-server/FEATURE.md`](./features/mcp-server/FEATURE.md) + [`cli/FEATURE.md`](./features/cli/FEATURE.md).
**Item 2 — CLI** bootstrap + key-management + raw-SQL slices shipped: data verbs (`ask`, `new`, bare-form, `db list/create`, `query`, `use`, `whoami`, `logout`, `mcp detect`, `update`), credential store (keychain + AES-GCM fallback per `SK-CLI-009`), state/config (`SK-CLI-010/013`), update check (`SK-CLI-015`), MCP detect (`SK-CLI-011`), `nlq keys list/revoke` (`SK-APIKEYS-010/011`) backed by `GET/DELETE /v1/keys[/:id]`, `nlq run [--db <id>] <sql>` + SDK `client.runSql()` + `POST /v1/run` (`SK-SDK-009`/`GLOBAL-015`, all three surfaces one PR per `GLOBAL-003`; same `/v1/ask` allow-list, DDL still rejected, pk_live writes rejected per `SK-APIKEYS-003`). Deferred verbs (`login`, `mcp install` key-write, `chat`, `keys rotate`) gated on `POST /v1/auth/device` + `POST /v1/keys/:id/rotate` — see [`cli/FEATURE.md`](./features/cli/FEATURE.md). **Dashboard `/app/keys` shipped** per [`SK-APIKEYS-012`](./features/api-keys/decisions/SK-APIKEYS-012-dashboard-ui.md) — copy-once mint + confirm-revoke; SDK `client.mintKey()` added.
**Item 4 — `<nlq-action>` v0.1 shipped** in `packages/elements/src/action-element.ts` per [`SK-ELEM-010..013`](./features/elements/decisions/): preview→Apply via [`SK-TRUST-001`](./features/trust-ux/FEATURE.md)'s diff hop, FormData → goal-text suffix, cookie-session auth (cross-origin write-token deferred — see [`api-keys/FEATURE.md`](./features/api-keys/FEATURE.md)). Bundle < 6 KB gzipped (`SK-ELEM-007`).
**Item 5 — framework wrappers — shipped:** `@nlqdb/{react,next,vue,nuxt,svelte,sveltekit,astro,solid}` + native Swift Package `Nlqdb` (`packages/nlqdb-swift`) all P1 · Shipped per [`progress.md §0`](./progress.md#0-surface-status-matrix--single-source-of-truth); React Native / Expo / Python / Go remain Phase 2 P1.
**Item 9 — quality-eval — slices 1–3c shipped:** `tools/eval/` runs BIRD Mini-Dev + Spider 2.0-lite (all 135 `local###` rows) on the free, single-model-frontier and agentic-frontier lanes with baseline diff + McNemar regression detection (`SK-QUAL-006..009`). Slice detail in `quality-eval/FEATURE.md`; last green run in `tools/eval/baseline-*.json`.

---

## 5. Phase 3 — The engine (the moat)

- **`GLOBAL-041` Phase B** — inspection (`pg_stat_*`, `EXPLAIN` on hot
  fingerprints) → typed proposals → `/app/dba` dashboard → 1-click
  apply/undo; then **Phase C** — per-table engine placement (ClickHouse via
  Tinybird) from the same proposal pipeline with dual-read verification.
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

**Exit gate:** `GLOBAL-041` Phase B floors — first-insert inference
≥ 99 %, evolution-without-user-action ≥ 90 %, optimizer yield ≥ 1 applied
proposal / active DB / month with median p95 improvement ≥ 20 % and no
un-undone regression > 10 %; **TTFV p50 ≤ 60 s** (moved here from the
Phase 2 gate); the remaining onboarding / UX / performance floors per the
[`GLOBAL-025`](./decisions/GLOBAL-025-north-star.md) KPI table; 50 paying
customers across tiers, otherwise ≥ 200 weekly-active users. DBA pricing is
decided after Phase B ships (`GLOBAL-041`).

---

## 6. Monetization + scaling trigger

**Building** is never gated — implement it before the signal. What a
demand-signal gates is **the cost-incurring layers**: Listmonk
marketing email and cost-incurring scaling (Cloudflare Pro, Neon
Launch). The hosted-premium meter is no longer a separate
service — it rides Stripe Billing Meters directly
([`SK-PREMIUM-017`](./features/premium-tier/decisions/SK-PREMIUM-017-stripe-billing-meters.md)).
None turn on by phase number; they turn on when one signal trips —
whichever first:

| Signal | Threshold | What it unlocks |
|---|---|---|
| Unsolicited inbound asking how to pay | ≥ 1 across GH / Discord / email (tripped 2026-08) | Revealed preference. Founder-led pricing conversation (a $1 founding-supporter tier is a cheap hard-signal layer). |
| Checkout completion rate | ≥ 30% over 50 sessions | Strong enough to commit to Stripe Billing Meters + the cost-incurring scaling layers. |

Thresholds are starting heuristics, not measured truths — adjust on
first contact with traffic. The [cost ladder](./cost-ladder.md) is the
same rule: free to build, no spend until it trips.

**Reconciliation with the persona-validation plan.** The "2 convert to paid
Hobby" criterion in [`personas.md §10.4`](./research/personas.md) is measurable
once Stripe live-mode lands ([`blocked-by-human.md`](./blocked-by-human.md)).
Phase 1 close requires all personas.md qualitative criteria plus that
paid-conversion check (or a deliberate decision to ship without it).

**What is *not* §6-gated.** Per
[`GLOBAL-026`](./decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md),
**BYOLLM ships in Phase 2** for every tier (no payment infra needed) and the
**hosted-premium lane is now wired end-to-end** (router, meter, and allowance
seeds in `apps/api/src/billing/premium/**`). §6 gated only the *meter firing*
(`PREMIUM_METER_LIVE`) — the operator flipped it live 2026-08-14.

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
  Engine-specifics + the retired signal-gate live in those SKs.
- **Embeddable NL library** ("Stripe of NL-Q" — their app, their end-users) and
  **notebook-style multi-query docs** — both **parked** as speculative scope
  (`GLOBAL-033`): revisit only when a paying / design-partner customer asks. A
  notebook is a BI tool (`architecture.md §8` not-building).
- Enterprise (SSO, audit log, on-prem).
- More engines (TimescaleDB, Typesense, pgvector at scale).
- `<nlq-stream>` real-time element.

---

## 8. Always-on (cross-phase)

- Build-in-public cadence, blog drip and channel work: **paused until
  `GLOBAL-041` Phase A measures**; existing pages stay live. Recruitment +
  interview cadence in [`docs/founder-playbook.md`](./founder-playbook.md).
- Security hygiene: Trivy + CodeQL on every PR; secret rotation
  quarterly; Renovate (`renovate.json5`) for dependency updates.
- Inference cost monitoring: weekly Grafana; if any free provider hits
  70% of daily quota for 3 days → light up paid tier.
- Free-tier abuse: per-IP + per-account rate limits day 1; PoW on
  signup if needed.
- Quarterly forced LLM failover in production for 1h.
- Weekly automated backup-restore drill.
