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
  (SK-PIVOT-017), pack #2 = founder-ops (D-05). The build order for packs
  #3..N is **founder-locked 2026-08-05** (niche-quality lens) in
  [`pack-candidates.md`](pack-candidates.md) — the next pack in that
  sequence becomes a `D-NN` slice below when its turn comes.
- [**SK-PIVOT-019**](../../decisions/SK-PIVOT-019-memory-strategy-benchmark.md) — the
  public cross-strategy benchmark, **sequenced after** the corpus + golden
  queries exist (D-07).
- [**SK-PIVOT-021**](../../decisions/SK-PIVOT-021-one-click-goal-pack-journeys.md) —
  every pack runs through one shared, resumable, least-permission product
  journey; a skill artifact alone is not a finished pack experience.
- [**SK-PIVOT-022**](../../decisions/SK-PIVOT-022-community-first-memory-guidance.md) —
  public guidance recommends the smallest strategy that improves the task,
  including outcomes that do not include nlqdb; it adds recommendations, not
  adapters.

## Why this track exists

The launch and dogfood decisions were recorded 2026-07-26/27 but had **no
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
| Expert-knowledge marketplace (**parallel track**, `SK-EKP-005` — never blocks or waits on the gate) | [`../../../expert-knowledge-platform/worksheets/INDEX.md`](../../../expert-knowledge-platform/worksheets/INDEX.md) (`EK-*`) |

`D-*` slices are picked by `/daily`, like `WS-*` and `E-*`. The track's own
engine-side prereq is **satisfied**: E-03 (memory scoping) merged in #851 and
`MEMORY_PRESET=1` shipped in #835 (2026-07-29) — a real corpus may land in a
prod memory DB, see D-04.

## Sequence

| D | Slice | Risk | Runs | Prereqs | SK-PIVOT-016 criterion / number moved |
|---|-------|------|------|---------|---------------------------------------|
| [D-01](D-01-docs-memory-skill.md) ✅ | The docs→memory extraction skill (SK-PIVOT-017) — **done 2026-07-29**: merged #847, artifact `apps/web/public/agent-artifacts/nlqdb-docs-memory/SKILL.md`, all 6 acceptance points verified (point 5 closed at ticking) | med | ~2 | — | the instrument behind criteria 1–3 |
| [D-02](D-02-resync-hook.md) 🟡 | One-way re-sync hook. **Split 2026-08-02:** D-02a ✅ the runnable extractor `tools/docs-memory/` (9 open-question + 6 blocked facts offline over live `docs/`); D-02b ⬜ authenticated convergent sync + workflow — blocked on a read-verb decision + the `NLQDB_API_KEY` secret | low→med | 2 | D-01 | criterion 1 (sustained call volume) |
| [D-03](D-03-golden-queries.md) ✅ | Ops-corpus golden-query set (≥ 10, ≥ 3 temporal) in the `SK-QUAL-023` eval family — **done 2026-07-29: first dispatch measured ops temporal 0/4 (run 30413719690)** | med | ~2 | D-01 | **criterion 4** (temporal passes) |
| [D-04](D-04-first-corpus-sync.md) | First real sync of nlqdb's own `docs/` corpus + the gate-progress readout | med | ~2 | D-01, D-02, ~~E-03 → `MEMORY_PRESET=1`~~ ✅ (#851, #835) | **criteria 1, 2, 3** |
| [D-05](D-05-founder-ops-pack.md) | Goal pack #2 — founder-ops (SK-PIVOT-018), seeded from `history/founder-actions-log.md` | low | ~2 | D-01, D-04 | criterion 1 · Pivot row |
| [D-06](D-06-agents-memory-dashboard.md) | The public memory dashboard on `/agents` | med | ~2 | D-04 | **criterion 5** |
| [D-07](D-07-memory-strategy-benchmark.md) ⛔ | Cross-strategy memory benchmark (SK-PIVOT-019) — **blocked** | high | multi | **blocked: the SK-PIVOT-017 corpus + golden queries must exist** (D-03 ✅; D-04 pending) | none — row #22 / answer-engine citations |
| [D-08](D-08-repo-ops-one-click-import.md) | Goal pack #1 as a one-click public-alpha repo-memory import (SK-PIVOT-021) | high | multi | D-01, D-04, E-06, delete | onboarding + UX · reusable pack runner |

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
schema). D-06 is the last criterion and the launch's own demo artifact. D-07
follows the gate sequence and is explicitly blocked — SK-PIVOT-019 sequences
it after the corpus, and it must **never** delay the gate or the launch.

D-08 is a productization follow-on, not a new launch-gate condition. It turns
pack #1 into the shared one-click journey every later pack reuses; its public
alpha may ship without delaying D-04–D-07.

## Hard rules

- **Public surfaces only.** Every read and write in this track goes through
  `npx -y @nlqdb/mcp` + a self-minted `sk_mcp_*` MCP key +
  `nlqdb_remember`/`nlqdb_query`. A reviewer rejects any ops-agent path that
  reaches a privileged endpoint, an internal binding, or the platform DB.
  Dogfooding through a backdoor measures nothing (SK-PIVOT-016).
- **Markdown stays canonical.** The memory DB is a derived, queryable index.
  Sync is one-way and idempotent; nlqdb never edits markdown. Anything making
  the DB the source of truth is a separate founder decision (P1), not a slice.
