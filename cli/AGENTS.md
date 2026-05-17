# CLI — Agents Guide

`nlq` command-line tool. Verbs ask/run, OS-keychain credentials, MCP install helper.

> This is the local guide. Read root [`AGENTS.md`](../AGENTS.md) first
> for the behavioral principles, the full path → feature map, and
> the project-wide tech stack. This file narrows that guide to
> `cli/`.

## Features relevant to this area

- [`cli`](../docs/features/cli/FEATURE.md) — mandatory pre-read for changes here.
- [`sdk`](../docs/features/sdk/FEATURE.md) — wire-shape parity (`GLOBAL-001` says the SDK is the only HTTP client; the CLI mirrors that contract in Go).
- [`mcp-server`](../docs/features/mcp-server/FEATURE.md) — `nlq mcp install` writes host configs that point at the hosted server.
- [`anonymous-mode`](../docs/features/anonymous-mode/FEATURE.md) — bare `nlq "<goal>"` mints `anon_<uuid>` via the same convention as the web surface.

## Layout

```
cli/
├── cmd/nlq/main.go              # entrypoint; bare-form rewrite + Cobra exec
├── internal/api/                # the only HTTP layer (mirror of @nlqdb/sdk)
├── internal/auth/               # env-key > refresh > anon resolver
├── internal/cmd/                # one Cobra command per file
├── internal/config/             # ~/.config/nlqdb/config.toml (prefs, SK-CLI-010)
├── internal/credstore/          # keychain + AES-GCM fallback (SK-CLI-009)
├── internal/mcphosts/           # one host detector per file (SK-CLI-011)
├── internal/output/             # human + JSON renderers (SK-CLI-004)
├── internal/paths/              # XDG path resolution (one source of truth)
├── internal/state/              # ~/.config/nlqdb/state.json (SK-CLI-013)
├── internal/updatecheck/        # once-per-day version poll (SK-CLI-015)
├── internal/useragent/          # User-Agent: nlq/<v> (<install>; <os>/<arch>)
└── internal/version/            # build-time `-X` overrides
```

## Files in `~/.config/nlqdb/`

| File | Dotfiles-safe? | What it holds |
|---|---|---|
| `config.toml` | ✅ yes | Stable preferences only — `api_base_url`, color, `no_update_check` (SK-CLI-010). |
| `state.json` | ⚠ no | Active DB + update-check timestamp (SK-CLI-013). Not a secret, but volatile and points at user data. |
| `state.json.lock` | ✅ yes (zero-byte) | flock target; recreated on demand. |
| `credentials.enc` | ❌ never | AES-GCM ciphertext of anon / refresh tokens (SK-CLI-009). |
| `.salt` | ❌ never | The 32-byte HKDF salt authenticating `credentials.enc` to this user on this host (SK-CLI-009). Sharing it weakens the fallback's security back to per-machine. |

"Share my dotfiles" recipes should copy `config.toml` only.

## Commands

Run from the repo root:

```bash
go -C cli build ./...                        # compile all packages
go -C cli test ./... -race -count=1          # unit tests with race detector
go -C cli vet ./...                          # vet
gofumpt -w cli                               # format (stricter than gofmt)
golangci-lint -C cli run ./...               # the lint set the CI job uses
```

Cross-compile for distribution (matches `SK-CLI-002`). The release
pipeline runs this three times — once per install channel — so the
embedded `InstallMethod` matches how the user obtained the binary,
which `User-Agent` parsing and the `nlq update` hint depend on
(`SK-CLI-014`, `SK-CLI-015`).

