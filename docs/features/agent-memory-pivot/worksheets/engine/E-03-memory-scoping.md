# E-03 — Per-agent / per-end-user / per-thread scoping

**Status:** ⬜ not started — **plan blockers resolved 2026-07-17** (restrictive
policy flavour + owner visibility + opt-in end-user gate ratified into
[SK-PIVOT-009](../../decisions/SK-PIVOT-009-agent-scope-rls.md))
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
the reach track's strongest claims wait on — is gated on this slice.

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

- [ ] `agent_isolation` created **`AS RESTRICTIVE`** per memory table on
      the preset path, `USING` = agent-GUC-or-tenant-literal (+ TTL arm on
      `facts`); opt-in end-user/thread restrictive policies; exec wrappers
      set the GUCs per request.
- [ ] Unit tests (always run, never skipped — red without the policies +
      GUCs): DDL pins policy flavour and clauses; exec steps pin the
      `set_config` calls. Neon integration tests (env-gated like
      `neon-provision.integration.test.ts`): A-cannot-read-B,
      tenant-sees-all, end-user + thread hard gates, TTL invisibility,
      anon/pk_live rejected.
- [ ] E-04 worksheet's read-side-clause remainder ticked (cron Worker
      stays open there).
- [ ] `bun run typecheck && lint && test` green.
- [ ] Engine INDEX tracker + status ticked. **Code-review:** request a
      second reviewer; this slice owns a security invariant.

## Artifact

A "memory scoping in nlqdb" technical note → `distribution-queue.md`.
(Honest about the invariant + why restrictive-RLS, not query-rewriting;
useful for the WS-09 blog and the reach track's R-02/R-03 isolation claims.)

## Rollback

The invariant cannot be soft-removed once shipped (would silently widen
visibility). Roll-forward only — patches go in front of new releases, never
behind. If broken in production, disable the memory-preset path (E-01 flag)
until fixed.
