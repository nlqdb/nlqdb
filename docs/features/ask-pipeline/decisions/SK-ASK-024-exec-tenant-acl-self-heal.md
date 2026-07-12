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
  exec error. Shipped together with the root-cause fix it backstops: the
  retarget imports its Neon client from `db-create/pg-client.ts` (a
  WASM-free module split out of `build-deps.ts`), because the previous
  `await import("./db-create/build-deps.ts")` rejected at module scope —
  libpg-query's Emscripten loader dereferences `self.location.href` in
  workerd — in every isolate where the create path's
  `ensureLibpgWasmGlobals()` shim hadn't already run. The rejection
  happened before the instrumented try, so adoption silently skipped the
  retarget and bricked the DB; whether a run passed depended on isolate
  routing, which is why the class looked dispatch-intermittent for four
  days (proven by an A/B preview probe, 2026-07-12: same flow, old code →
  role missing / no diag row; pg-client import → role created + RLS
  retargeted).
- **Core value:** Bullet-proof, Effortless UX
- **Why:** Two defects compounded. (1) The retarget's failure mode was
  *invisible*: the import rejection happened outside the try that owns the
  diag write, so 18/18 deterministic `pg_code 22023` exec rows (e2e run
  29170696769) had no matching regrant-failure row to explain them. (2)
  The retarget is **one-shot**: adoption replay's `UPDATE … WHERE
  tenant_id = ?` matches nothing on replay, so the ACL loop never re-runs
  — one miss bricked the adopted DB *permanently* ("Couldn't reach the
  database", forever), and every request-scoped retry (SK-ASK-013/022)
  replayed against state a previous request failed to write. The heal
  removes the one-shot property for good: recovery keyed off the *symptom*
  (exec) in the steady-state path is self-stabilising whatever drift
  caused it — the next import-graph regression, a restored branch, a
  partially-failed grant batch.
- **Consequence in code:** Heal placement is the `exec` **dep**, not the
  orchestrator — every call site (the SK-ASK-013 retry loop, the write-
  preview `count` probe) heals transparently, and each stage-retry attempt
  gives the heal another chance for free. Safety: `resolveDb` already
  scoped the row to the calling tenant, so the heal can only grant a
  tenant its own schema; the matcher is pinned to the `tenant_<16hex>`
  identifier so no other missing-role error can trigger a grant batch.
  Span attr `nlqdb.ask.acl_healed` marks healed requests. In
  `anon-adopt-regrant.ts`, client construction now sits INSIDE the
  instrumented try — nothing on the retarget path can fail without a
  diag row. Unit-proved in `apps/api/test/exec-acl-heal.test.ts`.
- **Alternatives rejected:**
  - **Only fix the import (no heal)** — restores the one-shot property:
    the next silent miss (any cause) is a permanent brick again, and this
    class took four days and three PRs to see the first time.
  - **`ensureLibpgWasmGlobals()` before the retarget's dynamic import** —
    treats the symptom; the retarget has no business importing a WASM SQL
    parser to run six GRANT statements (P5).
  - **Re-run the retarget on adoption replay** — heals nothing in
    practice: a fresh browser mints a fresh anon token, so the second
    sign-in is a *first* adoption of a different token, and the bricked
    DB's own token is never replayed.
  - **Orchestrator-level heal branch in the exec catch** — misses the
    write-preview `count` call site and adds a second exec loop to
    `orchestrate.ts` for no coverage gain.
