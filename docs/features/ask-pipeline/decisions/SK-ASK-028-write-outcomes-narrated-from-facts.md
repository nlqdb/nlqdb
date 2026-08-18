# SK-ASK-028 — Write outcomes are narrated from the engine's facts; `summarize` never sees a write

Parent feature: [`ask-pipeline/FEATURE.md`](../FEATURE.md). Narrows
[`SK-ASK-005`](../FEATURE.md#sk-ask-005) (conditional summarize) on the write
arm; pairs with
[`SK-TRUST-006`](../../trust-ux/FEATURE.md#sk-trust-006) (zero-effect writes).

- **Decision:** On the `/v1/ask` write branch the `summary` is composed
  server-side from the executed statement's verb, table, and the engine's
  affected-row count (`writeOutcomeSummary` in `apps/api/src/ask/diff.ts`) —
  e.g. *"Inserted 1 row into ideas."* The `llm.summarize` hop never runs for a
  write. `Accept: application/json` still suppresses narration entirely.
- **Core value:** Bullet-proof, Honest latency, Fast
- **Why:** The summarizer receives the **returned** rows. A plain
  `INSERT`/`UPDATE`/`DELETE` returns none, so the model narrated a *committed*
  write as an empty read. Production, 2026-08-17: an approved insert committed
  (Neon shows the row; `rowCount = 1`) and the user was told *"There are no
  existing rows … the idea has not yet been recorded. You may want to add a new
  entry to capture this idea"* — advice to redo what had just succeeded, at
  `confidence: 1.00`. No prompt fixes this: the LLM is being asked to describe
  an effect that is not in its input. The count is in the response, so the
  sentence is derivable without a model call — cheaper *and* incapable of
  lying.
- **Consequence in code:** `orchestrateAsk` resolves `writeTarget(planSql)`
  after exec and narrates from it; the summarize `try/catch` is now the read-only
  branch. SSE emits the same sentence on the `summary` event, so streaming and
  JSON surfaces agree. `apps/web`'s Data block suppresses its
  "No rows returned." notice when rows are empty but `rowCount > 0`
  (`showsEmptyNotice`) — empty-read copy under a committed write denied it a
  second time.
- **Alternatives rejected:**
  - **Feed the affected-row count into the summarize prompt.** Pays an LLM hop
    (300 ms p50) and a hallucination risk to render one sentence we already
    know exactly.
  - **Skip narration on writes entirely.** The write path is the one where the
    user most needs to be told what happened; silence reads as failure.
  - **Have the planner add `RETURNING *` so rows exist to narrate.** Changes
    the approved statement (`SK-TRUST-005`) and inflates a bulk write's
    response.