- **No secret values, ever.** Goal packs store credential *metadata* — service,
  key name, scope, date — never the value (SK-PIVOT-018).
- **No new schema, endpoint or tool for a pack.** Packs are seed content + a
  recipe on `agent_memory_v1` (SK-PIVOT-007). The shared runner may add generic
  product plumbing once (SK-PIVOT-021), but a pack-specific endpoint, DDL or
  preset version is in the wrong track.
- **Loosening a gate criterion needs a founder note** in
  `SK-PIVOT-016-dogfood-launch-gate.md`. Tightening is agent-allowed. Silently
  reinterpreting one is a P1 violation.
- **The gate is condition-gated.** Never introduce a date into it
  (founder-directed 2026-07-26).

## Gate progress — the number this track exists to move

`SK-PIVOT-016`: **0/5 green** (2026-07-29). Criterion 4 is now **measured on
both corpora** — the last unmeasured half closed by D-03 this run — but not yet
green: temporal **2/7** (synthetic 2/3, ops 0/4). The gate count is unchanged;
what changed is that the ops temporal axis went from *unmeasured* to a concrete
**0/4**. Run 156 read the SK-QUAL-023 run summary and diagnosed the root cause —
the planner is given DDL-only schema and guesses low-cardinality categorical
values wrong (`kind='question'` vs `'open_question'`, `role='doc-sync'` vs
`'sync'`) — and scoped the fix as engine slice
[E-09](../engine/E-09-schema-value-linking.md) (schema value-linking). **Run 158
then found E-09 is ⛔ BLOCKED by [`GLOBAL-037`](../../../../decisions/GLOBAL-037-schema-only-llm-egress.md)
(P1):** its mechanism — sampling real cell-values into the LLM prompt — is the
`value-retrieval` lever GLOBAL-037 forbids by name (schema-only egress; never
send user cell-values). So criterion 4 has **no agent-movable, GLOBAL-037-
compliant lever** today; the compliant re-scope (declare the categorical domains
as DDL `ENUM`/`CHECK` constraints so they're legitimate schema egress) is a
preset-schema design question for a future engine-track run, not a daily patch.
`/daily` step 1 restates this beside
the launch bullet's age every run. The founder also reads it on
**`/app/admin` → "Launch gate — SK-PIVOT-016"** (`SK-GTM-008`), which renders
criteria 1–2 live from D1 and 3–5 as static-with-as-of constants; this table
stays canonical, so a criterion that moves is updated here **and** in
`apps/web/src/components/admin/launch-gate.ts`.

| # | Criterion | State | Owned by |
|---|-----------|-------|----------|
| 1 | ≥ 100 real `/v1/ask` calls through the public MCP surface from the ops workload | ⬜ 0 | D-04 (+ D-02, D-05) |
| 2 | First-10-queries success ≥ 95 % **on that workload** | ⬜ N = 0 | D-04 |
| 3 | Zero silent data loss / wrong-answer-accepted incidents | ⬜ unstartable | D-04 |
| 4 | Temporal golden queries pass | ⬜ **temporal 2/7** — synthetic 2/3 + **ops 0/4** (measured 2026-07-29, run 30413719690) | D-03 ✅ (measured) → [E-09](../engine/E-09-schema-value-linking.md) ⛔ **BLOCKED (P1, [`GLOBAL-037`](../../../../decisions/GLOBAL-037-schema-only-llm-egress.md), run 158)** — value-sampling into the prompt is forbidden egress; no compliant agent-movable lever until a DDL-`ENUM`/`CHECK` re-scope |
| 5 | Live memory dashboard public on `/agents` | ⬜ unshipped | D-06 |

Criterion 4's synthetic half stays `2/3`; D-03 added the **ops** corpus's 4
temporal queries and measured them for the first time — **0/4** on the free
chain (run 30413719690). Both halves must be green, which is a tightening, not a
loosening; the ops half is now the binding constraint.

## Tracker

Tick on merge. Keep this list as the durable dogfood status (the scorecard's
`Pivot:` rows are regenerated; this is not).

- [x] D-01 — docs→memory extraction skill. **Done 2026-07-29** (#847 merged, ticked in #876): artifact `apps/web/public/agent-artifacts/nlqdb-docs-memory/SKILL.md`, all six acceptance points verified. (#876 ticked the sequence table but missed this line; fixed 2026-08-01 — **D-02 is unblocked and pullable now**.)
- [ ] D-02 — one-way re-sync hook (CI on merge, `docs/**` paths filter)
- [x] D-03 — ops-corpus golden-query set (12 questions, 4 temporal) in the `SK-QUAL-023` family. **Done 2026-07-29:** authoring landed #847; this run dispatched [run 30413719690](https://github.com/nlqdb/nlqdb/actions/runs/30413719690) — 27-q free EX 59.26 %, ops temporal **0/4** → diagnosed + scoped as engine slice [E-09](../engine/E-09-schema-value-linking.md) (run 156)
- [ ] D-04 — first `docs/` corpus sync + gate-progress readout (E-03 → #835 → sync)
- [ ] D-05 — founder-ops goal pack (pack #2, SK-PIVOT-018)
- [ ] D-06 — public memory dashboard on `/agents` (criterion 5)
- [ ] D-07 — cross-strategy memory benchmark (SK-PIVOT-019) — **blocked** on D-03 + D-04
- [ ] D-08 — one-click repo-memory public alpha on the shared pack runner (SK-PIVOT-021)
