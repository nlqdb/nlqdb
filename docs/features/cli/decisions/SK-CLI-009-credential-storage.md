# SK-CLI-009 — Credential storage: `zalando/go-keyring` primary, machine-keyed AES-GCM fallback file

- **Decision:** Long-lived credentials (CLI refresh tokens, MCP host keys) live in the OS keychain via `zalando/go-keyring`: Keychain (macOS), libsecret (Linux), Credential Manager (Windows). When the keychain is unavailable (some Linux distros without libsecret), the fallback is an AES-GCM-encrypted file at `~/.config/nlqdb/credentials.enc`, keyed to the machine, with a one-line warning printed at write time. **Plaintext is never an option.**
- **Core value:** Bullet-proof, Seamless auth
- **Why:** Keychain storage means credentials survive reboots, are encrypted at rest by the OS, and don't leak into shell history / `ps` output / env-dump screenshots. The AES-GCM fallback covers headless Linux without sacrificing encryption-at-rest; the machine-key derivation means a backup of `credentials.enc` to a different host is useless. This is the CLI manifestation of `GLOBAL-010`.
- **Consequence in code:** `cli/internal/credstore/` (path TBC) wraps `zalando/go-keyring` with the AES-GCM fallback. Keys are derived from a stable machine identifier (`/etc/machine-id` on Linux, `IOPlatformUUID` on macOS, registry GUID on Windows). The fallback path emits a single-line warning the first time it's written. No code path writes `credentials` to a plaintext file.
- **Alternatives rejected:**
  - Plaintext `~/.nlqdb/credentials.json` — leaks via cloud backups / dotfile syncs.
  - GPG-encrypted file with a user passphrase — adds a passphrase prompt to every `nlq` invocation; fails the latency budget.
