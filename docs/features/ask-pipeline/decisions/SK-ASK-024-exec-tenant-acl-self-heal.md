# SK-ASK-024 — Exec-time tenant-ACL self-heal: role-missing re-runs the idempotent retarget once

- **Decision:** The production `exec` dep (`buildExec`,
  `apps/api/src/ask/build-deps.ts`) wraps every hosted-Postgres statement
  in `execWithTenantAclHeal`: when exec fails with the tenant-role-missing
  shape (`SET LOCAL ROLE` → SQLSTATE 22023, message
  `role "tenant_<16hex>" does not exist`, `isTenantRoleMissingError` in
  `tenant-role.ts`), it re-runs the SK-ANON-003 ACL retarget
  (`makeAclRetarget(env, "exec_acl_heal_failed")` — role-if-missing +
  grants + `WITH SET` + `ALTER POLICY`, idempotent, constant-size) for the
  row's own tenant and retries the statement once. BYO rows and every
  other error class pass through untouched. A heal failure records its own
  `diag:exec_acl_heal_failed` row (SK-ASK-023) and surfaces the ORIGINAL
  exec error.
- **Core value:** Bullet-proof, Effortless UX
- **Why:** The adoption-time retarget is best-effort and runs **exactly
  once** — a replayed adoption's `UPDATE … WHERE tenant_id = ?` matches
  nothing, so the ACL loop never re-runs. One transient miss at sign-in
  therefore bricked the adopted DB *permanently*: every query died in the
  `db_unreachable` catch-all ("Couldn't reach the database", forever) —
  observed as 18/18 deterministic `pg_code 22023` diag rows across a
  20-minute e2e dispatch (2026-07-11, run 29170696769) on code that had
  passed the identical flow hours earlier and passed again the next day.
  The transient's identity is unobserved (the regrant diag shipped after
  that dispatch); rather than chase a ghost, make the recovery re-entrant:
  the steady-state path repairs the drift the moment the user next
  queries. Recovery that only runs at the *event* (adoption) converts a
  transient into permanent state corruption; recovery keyed off the
  *symptom* (exec) is self-stabilising whatever the original cause.
- **Consequence in code:** Heal placement is the `exec` **dep**, not the
  orchestrator — every call site (the SK-ASK-013 retry loop, the write-
  preview `count` probe) heals transparently, and each stage-retry attempt
  gives the heal another chance for free. Safety: `resolveDb` already
  scoped the row to the calling tenant, so the heal can only grant a
  tenant its own schema; the matcher is pinned to the `tenant_<16hex>`
  identifier so no other missing-role error can trigger a grant batch.
  Span attr `nlqdb.ask.acl_healed` marks healed requests. Unit-proved in
  `apps/api/test/exec-acl-heal.test.ts`.
- **Alternatives rejected:**
  - **Retry/backoff inside the adoption-time retarget** — helps only if
    the transient is time-local to sign-in; a stale-isolate or
    deleted-endpoint cause replays identically, and the brick remains for
    any miss that outlasts the retries.
  - **Re-run the retarget on adoption replay** — heals nothing in
    practice: a fresh browser mints a fresh anon token, so the second
    sign-in is a *first* adoption of a different token, and the bricked
    DB's own token is never replayed.
  - **Orchestrator-level heal branch in the exec catch** — misses the
    write-preview `count` call site and adds a second exec loop to
    `orchestrate.ts` for no coverage gain.
