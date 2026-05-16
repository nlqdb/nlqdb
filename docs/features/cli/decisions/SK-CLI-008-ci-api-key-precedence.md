# SK-CLI-008 — CI mode: `NLQDB_API_KEY` takes precedence, no keychain access attempted

- **Decision:** When `NLQDB_API_KEY` is set in the environment, the CLI uses it directly as the bearer token, skips `nlq login`, and does not attempt any keychain access. This is the CI / Docker / air-gapped escape hatch — explicit, auditable, single env var. No config-file fallback. No `~/.nlqdb/credentials.json`.
- **Core value:** Seamless auth, Bullet-proof, Free
- **Why:** Headless environments don't have a keychain. A keychain-attempt that gracefully degrades to a config file becomes the default in CI, leaking credentials into shell history and `ps` output. Making the env-var path explicit (and the only headless path) keeps the config-file leak vector closed by construction. This is the CLI manifestation of `GLOBAL-010`.
- **Consequence in code:** The credential resolver checks `NLQDB_API_KEY` first; if set, it returns immediately and the rest of the auth flow (keychain read, device flow) is bypassed. Keychain backends are only invoked when `NLQDB_API_KEY` is unset. CI documentation (`docs/runbook.md`) names `NLQDB_API_KEY` explicitly. Reviewers reject any `~/.nlqdb/*` credential file fallback.
- **Alternatives rejected:**
  - Plain config-file storage in `~/.nlqdb/credentials.json` — leaks via cloud backups / dotfile syncs (forbidden by `GLOBAL-010`).
  - Required env vars (no keychain on local laptops) — bad UX for the developer-laptop default.
