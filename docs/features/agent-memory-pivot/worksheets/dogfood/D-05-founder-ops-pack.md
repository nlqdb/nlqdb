# D-05 — Goal pack #2: founder-ops

**Status:** ⬜ not started
**Sequence:** Dogfood 5 of 7 · **Risk:** low · **Runs:** ~2 · **Prereqs:** D-01 (pack #1 is the template), D-04 (a live memory DB to write into) · **Gate:** none

## Goal

The second persona goal pack (founder-directed 2026-07-27): the **founder-ops**
corpus — accounts, credential *metadata*, external listings/submissions, and
the human-actions log — extracted into the same `agent_memory_v1` DB, answering
the builder's replay queries:

- *"what did I have to do by hand before first deploy, in order?"*
- *"which submissions are pending, and since when?"*
- *"replay this launch for product X"*

Pack #1 (repo-ops, D-01) proved the shape on decisions and open questions. This
pack proves the shape **generalises to a second persona with zero engine
change** — which is the entire claim of `SK-PIVOT-018`.

## SK-PIVOT-016 criterion / number it moves

**Criterion 1** — a second corpus roughly doubles the ops workload's organic
call volume, on the same public surface. Also the scorecard's Pivot rows
(dogfood track count).

## Read first

- [`SK-PIVOT-018`](../../decisions/SK-PIVOT-018-goal-packs.md) — the canonical
  pack anatomy (extraction recipe + seed entities/goals + golden queries), the
  **no schema / no endpoint / no tool** rule, and the ≥ 5 golden queries per
  pack requirement
- `SK-PIVOT-007` in [`../../FEATURE.md`](../../FEATURE.md) — one canonical
  schema, evolve by version, never fork per vertical. A pack that wants a column
  is in the wrong track.
- `docs/history/founder-actions-log.md` — **the seed corpus** (metadata only,
  never secret values — the file's own rule, which this pack must not weaken)
- `docs/blocked-by-human.md` — the live queue half of the same corpus: what is
  pending, since when, at what estimate
- `docs/research/acquisition-channels.md` — the external listings/submissions
  ledger (rows, states, dates) this pack makes queryable
- [`D-01`](D-01-docs-memory-skill.md) — the extraction recipe to clone

## Hard constraint — credential metadata, never values

The pack stores, per credential: **service, key name, scope, date**. Never the
value, never a fragment of one, never a "redacted but recoverable" form. A
reviewer rejects a pack that stores secret values (`SK-PIVOT-018`'s explicit
rejection), and so does the founder-actions-log's own metadata-only rule. The
guard is a test on the extraction recipe, not a code-review habit — a
credential-shaped string in a seeded fact should fail the pack's own test.

## Steps

1. **Run 1 — recipe + seeds.** Clone D-01's skill into a founder-ops extraction
   recipe: sources are `history/founder-actions-log.md`, `blocked-by-human.md`,
   and the acquisition ledger. Extract entities (services, accounts, listings)
   and episodes (actions with dates, estimates, and outcomes) — no new tables,
   no new preset version, no new tool (`SK-PIVOT-018`). Add the
   credential-metadata guard test. Run it against the D-04 DB.
2. **Run 2 — ≥ 5 golden queries.** Add ≥ 5 golden queries to the `SK-QUAL-023`
   eval family over this pack's pinned snapshot, using D-03's frozen-snapshot
   discipline (literal date bounds, hand-verified tie-free gold). At least one
   is a **replay** query — ordered human actions before first deploy — because
   that is the pack's headline claim and an ordering bug is invisible without a
   gold. Dispatch `quality-eval-memory.yml`, record EX + run link.

## Done when

- [ ] Founder-ops extraction recipe shipped in the agent-artifacts family beside
      pack #1, seeded from `history/founder-actions-log.md` (+ the queue and the
      acquisition ledger).
- [ ] **Zero** schema, endpoint, tool or preset-version change — verified by
      inspection and stated in the PR body (`SK-PIVOT-018` /
      `SK-PIVOT-007`).
- [ ] Credential-metadata-only guard test present and red if a secret-shaped
      value is seeded.
- [ ] ≥ 5 golden queries added to the `SK-QUAL-023` family, ≥ 1 of them the
      ordered-replay query; EX + run link recorded.
- [ ] The three headline replay questions above answer correctly against the
      live DB, and the answers are pasted here (the pack's proof).
- [ ] `bun run typecheck && test` green; lint with explicit paths.
- [ ] INDEX tracker + status ticked.

## Artifact

Strong queue candidate, and the most persona-legible one in the track:
*"every human action in a year of building an agent-operated company — as a
table you can query."* This is the SK-PIVOT-018 pitch with real rows behind it.
Queue-gated.

## Rollback

Delete the recipe + its golden queries; the memories it wrote are rows in the
shared DB and can be deleted by scope. Because the pack added no schema and no
endpoint, retirement costs nothing — which `SK-PIVOT-018` names as the reason
packs are the growth unit in the first place.
