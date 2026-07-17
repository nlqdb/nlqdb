# SK-PIVOT-009 — Per-agent memory scoping is row-level RLS keyed on `app.agent_id`, never query-rewriting the LLM's SQL

- **Decision:** E-03 scoping is enforced by a row-level RLS policy
  `agent_isolation` on each `agent_memory_v1` table, created **`AS
  RESTRICTIVE`** so Postgres ANDs it with the schema-wide permissive
  `tenant_isolation` policy. (Default-flavour policies are PERMISSIVE and
  OR-combined — a permissive `agent_isolation` would be dead code and a
  silent cross-agent breach. Source:
  [postgresql.org/docs/current/sql-createpolicy.html](https://www.postgresql.org/docs/current/sql-createpolicy.html).)
  The `USING` clause:

      current_setting('app.agent_id', true) = agent_id
      OR current_setting('app.agent_id', true) = '<tenant literal>'

  with the tenant literal baked per-DB exactly like `tenant_isolation`. On
  `facts` the clause also carries E-04's read-invisibility arm
  `AND (expires_at IS NULL OR expires_at > now())` (SK-PIVOT-011). The exec
  wrappers set `set_config('app.agent_id', …, true)` per request alongside
  `app.tenant_id`. The `/v1/ask` read path is **not** rewritten to inject a
  `WHERE agent_id` predicate.
- **Zero-config contract (ratified 2026-07-17):** smoothest possible
  onboarding for a SaaS builder — and for the coding agent wiring their
  repo — means every scope is server-defaulted and opt-in-narrowed; correct
  isolation with no schema design, no RLS knowledge, no setup step:
  - `agent_id` defaults to the tenant principal id (today's behaviour); an
    optional `agent_id` request field narrows to a sub-tenant agent. The
    account principal keeps **full visibility** of all its agents' rows
    (the tenant-literal arm) — the dashboard, cross-agent analytics, and
    the E-04 sweep (one `DELETE` across agents via the same exec wrapper)
    never silently lose rows.
  - `end_user_id` / `thread_id` narrowing is a **hard row-level gate, not
    an advisory SQL filter**: a request carrying `endUserId` / `threadId`
    has the exec wrapper set `app.end_user_id` / `app.thread_id`, pinned by
    matching restrictive policies. There is no layer to inject a `WHERE`
    into LLM SQL (this decision's own finding), so GUC + RLS is the only
    mechanism that lets "give each end-user their own memory" be claimed
    honestly (reach hard rule 1). Absent the field, cross-end-user
    analytics — the wedge pitch — run unrestricted within the agent scope.
  - Anon has **no memory surface** (SK-PIVOT-010: preset create is
    `requireSession`; `remember` rejects anon/pk_live) — E-03 pins that
    with tests instead of designing anon-token scoping.
  - Every GUC comparison **fails closed**: an unset GUC yields NULL and
    matches no row.
- **Core value:** Bullet-proof, Simple
- **Why:** The read path executes free-form LLM-emitted SQL via
  `neonSql.unsafe(sql)` (`ask/build-deps.ts`) — there is **no** typed-plan
  compiler or AST step on the query path to inject a predicate into.
  Rewriting arbitrary LLM SQL (CTEs, JOINs, aliases) is fragile, and on a
  security boundary a parser gap is a cross-agent data breach. RLS is what
  the provisioner already uses for tenant isolation (`tenant_isolation`,
  `neon-provision.ts`): engine-enforced, filters every read/write
  regardless of SQL shape (the exec wrappers' `SET LOCAL ROLE
  tenant_<hash>` already guarantees a non-owner role, so RLS is actually
  enforced), and the single scope source for the eventual ClickHouse
  engine.
- **Consequence in code:** `neon-provision.ts` emits the restrictive
  `agent_isolation` (+ end-user/thread) policies per memory table on the
  preset path; `buildHostedExecSteps` / `buildMemoryExec` set
  `app.agent_id` (+ the opt-in GUCs); handlers resolve `agent_id` from the
  principal (+ optional field). `sql-validate.ts` stays a generic
  destructive-verb guardrail — **not** the scope gate. **Supersedes** the
  "compile-layer scope predicate, dual-gated by `sql-validate`" mechanism
  in SK-PIVOT-006 / the original E-03 worksheet. Ships with two-principal
  invariant tests + second review (Neon-gated).
- **Alternatives rejected:** **AST `WHERE`-injection into LLM SQL** —
  fragile; a parser miss is a breach (the original E-03 plan, falsified
  here). · **`sql-validate.ts` refuses queries lacking the predicate** —
  it can reject but not *inject*, so can't be the primary gate. ·
  **Per-agent schema/DB** — defeats one shared memory DB per tenant + the
  zero-schema-design wedge. · **Strict GUC-equality (no tenant arm)** —
  blinds the account owner and the E-04 sweep to narrowed-agent rows;
  TTL'd facts would silently never expire. · **Advisory end-user
  filtering** — unenforceable on LLM SQL; the per-end-user claim (R-03)
  could never be published under reach hard rule 1.
