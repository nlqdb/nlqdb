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
**Status:** implemented (Phase 1); SK-ONBOARD-005 adds north-star instrumentation in Phase 1.5/2 with baselines recorded by **2026-06-01**.

**Contribution to north-star:** Seamless onboarding — this feature IS the second [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md) pillar's surface. SK-ONBOARD-005 wires the TTFV / first-query-success / drop-off / 4-of-5 unguided KPIs.

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

### SK-ONBOARD-005 — Instrument every onboarding KPI in [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md); baseline by 2026-06-01

- **Decision:** Add explicit event emissions for: `onboarding.landing.viewed`, `onboarding.first_query.attempted`, `onboarding.first_query.succeeded` (correct answer per the auto-grader described below), `onboarding.first_query.failed` (with reason), `onboarding.second_query.attempted` (signal for next-step engagement). The web surface records TTFV (`landing → first_query_succeeded` ms) on the existing event pipeline. **First-query-success grading** uses a lightweight LLM-judge prompt run async (no user-facing latency): given (question, returned answer, returned SQL, executed result), did the result answer the question? Output: boolean + one-sentence rationale; stored alongside the event for audit. Baselines for all five KPIs (TTFV p50/p95, first-query-success rate, unguided 4/5 pass rate, drop-off rate) recorded by 2026-06-01; the Phase 2 floor in [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md) is enforced from that date.
- **Core value:** Goal-first, Honest latency, Bullet-proof
- **Why:** "Seamless onboarding" is the second north-star pillar of [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md); without instrumentation it's an aesthetic claim. The five KPIs above are the smallest set that distinguishes "users arrive and bounce" (drop-off) from "users arrive, query, and leave wrong" (success-rate) from "users arrive, succeed, and leave anyway" (retention — owned by `trust-ux/SK-TRUST-004`). The LLM-judge grading is cheap (free chain, async) and unbiased — using returned-SQL as ground-truth would tautologically score everything green.
- **Consequence in code:** New events in `packages/events/src/types.ts` (`onboarding.*` domain). Web surface (`apps/web/src/onboarding/`) emits landing / attempted / succeeded / failed; CLI's `nlq new` + bare-form first-time path emits the same shape (per [`GLOBAL-003`](../../decisions/GLOBAL-003-all-surfaces-one-pr.md)). The async LLM-judge runs via `ctx.waitUntil` from `apps/api/src/ask/` and posts a `feature.onboarding.graded` event back to the pipeline. Grafana panel `onboarding-kpis` is the canonical view; the weekly cron from `quality-eval/SK-QUAL-002` summarizes into LogSnag `#north-star`. Unguided user-test pass-rate (the 4/5 number) stays a manual founder-driven metric per [`founder-playbook.md`](../../founder-playbook.md), recorded in the same Grafana panel as an annotation.
- **Alternatives rejected:** Heuristic grading (exact-match SQL or row-count) — too brittle; user's NL phrasing rarely matches the gold SQL even for correct answers. Synchronous LLM-judge — adds user-facing latency violating [`GLOBAL-011`](../../decisions/GLOBAL-011-honest-latency.md). No baseline date — repeats the failure mode `SK-QUAL-005` prevents. Self-report success ("did this answer your question?" prompt) — biases low; users don't reliably distinguish "answer was right" from "answer was useful".

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list below names the rules that constrain this feature; any feature-local commentary is nested under the rule.

- **GLOBAL-007** — No login wall before first value.
  - *In this feature:* Anonymous rate-limit tier is separate from authed-free and paid tiers.
- **GLOBAL-013** — $0/month free tier; no card required; hitting a limit rate-limits, never deletes, never silently upgrades.
- **GLOBAL-020** — No "pick a region", no config files in the first 60s.
  - *In this feature:* the TTFV KPI measures the mechanism — landing → first answer ≤ 60 s with no config form between.
- **GLOBAL-025** — North-star: engine quality, onboarding, UX — each with explicit KPIs.
  - *In this feature:* the onboarding north-star pillar lives here. KPI floors (TTFV, first-query success, drop-off, unguided 4/5) are the Phase 2 / Phase 3 exit gates; `SK-ONBOARD-005` ships the instrumentation.

## Open questions / known unknowns

- **Email verification timing — Resolved; Parked until password auth lands** (`GLOBAL-033`, UX → goal-first + speculative-scope). Magic-link sign-in (the default) needs no separate verify step, so there is nothing to block today. *If* password auth is ever added, verification uses the non-blocking banner (`SK-ONBOARD-001`) and never gates the chat — wired in that slice, not on spec.
- **Anonymous DB promotion on signup** — Resolved (cross-ref): finalized as the "link" option by [`SK-ANON-003`](../anonymous-mode/FEATURE.md) — adoption is a one-row `UPDATE databases SET user_id, adopted_at`, never a rename or data move (`POST /v1/anon/adopt`, live on `main`). The signup flow calls that path; nothing onboarding-specific is open.
- **MCP confirmation UX** — Resolved per `GLOBAL-033` (reuse what's built): the `SK-ONBOARD-004` approve loop reuses the existing `confirm_required` envelope (`SK-TRUST-001`) + an `approve` follow-up query — no new tool-call shape. **Parked until** the MCP confirm slice; cross-ref [`mcp-server/FEATURE.md`](../mcp-server/FEATURE.md).
