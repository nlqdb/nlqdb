# SK-QUAL-016 — Inject Spider 2.0-lite external-knowledge docs into the prompt, the way BIRD `evidence` already is

Parent feature: [`quality-eval/FEATURE.md`](../FEATURE.md). Closes the deferral
the loader carried since [`SK-QUAL-007`](./SK-QUAL-007-spider2-lite-loader.md)
("`external_knowledge` points at `resource/documents/<file>.md`; capture it
without fetching the body — deferred to a follow-up slice"). Mirrors the BIRD
`evidence` handling the runner has always done.

- **Decision:** `loadSpider2Lite` fetches each instance's
  `external_knowledge` doc body and puts it on `EvalQuestion.evidence`, so the
  runner's existing `enrichedGoal` (`question + "\n\nEvidence: " + evidence`)
  injects it into the planner prompt — the same channel BIRD's annotator
  `evidence` flows through. Cache-authoritative when `dataDir` is set (reads
  `resource/documents/<name>.md`, mirroring the gold-CSV cache contract);
  network-fetches from upstream otherwise. A missing / unsafe / 404 doc
  degrades to the no-evidence prompt — never throws. The `<name>.md` filename
  is gated by `SPIDER2_LITE_DOC_RE` + `basename` against path-traversal, the
  same defence-in-depth as the `instance_id` / `db` gates.

- **Core value:** Honest

- **Why:**
  - **We were scoring the chain against questions it cannot answer.** Spider
    2.0 ships these docs *as task context* — the haversine great-circle
    formula, the RFM recency/frequency/monetary scoring rule, the "Short /
    Medium / Long" music-length cutoffs, the f1-overtake definition. A planner
    that never sees `music_length_type.md` cannot know "Short" means "between
    the minimum and the midpoint of min and average"; the question is
    unanswerable, not hard. Dropping the doc made the Spider number an
    apples-to-oranges undercount versus both published Spider 2.0 results and
    our own BIRD lane (which *does* inject `evidence`).
  - **Addressable population, measured offline:** **13 of the 135
    `local###` SQLite questions (9.6%)** carry an `external_knowledge` doc
    that was being dropped — `local003` (RFM), `local009/010` (haversine),
    `local035` (spherical law), `local050/061` (projection), `local244`
    (music length), `local258/259` (baseball terms), `local275/277`
    (calculation method), `local336/344` (f1 overtake) — spanning 8 distinct
    DBs. On Spider's small base (25/135 = 0.1852) these 13 are the
    knowledge-gated tail; injecting the doc is the only lever that can flip
    them.
  - **Minimal, reuses the proven channel.** No runner change, no scorer
    change, no new prompt scaffold — the doc body rides the `evidence` field
    and `enrichedGoal` the BIRD lane has used since slice 3a. ≤ 6 KB per doc,
    13 affected questions, free-chain token cost negligible.

- **Consequence in code:** `tools/eval/src/datasets/spider2-lite.ts`
  (`loadExternalKnowledge` + `SPIDER2_LITE_DOCUMENTS_URL_BASE` /
  `SPIDER2_LITE_DOC_RE`, wired into the parallel loader and the `evidence`
  field; exported via `_testing`), `test/datasets/spider2-lite.test.ts`
  (unit + cache-hit + network + traversal-rejection coverage). The EX delta is
  measured by the **next canonical Spider dispatch** (Spider baseline
  2026-06-17 is < 7 days old, so [`SK-QUAL-002`](./SK-QUAL-002-weekly-cron.md)
  / §5 forbid a back-to-back re-dispatch this run); the run will pick the
  injection up automatically.

- **Alternatives rejected:**
  - **Fetch the doc but summarise / truncate it before injecting.** The docs
    are already terse (378 B – 5.7 KB) and the formula *is* the answer —
    truncating risks dropping the operative line. Inject verbatim.
  - **Add a dedicated `external_knowledge` field + an "External knowledge:"
    prompt label.** A second context channel duplicates `evidence` for no
    behavioural gain and forces a runner change; reusing `evidence` keeps the
    diff to the loader (P5).
  - **Wait for the next eval to measure EX before merging the injection.** The
    addressable population is measurable offline from the questions JSONL for
    free; gating a correctness fix on a quota-bound eval window is the
    [`SK-QUAL-015`](./SK-QUAL-015-column-coverage-harness.md) anti-pattern.
