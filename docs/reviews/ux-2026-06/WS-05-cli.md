# WS-05 — CLI (`nlq`)

**Scope:** `cli/`.
**Pre-reads:** `docs/features/cli/FEATURE.md` (+ its `decisions/`),
GLOBAL-012, GLOBAL-015 (files under `docs/decisions/`).
**Default KPI:** UX (human + agent shell ergonomics).
**Constraints:** SK-CLI-004 (no TTY-sniffing of output format; `--json`
is explicit), SK-CLI-005 (anonymous-first, no login wall), SK-CLI-008
(`NLQDB_API_KEY` env precedence; no keychain in CI), SK-CLI-014 (no
client-side telemetry), GLOBAL-012 (one-sentence errors + next action).

Verified strengths to preserve: bare `nlq "<goal>"` first-run, strict
stdout/stderr + `--json` discipline, keychain-only secrets, `printErr`
one-sentence error helper, machine-readable `nlq help --json`.

---

## WS05-T1 (P1) — BYOLLM error chain dead-ends on a stub command

- **Files:** `cli/internal/cmd/byollm.go:124-127` (the
  `byollmNeedsSession` const), printed from `cli/internal/cmd/ask.go:73`
  and `:147`; `cli/internal/cmd/login.go:21-22` (the stub)
- **Problem (verified):** `nlq byollm set` succeeds → `nlq ask` fails
  with "run `nlq login`…" → `nlq login` itself fails with "ships in the
  next slice". Two redirects into a wall. GLOBAL-012's *next action* must
  be an action that works today.
- **Fix:** Reword the const to lead with the working path:
  "your own LLM key needs a signed-in session — set
  NLQDB_API_KEY=<sk_live_…> (nlq login ships soon), or `nlq byollm clear`
  to use the built-in models." Note the file comment: this string is
  deliberately shared with the server's `byollm_requires_session`
  envelope so the two can't drift — keep it a single const, and when
  `nlq login` actually ships, revert the wording in the same PR that
  ships it.
- **Accept:** No CLI error message references `nlq login` while login.go
  is a stub (`grep -rn "nlq login" cli/internal/cmd/ | grep -v login.go`
  reviewed by hand); message stays one sentence.

## WS05-T2 (P2) — Deferred commands are indistinguishable from real failures for scripts

- **Files:** `cli/internal/cmd/login.go:18-23`,
  `cli/internal/cmd/mcp.go` (install path, ~lines 70-77)
- **Problem:** `nlq login` and `nlq mcp install` exit 1 with prose. An
  agent can't tell "not yet shipped" from "broke" without substring
  matching stderr.
- **Fix:** In `--json` mode emit
  `{"status":"not_implemented","command":"login"}` (matching the
  camelCase/JSON conventions of the other commands) before the non-zero
  exit, for both commands. Keep exit code 1 (a distinct exit code is a
  taxonomy decision — don't introduce one here; see WS05-T7 if tempted).
- **Accept:** `nlq login --json; echo $?` → parseable JSON + exit 1; same
  for `nlq mcp install --json`; human output unchanged.

## WS05-T3 (P2) — Anonymous-token mint can surface a raw crypto error

- **Files:** `cli/internal/auth/auth.go` (~lines 86-92)
- **Problem:** If the CSPRNG read fails on first run, the user sees a
  wrapped low-level error ("mint anon: …") — not a GLOBAL-012 sentence
  with a next action, and it fires at the worst moment (first contact).
- **Fix:** Wrap with: "couldn't generate an anonymous token (system
  entropy unavailable) — retry, or set NLQDB_API_KEY to skip anonymous
  setup." Keep `%w` so the cause stays inspectable.
- **Accept:** Error path returns the sentence; unit test with an injected
  failing reader if the seam allows.

## WS05-T4 (P2) — `nlq logout --json` uses snake_case keys; every other command is camelCase

- **Files:** `cli/internal/cmd/logout.go` (~lines 32-36)
- **Problem (parity, GLOBAL-002):** `config_dir`, `env_api_key_present`
  vs the camelCase used by all API-mirroring responses (`dbId`,
  `lastUsedAt`). Agents parsing multiple commands need one convention.
- **Fix:** Rename to `configDir`, `envApiKeyPresent`. Pre-1.0, no
  back-compat shim (CLAUDE.md P5 de-prioritizes backward compatibility).
- **Accept:** `nlq logout --json` keys are camelCase; tests updated.

## WS05-T5 (P3) — Polish batch (one commit)

1. **`nlq update` on brew/npm installs** (`cli/internal/cmd/update.go`
   ~lines 25-37): after printing the package-manager hint, `return nil`
   instead of continuing into the curl-path update-check network call
   (SK-CLI-015 says update is curl-only).
2. **`--json` discoverability**: add one line — "Pass --json for
   machine-readable output." — to the Long help of `ask` and `run`
   (`ask.go` ~28-30, `run.go` ~26-36).
3. **Empty `db list` hint** (`cli/internal/output/output.go` ~line 118):
   point at the bare form `nlq "<what you're building>"` (the documented
   SK-CLI-012 onboarding path) instead of `nlq new`.
4. **Revoke finality** (`cli/internal/cmd/keys.go` ~line 96): "✓ Revoked
   key <id> — it stops working within about a second." (verify the
   propagation claim against the api-keys feature before writing it).
5. **Decision IDs in user-facing help** (`cli/internal/cmd/query.go`
   ~lines 14-16): drop the `SK-CLI-003` citation from the Long text;
   decision references belong in code comments / FEATURE.md, not help
   output.
- **Accept:** Each item verifiable from `--help` / command output;
  `bun run test` (and the Go test suite per `cli/AGENTS.md`) green.

## WS05-T6 (P2) [decision needed] — No preview path for raw SQL writes

- **Context:** `nlq ask` already has a built-in dry-run (destructive
  plans return `requires_confirm` + diff until `--confirm`). `nlq run`
  (GLOBAL-015 escape hatch) executes writes immediately — there is no
  `--dry-run`, and adding one is a *feature decision* (it likely needs an
  API-side preview mode, which touches `/v1/run` and surface parity per
  GLOBAL-003), not a copy fix.
- **Task:** Do not implement. Add it to
  `docs/features/cli/FEATURE.md` → `## Open questions / known unknowns`
  ("should `nlq run` support a preview/dry-run for writes, and does
  `/v1/run` need a preview mode to back it?") and raise it with the user.

## WS05-T7 — Explicitly out of scope

- Distinct exit codes per error class, `--quiet` flag, interactive REPL:
  all are taxonomy/feature decisions beyond this review. If wanted, they
  go through `FEATURE.md` open questions first (CLAUDE.md P4-D1), not a
  worksheet.
