# @nlqdb/cli

npm shim for the [`nlq`](https://github.com/nlqdb/nlqdb/tree/main/cli) CLI.

`npm install -g @nlqdb/cli` downloads the right Go binary for your platform
from the matching GitHub Release, verifies its sha256 against the release's
`checksums.txt`, and places it on your `PATH`.

## Install

```bash
npm install -g @nlqdb/cli      # or pnpm, yarn, bun
nlq --version
```

Equivalent paths — all resolve to the same binary version:

```bash
curl -fsSL https://nlqdb.com/install | sh
brew install nlqdb/tap/nlq
```

## Supported platforms

- macOS (Intel + Apple Silicon)
- Linux (x86_64 + arm64)

Windows / other targets: build from
[source](https://github.com/nlqdb/nlqdb/tree/main/cli) — the postinstall
errors out early via `package.json` `os` / `cpu` gates so `npm install`
never gets to the download step on unsupported platforms.

## Env vars

| Variable | Effect |
|---|---|
| `NLQDB_CLI_SKIP_DOWNLOAD=1` | Skip the postinstall download (CI / airgapped — install the binary separately). |
| `NLQDB_CLI_BINARY_URL` | Override the tarball URL (corporate mirror). |
| `NLQDB_CLI_CHECKSUMS_URL` | Override the `checksums.txt` URL (must list the matching archive). |

The downloaded binary's sha256 is always verified against the
release's signed `checksums.txt` before it lands on disk.

## How it works

This package contains no Go source. `bin/nlq.cjs` is a tiny Node
wrapper that execs the platform binary downloaded by
`scripts/postinstall.mjs`. Decisions:
[`SK-CLI-002`](https://github.com/nlqdb/nlqdb/blob/main/docs/features/cli/decisions/SK-CLI-002-distribution-channels.md).
