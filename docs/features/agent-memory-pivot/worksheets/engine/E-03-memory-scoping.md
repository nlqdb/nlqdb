# E-03 — Per-agent / per-end-user / per-thread scoping

**Status:** ✅ shipped (2026-07-28) — restrictive `agent_isolation` +
opt-in `end_user_isolation` / `thread_isolation` on the provisioner path,
scope GUCs on both exec wrappers, invariant tests (unit + Neon-gated).
**E-06's `MEMORY_PRESET` prerequisite is satisfied.**
**Sequence:** Engine 3 of 7 · **Risk:** **high — security-critical** · **Runs:** ~2 · **Prereqs:** E-01 ✅ · **Gate:** none, but extra-review

## Goal

Guarantee that one agent cannot read another agent's memory — and that an
end-user-scoped request cannot read another end-user's rows. Every read and
write against an `agent_memory_v1` DB is scoped by the calling principal's
identity, with optional `end_user_id` / `thread_id` narrowing enforced at the
row level. **This is the slice where a correctness bug is a data breach** —
own it explicitly, with tests that pin the invariant.

**Design rule (ratified 2026-07-17):** smoothest possible onboarding for
SaaS builders and the coding agents that build with them — every scope is
server-defaulted, narrowing is one request field, nothing to configure.

## Scorecard number it moves

`Pivot:` boolean "memory scoping invariant tested." Indirectly: every later
wedge claim assumes this works, and `MEMORY_PRESET=1` in prod (E-06) — which
the strongest public wedge claims wait on — is gated on this slice.

## Read first

- [`SK-PIVOT-009`](../../decisions/SK-PIVOT-009-agent-scope-rls.md) — the
  canonical mechanism + semantics (restrictive RLS, GUCs, fail-closed)
- `apps/api/src/principal.ts` — how callers get an identity today
  (`user` / `sk_live` / `sk_mcp` / `pk_live` / `anon`)
- `apps/api/src/db-create/neon-provision.ts` — the `tenant_isolation` RLS
  pattern (permissive) the restrictive `agent_isolation` policy ANDs with
- `apps/api/src/ask/build-deps.ts` — `buildHostedExecSteps` /
  `buildMemoryExec`: the exec wrappers that set `app.tenant_id` + `SET
  LOCAL ROLE tenant_<hash>` (non-owner ⇒ RLS actually enforced); this
  slice adds the scope GUCs alongside

## Mechanism — SK-PIVOT-009 (body in `decisions/`)

Implementation-critical points, in brief (the decision file has the full
rationale):

- `agent_isolation` is created **`AS RESTRICTIVE`** per memory table on the
  preset path. Default-flavour Postgres policies are PERMISSIVE and
  **OR**-combined — a permissive `agent_isolation` next to
  `tenant_isolation` would be dead code and a silent breach. Pin the
  keyword in the DDL unit test.
- `USING`: GUC = `agent_id` **or** GUC = baked tenant literal — the account
  principal (and the E-04 sweep, which `DELETE`s across agents through the
  same exec wrapper) keeps full visibility; narrowed agents are isolated
  from each other. Unset GUC ⇒ NULL ⇒ no rows (fail-closed).
- `end_user_id` / `thread_id`: opt-in **hard gate** — a request carrying
  `endUserId`/`threadId` gets `app.end_user_id`/`app.thread_id` set and
  matching restrictive policies pin them. Absent ⇒ cross-end-user
  analytics run unrestricted within the agent scope (the wedge pitch).
