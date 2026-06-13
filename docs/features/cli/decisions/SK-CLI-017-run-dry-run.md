# SK-CLI-017 — `nlq run --dry-run` previews raw writes without executing; default `nlq run` stays immediate

Parent feature: [`cli/FEATURE.md`](../FEATURE.md). Wire/SDK/server
counterpart: [`SK-SDK-012`](../../sdk/decisions/SK-SDK-012-run-dry-run.md)
(the `/v1/run` `dryRun` contract). Reuses the write-preview built for
`/v1/ask` ([`SK-TRUST-001`](../../trust-ux/FEATURE.md)). Parent GLOBALs:
[`GLOBAL-015`](../../../decisions/GLOBAL-015-power-user-escape-hatch.md)
(escape hatch, preserved), `GLOBAL-002`/`GLOBAL-003` (parity),
[`GLOBAL-023`](../../../decisions/GLOBAL-023-trust-ux-baseline.md) (trust).

- **Decision:** `nlq run` gains a `--dry-run` boolean flag. With
  `--dry-run` the CLI sends `dryRun: true` to `/v1/run` (`SK-SDK-012`); the
  server previews the statement instead of executing it and returns the
  same `requires_confirm` + `diff` shape `/v1/ask` already returns for
  destructive plans. For a write verb (INSERT / UPDATE / DELETE) the CLI
  prints the existing trust-diff line (`⚠ <VERB> on `<table>` affects ~N
  rows — <summary>`) plus `Re-run without --dry-run to apply.`; for a read
  verb (SELECT / WITH / EXPLAIN / SHOW) it prints `read-only query — safe
  to run.` and nothing executes. `--json` mode carries the same
  `requires_confirm` / `diff` fields. Without `--dry-run`, `nlq run` is
  **unchanged** — immediate execution, the `GLOBAL-015` escape hatch. No
  `--confirm` flag is added to `nlq run` (unlike `nlq ask`): you apply by
  simply re-running without `--dry-run`, keeping one way to apply
  (`GLOBAL-017`).
- **Core value:** Bullet-proof, Honest latency, Creative
- **Why:** `nlq ask` already previews destructive plans before they
  commit (`SK-TRUST-001`), but the raw escape hatch `nlq run` executes
  writes immediately with no preview — a power user pasting a hand-written
  `DELETE … WHERE` has no safety net on the one surface most likely to run
  a typo'd bulk write. An **opt-in** `--dry-run` adds that net without
  weakening `GLOBAL-015`: the default stays immediate, so scripts and
  pipelines that rely on `nlq run` executing don't change. Reusing
  `/v1/ask`'s server-side `buildDiff` (AST + pre-flight `SELECT COUNT(*)`)
  means zero new preview logic and identical affected-row numbers across
  `ask` and `run` (`GLOBAL-002`); the count is computed server-side so the
  CLI never fabricates it (`GLOBAL-011`).
- **Consequence in code:** `cli/internal/cmd/run.go` adds `--dry-run`
  (`BoolVar`) and threads it onto `api.RunRequest{DryRun: true}`;
  `cli/internal/api` adds `DryRun bool` to the run request and optional
  `Confirm` + `Diff` fields to `RunResponse` (mirroring `AskResponse`);
  `cli/internal/output` `WriteRun` renders the preview by reusing the
  `nlq ask` diff renderer. The verb stays in the bare-form `known` map.
  Ships in one slice with `SK-SDK-012` (server `/v1/run` + TS `runSql`),
  the MCP `run` tool's `dryRun` param, and the `<nlq-data>` / framework
  passthrough, per `GLOBAL-003` — no surface lags.
- **Alternatives rejected:**
  - Make preview the default on `nlq run` (mirror `nlq ask`'s mandatory
    confirm) — changes the escape hatch's immediate semantics; a power
    user scripting bulk writes would suddenly need a confirm step,
    breaking existing pipelines and the "raw, immediate" contract
    `GLOBAL-015` protects.
  - A separate `nlq run --explain` or a `nlq preview` verb — doubles the
    surface; `--dry-run` is the conventional name (`terraform plan`,
    `kubectl --dry-run`, `psql` transactions) and reuses the existing diff.
  - Client-side affected-row estimate — silent-lie risk (`GLOBAL-011`);
    the number must come from the server's pre-flight `COUNT(*)` like
    `/v1/ask`.
  - Add `--confirm` to `nlq run` as well — redundant: re-running without
    `--dry-run` already applies; a second knob violates `GLOBAL-017`.
- **Source:** canonical here · wire/server/SDK counterpart `SK-SDK-012` ·
  reuses `SK-TRUST-001` (buildDiff) · governed by `GLOBAL-015`
  (preserved) / `GLOBAL-002` / `GLOBAL-003` / `GLOBAL-023`.
