# SK-SDK-012 — `runSql({ dryRun })` and the `/v1/run` `dryRun` flag preview writes without executing

Parent feature: [`sdk/FEATURE.md`](../FEATURE.md). Builds on
[`SK-SDK-009`](./SK-SDK-009-run-sql.md) (the `runSql()` / `/v1/run`
escape-hatch contract). Reuses the write-preview built for `/v1/ask`
([`SK-TRUST-001`](../../trust-ux/FEATURE.md), `apps/api/src/ask/diff.ts`).
CLI surface: [`SK-CLI-017`](../../cli/decisions/SK-CLI-017-run-dry-run.md).
Parent GLOBALs:
[`GLOBAL-015`](../../../decisions/GLOBAL-015-power-user-escape-hatch.md)
(escape hatch, preserved), `GLOBAL-001`/`GLOBAL-002`/`GLOBAL-003` (one
client, parity), `GLOBAL-011` (no silent lie), `GLOBAL-023` (trust).

- **Decision:** `runSql()` gains an optional `dryRun?: boolean`, and
  `/v1/run` accepts a `dryRun` field. When `dryRun: true` **and** the
  statement's leading verb is a write (INSERT / UPDATE / DELETE), the
  orchestrator runs the existing `buildDiff` and returns
  `{ requires_confirm: true, diff, trace, rows: [], rowCount: 0 }`
  **without executing** — byte-identical to `/v1/ask`'s preview hop, so
  every surface shares one renderer (`GLOBAL-002`). When `dryRun: true`
  and the verb is a read (SELECT / WITH / EXPLAIN / SHOW), it returns
  `{ requires_confirm: false, … }` without executing — a read is
  side-effect-free, so "safe to run" is the honest answer and we don't
  spend a query. When `dryRun` is omitted or `false`, `/v1/run` is
  **unchanged**: immediate execution, the `GLOBAL-015` escape hatch. The
  wire `RunResponse` (and the SDK `RunResult`) gain optional
  `requires_confirm` + `diff` fields mirroring `AskResponse`.
- **Core value:** Bullet-proof, Creative, Goal-first
- **Why:** `nlq ask` / `/v1/ask` already preview destructive plans, but
  `/v1/run` is deliberately the raw, no-preview escape hatch
  (`orchestrate.ts` skips the diff gate). That leaves the escape-hatch
  surface — the one most likely to run a hand-written bulk write — with no
  safety net. An **opt-in** flag adds the net additively: `GLOBAL-015` is
  about *exposing* a raw path, not forbidding a preview, and the default
  immediate behavior is untouched, so existing `runSql` writers don't
  change. Reusing `buildDiff` (server-side AST + pre-flight `COUNT(*)`)
  means no new preview logic and the same affected-row numbers as
  `/v1/ask` (`GLOBAL-002`), computed server-side so no surface fabricates
  the count (`GLOBAL-011`). The SDK is the only HTTP client (`GLOBAL-001`),
  so the option lives here for web / `<nlq-data>` / MCP to inherit it.
- **Consequence in code:** `apps/api/src/run/orchestrate.ts` — `RunRequest`
  gains `dryRun?: boolean`; after the validate + `readOnly` gate +
  `resolveDb`, if `req.dryRun && isWriteVerb(sql)` build the diff (the same
  `CountExec` closure `/v1/ask` uses) and return the preview without the
  `nlqdb.run.exec` hop; if `req.dryRun` on a read, return
  `requires_confirm: false` with no exec; otherwise unchanged. `RunResult`
  and the wire response gain optional `requires_confirm` + `diff`.
  `packages/sdk/src/index.ts` `runSql` accepts `dryRun` and surfaces the
  preview fields. The `nlqdb.diff.build` span already exists (`GLOBAL-014`).
  Ships in one PR with `SK-CLI-017` (`nlq run --dry-run`), the MCP `run`
  tool's `dryRun` param, and the `<nlq-data>` / framework-wrapper
  passthrough, per `GLOBAL-003`.
- **Alternatives rejected:**
  - Make preview mandatory on `/v1/run` (drop the immediate path) — breaks
    `GLOBAL-015`; existing `runSql` callers that write would silently
    no-op until they learned a new confirm step.
  - A separate `/v1/run/preview` endpoint — duplicates the orchestrator's
    rate-limit + validate + resolve path for one boolean; a flag on the
    existing endpoint reuses all of it (`GLOBAL-017`).
  - Execute reads under `dryRun` — a "dry" run that touches data is a
    contradiction; reads are side-effect-free, so report "safe to run"
    without spending the query.
  - Client-computed diff — `GLOBAL-011` silent-lie risk; the count is
    server-side, identical to `/v1/ask`.
- **Source:** canonical here · CLI surface `SK-CLI-017` · builds on
  `SK-SDK-009` (runSql) + `SK-TRUST-001` (buildDiff) · governed by
  `GLOBAL-015` (preserved) / `GLOBAL-002` / `GLOBAL-003` / `GLOBAL-023`.
