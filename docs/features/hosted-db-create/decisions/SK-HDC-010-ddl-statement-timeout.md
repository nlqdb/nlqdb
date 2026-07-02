# SK-HDC-010 — DDL transaction has a 30 s statement timeout, 600 s for index DDL

- **Decision:** Immediately after `BEGIN`, the provisioner issues `SET LOCAL statement_timeout = '30s'`. DDL statements matching `/\bindex\b/i` are bracketed with a per-statement bump to `'600s'` and reset to `'30s'` after. `SET LOCAL` is transaction-scoped and resets on `COMMIT` / `ROLLBACK`.
- **Core value:** Bullet-proof
- **Why:** A server-side `statement_timeout` catches pathological DDL expressions — e.g., a schema with a circular FK reference — that parse and validate correctly but hang at execution time. 30 s is generous for `CREATE TABLE` / `ALTER TABLE` (typical: <100 ms) but short enough to prevent a stuck connection from holding the Worker open until isolate death. `CREATE INDEX` against a populated table is the carve-out: it can run for minutes, and capping at 30 s would surface as `ddl_execution_failed` on benign large-table cases.
- **Consequence in code:** `neon-provision.ts` owns both timeouts; the 600 s bump matches `/\bindex\b/i` (word-boundary, so `idx_user_id` does not trigger). Neither value is configurable.
- **Alternatives rejected:**
  - Session-level `SET statement_timeout` — leaks into subsequent requests on a pooled connection.
  - Single 30 s ceiling for everything — bites on legitimate `CREATE INDEX` against a populated table.
  - Single 600 s ceiling for everything — defeats the guard for the 99 % case.
  - Trust the Worker CPU limit alone — hard kill, no `finally`, worse error surface.
  - Configurable via wrangler.toml — adds operator surface for a value that doesn't need tuning at Phase 1 scale.
