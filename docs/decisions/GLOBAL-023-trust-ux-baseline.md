# GLOBAL-023 — Trust UX baseline

- **Decision:** Every path that turns natural language into something
  executable enforces three rules at the user surface: (1) any write
  or DDL shows a **diff preview** before commit, (2) every response
  carries the **compiled SQL** (or compiled plan) as a visible trace,
  (3) plans with confidence below the per-tier floor **refuse**
  rather than guess.
- **Core value:** Bullet-proof, Honest latency, Goal-first
- **Why:** Text-to-SQL in 2026 hits 50–70% accuracy on messy schemas
  and the canonical failure mode is "syntactically right, semantically
  wrong" — an answer that *executes* and looks plausible but joins
  the wrong table or omits a filter. Layered guardrails work at the
  parser level (`SK-SQLALLOW-*`) and at the schema-fit level
  (`SK-ASK-*`), but the user-surface layer is the one that catches
  the silent semantic failure. Diff-preview + visible-trace +
  refuse-on-low-confidence collapses the "looked right so I trusted
  it" surface to zero. `GLOBAL-015` gives power users a raw escape
  hatch; this rule makes the NL path safe by construction.
- **Consequence in code:** Every write/DDL response shape includes a
  `diff` block (rows-affected sample + structural-change summary) that
  the surface MUST render before the commit action is enabled.
  `/v1/ask` responses include the compiled SQL in the `trace` block
  on every path, not only on `?trace=1`. The LLM router emits a
  `confidence` score on every plan; `ask-pipeline` refuses with
  `low_confidence` (instead of executing) when the score is below a
  per-tier floor. Floor values are placeholders until the
  [`quality-eval`](../features/quality-eval/FEATURE.md) harness
  calibrates them against real benchmark data. Refusal is a typed
  error per `GLOBAL-012` ("one sentence with the next action").
- **Alternatives rejected:**
  - Spinner-and-pray (silent commit) — fails the bullet-proof value;
    the silent-wrong-update is the exact failure this rule prevents.
  - Diff preview only on destructive ops — misses the
    silent-wrong-update on a non-destructive `UPDATE` that touches the
    wrong rows.
  - Show SQL only on `?trace=1` — opt-in honesty is the same as no
    honesty; humans don't toggle the flag when they need it.
  - Force a re-prompt on low confidence — slow and frustrating; the
    refuse + suggest-clarification path is faster and surfaces the
    ambiguity to the user.
