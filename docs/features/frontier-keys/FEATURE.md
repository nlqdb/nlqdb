---
name: frontier-keys
description: Founder-funded frontier-model lane (Anthropic + OpenAI), tiered key rotation, dormant behind a hardcoded gate — the "best value" half of the seamless-approachable-value plan.
when-to-load:
  globs:
    - packages/llm/src/frontier/**
    - packages/llm/src/chains/frontier.ts
  topics: [frontier, founder-keys, best-value, tiered-fallback, gating, value-plan]
---

# Feature: Frontier Keys — Founder-Funded Best-Value Lane

**One-liner:** A dormant, hard-gated dispatch lane that serves *frontier-quality*
answers from the **founder's own** Anthropic + OpenAI keys (best value for a small
token budget), with automatic tier fallback (Opus → Sonnet → Haiku · GPT tier-1 →
tier-2 → tier-3) and a KV pointer that skips exhausted tiers. This doc is also the
**progress tracker + larger vision** for the founder's *"seamless, approachable
value"* plan (scorecard row of the same name) — the approachable on-ramp half
(two-door home + BYO connect) is tracked below alongside the value half.
**Status:** scaffold only — **gated OFF** (`HAS_FRONTIER_API_KEYS = false`). The
value lane is **0% live**; the approachability half is largely shipped (see the
tracker). Stays at a deliberately very low score until the lane is enabled **and**
live (per the founder's instruction for the scorecard row).
**Owners (code):** `packages/llm/src/frontier/**`, `packages/llm/src/chains/frontier.ts`; wiring in `apps/api/src/ask/model-picker.ts` (gated).
**Cross-refs:** [`llm-router/FEATURE.md`](../llm-router/FEATURE.md) (the lane sits alongside free/BYOLLM/hosted-premium, `SK-LLM-016`/`SK-LLM-017`) · [`GLOBAL-026`](../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md) (LLM strategy) · [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md) (engine-quality KPI: the free-vs-frontier delta) · [`byo-connect/FEATURE.md`](../byo-connect/FEATURE.md) + `web-app` `SK-WEB-018`/`SK-WEB-019` (approachability half).

## Relationship to the existing premium lane

This is **not** the hosted-premium meter (`SK-LLM-017` / `SK-PREMIUM-009`), which
bills *paid customers* for frontier calls through retention-off providers. The
frontier-keys lane spends the **founder's** keys to lift answer quality for *best
value* during the pre-PMF window — it is a cost the founder eats deliberately,
capped hard, and is dormant by default. The two lanes never overlap: hosted-premium
is `principal.tier !== "free"` + `PREMIUM_METER_LIVE`; frontier-keys is the
founder-funded path gated by `HAS_FRONTIER_API_KEYS` + the KV pointer + the
eligibility predicate below.

## Decisions

### SK-FRONTIER-001 — The frontier lane ships fully but dormant behind a hardcoded `HAS_FRONTIER_API_KEYS = false`

- **Decision:** All frontier-lane code lands in `packages/llm` now, but the lane is
  unreachable until a single hardcoded module constant `HAS_FRONTIER_API_KEYS`
  (in `packages/llm/src/frontier/gate.ts`) is flipped to `true`. While `false`,
  `selectFrontierLane()` returns `null` before reading any key, env var, or KV — so
  no founder key can be touched, in any environment, by any caller.
- **Core value:** Bullet-proof, Free (cost-control), Best value
- **Why:** Founder frontier keys are scarce and metered; an env-only switch can be
  set by accident on a preview or a misconfigured deploy and silently burn the
  budget. A hardcoded boolean is a **code-review-visible, deploy-uniform** hard
  gate: enabling the lane is a deliberate one-line diff that shows up in a PR, not a
  dashboard toggle. The constant is the outermost of three gates (constant → KV
  pointer → eligibility predicate); the inner two only ever run when the constant is
  already `true`.
- **Consequence in code:** `export const HAS_FRONTIER_API_KEYS = false;` is the
  first check in the lane selector and in `apps/api/src/ask/model-picker.ts`'s
  frontier branch. Tests assert that with the constant `false`, no provider/key/KV
  access occurs (spies see zero calls) and the router falls through to the existing
  free/BYOLLM/hosted-premium precedence unchanged.
- **Alternatives rejected:** **Env-var-only gate** — settable by accident across
  preview/CI, no PR-visible audit trail; the founder explicitly asked for a
  hardcoded boolean. **Feature-flag service** — a dependency + network read for a
  switch that should be a compile-time constant (GLOBAL-013).

### SK-FRONTIER-002 — Tiered key rotation: 3 Anthropic tiers + 3 OpenAI tiers, each a distinct key with a small token budget

- **Decision:** The lane is an ordered set of **six** tiers — Anthropic
  `[opus, sonnet, haiku]` then OpenAI `[t1, t2, t3]` (model IDs env-configured; see
  Open questions) — each backed by its **own** founder key with a **small** initial
  token budget. A tier is used until its budget is spent or it returns a hard
  limit/quota error (429/insufficient_quota), then dispatch falls to the next tier;
  Anthropic exhausts to OpenAI; all six exhausted ⇒ the lane yields `null` and the
  request falls through to the free chain. Budgets and key→tier mapping are
  env-driven (`FRONTIER_ANTHROPIC_KEY_1..3`, `FRONTIER_OPENAI_KEY_1..3`,
  `FRONTIER_TIER_BUDGET_*`); the package holds no secret.
- **Core value:** Best value, Bullet-proof
- **Why:** A single key = one cap and a cliff to the free chain. Tiering spends the
  *highest-quality* model first (Opus), and only degrades to Sonnet/Haiku/OpenAI as
  budget runs out — maximizing answer value per founder dollar before falling back.
  Per-tier small caps bound blast radius if a key leaks or a loop misfires.
- **Consequence in code:** `packages/llm/src/frontier/tiers.ts` defines the ordered
  `FrontierTier[]` (`{ id, provider, model, keyEnv, budgetTokens }`); a per-tier
  token counter (KV-backed, `SK-FRONTIER-003`) gates eligibility; the lane builds a
  single-provider router for the active tier and fails over on budget/quota. Reuses
  the `SK-LLM-002` provider adapter + `SK-LLM-005` breaker semantics; no new provider
  SDK import outside `packages/llm`.
- **Alternatives rejected:** **One key, one model** — no graceful value-degrade, a
  hard cliff to free. **Round-robin across same-tier keys** — spreads load but
  doesn't express the Opus→Sonnet quality ladder the founder asked for.

### SK-FRONTIER-003 — A KV "active frontier tier" pointer skips exhausted tiers without paying for their failures

- **Decision:** A single KV key — `frontier:active_tier` (the founder's "Redis key";
  nlqdb's KV store **is** Cloudflare KV, not Redis — see Open questions) — names the
  currently usable tier id, or the sentinel `"none"`. The selector reads it first and
  dispatches **straight** to that tier, never probing already-exhausted tiers. On a
  budget/quota exhaustion the lane advances the pointer to the next tier (or `"none"`
  when all six are spent); a daily/cron reset (or budget-window rollover) restores it
  to the top tier. `"none"` ⇒ the lane returns `null` immediately (no provider call).
- **Core value:** Fast, Honest latency, Best value
- **Why:** Without the pointer, a request after exhaustion pays real wall-clock
  walking dead keys (each a network round-trip + breaker trip) before falling
  through — exactly the "we don't want to spend time waiting for failures if all
  reached limits" the founder called out. One KV read collapses that to an O(1)
  jump to the live tier (or an instant fall-through).
- **Consequence in code:** `packages/llm/src/frontier/pointer.ts` —
  `readActiveTier(kv)` / `advanceActiveTier(kv, fromTier)` / `resetActiveTier(kv)`,
  injected (the package never imports a KV binding directly; `apps/api` wires
  `env.KV`). The pointer is advisory + self-healing: a stale `"none"` only costs a
  fall-through, never a wrong answer.
- **Alternatives rejected:** **Probe every tier per request** — the latency the
  founder rejected. **In-memory per-Worker counter** — lost on cold start and not
  shared across isolates, so exhaustion isn't durable.

### SK-FRONTIER-004 — The lane is excluded from e2e, test-agent, and preview/non-production traffic

- **Decision:** Even when `HAS_FRONTIER_API_KEYS` is `true`, `isFrontierEligible(ctx)`
  returns `false` (lane disabled) for: (a) **e2e test flows** (the `x-nlqdb-e2e`
  marker / e2e bearer), (b) **agents calling our APIs for testing** (the
  stranger-test / synthetic walker / opencheck principals), and (c) **preview /
  non-production deployments** (Cloudflare Workers Versions previews and any
  `ENVIRONMENT !== "production"`). Only genuine production end-user traffic can spend
  founder frontier budget.
- **Core value:** Free (cost-control), Bullet-proof
- **Why:** CI, preview branches, and synthetic test agents generate the *bulk* of
  request volume pre-PMF; letting any of them touch the metered founder keys would
  drain the budget on traffic that has zero user value. The exclusion is the third
  gate (after the constant + pointer) and is the one that makes "enable in prod"
  safe even though preview shares the production build artifact.
- **Consequence in code:** `packages/llm/src/frontier/eligibility.ts` —
  `isFrontierEligible({ environment, isPreview, principalKind, e2e })`; `apps/api`
  populates it from `env.ENVIRONMENT`, the Versions-preview signal, the resolved
  principal, and the e2e header. Tests assert each excluded condition yields `null`
  from the lane with no key access.
- **Alternatives rejected:** **Rely on the hardcoded constant alone** — once flipped
  on for prod, the same build runs on previews; the constant can't distinguish them.
  **A separate preview key set** — still spends money on non-user traffic; exclusion
  is the right shape.

## Progress tracker — "seamless, approachable value" plan

Tick ⬜→✅ on merge. The scorecard row *"Omer's seamless approachable value plan
implemented"* mirrors this and stays at a very low score until **every** row is ✅
(including the frontier lane enabled **and** live in production).

**Approachability — the on-ramp (this PR, mostly shipped):**
- ✅ Two-door home (`SK-WEB-018`) — agent-memory | question-your-ClickHouse, responsive
- ✅ `/app/connect` page + `ConnectForm` (`SK-WEB-019`)
- ✅ 7-host MCP install + click-to-reveal-fallback (`SK-WEB-016`: Cursor/VS Code deep-link, Claude Code/Codex command, Claude/Windsurf/Zed config)
- ✅ BYO-ClickHouse HTTP exec + ClickHouse schema render (`packages/db`)
- ◐ `POST /v1/db/connect` end-to-end + query-time engine dispatch (`SK-DBCONN-001`)
- ✅ Surface parity — SDK `databases.connect`, CLI `nlq db connect`, MCP `nlqdb_connect_database` (elements N/A, documented)

**Best value — the frontier lane (this PR = dormant scaffold):**
- ◐ `HAS_FRONTIER_API_KEYS = false` constant + dormant lane selector (`SK-FRONTIER-001`)
- ⬜ Tiered key rotation + per-tier token budgets (`SK-FRONTIER-002`)
- ⬜ KV `frontier:active_tier` pointer + advance/reset (`SK-FRONTIER-003`)
- ⬜ `isFrontierEligible` exclusion predicate (`SK-FRONTIER-004`)
- ⬜ Wire the lane into `apps/api/src/ask/model-picker.ts` (gated)
- ⬜ Verify current OpenAI model IDs + Anthropic IDs before enabling (P2)
- ⬜ Daily/cron budget-window reset of the KV pointer
- ⬜ Enable in production (`HAS_FRONTIER_API_KEYS = true`) — the final, founder-only step

## Open questions / known unknowns

- **"Redis" vs Cloudflare KV.** nlqdb runs on Cloudflare Workers with **KV** as its
  key-value store (`GLOBAL-013`: no extra paid infra). This feature implements the
  founder's "Redis key" on KV. If a true Redis is ever introduced, `pointer.ts`'s
  injected interface swaps with no lane-logic change. **Defaulting to KV.**
- **Exact frontier model IDs.** Anthropic tiers default to Opus/Sonnet/Haiku
  (`claude-opus-4-8` / `claude-sonnet-4-6` / `claude-haiku-4-5`); OpenAI tier IDs are
  env-configured and **must be P2-verified against the current OpenAI model list**
  before the lane is enabled — recorded here so a stale ID can't ship silently.
- **Budget accounting granularity.** Initial caps are coarse per-tier token counters
  in KV; precise per-request cost accounting folds into the Lago wiring tracked in
  `llm-router` Open questions (Phase 2).
- **AGENTS.md §5 path row.** This feature's globs
  (`packages/llm/src/frontier/**`) should be added to root `AGENTS.md` §5; deferred
  with the `byo-connect` row until `AGENTS.md` is next trimmed (it is over the D4
  20 KB cap; adding a row requires an offsetting net-shrink).

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (index in [`docs/decisions.md`](../../decisions.md)).

- **GLOBAL-026** — LLM strategy: free chain forever, BYOLLM, hosted premium on paid.
  - *In this feature:* the frontier-keys lane is a founder-funded *best-value* path distinct from the three GLOBAL-026 lanes; it never replaces the free chain (it falls through to it when exhausted/ineligible) and never bills users.
- **GLOBAL-025** — North-star: engine quality, onboarding, UX.
  - *In this feature:* the lane is a direct engine-quality lever (frontier answers) and feeds the free-vs-frontier delta KPI; the approachability half advances onboarding + UX.
- **GLOBAL-013** — $0/month free tier; ≤ 3 MiB Workers bundle.
  - *In this feature:* KV (not new infra) backs the pointer; founder keys are the only paid input and are hard-gated + excluded from non-prod.
- **GLOBAL-014** — OTel span on every external call.
  - *In this feature:* frontier provider calls emit the same `gen_ai.*` spans as every other LLM call (`SK-LLM-006`), tagged with the active tier.