- The `facts` policy carries E-04's `AND (expires_at IS NULL OR expires_at
  > now())` arm now — this completes E-04's read-side remainder (tick it
  there on merge; only the cron Worker stays open).
- Anon/pk_live: **no memory surface** (SK-PIVOT-010 — preset create is
  `requireSession`, `remember` rejects both). Pin with tests; no
  anon-token scoping is designed.
- No prod memory DBs exist (`MEMORY_PRESET` dark), so the policies land on
  the provisioner path only — **no backfill migration**. Pre-E-03 dev DBs
  are disposable.

## Steps

1. **Run 1 — restrictive policies + GUC plumbing.** `neon-provision.ts`
   emits `agent_isolation` (+ end-user/thread restrictive policies) per
   memory table on the preset path; `buildHostedExecSteps` /
   `buildMemoryExec` set `app.agent_id` always and
   `app.end_user_id`/`app.thread_id` when the request carries them; the
   handlers resolve `agent_id` from the principal (+ optional request
   field). Unit-test the generated DDL (pin `AS
   RESTRICTIVE` + both `USING` arms + the TTL arm) and the exec
   transaction statements (no Neon needed).
2. **Run 2 — invariant tests on Neon.** Integration tests with **two
   narrowed agents in the same DB**: agent A writes, agent B cannot read;
   the tenant-default principal reads both. End-user hard-gate test: with
   `app.end_user_id` set, another end-user's rows are invisible to any SQL
   shape. Thread narrowing same. Expired facts invisible on reads. Anon +
   pk_live memory paths stay rejected (pin SK-PIVOT-010).

## Done when

- [x] `agent_isolation` created **`AS RESTRICTIVE`** per memory table on
      the preset path, `USING` = agent-GUC-or-tenant-literal (+ TTL arm on
      `facts`); opt-in end-user/thread restrictive policies; exec wrappers
      set the GUCs per request.
- [x] Unit tests (always run, never skipped — red without the policies +
      GUCs): DDL pins policy flavour and clauses; exec steps pin the
      `set_config` calls. Neon integration tests (env-gated like
      `neon-provision.integration.test.ts`): A-cannot-read-B,
      tenant-sees-all, end-user + thread hard gates, TTL invisibility,
      anon/pk_live rejected.
- [x] E-04 worksheet's read-side-clause remainder ticked (cron Worker
      stays open there).
- [x] `bun run typecheck && lint && test` green.
- [x] Engine INDEX tracker + status ticked. **Code-review:** request a
      second reviewer; this slice owns a security invariant.

## Shipped shape (2026-07-28)

- `db-create/presets/agent-memory-v1.ts` — `agentMemoryV1ScopePolicies()`
  emits the four `agent_isolation` policies (all `AS RESTRICTIVE`) plus the
  `end_user_isolation` / `thread_isolation` pair on `facts` + `episodes`
  (the only tables carrying those columns). `entity_facts` has no
  `agent_id`, so it inherits scope from its parent `entities` row
  (`entity_id IN (SELECT e.id FROM entities e WHERE <agent arm>)`) rather
  than being left unrestricted. `isAgentMemoryV1Db` moved here so the
  provisioner, the `remember` verb and the E-04 sweep share one predicate —
  a DB the write verb accepts can never be a DB whose rows went unscoped.
- `db-create/neon-provision.ts` — emits them right after the permissive
  `tenant_isolation` policies, on the memory-preset id prefix only. No
  backfill (`MEMORY_PRESET` dark ⇒ no prod memory DB exists).
- `ask/build-deps.ts` — `buildHostedExecSteps` sets `app.agent_id` on
  **every** hosted exec (defaulted to the tenant id = the policy's baked
  literal) and the narrowing GUCs only when the request carried them;
  `buildMemoryExec` takes the scope off `plan.scope`, so a write is checked
  against the same gate its later reads are filtered by.
- Handlers: `POST /v1/memory/remember` accepts an optional `agentId`
  (server-defaulted to the principal); `/v1/ask` accepts `agentId` /
  `endUserId` / `threadId` (`invalid_scope` 400 on a non-string — a
  silently-dropped scope field would *widen* visibility).
- GUC re-arming from inside LLM-emitted SQL was already closed:
  `set_config` / `current_setting` are on `sql-validate.ts`'s
  `DISALLOWED_FUNCTIONS` list (SK-SQLAL-008).
- **"Absent GUC" is `nullif(current_setting(…), '') IS NULL`, not `IS NULL`.**
  A custom-GUC placeholder reads NULL only until something sets it; after
  `SET LOCAL`'s transaction-end reset it reads the **empty string** for the
  rest of that backend session, and Neon's HTTP proxy reuses backends. With a
  bare `IS NULL` the first `endUserId`-narrowed request on a connection made
  every later *unnarrowed* read on it return zero rows. Caught by running the
  generated policies against a real Postgres before merge (fail-closed, so
  not a breach — but silent, and only reproducible after a narrowed request).
- **Consequence for E-04's remaining cron half:** the TTL arm lives in a
  `FOR ALL` policy's `USING`, and Postgres applies SELECT/ALL policies to a
  `DELETE` that reads columns in `WHERE`/`RETURNING`
  ([Table 297 note a](https://www.postgresql.org/docs/17/sql-createpolicy.html)),
  so the sweep must run as the schema **owner** — reusing
  `buildHostedExecSteps`' `SET LOCAL ROLE` would make it delete nothing.
  Noted in `memory/expire.ts` and in E-04 step 3(c).

**Surface-parity gap (GLOBAL-003):** the three scope fields are HTTP-only
this run — SDK / CLI / MCP / elements still send neither, so nothing
regresses, but the narrowed-agent story is not reachable from those
surfaces yet. Tracked in the feature's *Open questions*.

## Artifact

A "memory scoping in nlqdb" technical note → `distribution-queue.md`.
(Honest about the invariant + why restrictive-RLS, not query-rewriting;
useful for the WS-09 blog and the wedge's per-agent / per-end-user
isolation claims.)

## Rollback

The invariant cannot be soft-removed once shipped (would silently widen
visibility). Roll-forward only — patches go in front of new releases, never
behind. If broken in production, disable the memory-preset path (E-01 flag)
until fixed.
