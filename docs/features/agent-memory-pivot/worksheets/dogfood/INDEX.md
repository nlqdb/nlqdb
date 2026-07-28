# Dogfood track — nlqdb runs its own ops on nlqdb memory

Fourth track of the pivot, beside messaging (`WS-*`), engine (`E-*`) and reach
(`R-*`). This one exists to make **one** thing true: nlqdb's own operating
agents run a real memory workload through the **public** surfaces, so the
launch stops being a bet. Sized and sequenced like the engine track — one
slice per `/daily` run, concrete `Done when` boxes, prereqs stated.

Governing decisions (bodies in [`../../decisions/`](../../decisions/) — never
restated here):

- [**SK-PIVOT-016**](../../decisions/SK-PIVOT-016-dogfood-launch-gate.md) — the
  5-criterion, **condition-gated** (never date-gated) launch gate this track
  drives. Agents may tighten a criterion; **only the founder may loosen or
  remove one.**
- [**SK-PIVOT-017**](../../decisions/SK-PIVOT-017-docs-to-memory-skill.md) — the
  workload itself: a docs→memory extraction skill, one-way sync, markdown stays
  canonical.
- [**SK-PIVOT-018**](../../decisions/SK-PIVOT-018-goal-packs.md) — the wedge grows
  by persona goal packs on the one canonical schema. Pack #1 = repo-ops
  (SK-PIVOT-017), pack #2 = founder-ops (D-05).
- [**SK-PIVOT-019**](../../decisions/SK-PIVOT-019-memory-strategy-benchmark.md) — the
  public cross-strategy benchmark, **sequenced after** the corpus + golden
  queries exist (D-07).

## Why this track exists

The four decisions above were recorded 2026-07-26/27 but had **no
worksheets**, so the `/daily` loop structurally could not pick them up: step 2
picks a lever from a track index, and there was no index. Meanwhile the
launch-sequence bullet in [`blocked-by-human.md`](../../../../blocked-by-human.md)
sat 44+ days with its gate at **0/5** — every criterion agent-movable, nothing
assigned to move them. This file is the missing intake.

## How this track interleaves with the other three

| Worst-number / weekly-focus lane today | Pick from |
|---|---|
| The `SK-PIVOT-016` dogfood gate (**founder-set weekly focus 2026-07-28**) | this file (`D-*`) |
| Funnel / distribution / wedge conversion | [`../INDEX.md`](../INDEX.md) (`WS-*`) |
| Engine quality / agent on-ramp / "wedge claims true" | [`../engine/INDEX.md`](../engine/INDEX.md) (`E-*`) |
| Acquisition reach (search + coding-agent discovery) | [`../reach/INDEX.md`](../reach/INDEX.md) (`R-*`, `/reach` loop only) |

