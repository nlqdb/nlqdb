# E-03 — Per-agent / per-end-user / per-thread scoping

**Status:** ⬜ not started
**Sequence:** Engine 3 of 7 · **Risk:** **high — security-critical** · **Runs:** ~2 · **Prereqs:** E-01 ✅ · **Gate:** none, but extra-review

## Goal

Guarantee that one agent cannot read another agent's memory. Every read and
write against an `agent_memory_v1` DB is scoped by the calling principal's
identity (the "agent"), with optional `end_user_id` / `thread_id` narrowing.
**This is the slice where a correctness bug is a data breach** — own it
explicitly, with tests that pin the invariant.

## Scorecard number it moves

`Pivot:` boolean "memory scoping invariant tested." Indirectly: every
later wedge claim assumes this works.

## Read first

- `apps/api/src/principal.ts` — how callers get an identity today
  (`user` / `sk_live` / `sk_mcp` / `pk_live` / `anon`)
- `docs/features/ask-pipeline/FEATURE.md` — the typed-plan compile point
  where we'll inject the scope predicate
- `docs/features/sql-allowlist/FEATURE.md` — the SQL validation layer
  (must agree that the scope predicate is always present)
- `docs/features/anonymous-mode/FEATURE.md` — anon principals have no
  stable `agent_id`; this slice must decide what they can/can't do with
  memory (default: writes scoped to the anon token, reads of others
  refused)

## Mechanism (the precise invariant)

For any compiled SQL touching `agent_memory_v1` tables (`facts`,
`episodes`, `entities`, `entity_facts`):

- **Every `SELECT` / `UPDATE` / `DELETE`** has a top-level
  `WHERE agent_id = $principal.agent_id` injected by the compile layer
  (not by the LLM — the LLM never sees the predicate).
- `end_user_id` / `thread_id` filters from the caller AND the predicate
  above, never instead of it.
- The SQL allowlist (`sql-validate.ts`) rejects any compiled query
  against memory tables that lacks the `agent_id` predicate — defence in
  depth.
- **Optional but recommended:** also enable Postgres RLS with a session
  GUC set per request. The compile-layer predicate is the primary gate
  (works on engines without RLS, like the planned ClickHouse engine);
  RLS is the second seatbelt.

## Steps

1. **Run 1 — compile-layer injection + allowlist gate.** In the typed-plan
   compiler, detect memory-preset DBs and inject the `agent_id` predicate.
   Extend `sql-validate.ts` to refuse memory-table queries missing the
   predicate. Add a property-style test that fuzzes goals and asserts
   **every** compiled SQL has the predicate.
2. **Run 2 — invariant tests + anon decision.** Tests with **two principals
   in the same DB**: agent A writes, agent B cannot read. End-user / thread
   narrowing tests. Anon principal: writes scoped to the anon token; cross-
   anon reads refused. Optional Postgres RLS toggle on Neon (`SK-MEM-*`
   captures the call).

## Done when

- [ ] Compile-layer injects `agent_id = $principal.agent_id` on **every**
      memory-table SELECT/UPDATE/DELETE; LLM never sees the predicate.
- [ ] `sql-validate.ts` refuses memory-table queries lacking the predicate
      (defence-in-depth gate).
- [ ] Tests: A-cannot-read-B, end-user narrowing, thread narrowing, anon
      scoped to token, ≥ 200 fuzzed-goal cases all carry the predicate.
- [ ] Anon-mode rule documented (decision SK-MEM-* in
      `agent-memory-pivot/FEATURE.md` or a dedicated `memory/FEATURE.md`).
- [ ] `bun run typecheck && lint && test` green; new tests CANNOT be
      skipped (red without the compile-layer injection).
- [ ] Engine INDEX tracker + status ticked. **Code-review:** request a
      second reviewer; this slice owns a security invariant.

## Artifact

A "memory scoping in nlqdb" technical note → `distribution-queue.md`.
(Honest about the invariant + the dual gate; useful for the WS-09 blog.)

## Rollback

The invariant cannot be soft-removed once shipped (would silently widen
visibility). Roll-forward only — patches go in front of new releases, never
behind. If broken in production, disable the memory-preset path (E-01 flag)
until fixed.
