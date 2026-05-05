# GLOBAL-010 — Credentials live in the OS keychain; `NLQDB_API_KEY` is the CI escape hatch

- **Decision:** Long-lived credentials (CLI tokens, MCP host keys) live
  in the OS keychain (Keychain on macOS, libsecret on Linux,
  Credential Manager on Windows). The only env-var path is
  `NLQDB_API_KEY`, used in CI / containerized environments where a
  keychain is unavailable.
- **Core value:** Seamless auth, Bullet-proof
- **Why:** Keychain storage means credentials survive reboots, are
  encrypted at rest by the OS, and don't leak into shell history /
  ps output / env-dump screenshots. The single env-var fallback is
  the explicit, auditable escape hatch — it doesn't quietly become
  the default.
- **Consequence in code:** `cli/` and `packages/mcp` use a small
  keychain abstraction; tokens are written there on first sign-in.
  When the keychain is missing (CI, Docker), `NLQDB_API_KEY` is read
  with a one-line message that names the env-var explicitly. No
  config-file fallback, no `~/.nlqdb/credentials.json`.
- **Alternatives rejected:**
  - Plain config-file storage in `~/.nlqdb/` — leaks via cloud
    backups / dotfile syncs.
  - Required env vars — bad UX on a developer laptop.
