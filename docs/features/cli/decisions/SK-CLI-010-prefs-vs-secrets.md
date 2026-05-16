# SK-CLI-010 — Non-secret prefs in `~/.config/nlqdb/config.toml`; secrets never live in config

- **Decision:** Stable user preferences (default output format, colour mode, etc.) live in `~/.config/nlqdb/config.toml`. Secrets — refresh tokens, API keys, anonymous device tokens — never live in config files. Mutating state (`active_db`, last-update-check timestamp) lives separately in `~/.config/nlqdb/state.json` per [`SK-CLI-013`](SK-CLI-013-active-db-state.md). The three stores are completely separate.
- **Core value:** Simple, Bullet-proof
- **Why:** Mixing secrets and preferences in a single file makes "share my config" a credential leak. Splitting them gives users a config they can commit to dotfiles repos / share in screenshots without leaking. The XDG path is the unsurprising location for non-secret prefs on every platform.
- **Consequence in code:** Three separate readers in the CLI: `config.toml` (preferences), `state.json` (mutating active-DB / update-check metadata), keychain/env (secrets). Reviewers reject any preference key that reads a token. The state writer never writes secrets.
- **Alternatives rejected:**
  - Single `~/.nlqdb/config.json` with both prefs and tokens — credential leak vector.
  - Environment variables for prefs — clutters `env`; doesn't survive reboots without shell-rc gymnastics.
