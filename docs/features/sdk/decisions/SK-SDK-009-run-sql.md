# SK-SDK-009 — `runSql()` raw-query method; SDK-side counterpart of `nlq run` and `/v1/run`

Parent feature: [`sdk/FEATURE.md`](../FEATURE.md). Opt-in write preview:
[`SK-SDK-012`](./SK-SDK-012-run-dry-run.md). CLI surface:
[`SK-CLI-003`](../../cli/decisions/SK-CLI-003-subcommand-verbs.md).

- **Decision:** The SDK exposes `runSql({ db, sql, signal?, idempotencyKey? }): Promise<{ rows: Row[]; rowCount: number; trace: Trace }>`. It POSTs to `/v1/run` (the raw-SQL escape-hatch endpoint corresponding to CLI `nlq run` per `SK-CLI-003`). The endpoint accepts the same constrained read/write verb list as `/v1/ask` (`SELECT / INSERT / UPDATE / DELETE / WITH / EXPLAIN / SHOW`). DDL is still rejected on this path; DDL only happens via the typed-plan compiler.
- **Core value:** Creative, Bullet-proof, Goal-first
- **Why:** [`GLOBAL-015`](../../../decisions/GLOBAL-015-power-user-escape-hatch.md) requires an escape hatch on every surface. The CLI ships `nlq run` (`SK-CLI-003`); without an SDK counterpart the SDK becomes the NL-only surface — exactly the trap `GLOBAL-015` warns against — and `apps/web`, `packages/elements`, `packages/mcp` lose access to raw SQL. `GLOBAL-002` and `GLOBAL-003` make this a parity requirement, not an option. The endpoint reuses the existing SQL allow-list + executor; only the LLM steps are bypassed, so the safety surface is the same one already shipped.
- **Consequence in code:** `packages/sdk/src/index.ts` adds `runSql` alongside `ask`. The request shape is `{ db: string; sql: string; idempotencyKey?: string }`; the response shape includes the same `trace` block specified by [`SK-TRUST-002`](../../trust-ux/FEATURE.md) — even raw-SQL responses must carry the compiled SQL + plan-id + cache-hit flag so surfaces don't have to special-case the escape-hatch path. `runSql` is a mutating helper (it may run an `INSERT`); `SK-SDK-006` Idempotency-Key auto-generation applies. The wire-layer retry loop (`SK-SDK-008`) applies. The 401 silent-refresh (`SK-SDK-005`) applies. Bearer-key callers (CLI, events-worker) and `withCredentials` callers (web) both work through the same method.
- **Alternatives rejected:**
  - Expose raw SQL only through the CLI — contradicts `GLOBAL-002`; forces web / MCP / embed users to drop down to the CLI for an escape hatch they ought to have in the same SDK they already use.
  - Allow DDL through `/v1/run` — contradicts `architecture.md §3.6.5` validator split; widens the prompt-injection surface and breaks the "DDL only via typed-plan compiler" invariant.
  - Two methods (`runSelect` + `runMutation`) — the SQL allow-list is already the discriminator; doubling the method surface adds no semantic value and breaks the GLOBAL-017 "one way to do each thing" rule.
- **Source:** canonical here · referenced from `docs/features/cli/FEATURE.md` `SK-CLI-003` and from `docs/phase-plan.md §4` Phase 2 deliverable 3. Opt-in write preview in `SK-SDK-012`.