`D-*` slices are picked by `/daily`, like `WS-*` and `E-*`. The track's own
prereq is engine-side: **E-03** (memory scoping) must merge, then
`MEMORY_PRESET=1` ships (PR #835), before any real corpus lands in a prod
memory DB — see D-04.

## Sequence

| D | Slice | Risk | Runs | Prereqs | SK-PIVOT-016 criterion / number moved |
|---|-------|------|------|---------|---------------------------------------|
| [D-01](D-01-docs-memory-skill.md) 🟡 | The docs→memory extraction skill (SK-PIVOT-017) — **build in flight on `claude/docs-memory-skill`; this slice tracks it, do not rebuild** | med | ~2 | — | the instrument behind criteria 1–3 |
| [D-02](D-02-resync-hook.md) | One-way re-sync hook — CI on merge when `docs/**` changed | low | 1 | D-01 | criterion 1 (sustained call volume) |
| [D-03](D-03-golden-queries.md) | Ops-corpus golden-query set (≥ 10, ≥ 3 temporal) in the `SK-QUAL-023` eval family | med | ~2 | D-01 | **criterion 4** (temporal passes) |
| [D-04](D-04-first-corpus-sync.md) | First real sync of nlqdb's own `docs/` corpus + the gate-progress readout | med | ~2 | D-01, D-02, **E-03 merged → `MEMORY_PRESET=1` (#835)** | **criteria 1, 2, 3** |
| [D-05](D-05-founder-ops-pack.md) | Goal pack #2 — founder-ops (SK-PIVOT-018), seeded from `history/founder-actions-log.md` | low | ~2 | D-01, D-04 | criterion 1 · Pivot row |
| [D-06](D-06-agents-memory-dashboard.md) | The public memory dashboard on `/agents` | med | ~2 | D-04 | **criterion 5** |
| [D-07](D-07-memory-strategy-benchmark.md) ⛔ | Cross-strategy memory benchmark (SK-PIVOT-019) — **blocked** | high | multi | **blocked: the SK-PIVOT-017 corpus + golden queries must exist** (D-03 ✅ + D-04 ✅) | none — row #22 / answer-engine citations |

**Why this order.** D-01 is the workload's producer — nothing else in the track
means anything without it, which is why it is being built first (in parallel,
by its own agent). D-02 next because a corpus that goes stale on the first
merge is a demo, not a workload, and the hook is one small workflow. D-03 is
sequenced **before** D-04 deliberately: golden queries over a *frozen* corpus
snapshot are offline work that needs no prod flag, so it is the one slice
pullable while `MEMORY_PRESET` is still dark — and it is the criterion the gate
calls the measured weak axis. D-04 is the first slice that needs prod and
produces criteria 1–3 by simply running. D-05 doubles the workload with a
second persona at zero engine cost (SK-PIVOT-018: a pack is content, not
schema). D-06 is the last criterion and the launch's own demo artifact. D-07 is
last and explicitly blocked — SK-PIVOT-019 sequences it after the corpus, and
it must **never** delay the gate or the launch.

## Hard rules

- **Public surfaces only.** Every read and write in this track goes through
  `npx -y @nlqdb/mcp` + a self-minted `sk_live_*` key +
  `nlqdb_remember`/`nlqdb_query`. A reviewer rejects any ops-agent path that
  reaches a privileged endpoint, an internal binding, or the platform DB.
  Dogfooding through a backdoor measures nothing (SK-PIVOT-016).
- **Markdown stays canonical.** The memory DB is a derived, queryable index.
  Sync is one-way and idempotent; nlqdb never edits markdown. Anything making
  the DB the source of truth is a separate founder decision (P1), not a slice.
- **No secret values, ever.** Goal packs store credential *metadata* — service,
  key name, scope, date — never the value (SK-PIVOT-018).
- **No new schema, endpoint or tool for a pack.** Packs are seed content + a
  skill prompt on `agent_memory_v1` (SK-PIVOT-007). A slice that adds DDL or a
  preset version is in the wrong track.
- **Loosening a gate criterion needs a founder note** in
  `SK-PIVOT-016-dogfood-launch-gate.md`. Tightening is agent-allowed. Silently
  reinterpreting one is a P1 violation.
- **The gate is condition-gated.** Never introduce a date into it
  (founder-directed 2026-07-26).

## Gate progress — the number this track exists to move

`SK-PIVOT-016`: **0/5 green** (2026-07-28). `/daily` step 1 restates this
beside the launch bullet's age every run.

| # | Criterion | State | Owned by |
|---|-----------|-------|----------|
| 1 | ≥ 100 real `/v1/ask` calls through the public MCP surface from the ops workload | ⬜ 0 | D-04 (+ D-02, D-05) |
| 2 | First-10-queries success ≥ 95 % **on that workload** | ⬜ N = 0 | D-04 |
| 3 | Zero silent data loss / wrong-answer-accepted incidents | ⬜ unstartable | D-04 |
| 4 | Temporal golden queries pass | ⬜ temporal 2/3 on the synthetic corpus | D-03 |
| 5 | Live memory dashboard public on `/agents` | ⬜ unshipped | D-06 |

Criterion 4's `2/3` is the **synthetic** `memory-quality` corpus, owned by
[`quality-eval`](../../../quality-eval/decisions/SK-QUAL-023-agent-memory-quality-eval.md).
D-03 adds the **ops** corpus's temporal queries; both must be green, which is a
tightening, not a loosening.

## Tracker

Tick on merge. Keep this list as the durable dogfood status (the scorecard's
`Pivot:` rows are regenerated; this is not).

- [ ] D-01 — docs→memory extraction skill. **🟡 build in flight 2026-07-28 on branch `claude/docs-memory-skill`** (parallel agent owns the skill artifact). This worksheet is the tracking slice: do not rebuild it; on that branch's merge, record the artifact path here and tick.
- [ ] D-02 — one-way re-sync hook (CI on merge, `docs/**` paths filter)
- [ ] D-03 — ops-corpus golden-query set (≥ 10, ≥ 3 temporal) in the `SK-QUAL-023` family
- [ ] D-04 — first `docs/` corpus sync + gate-progress readout (E-03 → #835 → sync)
- [ ] D-05 — founder-ops goal pack (pack #2, SK-PIVOT-018)
- [ ] D-06 — public memory dashboard on `/agents` (criterion 5)
- [ ] D-07 — cross-strategy memory benchmark (SK-PIVOT-019) — **blocked** on D-03 + D-04