```bash
for INSTALL in curl-sh homebrew npm-shim; do
  for OS in linux darwin windows; do
    for ARCH in amd64 arm64; do
      CGO_ENABLED=0 GOOS=$OS GOARCH=$ARCH go -C cli build -trimpath \
        -ldflags="-s -w \
          -X github.com/nlqdb/nlqdb/cli/internal/version.Version=$TAG \
          -X github.com/nlqdb/nlqdb/cli/internal/version.Commit=$SHA \
          -X github.com/nlqdb/nlqdb/cli/internal/version.InstallMethod=$INSTALL" \
        -o "dist/$INSTALL/nlq-$OS-$ARCH" ./cli/cmd/nlq
    done
  done
done
```

## Local rules

- Every change here must respect the `GLOBAL-NNN` decisions in
  [`docs/decisions.md`](../docs/decisions.md).
- A new external call (DB / LLM / HTTP / queue) needs an OTel span
  (`GLOBAL-014`). The CLI is the client side; spans live server-side
  on `apps/api` where the request lands.
- If a request is ambiguous or an error is unfamiliar — web-research
  current best practices first (see root `AGENTS.md` §2 P2).
- A decision change (new or amended) updates every place that copies
  it, in the same PR (root `AGENTS.md` §2 P3).
- **Output:** `--json` is the only switch that changes shape; never
  read `isatty(stdout)` to branch the formatter (`SK-CLI-004`). The
  update-check helper is the only exception — `SK-CLI-015` names
  non-TTY as a skip path.
- **Credentials:** the keychain is the default; the AES-GCM fallback
  fires only when `go-keyring` returns `ErrUnsupportedPlatform` or
  another backend error. Plaintext is never an option (`SK-CLI-009`).
- **No client telemetry pipeline.** `User-Agent` is the only signal
  shipped (`SK-CLI-014`). No event-emit code in `cli/`. No
  `DO_NOT_TRACK` / `NLQDB_TELEMETRY` env reads — there is nothing to
  opt out of.
- **Adding a new MCP host:** drop a file in `internal/mcphosts/`
  implementing the `Host` interface, append it to `Registry()`, add
  a test that round-trips a real-shape config file. No changes
  elsewhere.
- **Adding a new verb:** new file under `internal/cmd/`, register it
  in `cmd.New()`, and add the verb name to the `known` map in
  `cmd/nlq/main.go` so the bare-form rewriter doesn't intercept it.
  The `TestRegisteredVerbs` lint test catches divergence.

## E2E coverage

CLI persona journeys live at [`tests/e2e/cli/`](../tests/e2e/cli/) — Go
`testscript` fixtures driven from a hermetic `httptest` mock. Persona
mapping: [P1](../tests/personas/P1-solo-builder/README.md),
[P2](../tests/personas/P2-agent-builder/README.md),
[P4](../tests/personas/P4-backend-engineer/README.md),
[P6](../tests/personas/P6-analytics-engineer/README.md).

After a CLI change that could shift wire shape, output format, or
keychain behaviour, trigger the e2e from the repo:

```bash
gh workflow run e2e.yml -f surface=cli       # hermetic, fast
gh workflow run e2e.yml -f surface=all       # CLI + every other surface, shared staging
```

Local run (no GitHub round-trip):

```bash
cd tests/e2e/cli && go test -count=1 -race ./...
```

A new fixture lands as `tests/e2e/cli/scripts/<persona>_<step>.txtar`
+ a row in the relevant persona README's surface matrix.

See [`docs/features/e2e-coverage/FEATURE.md`](../docs/features/e2e-coverage/FEATURE.md)
for the harness conventions and [`tests/e2e/cli/README.md`](../tests/e2e/cli/README.md)
for the runner specifics.

## When you finish

1. Run the commands above and ensure they all pass.
2. Build artifacts for Linux / macOS / Windows; verify raw < 10 MB
   and gzipped < 4 MB (`SK-CLI-001`).
3. If you added a decision, it has an ID, lives in the right place
   (`docs/decisions.md` or the relevant `FEATURE.md`), and any
   duplicate of an affected `GLOBAL-NNN` is updated.
4. Open a PR; the root `AGENTS.md` §8 lists the pre-PR quality gates.
