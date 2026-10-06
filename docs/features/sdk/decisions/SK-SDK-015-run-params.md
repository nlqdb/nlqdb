# SK-SDK-015 — `runSql({ params })`: values bind to `$1…$n`, never inlined

Parent feature: [`sdk/FEATURE.md`](../FEATURE.md). Builds on
[`SK-SDK-009`](./SK-SDK-009-run-sql.md). Closes §6.1 R3 of
[`001-rateme12.md`](../../../history/dogfood-iterations/001-rateme12.md).

- **Decision:** `runSql()` and `/v1/run` take an optional `params` — a JSON
  array of strings, numbers, booleans or nulls, at most 1000, bound to
  `$1…$n` by the database driver. The SQL text and the `trace` block never
  carry the values. Anything else is `invalid_body` (400), and so is an
  integer past 2^53: `JSON.parse` has already rounded it, so it could bind
  to the wrong row (send it as a string). The count must equal the highest
  `$n` the parser finds, else `sql_rejected` (`params_mismatch`) before
  exec, so a cast is `CAST($1 AS int)` (the allow-list parser,
  node-sql-parser 5.4, rejects `$1::int` as `parse_failed`). A ClickHouse
  database rejects non-empty `params` with `sql_rejected`
  (`params_unsupported_engine`), because ClickHouse binds named
  `{name:Type}` params, not `$n`. CLI: `nlq run --params '<json array>'`;
  Swift: `RunSqlRequest(params:)` (`SK-SWIFT-005` parity).
- **Core value:** Bullet-proof, Simple
- **Why:** an app's Worker writes user-typed values. Through `ask()` those
  values ride the goal text into an LLM plan and cost one plan per uncached
  insert. Through `runSql()` without `params`, the app has to inline them,
  which is the SQL-injection shape. The Postgres exec path already binds
  params (`HostedExecStep.params`, the memory-write path), so this choice
  reuses the existing wire and executor (`GLOBAL-033`, "reuse what's
  built"). It adds no new endpoint.
- **Consequence in code:** `apps/api/src/http.ts` `parseRunBody` shape-checks
  `params`. `apps/api/src/run/orchestrate.ts` passes them to `exec`. The
  `ask/build-deps.ts` `dispatchExec` runners bind them (hosted Neon, BYO
  `postgres.js`, Supabase mgmt). The span records `nlqdb.run.param_count`
  only, never the values. Engine refusals reuse the `/v1/ask` classifiers:
  class 23 is `write_constraint`, class 22 is `invalid_value`, never a
  retryable `db_unreachable`. MCP and `<nlq-data>` have no raw-SQL verb, so
  there is no `GLOBAL-003` gap.
- **Alternatives rejected:**
  - Structured values on `ask()`: this keeps writes on the inference path,
    but it needs placeholder plans, a cache key over the value shape, and
    widen-path changes. It is a Phase A slice of its own, not a wire flag.
  - Client-side escaping in the SDK: every surface would need its own
    escaper, and one wrong one is an injection hole. The driver binds.
