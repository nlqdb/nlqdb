# GLOBAL-040 — Ambiguity and low confidence resolve as a guided one-click turn, never a dead-end error

- **Decision:** Every point on the NL→executable path where the system would
  otherwise **refuse or dead-end** on ambiguity or low confidence instead
  returns a **`clarify_required` guided turn**: one sharp question plus up to a
  few **one-click options** — re-sendable goals that resume the user's original
  intent. This is the *single* contract for all such cases: routing ambiguity
  (`ambiguous_db`), destructive ambiguity (`SK-ASK-026`), a missing required
  reference (`SK-ASK-031`), and **plan-level low confidence** (`SK-TRUST-003`).
  - The one guarantee carried over from the old "refuse rather than guess"
    rule is preserved: a plan whose confidence is below the tier floor is
    **still never silently executed**. What changes is only the *surface
    outcome* — a guided continuation, not a typed failure.
  - `low_confidence` is therefore a **`clarify_required` clarification**
    (its `options` built from the planner's candidate readings), **not** a
    standalone error code.
  - **Last-resort fallback:** only when no answerable question can be formed
    (no candidate readings at all) does the path emit a plain one-sentence
    typed error ([`GLOBAL-012`](./GLOBAL-012-one-sentence-errors.md)). So this
    is strictly a UX upgrade over the prior behaviour — never a new failure
    mode.
  - **Supersedes [`GLOBAL-023`](./GLOBAL-023-trust-ux-baseline.md) rule (3)**
    ("plans below the floor refuse rather than guess" → "clarify rather than
    guess"). GLOBAL-023 rules (1) diff-preview-on-write and (2) visible-SQL-trace
    are unchanged.
- **Core value:** Goal-first, Bullet-proof, Honest latency
- **Why:** A dead-end error ("nlqdb wasn't confident enough to run it") forces
  the user to restart from scratch — the exact unhappy path the "refuse" wording
  kept endorsing. The information needed to move forward — the candidate
  readings — already exists at the moment of refusal; withholding it behind an
  error is a self-inflicted wound. The codebase already proved the pattern works
  three times (`SK-ASK-014` / `SK-ASK-026` / `SK-ASK-031` each folded a dead-end
  into `clarify_required`); this GLOBAL makes it the rule so no future ambiguity
  ships as a dead-end. Reframing refusal as a guided turn keeps the
  anti-silent-wrong-answer guarantee (the below-floor plan is still not run)
  while removing the fast-fail feel — the [`GLOBAL-025`](./GLOBAL-025-north-star.md)
  UX pillar and the refuse-vs-hallucinate KPI now count *clarify* turns, which
  is the same "declined to guess" signal minus the dead-end.
- **Consequence in code:**
  - `low_confidence` is removed as a standalone code (`@nlqdb/errors` registry,
    `@nlqdb/sdk` error union, the MCP phrasing table) and becomes
    `clarify_required` with `clarification: "low_confidence"` and `options`.
    Every surface already renders `clarify_required` as guided options — web
    chips (`ChatPanel`), CLI numbered choices (`renderClarify`), MCP structured
    `details.options` — so a low-confidence outcome is a happy turn on **all**
    surfaces by construction, with **no** new per-surface branch.
  - The plan-confidence floor (`SK-TRUST-003`) stays **calibration-gated** on
    the [`quality-eval`](../features/quality-eval/FEATURE.md) harness; when it
    activates it must return the clarify turn (options from the planner's
    candidate readings), never a typed error. This GLOBAL fixes the *shape* of
    that outcome before it ships, so it cannot regress into a dead-end.
  - The free-model nudge ([`SK-PREMIUM-004`](../features/premium-tier/FEATURE.md))
    no longer treats `low_confidence` as a model-quality *error* — a guided
    clarify is help, not a struggle to upsell over; the ok-path
    sub-floor-confidence nudge (an answer that *ran* below the floor) is
    unchanged.
- **Alternatives rejected:**
  - Keep the typed `low_confidence` error and just add per-surface rendering —
    leaves two parallel clarify rails (`alternatives` vs `options`) and a
    standalone code every new surface must special-case; the codebase already
    committed to the single `clarify_required` rail.
  - Auto-execute the best below-floor plan with a warning — reintroduces the
    silent-wrong-answer this whole family exists to prevent (`GLOBAL-023`).
  - Activate an uncalibrated floor now to "make it real" — over-clarifies
    (friction on confident answers), the opposite failure; floor calibration
    stays with `quality-eval`.
