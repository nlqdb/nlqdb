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
  — engine quality, seamless onboarding, seamless UX, or
  performance — AND must not degrade any of the others.
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
- Resend (magic link), Sentry, Plausible, LogSnag wired.

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
≥ 72% on the free chain, ≥ 88% on frontier (free-vs-frontier delta
≤ 22 pts); TTFV p50 ≤ 60 s, first-query success ≥ 70%; destructive-op
retry rate measurably below the no-preview baseline.

**Status (2026-05):** item 1 (MCP server) is in progress and item 2
(CLI) has its bootstrap slice plus key-management verbs on a branch.
CLI bootstrap shipped `cli/go.mod`, the data verbs (`ask`, `new`,
bare-form, `db list`, `db create`, `query`, `use`, `whoami`,
`logout`, `mcp detect`, `update`), credential store (keychain +
AES-GCM fallback per `SK-CLI-009`), state (`SK-CLI-013`) + config
(`SK-CLI-010`), update check (`SK-CLI-015`), MCP host detection
(`SK-CLI-011`). **Key-management slice added** `nlq keys list` +
`nlq keys revoke <id>` (`SK-APIKEYS-010` / `SK-APIKEYS-011`) backed
by `GET /v1/keys` + `DELETE /v1/keys/:id`. **Raw-SQL escape-hatch
slice added** `nlq run [--db <id>] <sql>` + SDK `client.runSql()` +
`POST /v1/run` (`SK-SDK-009` / `GLOBAL-015`) — all three surfaces in
one PR per `GLOBAL-003`. Same allow-list as `/v1/ask`; DDL still
rejected; pk_live writes rejected at the leading-verb gate
(`SK-APIKEYS-003`). Remaining deferred verbs (`login`, `mcp install`
key-write, `chat`, `keys rotate`) are gated on server-side endpoints
not yet shipped (`POST /v1/auth/device`, `POST /v1/keys/:id/rotate`)
— see [`cli/FEATURE.md`](./features/cli/FEATURE.md). Item 1 — MCP server —
`SK-MCP-010` slices 1 + 2 + 3a + 3b + 3c shipped. Slice 1: `sk_live_` +
`sk_mcp_*` mint via `POST /v1/keys`. Slice 2: `packages/mcp/` stdio
package with all three tools. Slice 3a: `apps/mcp/` Cloudflare Worker
on `mcp.nlqdb.com`, MCP Streamable-HTTP at `/mcp`, stateless bearer
auth. Slice 3b: `workers-oauth-provider` + `McpAgent` Durable Object
sessions per `SK-MCP-011..014` — dynamic client registration, single
`mcp` scope, cross-Worker callback bridge minting `sk_mcp_*` server-
side, DO revalidation cache for 1 s revocation (pulled forward from
the original 3c scope because the DO lifecycle was the natural home).
Slice 3c: per-bucket rate-limit (`apps/api/src/principal.ts::rateLimitBucketKey`
keys all `sk_*` principals by `rl:${api_keys.id}` — one namespace,
no per-prefix special-casing per `SK-MCP-009`; migration 0014 renames
`rate_limit_buckets.user_id` → `bucket_key` to match) + auth-failure
observability (`nlqdb.mcp.http.request` span wraps every Worker
request except `GET /health`; `nlqdb.mcp.auth.failures.total{error_code, status}`
counter fires from `OAuthProvider`'s `onError`, and the active span is
flipped to ERROR with `nlqdb.mcp.auth.error_*` attributes so trace
queries surface auth failures alongside 5xx). Remaining: slice 4 (`nlq mcp install`
CLI auto-detection) — see
[`mcp-server/FEATURE.md`](./features/mcp-server/FEATURE.md) and
[`cli/FEATURE.md`](./features/cli/FEATURE.md). **Dashboard
key-management UI shipped** at `/app/keys` per
[`SK-APIKEYS-012`](./features/api-keys/decisions/SK-APIKEYS-012-dashboard-ui.md)
— copy-once mint modal + confirm-revoke dialog, SDK `client.mintKey()`
added, MCP `auth_required` envelope now points at a working URL. **Item
4 — `<nlq-action>` write-counterpart element — v0.1 shipped** in
`packages/elements/src/action-element.ts` per
[`SK-ELEM-010..013`](./features/elements/decisions/): preview→Apply
two-click commit via [`SK-TRUST-001`](./features/trust-ux/FEATURE.md)'s
diff hop, FormData → goal-text suffix, cookie-session auth
(cross-origin write-token still deferred — tracked in
[`api-keys/FEATURE.md`](./features/api-keys/FEATURE.md)). Bundle
budget intact at < 6 KB gzipped per `SK-ELEM-007`. **Item 5 —
framework wrappers — shipped:**
`@nlqdb/{react,next,vue,nuxt,svelte,sveltekit,astro,solid}` and the
native Swift Package `Nlqdb` (`packages/nlqdb-swift`) are now
P1 · Shipped per [`progress.md §0`](./progress.md#0-surface-status-matrix--single-source-of-truth);
React Native / Expo and Python / Go SDKs remain Phase 2 P1.
**Item 9 — quality-eval — slice 1 shipped:** `tools/eval/` workspace,
BIRD Mini-Dev SQLite runner, free + frontier lanes, multiset EX
scorer, daily workflow. Smoke-tested against the free chain + Claude
Sonnet 4.6 via OpenRouter. Slice 2 (baseline + Spider 2.0-lite PG +
internal `db.create` eval + alert) by 2026-06-15 per `SK-QUAL-005`.

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
≥ 78% on free chain, ≥ 92% on frontier (delta ≤ 14 pts); Spider
2.0-lite EM ≥ 15% on free chain, ≥ 25% on frontier; TTFV p50 ≤ 30 s;
first-query success ≥ 85%; Sean-Ellis "very disappointed" ≥ 40%
(PMF) — measured monthly per
[`founder-playbook.md` §2](./founder-playbook.md).

---

## 6. Monetization + scaling trigger (replaces the old "Stripe in Phase 2")

Stripe live, Lago metering, and Listmonk marketing email are **not**
scheduled by phase. They ship when one of three demand-signals trips —
whichever happens first:

| Signal | Threshold | Implication |
|---|---|---|
| Unsolicited inbound asking how to pay | ≥ 5 across GH / Discord / email | Revealed preference. Founder-led pricing conversation. Ship Stripe Checkout in test mode + a $1 founding-supporter button as a hard-signal layer. |
| Test-mode Stripe Checkout completion rate (if shipped) | ≥ 30% over 50 sessions | Strong-enough signal to commit to Stripe live + Hobby $10 + Lago. |

The thresholds above are starting heuristics, not measured truths —
adjust on first contact with traffic. Until one trips, **no
payment-infra engineering work happens**. The cost ladder in
[`README.md`](../README.md) already says "pay only when someone pays
you"; this section is the operational form of that rule. Same logic
applies to scaling work (Cloudflare Pro, Neon Launch, etc.) — see
the cost ladder in README.

**Reconciliation with the persona-validation plan.** The
"2 convert to paid Hobby" criterion in
[`personas.md §10.4`](./research/personas.md) is downstream of this
trigger — it can only be measured after Stripe live ships. Persona
validation for Phase 1 close therefore requires: (a) all the
qualitative criteria in personas.md, AND (b) the §6 trigger has
tripped and Stripe live has shipped, OR (c) deliberate decision to
ship without paid validation if §6 hasn't tripped within the
quarter.

**What is *not* §6-gated.** Per
[`GLOBAL-026`](./decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md),
**BYOLLM ships in Phase 2** for every tier (no payment infra needed)
and the **architectural slot for hosted-premium dispatch** lands in
the same slice (router precedence, span names, schema columns). What
§6 actually gates is the *meter firing*: until §6 trips, the
hosted-premium lane is feature-flagged dark, and there is no path
from "I'm a paid user" to "we billed Stripe for tokens". When §6
trips, lighting the lane is a flag flip, not a refactor.

---

## 7. Phase 4+ — Beyond v1

- **BYO Postgres** (`POST /v1/db/connect`) — shape locked in
  [`architecture.md` §3.6.7](./architecture.md#367-byo-postgres-phase-4-decided-shape).
  Moves forward only if P4-persona inbound (signal-gated, not
  phase-gated).
- **BYO ClickHouse** (`POST /v1/db/connect`) — same `registerByoDb`
  provisioner path as BYO Postgres ([`architecture.md §3.6.7`](./architecture.md#367-byo-postgres-phase-4-decided-shape)),
  with two differences: (a) ClickHouse's native HTTP interface means
  Workers proxies directly — no TCP socket or Hyperdrive required;
  (b) schema introspection reads `system.columns` instead of
  `pg_catalog`. Signal-gated on P6-persona inbound (see
  [`personas.md`](./research/personas.md#p6--the-analytics--observability-engineer));
  not phase-gated. The Phase 3 managed-CH path via Tinybird is
  unaffected — that is a separate internal-engine decision. Not the
  same as the managed OTel ingestion pivot in
  [`otel-grafana-pivot.md`](./research/otel-grafana-pivot.md), which
  explores nlqdb owning the storage layer; BYO ClickHouse is an NL
  query skin over the user's existing cluster.
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
