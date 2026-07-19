---
name: onboarding
description: First-60-seconds experience — zero-friction signup, goal-first on-ramp, anti-patterns we refuse.
when-to-load:
  globs:
    - apps/web/src/onboarding/**
    - apps/web/src/components/onboarding/**
  topics: [onboarding, signup, first-query, anonymous-mode]
---

# Feature: Onboarding

**One-liner:** First-60-seconds experience — zero-friction signup, goal-first on-ramp, anti-patterns we refuse.
**Status:** implemented (Phase 1); SK-ONBOARD-006 ships the first-10-queries KPI instrument (2026-07-01); SK-ONBOARD-008 adds one-click starter goals to the anon create surface (2026-07-09); SK-ONBOARD-005 ships the TTFV (2026-07-09) + drop-off funnel (2026-07-10) instruments on the anon create surface.

**Contribution to north-star:** Seamless onboarding — this feature IS the second [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md) pillar's surface. SK-ONBOARD-005/006 wire the TTFV / first-10-queries-success / drop-off / 4-of-5 unguided KPIs.

**Owners (code):** `apps/web/src/` (onboarding flow), `apps/api/src/routes/auth/**` (signup), `docs/features/anonymous-mode/FEATURE.md` (anonymous-first pattern)
**Cross-refs:** docs/architecture.md §0.1 (goal-first inversion) · docs/architecture.md §3.1 (marketing site) · docs/architecture.md §3.2 (platform web app) · docs/research/personas.md (P1 Solo Builder — primary persona) · `docs/features/anonymous-mode/FEATURE.md` (Aarav pattern) · `docs/features/web-app/FEATURE.md` (chat surface, Maya happy path)

## Touchpoints — read this feature before editing

- `apps/web/src/` (onboarding pages and flow)
- `apps/api/src/routes/auth/**` (signup endpoint)

## Decisions

### SK-ONBOARD-001 — No wizard, no plan-picker, no modal walls before first query

- **Decision:** The onboarding flow has zero wizard steps, no "choose your plan" screen before first query, no email-verification wall before first query, no modals interrupting the chat after first query, and no "getting started" video. The user's first action is a query, not a form.
- **Core value:** Goal-first, Effortless UX, Free
- **Why:** Every additional step before first value is a dropout opportunity. The fastest path to value is also the most honest one — the user came to talk to a database, so let them talk to a database. Email verification, plan selection, and feature tours all add latency-to-value that the product's "under 60 seconds" promise cannot absorb. The anti-pattern list below was written from watching real users drop during wizard steps in comparable products.
- **Consequence in code:** `apps/web/src/` has no wizard component, no onboarding modal stack, no plan-picker gate. The first authenticated page after signup lands on the chat. Email verification, if required by Better Auth, must not block the chat — verified state is surfaced as a non-blocking banner.
- **Alternatives rejected:** Multi-step wizard ("what's your use case? pick a template") — adds 45–90 seconds; drops ~30% of users. Email-verification wall — blocks the anonymous-first pattern (`SK-ANON-001`). "Choose your plan" on signup — violates `GLOBAL-013` (no card required for free tier); a plan choice before value feels like a bait-and-switch.
- **Source:** docs/architecture.md §0.1 · plan.md §1.1 (archived)

### SK-ONBOARD-002 — No auto-charge without a second explicit confirmation

- **Decision:** No charge ever fires without a second explicit confirmation from the user. The first confirmation is "enter card" (Stripe setup-intent); the second is "confirm upgrade" or "confirm this charge" on the billing surface. Auto-upgrades and auto-charges are permanently off.
- **Core value:** Bullet-proof, Honest latency, Free
- **Why:** Surprise charges are the single fastest way to turn a free-tier user into a vocal detractor. The free-tier economics (`GLOBAL-013`) work because users trust that nothing expensive happens silently. A user who gets an unexpected $25 charge tells five people; a user who gets a clear "you're about to be charged $25 — confirm?" tells nobody.
- **Consequence in code:** Stripe billing uses setup-intents only at card entry; actual charge requires a second explicit action on the billing surface. No code path in `apps/api/src/billing/**` fires a Stripe `PaymentIntent.create` without a user-initiated request. CI should fail any PR that adds a background-triggered charge.
- **Alternatives rejected:** Auto-upgrade on limit hit ("upgrade to continue") — common pattern but fundamentally dishonest; contradicts `GLOBAL-013`. Trial period that auto-charges — explicitly rejected in the pricing design; the free tier *is* the trial.
- **Source:** docs/guidelines.md §6 (bullet-proof checklist) · `docs/features/stripe-billing/FEATURE.md` (SK-STRIPE-001)

### SK-ONBOARD-003 — Anonymous-first: first query before signup prompt

- **Decision:** The user can run their first query without signing up. The signup prompt appears after value is demonstrated, not before. See `docs/features/anonymous-mode/FEATURE.md` for the full anonymous-mode design.
- **Core value:** Goal-first, Free, Effortless UX
- **Why:** The 60-second promise only holds if the clock doesn't start ticking on a signup form. Asking for an account before the user has seen the product work is the standard SaaS on-ramp; our positioning is that we invert it. Every SaaS that has A/B tested anonymous-first vs. signup-first has found higher activation on anonymous-first. Our version is more aggressive: the anonymous query uses a real (ephemeral) DB, not a canned demo.
- **Consequence in code:** `POST /v1/ask` accepts anonymous device tokens (Bearer `anon_…`) and provisions a real ephemeral DB. The web surface issues the device token on first load without a network call. The `anon_*` DB is promoted to the user's account on signup (no data loss). Rate limit is the separate anonymous tier (`SK-ASK-006`).
- **Alternatives rejected:** Require signup before first query — standard SaaS, measurably worse activation. Fake demo data instead of a real query — users can tell, and "we ran your query against a real DB" is the trust moment we want.
- **Source:** `docs/features/anonymous-mode/FEATURE.md` · docs/architecture.md §0.1

### SK-ONBOARD-004 — Destructive ops show a diff and require a second Enter before execution

- **Decision:** Any query that the system classifies as destructive (UPDATE/DELETE/DROP touching > 1 row, or any DDL on non-empty tables) shows a plain-English diff and row-count preview, and requires the user to press Enter a second time (or click "Approve") before execution. This applies in all surfaces: web chat, CLI, and MCP (where the agent surfaces the confirmation to the user).
- **Core value:** Bullet-proof, Honest latency
- **Why:** The trust-building moment for destructive ops is the diff preview — the user sees "this will delete 183 rows" before it happens, not after. The second-Enter is the minimum friction needed to prevent finger-slip mass deletes. It also de-risks the NL ambiguity problem: if the LLM misunderstood "delete old orders" and the diff shows 50k rows, the user catches it before any data is gone.
- **Consequence in code:** The confidence gate in the `/v1/ask` pipeline (step 5 of the LLM loop — see `SK-ASK-002`) sets `requires_confirm: true` on destructive plans. The web surface renders the diff chip and blocks the approve button until a second interaction. CLI prompts "Press Enter to approve (Ctrl-C to cancel)." MCP returns the diff in the tool result and waits for a `nlqdb_query("...", "approve")` follow-up.
- **Alternatives rejected:** Single-click approve — too fast; users approve without reading. Require typing "DELETE" to confirm — patronizing for small deletes; still necessary for mass-delete (add this as a per-surface escalation for >10k rows). No confirmation at all — explicitly rejected; the Replit incident (`docs/research-receipts.md §1`) shows what happens without guardrails.
- **Source:** docs/guidelines.md §6 (bullet-proof checklist row "Accidental mass delete")

### SK-ONBOARD-005 — Instrument the remaining onboarding funnel KPIs in [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md)

- **Decision:** Instrument the two GLOBAL-025 onboarding KPIs the first-10 counter (`SK-ONBOARD-006`) doesn't cover: **TTFV** (`landing → first answer` ms) and **drop-off** (`landing.viewed` → `first_query.attempted` → `second_query.attempted`). Both ship as client funnel signals from the anon create surface: **TTFV** as `onboarding.first_answer` (`{ ttfv_ms, surface }`), and **drop-off** as `onboarding.landing_viewed` (`{ surface }`, once per mount) + `onboarding.query_attempted` (`{ surface, ordinal }`, ordinal 1 = first_query.attempted, 2 = second_query.attempted, then silent). The success KPI (**first-10-queries success**, founder directive 2026-07-01) is instrumented by `SK-ONBOARD-006` below, not by an event.
- **Core value:** Goal-first, Honest latency, Bullet-proof
- **Why:** "Seamless onboarding" is the second north-star pillar of [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md); without instrumentation it's an aesthetic claim. The KPI set distinguishes "arrive and bounce" (drop-off) from "arrive, query, and leave unanswered" (first-10 success) from "arrive, succeed, and leave anyway" (retention — `trust-ux/SK-TRUST-004`). TTFV must be **browser-measured** (`performance.now()` at the first answer = honest ms since page load); the server never sees when the user landed, so it can't ride a D1 counter the way the first-10 KPI does.
- **Consequence in code:** TTFV is `apps/web/src/lib/ttfv.ts` (`makeTtfvOnce()`, a fire-once recorder + test) called from `CreateForm.submit()`'s `ok` arm; drop-off is the twin `apps/web/src/lib/dropoff.ts` (`makeDropoffFunnel()` + test) — `landing()` fires once on mount, `attempt()` in `submit()` **before** the network call (ordinal capped at 2), capturing a 2nd attempt even when the `SK-ANON-012` one-shot cap redirects to sign-in. Both relay through the client `emit()` LogSnag funnel (`lib/logsnag.ts`) — the same channel as the other `home.*`/`onboarding.*` signals (`SK-ONBOARD-008`). **Supersedes** the original "new `packages/events` `onboarding.*` events + CLI emission" (P3): these are single-page browser signals — not cross-surface capabilities — so [`GLOBAL-003`](../../decisions/GLOBAL-003-all-surfaces-one-pr.md) needs no CLI/SDK/MCP propagation (same as `SK-ONBOARD-008`), and `SK-ONBOARD-006` already set the lighter-than-events-pipeline precedent. The 4/5 unguided user-test rate stays manual per [`founder-playbook.md`](../../founder-playbook.md).
- **Alternatives rejected:** No instrumentation (aesthetic claim). New `packages/events` `onboarding.*` server events (superseded above — heavier, and the server can't measure landing time). Async LLM-judge correctness grading (the pre-2026-07-01 plan for the retired first-query-success KPI) — grades *correctness*, a stricter/heavier bar than the founder's "answered successfully"; re-open only if a correctness KPI is added.

### SK-ONBOARD-006 — First-10-queries KPI measured by saturating D1 counters, not the events pipeline

- **Decision:** The [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md) first-10-queries success KPI (per new user/DB, share of the first 10 `/v1/ask` calls answered successfully; success = 2xx with a non-refused answer = the orchestrator's `ok` arm, confirm previews included) is instrumented as two saturating columns on the D1 `databases` row — `first10_asks`, `first10_ok` (migration `0020_first10_counters.sql`). The `/v1/ask` handler bumps them fire-and-forget via `ctx.waitUntil` on every routed completion; the `first10_asks < 10` SQL guard stops counting at the ordinal. The KPI read is one D1 query — `SELECT SUM(first10_ok) * 1.0 / SUM(first10_asks) FROM databases WHERE first10_asks > 0` — run by the `/daily` scorecard pull (the *stranger-honest* form that excludes synthetic + founder/test traffic is `SK-ONBOARD-007`).
- **Core value:** Simple, Free, Honest latency
- **Why:** The obvious instrument is the events pipeline, but `ask.completed` is success-only by design (`SK-EVENTS-009`) and adding failure rows means widening the Tinybird `query_log` schema (documented "do not widen") plus new event/sink/wire/test surface — ~6 files for a number one UPDATE answers. D1 is already on the `/v1/ask` completion path (the `last_queried_at` touch), so the counter adds no new external system and needs no read-side ordinal windowing.
- **Consequence in code:** `bumpFirst10()` in `apps/api/src/index.ts` next to `touchLastQueried()`; four call sites (SSE/JSON × ok/error). Calls that return before DB routing (creates, 409 `candidate_dbs`, anon pre-DB 429s) are not counted — the KPI is defined over asks routed to a DB, and per-DB is the unit ("per new user/DB").
- **Alternatives rejected:** `ask.failed` event → Tinybird `query_log` — schema widening + multi-package surface, and the analyser doesn't need failure rows yet. OTel counter + KV ordinal — the number lands in Grafana, which the scorecard pull can't read today, and burns KV write budget per ask.

### SK-ONBOARD-007 — First-10 KPI excludes synthetic (walker) traffic: UA-skip at the write, principal-join at the read

- **Decision:** The [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md) onboarding KPI is defined over **genuine strangers only** — the /daily loop mandates excluding nlqdb's own stranger-test bot traffic. Two coupled exclusions keep `SK-ONBOARD-006`'s counters honest: **(write)** `bumpFirst10()` in `apps/api/src/index.ts` skips the bump when the request User-Agent is nlqdb's walker UA (`isSyntheticUserAgent()`, `apps/api/src/synthetic-ua.ts`, matches the stable token `nlqdb-stranger-test` set in `tools/stranger-test/src/runner.ts`); **(read)** the scorecard KPI query joins `databases.tenant_id → user.email` and excludes the known founder/test principals (the roster maintained in `scorecard.md` row #2). The honest read:

  ```sql
  -- genuine-stranger first-10 success rate (0 rows ⇒ not yet measurable)
  SELECT SUM(d.first10_ok) * 1.0 / NULLIF(SUM(d.first10_asks), 0)
  FROM databases d
  LEFT JOIN user u ON u.id = d.tenant_id
  WHERE d.first10_asks > 0
    AND (u.email IS NULL          -- anon (walker already excluded at write)
         OR (u.email NOT LIKE '%@salfati.group'
             AND u.email NOT IN ('omer.hochman@gmail.com', 'test@example.com')));
  ```

- **Core value:** Honest latency (the KPI reads what strangers experience, not what our bots do)
- **Why:** The browser walkers (flows 001–003) drive the *real* anonymous `/v1/ask` path, so their asks bump the same counters a stranger's would. Anonymous walker DBs carry no `user` row, so the read-side principal join can't tell walker from stranger — only the request UA can. The write-side skip is the only place that distinction survives. Authed non-stranger traffic (founder + `test@example.com`) *is* recoverable by the read-side join, so it stays a read filter rather than a hardcoded allowlist on the hot path (P5).
- **Consequence in code:** one pure exported helper `isSyntheticUserAgent()` + a single guard at the top of `bumpFirst10()` (covers all four SSE/JSON × ok/error call sites); the `last_queried_at` touch is deliberately left alone — TTL eviction (`SK-ANON-002`) is a separate mechanism. Measured 2026-07-07: every pre-fix counter row was founder/test — genuine-stranger N = 0, so the previously-reported 35–37% was 100% non-stranger and the true KPI is *not yet measurable*.
- **Alternatives rejected:** a `synthetic` column on `databases` set at create-time from the creating UA — a migration + plumbing the UA into both INSERT sites (`neon-provision.ts`, `db-connect/connect.ts`, the latter security-sensitive) for a distinction the counter's own write already knows; and create-UA ≠ ask-UA in general. Skipping the bump is smaller and attributes the ask, not the create.
  *Amended 2026-07-19 by [`SK-GTM-005`](../gtm-metrics/FEATURE.md) (founder: count real unique users): `databases.synthetic` now exists — for the funnel/unique-device question, which ask-level attribution can't answer. The first-10 KPI mechanism here is unchanged (write-side bump skip, not the column).*

### SK-ONBOARD-008 — Starter goals on the anonymous create surface; fill, never auto-submit

- **Decision:** The anonymous create form (`CreateForm`, live at `/app/new`, `/vs/*`, `/solve/*`, `/agents`) renders a short row of one-click **starter build goals** (`apps/web/src/data/create-starters.ts`) below the input. Clicking a chip only **fills** the goal input (via the same debounced `onGoalChange` draft path) and emits the `home.starter_clicked` [`GLOBAL-024`](../../decisions/GLOBAL-024-demand-signal-telemetry.md) funnel signal — it never auto-submits. Starters are hidden once a DB has been created (`!result`).
- **Core value:** Goal-first, Effortless UX, Honest latency
- **Why:** The device gets exactly **one** `/v1/ask` create call before the `SK-ANON-012` cap sends it to sign-in, so a stranger's *first* goal is their only shot — the single highest-leverage agent-controllable input to the `SK-ONBOARD-006` first-10-queries-success KPI. A blank "What are you building?" field is the classic first-query-paralysis point; a placeholder alone (`SK-WEB-002`) doesn't show what the field *accepts*. Curated, known-good build goals turn the one free call into a legible payoff instead of a weak schema. **Fill-not-submit is the load-bearing part:** auto-submitting on click would let a mis-tap silently spend the one-shot cap.
- **Consequence in code:** `create-starters.ts` (typed `CreateStarter[]` + invariants test) is the single source of the list; `CreateForm.onStarter()` fills + emits; chip styles reuse the existing `--rule-2`/`--accent-line` tokens. No API/SDK/CLI/MCP surface — this is a pure web-form affordance (a query box, not a cross-surface capability), so [`GLOBAL-003`](../../decisions/GLOBAL-003-all-surfaces-one-pr.md) does not require propagation.
- **Alternatives rejected:** auto-submit on click (fastest to value, but burns the `SK-ANON-012` one-shot on a mis-tap — rejected). Reusing `showcase-examples.ts` (those are *query* goals for the chat box; this field takes *build* goals — wrong shape). A long exhaustive list (every chip competes for the same fold; the strongest few win — `SK-WEB` carousel rationale).

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list below names the rules that constrain this feature; any feature-local commentary is nested under the rule.

- **GLOBAL-007** — No login wall before first value.
  - *In this feature:* Anonymous rate-limit tier is separate from authed-free and paid tiers.
- **GLOBAL-013** — $0/month free tier; no card required; hitting a limit rate-limits, never deletes, never silently upgrades.
- **GLOBAL-020** — No "pick a region", no config files in the first 60s.
  - *In this feature:* the TTFV KPI measures the mechanism — landing → first answer ≤ 60 s with no config form between.
- **GLOBAL-025** — North-star: engine quality, onboarding, UX — each with explicit KPIs.
  - *In this feature:* the onboarding north-star pillar lives here. KPI floors (TTFV, first-10-queries success ≥ 95%, drop-off, unguided 4/5) are the Phase 2 / Phase 3 exit gates; `SK-ONBOARD-005`/`SK-ONBOARD-006` ship the instrumentation.

## Open questions / known unknowns

- **Email verification timing — Resolved; Parked until password auth lands** (`GLOBAL-033`): magic-link (the default) needs no verify step; if password auth ever lands, verification is the `SK-ONBOARD-001` non-blocking banner, wired in that slice.
- **Anonymous DB promotion on signup** — Resolved by [`SK-ANON-003`](../anonymous-mode/FEATURE.md): adoption is a one-row UPDATE (`POST /v1/anon/adopt`, live on `main`); nothing onboarding-specific is open.
- **MCP confirmation UX** — Resolved per `GLOBAL-033` (reuse what's built): the `SK-ONBOARD-004` approve loop reuses the existing `confirm_required` envelope (`SK-TRUST-001`) + an `approve` follow-up query — no new tool-call shape. **Parked until** the MCP confirm slice; cross-ref [`mcp-server/FEATURE.md`](../mcp-server/FEATURE.md).
