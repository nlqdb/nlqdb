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
**Status:** implemented (Phase 1)
**Owners (code):** `apps/web/src/` (onboarding flow), `apps/api/src/routes/auth/**` (signup), `docs/features/anonymous-mode/FEATURE.md` (anonymous-first pattern)
**Cross-refs:** docs/architecture.md §0.1 (goal-first inversion) · docs/architecture.md §3.1 (marketing site) · docs/architecture.md §3.2 (platform web app) · docs/research/personas.md (P1 Solo Builder — primary persona) · `docs/features/anonymous-mode/FEATURE.md` (Aarav pattern) · `docs/features/web-app/FEATURE.md` (chat surface, Maya happy path)

## Touchpoints — read this skill before editing

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

## GLOBALs governing this feature

Canonical text in [`docs/decisions.md`](../../docs/decisions.md). The list below names the rules that constrain this feature; any skill-local commentary is nested under the rule.

- **GLOBAL-013** — $0/month free tier; no card required; hitting a limit rate-limits, never deletes, never silently upgrades.
- **GLOBAL-007** — Anonymous rate-limit tier is separate from authed-free and paid tiers.

## Open questions / known unknowns

- **Email verification timing.** Better Auth supports magic-link sign-in which doesn't require a separate verify step. If we add password auth later, the verification flow must not block the chat — the non-blocking banner approach (SK-ONBOARD-001) needs explicit implementation.
- **Anonymous DB promotion on signup.** When an anonymous user signs up, the `anon_*` DB should be promoted to their account. The exact promotion flow (rename, re-key, or link) is owned by `docs/features/anonymous-mode/FEATURE.md` and is not yet finalized.
- **MCP confirmation UX.** SK-ONBOARD-004 says MCP waits for an `approve` follow-up query. The exact tool-call shape for this confirmation loop is TBD in `docs/features/mcp-server/FEATURE.md`.
