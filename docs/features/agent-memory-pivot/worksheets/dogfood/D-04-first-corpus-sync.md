# D-04 — First real sync of nlqdb's own `docs/` corpus + the gate-progress readout

**Status:** ⬜ not started — **prereq chain not yet clear** (see below)
**Sequence:** Dogfood 4 of 7 · **Risk:** med · **Runs:** ~2 · **Prereqs:** D-01, D-02, **E-03 merged → `MEMORY_PRESET=1` in prod (PR #835)** · **Gate:** the prereq chain is founder-sequenced

## Goal

nlqdb's own `docs/` corpus lives in a real, prod, `agent_memory_v1` memory DB,
written and read through the public MCP surface by nlqdb's own operating agents
— and the gate's first three criteria become **measured numbers** instead of
"unstartable". This is the slice that turns the launch from a bet into a
report.

## SK-PIVOT-016 criteria it moves

**Criteria 1, 2 and 3** — all three, and they are the three that no other slice
can touch:

1. ≥ 100 real `/v1/ask` calls through the public MCP surface from the ops
   workload (today: **0**).
2. First-10-queries success ≥ 95 % **on that workload** — scorecard row #4's
   instrument, finally with `N > 0` (today: `N = 0`, so not measurable).
3. Zero silent data loss / wrong-answer-accepted incidents.

## The prereq chain — do not shortcut it

**E-03 merges → `MEMORY_PRESET=1` ships (#835) → this corpus syncs.**

- [`E-03`](../engine/E-03-memory-scoping.md) is the security-critical scoping
  slice and is **in flight** on branch `claude/e03-memory-scoping`. Until it
  merges, `end_user_id`/`thread_id` are written but never read — the columns
  look like isolation and provide none.
- `MEMORY_PRESET=1` is a `SK-PIVOT-016` prerequisite and is **dark**; PR #835
  flips it and is deliberately drafted. **Founder-decided 2026-07-28: hold #835
  until E-03 merges, then un-draft and ship the flip.** The
  [`E-06`](../engine/E-06-agents-createform-preset.md) gate ("only after E-03
  ships") is **satisfied by that sequence, not superseded** — recorded in
  [`blocked-by-human.md`](../../../../blocked-by-human.md) bullet #1.
- **The flip invalidates E-03's "no prod memory DBs exist ⇒ no backfill
  migration" premise** the moment it happens. The run that flips it owes E-03 a
  backfill line; the run that syncs this corpus is the first to create a prod
  memory DB, so check that line landed before writing a single row.

A run that finds the chain incomplete records that finding and picks another
slice — D-03 is the pullable one (offline, no flag).

## Read first

- [`SK-PIVOT-016`](../../decisions/SK-PIVOT-016-dogfood-launch-gate.md) — the
  five criteria and the **public-surfaces-only** rule a reviewer enforces
- [`SK-PIVOT-017`](../../decisions/SK-PIVOT-017-docs-to-memory-skill.md) — "nlqdb's
  own `docs/` is the first corpus — simultaneously the gate workload and the
  launch demo"
- [`E-03`](../engine/E-03-memory-scoping.md) + [`E-06`](../engine/E-06-agents-createform-preset.md)
  — the chain above, in the engine track's own words
- `docs/features/onboarding/FEATURE.md` (`SK-ONBOARD-007`) — how
  first-10-queries success is actually computed, so criterion 2 is read off the
  existing instrument and not re-derived by hand
- `apps/api/src/memory/remember.ts` + `expire.ts` — the write verb and the TTL
  sweep this corpus becomes the first real subject of

## Steps

1. **Run 1 — provision + first sync.** Verify the chain (E-03 merged, #835
   merged, E-03's backfill line present). Create the memory DB through the
   **authed** create surface with `{ preset: "agent_memory_v1" }`
   (`SK-PIVOT-010` — never the anon path). Mint an `sk_live_*` key exactly as a
   stranger would, configure `npx -y @nlqdb/mcp`, run D-01's skill against
   `docs/`. Record: rows written per table, asks issued, wall-clock, and every
   failure verbatim — the failures are the launch post's whole value ("here's
   what broke").
2. **Run 2 — the gate-progress readout.** Ship a repeatable way to read
   criteria 1–3 off this workload, so `/daily` step 1 can restate `n/5` each run
   without archaeology (SK-PIVOT-016 requires that restatement). Criterion 1 =
   the workload's `/v1/ask` count; criterion 2 = row #4's instrument scoped to
   this DB; criterion 3 = a stated incident definition plus what was checked.
   Write the numbers into [`INDEX.md`](INDEX.md)'s gate table.

## Done when

- [ ] Chain verified in writing before any row is written: E-03 merged, #835
      merged, E-03's backfill line present.
- [ ] A prod `agent_memory_v1` DB holds the extracted `docs/` corpus, created
      through the **authed** surface, written **only** via
      `nlqdb_remember`/`nlqdb_query` over `npx -y @nlqdb/mcp` with a self-minted
      `sk_live_*` key — no privileged path anywhere in the run.
- [ ] Rows-per-table, asks issued, and **every failure verbatim** recorded here.
- [ ] Criterion 1 readout exists and prints a number (even if < 100).
- [ ] Criterion 2 read off `SK-ONBOARD-007`'s existing instrument scoped to this
      DB — not recomputed by hand.
- [ ] Criterion 3 has a written incident definition + what was checked against
      it.
- [ ] [`INDEX.md`](INDEX.md)'s gate table carries the three numbers; the
      scorecard's Pivot rows and the launch bullet's `n/5` agree with it.
- [ ] INDEX tracker + status ticked.

## Artifact

**The launch post's raw material** — "we ran our own company's ops on our own
memory through the public MCP endpoint; here's what broke." Named as the launch
demo in `blocked-by-human.md` bullet #2 and in `research/launch-kit.md` §3.1's
fact sheet. Draft it into `research/distribution-queue.md` even if the run's
numbers are unflattering; unflattering is the point (`SK-PIVOT-019`'s
concede-columns logic applies here too).

## Rollback

Drop the memory DB. Markdown is canonical and untouched (SK-PIVOT-017's
one-way rule), so nothing is lost but the index — which D-02's hook rebuilds.
If `MEMORY_PRESET` is unflipped, the preset path 400s and this corpus becomes
unreachable rather than corrupt; that is the intended failure mode.
