# E-01 — Canonical `agent_memory_v1` schema preset for `db.create`

**Status:** ✅ wired (run 1/2 module + run 2/2 request-path; SK-HDC-020). One follow-on tracked: the quality-eval preset-path ablation row (Neon-branch gated).
**Sequence:** Engine 1 of 7 · **Risk:** med · **Runs:** ~2 · **Prereqs:** none · **Gate:** none

## Goal

Ship a typed, versioned schema preset that an agent picks up with **zero
schema design**. `db.create` today infers schemas from an English goal —
generic, but the agent has to know what tables it wants. The preset says:
"agent memory has a known shape; here it is." Every later engine worksheet
writes to or queries it.

## Scorecard number it moves

Onboarding (agent on-ramp) — boolean "memory preset shippable" on the
`Pivot:` line. Unblocks the live demo (WS-09) and the `/agents` CreateForm
(E-06).

## Read first

- `docs/features/hosted-db-create/FEATURE.md` (the `db.create` typed-plan +
  classifier + Neon provisioner pipeline; this is the surface we extend)
- `apps/api/src/db-create/**` (existing presets/templates if any; how
  `classifier.ts` / `sql-validate-ddl.ts` are wired)
- `docs/features/schema-widening/FEATURE.md` — `schema_hash` & widening
  rules (GLOBAL-004); the preset version becomes part of the schema
  identity
- `packages/db/AGENTS.md`

## The schema (v1)

Four tables. Names + columns are part of the public contract once shipped;
evolve via `agent_memory_v2`, never an in-place rename.

```
facts          (id BIGSERIAL PK, agent_id TEXT NOT NULL, end_user_id TEXT NULL,
                thread_id TEXT NULL, kind TEXT NOT NULL,  -- 'fact'|'preference'|'observation'|…
                content TEXT NOT NULL, tags TEXT[] NOT NULL DEFAULT '{}',
                source JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                expires_at TIMESTAMPTZ NULL,                  -- E-04
                embedding VECTOR(?) NULL)                     -- E-05
episodes       (id BIGSERIAL PK, agent_id TEXT NOT NULL, end_user_id TEXT NULL,
                thread_id TEXT NULL, role TEXT NOT NULL,      -- 'user'|'assistant'|'tool'|'system'
                content TEXT NOT NULL, tool_calls JSONB,
                tokens INT, occurred_at TIMESTAMPTZ NOT NULL)
entities       (id BIGSERIAL PK, agent_id TEXT NOT NULL, kind TEXT NOT NULL,
                canonical_name TEXT NOT NULL, properties JSONB,
                first_seen_at TIMESTAMPTZ, last_seen_at TIMESTAMPTZ,
                UNIQUE (agent_id, kind, canonical_name))
entity_facts   (entity_id BIGINT REFS entities(id) ON DELETE CASCADE,
                fact_id BIGINT REFS facts(id) ON DELETE CASCADE,
                PRIMARY KEY (entity_id, fact_id))
```

Indexes: `(agent_id, end_user_id, thread_id, created_at DESC)` on `facts`
and `episodes`; GIN on `facts.tags`; vector index left to E-05.

## Steps

1. **Run 1 — preset module. ✅ (2026-06-20, run 29).** New
   `apps/api/src/db-create/presets/agent-memory-v1.ts` exports the four-table
   DDL (`agentMemoryV1Ddl(schemaName)`), the `AGENT_MEMORY_V1_VERSION`
   versionTag, and the pinned column contract (`AGENT_MEMORY_V1_COLUMNS`).
   Plain DDL (not a `SchemaPlan` — the shape needs multi-column UNIQUE, a
   composite-PK link table, `ON DELETE CASCADE`, `TEXT[]` + GIN, beyond the
   inferred-plan grammar), authored to pass the **same** `sql-validate-ddl`
   validator (asserted in the test). **Deviations from the schema block,
   intentional:** `embedding VECTOR` is deferred to E-05 (its own multi-run slice;
   added later as an ADD COLUMN widen) so the preset provisions on stock
   Postgres; `expires_at` ships now (plain nullable column, E-04 adds the
   sweep); the `episodes` scope index orders by `occurred_at` (its time column)
   rather than the non-existent `created_at`. The module is **additive and
   unreferenced** this run — rollback is deleting the file. The `versionTag →
   schema_hash` thread, the `{ preset }` input field, the `MEMORY_PRESET` flag,
   and the classifier-skip are **run 2** (the request-path change).
2. **Run 2 — wire + tests. ✅ (2026-06-20, run 30; SK-HDC-020).** `DbCreateArgs`
   gains `preset?: MemoryPreset`; the orchestrator branches on it to skip
   `classifyEngine`/`inferSchema`/`compileDdl` and source `engine` (pinned
   `postgres`), the typed `plan` (`agentMemoryV1Plan()` projection), and the
   `ddl` (`agentMemoryV1Ddl`) from the preset, then shares steps 4–7
   (validate → provision → MRU → embed → mint) with the inferred path. The DDL
   is re-derived on the SK-HDC-012 collision retry. `schema_hash` is
   version-keyed via the projection's `slug_hint` and shared across every
   preset DB (one plan-cache fingerprint, GLOBAL-006). `POST /v1/databases`
   parses `preset` (gated behind `MEMORY_PRESET`; `preset_disabled` /
   `invalid_preset` / `preset_engine_conflict` rejections; no goal needed).
   Unit + contract tests cover the wiring; the **quality-eval preset-path
   ablation row** needs a Neon test branch and is the one tracked follow-on.

## Done when

- [x] `db.create` accepts `{ preset: "agent_memory_v1" }` and provisions the
      four tables + indexes deterministically.
- [x] `schema_hash` includes the preset version (existing widening rules
      from GLOBAL-004 unchanged — `slug_hint` carries the version tag).
- [x] Hosted-db-create feature has an `SK-HDC-*` decision covering the preset
      path (SK-HDC-020). ⬜ quality-eval preset-path ablation row (Neon-branch
      gated — tracked in SK-HDC-020 § Remaining).
- [x] `typecheck && lint && test` green (orchestrate + preset contract tests;
      824 API tests green). ⬜ live integration test against a Neon branch
      (env-gated — same skip pattern as `neon-provision.integration.test.ts`).
- [x] Engine INDEX tracker + status ticked.

## Artifact

A "what's in an `agent_memory_v1` database" doc page in `apps/docs/` (one
page; the schema is small) → `distribution-queue.md`.

## Rollback

Behind a feature flag. Disable `MEMORY_PRESET`; existing DBs untouched
(the preset path was opt-in). Remove the input field on the next release.
