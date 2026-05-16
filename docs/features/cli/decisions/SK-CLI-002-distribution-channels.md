# SK-CLI-002 — Distribution: curl-pipe-sh primary, Homebrew tap, npm shim

- **Decision:** Three install paths, in priority order: (1) `curl -fsSL https://nlqdb.com/install | sh` → `~/.local/bin/nlq`, (2) `brew install nlqdb/tap/nlq`, (3) `npm i -g @nlqdb/cli` (Node shim that downloads the right Go binary). All three resolve to the same binary version pinned per release.
- **Core value:** Free, Effortless UX, Open source
- **Why:** Curl-pipe-sh is the lowest-friction install for the Phase 2 developer audience — we control the install script and can sign for tamper detection. Homebrew is the Mac-default for many devs and gives version pinning + uninstall for free. The npm shim closes the loop for teams whose toolchain is "if it's not on npm, it's not happening" — and reuses the same Go binary we already build.
- **Consequence in code:** The release pipeline (DESIGN §13.4) builds a Go binary per (OS, arch) and publishes (a) signed tarballs to a CDN behind `nlqdb.com/install`, (b) a Homebrew formula in the `nlqdb/tap` repo, (c) an `@nlqdb/cli` package whose `postinstall` fetches the right binary. Installer signing keys are documented in `docs/runbook.md`. The npm shim must NOT contain Go source — only download logic.
- **Alternatives rejected:**
  - Single-channel install (only curl-pipe-sh) — closes the door on devs who can't run shell scripts in their environment (e.g. corporate Windows).
  - Cross-compile via npm install (build Go on user's machine) — Go toolchain is not a reliable assumption on user hardware.
