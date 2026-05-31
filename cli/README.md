# cli — the `nlq` binary (Go)

Static Go binary, 3-char name, distributed via curl-pipe-sh, Homebrew
tap, and an npm shim (`@nlqdb/cli`). Power-user surface for
devs / agents who don't want a browser.

Bootstrap slice ships: `nlq ask`, `nlq run`, `nlq new`, bare
`nlq "…"`, `nlq db list`, `nlq db create`, `nlq query`, `nlq use`,
`nlq whoami`, `nlq logout`, `nlq mcp detect`, `nlq update`,
`nlq keys list`, `nlq keys revoke <id>`,
`nlq byollm set|status|clear` (bring your own LLM key, 0% markup),
plus `--json` / `--version` / `--help`. Auth: `NLQDB_API_KEY`
env-key (CI escape hatch) or anonymous device token in the OS
keychain (default).

Verbs deferred to follow-up slices (gated on server endpoints not
yet shipped): `nlq login` device-flow, `nlq mcp install` key-write,
`nlq chat` REPL, `nlq keys rotate`, `nlq connection`. See
[`../docs/features/cli/FEATURE.md`](../docs/features/cli/FEATURE.md)
for the per-verb status.

See [`docs/architecture.md §3.3`](../docs/architecture.md#33-cli---nlq)
for the full surface spec.

## Install (post-Phase-2)

```bash
curl -fsSL https://nlqdb.com/install | sh       # primary
brew install nlqdb/tap/nlq                      # macOS / Linux
npm i -g @nlqdb/cli                             # Node toolchain
```

## Build from source

```bash
go -C cli build -trimpath -ldflags='-s -w \
  -X github.com/nlqdb/nlqdb/cli/internal/version.Version=dev' \
  -o nlq ./cmd/nlq
./nlq --version
```

See [`AGENTS.md`](AGENTS.md) for the full layout and per-platform
cross-compile recipe.
