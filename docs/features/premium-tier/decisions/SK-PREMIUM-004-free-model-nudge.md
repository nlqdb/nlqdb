# SK-PREMIUM-004 — In-context free-model nudge fires when the free chain visibly struggled, never on cost surprise, and never for a premium user

Parent feature: [`premium-tier/FEATURE.md`](../FEATURE.md).

- **Decision:** When the user is on the strict-$0 (free) chain *and* a reply
  visibly struggled — it failed on a model-quality code (`llm_failed` = couldn't
  plan, `sql_rejected` = produced disallowed SQL, or `schema_mismatch` **only**
  on the pre-flight LLM-hallucination path (non-empty `referencedTables`), not
  the exec-catch infra path (`SK-ASK-016`/`SK-ASK-019`)) or came back below the
  `0.7` plan-confidence floor — the chat renders a short, non-blocking nudge
  below that reply: a one-line warning plus a single "Switch model" CTA that
  opens the header `ModelPicker`. The nudge never blocks the response — the
  free-chain answer/error renders first; the nudge is *additional* context, not
  a paywall. It is gated on the *struggled* condition and on *free chain* — a
  BYOLLM/frontier user **and a paid user auto-routed to the hosted-premium
  model** never see it. The founder-approved copy is blunt — *"The free model
  sucks — use a frontier model for better answers."* — overriding the softer
  `GLOBAL-026` "free is great" framing: conversion over brand tone.
- **Core value:** Effortless UX, Honest latency, Goal-first
- **Why:** The free chain sometimes errors, and when it doesn't its answers can
  be lower-accuracy than a frontier model — with no affordance telling the user
  a better model exists. Firing *only* when the free model actually struggled
  keeps it out of the way for queries it handles fine, so it isn't
  banner-blindness. Gating on the free chain avoids the wrong message ("the free
  model sucks") reaching a user who already brought a frontier key **or is
  paying for the hosted-premium model** — for whom the nudge is both false
  ("free") and useless (switching does nothing). Rendering below the answer (not
  modal) preserves `GLOBAL-007` ("no login wall before first value"). Never
  firing on "we're about to bill you more" prevents the dark pattern where a
  customer thinks they hit a cap when they really hit a sales prompt.
- **Consequence in code:** `apps/web/src/components/chat/FreeModelNudge.tsx`
  renders the warning + CTA. `ChatPanel` gates it on `onFreeChain &&
  freeChainStruggled(reply)`: `freeChainStruggled`
  (`free-model-nudge-gate.ts`) reads the reply's error `code` or
  `trace.confidence` against `LOW_CONFIDENCE_THRESHOLD = 0.7`; `onFreeChain` is
  learned from the `ModelPicker`'s `BYOLLM_STATUS_EVENT` broadcast and is true
  only when `configured === false` **and** `premiumActive === false` — a paid,
  active user on a live-premium deployment with no BYOLLM key is auto-routed to
  the premium model, so they are not on the free chain (`SK-PREMIUM-020` fixed
  the bug where such a user saw this nudge on a premium failure). The CTA
  dispatches `MODEL_PICKER_OPEN_EVENT`; `ModelPicker` listens, opens, and
  scrolls itself into view. This is web-only per `GLOBAL-002` — programmatic
  surfaces expose `trace.confidence` and the error code and let the embedding
  app render its own UI. The one-click Stripe-Checkout upgrade action and the
  per-(user, db) "dismiss for 30d" preference remain **deferred**.
- **Alternatives rejected:**
  - Fire on the classifier `hard_plan` verdict — no such verdict is surfaced to
    any client today; reusing the confidence floor + error code that already
    ride the response was lighter.
  - Show the nudge on every free reply — banner blindness within minutes.
  - Show it to BYOLLM/frontier/premium users too — the copy is wrong for them
    and switching does nothing.
  - Block the response and require an upgrade — turns the nudge into a paywall;
    collapses activation, breaks the "answer first" promise.
- **Source:** docs/architecture.md §0 · docs/architecture.md §6 (honest
  billing) · `SK-WEB-005` (three-part chat response) ·
  [`GLOBAL-026`](../../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md)
