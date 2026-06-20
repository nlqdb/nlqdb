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

## Mechanism (the precise invariant) — **SK-PIVOT-009**

> **Corrected 2026-06-20 (run 32).** The original plan injected a
> `WHERE agent_id = …` predicate into the compiled SQL at a "compile layer."
> The read-path investigation (`apps/api/src/ask/orchestrate.ts` →
> `build-deps.ts`) found there **is no such layer**: the LLM emits free-form
> SQL as a *string* and it executes via `neonSql.unsafe(sql)` — there is no
> typed-plan compiler or AST step on the query path to inject into. Rewriting
> arbitrary LLM SQL (CTEs, JOINs, aliases) to force a predicate is fragile,
> and on a security boundary a parser gap is a cross-agent data breach. The
> robust mechanism — and the one the provisioner **already** uses for tenant
> isolation — is **row-level RLS keyed on a session GUC**, per SK-PIVOT-009.

For any read/write touching `agent_memory_v1` tables (`facts`, `episodes`,
`entities`, `entity_facts`):

- An additive RLS policy **`agent_isolation`** is created per memory table on
  the preset path, keyed on `current_setting('app.agent_id', true) = agent_id`,
  ANDed with the existing schema-wide `tenant_isolation` policy
  (`neon-provision.ts`). Postgres applies it to every `SELECT`/`UPDATE`/`DELETE`
  uniformly, regardless of the SQL shape the LLM produced — the LLM never sees
  it.
- The exec wrappers (`buildExec` / `buildMemoryExec`) set
  `set_config('app.agent_id', …, true)` per request, transaction-local,
  alongside the existing `app.tenant_id`.
- `agent_id` defaults to the tenant principal id (today's behaviour); an
  optional explicit `agent_id` request field narrows to a sub-tenant agent
  (additive, backward-compatible). `end_user_id` / `thread_id` are *additional*
  caller filters in the SQL, never a substitute for the RLS gate.
- `sql-validate.ts` stays a generic destructive-verb guardrail — it **can't
  inject**, so it is **not** the scope gate (it rejects, doesn't enforce
  membership). The GUC + RLS is the primary gate; it is also the single scope
  source for the eventual ClickHouse engine (which enforces the equivalent
  per-query scope from the same GUC).

## Steps

1. **Run 1 — RLS policy + GUC plumbing.** `neon-provision.ts` emits the
   `agent_isolation` policy per memory table on the preset path; `buildExec` /
   `buildMemoryExec` set `app.agent_id`; the handler resolves `agent_id` from
   the principal (+ optional request field). Unit-test the generated DDL +
   the exec transaction statements (no Neon needed).
2. **Run 2 — invariant tests + anon decision.** Integration tests with **two
   principals in the same DB** on Neon: agent A writes, agent B cannot read.
   End-user / thread narrowing tests. Anon principal: writes scoped to the
   anon token; cross-anon reads refused.

## Done when

- [ ] `agent_isolation` RLS policy created per memory table on the preset
      path, keyed on `current_setting('app.agent_id')`, ANDed with
      `tenant_isolation`; the exec wrappers set `app.agent_id` per request.
- [ ] Tests: generated DDL pins the policy; exec transaction sets
      `app.agent_id`; on Neon, A-cannot-read-B, end-user narrowing, thread
      narrowing, anon scoped to token.
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
