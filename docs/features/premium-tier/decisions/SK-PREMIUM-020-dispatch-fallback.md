# SK-PREMIUM-020 — A premium-lane dispatch failure falls back to the free chain (surfaced, unmetered), never `llm_failed` for a paid user

Parent feature: [`premium-tier/FEATURE.md`](../FEATURE.md). Amends the "no
failover" posture of [`SK-LLM-016`](../../llm-router/decisions/SK-LLM-016-byollm-dispatch-lane.md)
and [`SK-LLM-046`](../../llm-router/decisions/SK-LLM-046-ai-gateway-auth-token.md)
("the premium lane remains gateway-only") for the case where the gateway-only
premium lane faults.

- **Decision:** When the hosted-premium lane (`buildPremiumRouter`,
  `SK-PREMIUM-009`) throws on any op (`route`/`plan`/`summarize`), the `/v1/ask`
  handler serves the request on the **free chain** instead of returning
  `llm_failed`. The switch is a *lane* fallback wired at the handler
  (`withFallbackRouter`), not an in-router provider failover — the premium
  router itself stays fail-loud with no internal hedge (`SK-LLM-016`
  unchanged). It is **never silent** (`GLOBAL-023`): the response `premium`
  trace carries `{ lane: "free", premium_fallback: true, reason:
  "dispatch_error" }`, the ask span gets `llm.premium_fallback=true`, and the
  underlying provider error is `console.warn`-logged. It is **unmetered and
  never charged**: the free leg never fires the premium `onUsage` sink, so no
  allowance slot is consumed and nothing bills — identical to a plan-cache hit
  (`SK-PREMIUM-007`).
- **Core value:** Bullet-proof, Effortless UX, Honest latency
- **Why:** The free chain carries a direct (non-gateway) tail
  (`SK-LLM-047`), so an AI-Gateway fault it sails through takes the gateway-only
  premium lane down with no backstop. Left unguarded that produced the absurd,
  observed bug: a **paying** customer got `{"error":{"status":"llm_failed"}}`
  (and the "the free model sucks" nudge) on the very fault a **free** user
  never noticed — paid strictly worse than free. `SK-LLM-016`'s "fail loud, no
  failover" exists to stop a *silent* downgrade that hides a failure and
  re-bills a bad key; a *surfaced, logged, unmetered* fallback violates neither
  goal (the failure is loud in the trace + logs + span; nothing is billed) and
  restores the invariant that a paid user is never worse off than a free one.
  This is the same posture the feature already takes at allowance exhaustion
  (`SK-PREMIUM-011` overflow→fallback) and at payment failure (`GLOBAL-033`:
  route premium DBs to the free chain, never block the product) — extended to
  infra failure.
- **Consequence in code:** `withFallbackRouter(primary, fallback, onFallback)`
  in `packages/llm/src/fallback-router.ts` wraps the premium router with the
  free router; a caller-aborted request re-throws (not a premium failure).
  `apps/api/src/index.ts` builds the premium `router` as
  `withFallbackRouter(buildPremiumRouter(…), freeRouter, …)`, sets
  `premiumDispatchFellBack` + the span attr + the log in `onFallback`, and
  `settlePremium` returns the `premium_fallback` trace (instead of `null`) when
  a premium run consumed zero billable tokens *because it fell back* (the
  plan-cache-hit zero-token case stays trace-silent). The premium-lane meter
  math is untouched — a fallback simply never reaches it.
- **Alternatives rejected:**
  - **Keep the hard `llm_failed`** — the bug itself; a paid user seeing a worse
    outcome than a free user is indefensible (`GLOBAL-025` UX must not degrade).
  - **In-router failover to a free provider inside `buildPremiumRouter`** —
    reintroduces the silent-downgrade / split-telemetry failure `SK-LLM-016`
    rejects, and would let a premium *answer* quietly bill a free-provider
    completion. The handler-level lane switch keeps the two lanes' telemetry and
    billing cleanly separate.
  - **Give the premium lane its own direct (non-gateway) Anthropic leg** — real
    money on every fallback token with no allowance/meter path, and still a
    second gateway-independent egress to provision; the $0 free chain the user
    already gets for free is the honest backstop.
