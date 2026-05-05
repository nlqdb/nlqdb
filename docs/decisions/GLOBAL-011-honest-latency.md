# GLOBAL-011 — Honest latency — show the live trace; never spinner-lie

- **Decision:** When a request is in flight, surfaces show what is
  actually happening (cache lookup, plan, allowlist, exec, summarize)
  with real timings — not a generic spinner. If a step takes long, we
  say what step.
- **Core value:** Honest latency, Effortless UX
- **Why:** A spinner that hides progress trains users to assume the
  worst. A live trace shows exactly where time goes and turns
  perceived latency into legible, cacheable, debuggable information.
  It also makes us better at performance because we *see* every slow
  step.
- **Consequence in code:** `apps/web` streams trace events from the
  ask-pipeline (or polls the OTel-exposed step state) and renders
  them in order. CLI's TTY mode prints each step as it completes.
  The SDK exposes an `onTrace` hook for surfaces to consume.
- **Alternatives rejected:**
  - Generic spinner with "this is taking longer than usual" — gives
    no information.
  - Hide latency below a threshold — users notice anyway, and lose
    trust when the threshold is wrong.
