# D-02 — One-way re-sync hook: CI on merge when `docs/**` changed

**Status:** ⬜ not started
**Sequence:** Dogfood 2 of 7 · **Risk:** low · **Runs:** 1 · **Prereqs:** D-01 · **Gate:** needs an `NLQDB_API_KEY` repo secret (see *Credential* below)

## Goal

The memory corpus stays true to `docs/` without anyone remembering to re-run
anything. On every merge to `main` that touched `docs/**`, CI re-runs D-01's
extraction against the changed corpus. Convergent, one-way, idempotent — a
re-run after a docs change updates the index; nlqdb never writes markdown back.

## SK-PIVOT-016 criterion / number it moves

**Criterion 1** (≥ 100 real `/v1/ask` calls from the ops workload) — this is
what makes the workload *sustained* rather than a single seeding run. Also
protects criterion 3: a stale index that answers confidently from deleted docs
is exactly a "wrong-answer-accepted" incident.

## Read first

- [`SK-PIVOT-017`](../../decisions/SK-PIVOT-017-docs-to-memory-skill.md) — "keep
  it fresh with a one-way re-sync hook (CI on merge and/or session start)"
- [`D-01`](D-01-docs-memory-skill.md) — the skill this hook invokes, and its
  idempotency guarantee (this hook is only correct because of it)
- `.github/workflows/quality-eval-memory.yml` — the closest existing shape: a
  workflow that talks to the live API with a secret, free-tier only
- `docs/features/ci-permissions/FEATURE.md` — **mandatory** per `AGENTS.md` §5
  for anything under `.github/workflows/**`
- `apps/api/src/memory/remember.ts` — the endpoint the run writes through

## Mechanism — the "and/or" resolved

SK-PIVOT-017 leaves the trigger as "CI on merge **and/or** session start".
Resolved to **CI on merge only** (a value-decidable call per `GLOBAL-033`):

- `/daily` fires ~6×/day and `/reach` 4×/day. A session-start sync would re-run
  the same extraction ~10×/day against a corpus that changed at most once —
  work with no delta, and every run pays the latency.
- Merge is the exact event that changes the corpus, so on-merge is
  once-per-change by construction.
- Daily-agent containers are egress-gated in places (the row-#15 opencheck and
  row-#21 walker constraints); CI is not.

Session-start is therefore **out of scope**, not deferred — re-opening it needs
a reason this reasoning doesn't already cover.

**Path filter** is the whole point of the trigger: `paths: ['docs/**']` on
`push: branches: [main]`. A merge that touches no docs must be a no-op with no
API call, or criterion 1's call count stops meaning "real work".

## Credential

The workflow needs `NLQDB_API_KEY` (a self-minted `sk_live_*`) as a **repo
secret** — an operator action an agent cannot perform. Queue bullet **#3** in
[`blocked-by-human.md`](../../../../blocked-by-human.md) already asks the
founder to mint exactly this credential for the walker env. The run that ships
this slice should **extend that bullet** to name the repo secret too, rather
than adding a new bullet (the queue is ranked by yield per founder-minute, not
appended to — founder-directed 2026-07-22). Until the secret exists the
workflow is committed but skips with a printed reason, never fails red.

## Steps

1. **Run 1 — the workflow.** Add `.github/workflows/memory-sync.yml`:
   `push` → `branches: [main]`, `paths: ['docs/**']`, plus
   `workflow_dispatch` for manual re-sync. Least-privilege `permissions:`
   (`contents: read`) per the `ci-permissions` feature. Steps: check the secret
   is present (skip with a printed reason if not — never a red run), install,
   run D-01's extraction against `docs/`, print rows written / rows unchanged /
   asks issued. Concurrency group so two merges don't race the same corpus.
2. **Prove idempotency in the same run.** Dispatch the workflow twice against an
   unchanged `docs/` and assert the second run writes **0 new** rows. This is
   the box that makes "convergent" a measurement instead of a claim.

## Done when

- [ ] `.github/workflows/memory-sync.yml` exists: `push` on `main` filtered to
      `docs/**`, plus `workflow_dispatch`; least-privilege permissions;
      concurrency-guarded.
- [ ] Missing-secret path skips with a printed reason (green, not red); the run
      that lands this extends queue bullet #3 to name the repo secret.
- [ ] A merge touching no docs issues **zero** API calls (verified on a real
      run, or by a dry-run assertion if no such merge landed yet).
- [ ] Second consecutive run over an unchanged corpus writes **0 new rows**
      (idempotency measured, not asserted).
- [ ] The run prints rows written / unchanged / asks issued, so D-04's
      gate-progress readout has an input it doesn't have to reconstruct.
- [ ] INDEX tracker + status ticked.

## Artifact

None owed — a workflow is not a stranger-searchable lesson. Skip step 3.2.

## Rollback

Delete the workflow file. The corpus freezes at its last sync; nothing else
breaks, and D-04's memories are untouched. No migration, no state.
