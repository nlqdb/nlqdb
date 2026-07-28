# D-07 — Cross-strategy memory benchmark (SK-PIVOT-019)

**Status:** ⛔ **BLOCKED** — prereq: **the `SK-PIVOT-017` corpus + golden queries
must exist** (D-03 ✅ *and* D-04 ✅). `SK-PIVOT-019` sequences this
build explicitly; the sequencing is a decided prerequisite, **not** an open
question, and this slice must **never delay the `SK-PIVOT-016` gate or the
launch**.
**Sequence:** Dogfood 7 of 7 · **Risk:** high · **Runs:** multi · **Prereqs:** D-03, D-04 · **Gate:** each named hosted competitor needs a ToS check (P2) and, if it needs an account, a founder action

## Do not start this slice early

A `/daily` run that reaches for D-07 while D-03 or D-04 is open is picking the
most interesting slice over the gating one. The gate is at 0/5 and every other
`D-*` moves a criterion; this one moves none. Pick the lowest-numbered
unblocked slice instead (`INDEX.md` step 1).

## Goal

A public, reproducible memory-strategy benchmark: the **same real corpus** (the
D-04 ops memories) and the **same golden queries** (D-03), grouped by the
`SK-QUAL-023` axis labels (retrieval, temporal, forgetting, consolidation,
analytical), run against competing memory strategies and published with
**per-purpose winners even where nlqdb loses**.

v1 strategy set: **nlqdb · DIY Postgres+pgvector · plain-context (no store)**.
Hosted competitors (Mem0, Zep, …) are added **one per run** — the
`SK-PIVOT-002` cadence — as each one's ToS allows.

## Number it moves

No `SK-PIVOT-016` criterion. Scorecard row **#22** (channels live with
attributable yield) via a channel that is currently at zero: nlqdb earns **0**
answer-engine citations today, so this is a channel *opened*, not optimised.

## Read first

- [`SK-PIVOT-019`](../../decisions/SK-PIVOT-019-memory-strategy-benchmark.md) —
  the canonical decision: what is published, the ToS discipline, the
  no-integrations rule
- [`SK-QUAL-023`](../../../quality-eval/decisions/SK-QUAL-023-agent-memory-quality-eval.md)
  — the axis taxonomy and scorers this reuses (do not invent new ones)
- `docs/features/quality-eval/FEATURE.md` — **mandatory** per `AGENTS.md` §5 for
  `tools/eval/**`
- [`D-03`](D-03-golden-queries.md) — the question set; the benchmark runs *these*,
  not a new set
- `docs/cost-ladder.md` — free tiers only; a strategy that costs money waits
- `docs/research/acquisition-channels.md` — the answer-engines row this is
  aimed at
- `SK-PIVOT-001` in [`../../FEATURE.md`](../../FEATURE.md) — the typed-data-
  structure-rendered-on-`/agents` pattern the results page follows

## Hard rules (from SK-PIVOT-019 — a reviewer rejects violations)

- **Concede columns.** Per-purpose winners are published **including where nlqdb
  loses**. Winners-only edits are rejected. Admitting "for pure fuzzy recall,
  top-k wins — here is the number" is what makes the analytical column
  believable.
- **No adapters, ever.** Nothing that integrates nlqdb *with* a competing memory
  store may ride this work. That is the rejected integrations-program path: a
  permanent N-provider maintenance surface that blurs the wedge into middleware.
- **ToS first, recorded.** Before any named number is published, check that
  provider's ToS for a benchmark clause (P2) and record the check. A provider
  that forbids publication is listed as **"not benchmarkable under its ToS"** —
  never renamed, never anonymised.
- **Provider defaults, pinned versions, run dates printed** on the page.
- **Free tiers only.** A hosted-competitor account is a founder action → a queue
  bullet at its yield rank, never spend.

## Steps (only once unblocked)

1. **Run 1 — harness, nlqdb lane only.** A public harness in `tools/` beside the
   eval harness: takes the D-03 question set + the D-04 corpus, runs one
   strategy, emits per-axis scores using `SK-QUAL-023`'s scorers. Ship with the
   nlqdb lane alone and its raw results committed.
2. **Run 2 — the two self-hostable baselines.** DIY Postgres+pgvector and
   plain-context. Both are free and need no third-party ToS check, so they are
   the honest first comparison and can be published immediately.
3. **Run 3 — the results surface.** A typed data structure rendered on
   `/agents` (`SK-PIVOT-001` pattern), per-axis winners, pinned versions and run
   dates printed.
4. **One hosted competitor per later run.** ToS check → record it → account (a
   founder queue bullet if one is needed) → run → publish, conceding every
   column nlqdb loses.

## Done when

- [ ] Harness is public in `tools/`, reuses `SK-QUAL-023`'s axes + scorers, and
      runs D-03's question set over D-04's corpus (no new question set).
- [ ] nlqdb + DIY Postgres+pgvector + plain-context lanes all run; raw results
      committed.
- [ ] Results surface live on `/agents` from a typed data structure, with
      per-axis winners, **pinned versions and run dates printed**.
- [ ] At least one axis where nlqdb loses is published as such (if none exists,
      say so explicitly — an all-wins table is the signal the harness is wrong).
- [ ] Every named hosted provider has a recorded ToS check; any that forbids
      publication is listed as "not benchmarkable under its ToS".
- [ ] Zero adapters / integrations to a competing store added anywhere in the
      diff; stated in the PR body.
- [ ] `bun run typecheck && test` green; lint with explicit paths.
- [ ] INDEX tracker + status ticked.

## Artifact

The benchmark page **is** the artifact class SK-PIVOT-019 is aiming at (the
most-cited artifact class in developer tooling). The queue draft is the
write-up that points at it and states the method — including which providers
declined and why.

## Rollback

Delete the harness + the results data structure; nothing depends on them and no
schema, endpoint or adapter was added — `SK-PIVOT-019` requires exactly that
"retired at zero cost" property. Published numbers stay in `git log`; if one is
later found wrong, correct it on the page with the correction dated, never
silently.
