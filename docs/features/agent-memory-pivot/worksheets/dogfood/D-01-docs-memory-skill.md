# D-01 — The docs→memory extraction skill (tracking slice)

**Status:** 🟡 **build in flight 2026-07-28** — the skill artifact is being
built by a parallel agent on branch **`claude/docs-memory-skill`**. **Do not
build it here.** This worksheet is the *tracking* slice: it records what the
artifact must satisfy for the rest of the track to stand on it, and it is
ticked when that branch merges.
**Sequence:** Dogfood 1 of 7 · **Risk:** med · **Runs:** ~2 (in flight) · **Prereqs:** — · **Gate:** none

## Goal

An nlqdb-branded skill — in the existing agent-artifacts family, beside
`nlqdb-memory` — that instructs a coding agent to extract a repo's
**structured operational knowledge** into an nlqdb memory DB through the public
MCP surface. Not prose ingestion: decisions (IDs, statuses, dates,
cross-references), open questions (with ages), queues, ledgers/trackers.

This is the producer for everything else in the track. D-02 re-runs it, D-03
scores it, D-04 points it at nlqdb's own `docs/`, D-05 clones its recipe for a
second persona, D-06 renders what it wrote, D-07 benchmarks against its corpus.

## SK-PIVOT-016 criterion / number it moves

No criterion goes green on this slice alone — it is the **instrument** behind
criteria 1–3 (call volume, first-10 success, zero-incident). Nothing in the
gate is measurable until this exists.

## Read first

- [`SK-PIVOT-017`](../../decisions/SK-PIVOT-017-docs-to-memory-skill.md) — the
  canonical decision (extraction shape, one-way sync, markdown canonical, what
  v1 explicitly does **not** ingest)
- [`SK-PIVOT-018`](../../decisions/SK-PIVOT-018-goal-packs.md) — this skill *is*
  goal pack #1 (repo-ops); the pack anatomy (recipe + seeds + golden queries) is
  the shape D-05 reuses
- `apps/web/public/agent-artifacts/README.md` + `nlqdb-memory/SKILL.md` — the
  existing family, its install path (`npx skills add …`), and the file layout a
  new skill must match
- `apps/web/src/lib/agent-artifacts.test.ts` — the guard that pins the family's
  published surfaces; a new skill is expected to extend it
- `apps/api/src/memory/remember.ts` — the write verb's actual contract
  (`AGENT_MEMORY_V1_COLUMNS`, `wrong_preset` 409) the skill must generate valid
  calls against

## Acceptance contract — what the in-flight build must satisfy

The rest of this track assumes all of these. If the merged artifact misses one,
the gap is this worksheet's remaining work, not a silent renegotiation.

1. **Public surfaces only** — writes via `nlqdb_remember`, reads via
   `nlqdb_query`, over `npx -y @nlqdb/mcp` with a self-minted `sk_live_*` key.
   No privileged path, no internal binding.
2. **Idempotent** — a second run over an unchanged corpus converges (no
   duplicate facts). Entities upsert on `(agent_id, kind, canonical_name)`, the
   UNIQUE `remember.ts` already relies on.
3. **One-way** — the skill never writes markdown back. It has no edit step.
4. **Structured extraction only** — decision IDs, statuses, dates,
   cross-references, open-question ages, queue/tracker rows. v1 does **not**
   ingest arbitrary prose (SK-PIVOT-017), so a "summarise this doc" step is out
   of scope and a reviewer rejects it.
5. **No secret values** — if the corpus mentions a credential, only its
   metadata is stored (SK-PIVOT-018).
6. **Installable by the one command** the family already publishes, and pinned
   by `agent-artifacts.test.ts` like its siblings.

## Steps (for the run that closes this slice, after the branch merges)

1. Read the merged artifact. Check it against the six acceptance points above.
   Any miss becomes a numbered follow-on box here — don't tick around it.
2. Record the artifact's real path in this file and in the INDEX tracker line
   (the rest of the track links to it).
3. If the skill's extraction recipe diverged from SK-PIVOT-017's scope (e.g. it
   ingests prose), **stop and raise it** with the ID per `CLAUDE.md` P1 — that
   is a decision change, not a worksheet detail.

## Done when

- [ ] `claude/docs-memory-skill` is merged and its artifact path is recorded
      here + in [`INDEX.md`](INDEX.md).
- [ ] All six acceptance-contract points verified against the merged files
      (each one either satisfied or carried as a numbered follow-on box).
- [ ] `agent-artifacts.test.ts` (or its successor guard) pins the new skill's
      published surface.
- [ ] `bun run typecheck && test` green; lint run with explicit paths.
- [ ] INDEX tracker + status ticked `🟡 → ✅`.

## Artifact

The lesson is a strong one and belongs in `research/distribution-queue.md`:
*"we imported our own docs into our own product and it told us what we'd
forgotten"* — the cold-start fix SK-PIVOT-017 names, written from a real run.
Draft it only when the step-3 queue gate allows (< 3 deep).

## Rollback

The skill is a published static artifact — removing the directory removes the
capability, no migration. Memories it already wrote are unaffected (and are
D-04's asset, so don't delete them to "clean up" a skill rollback).
