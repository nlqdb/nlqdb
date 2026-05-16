# SK-CLI-005 — Anonymous-first: bare queries work before any sign-in

- **Decision:** `nlq new "..."` and bare `nlq "..."` mint an anonymous device token (72h window per `docs/architecture.md §4.1`) and immediately produce a working answer. The token is written to the OS keychain. `nlq login` runs the device-code flow only when the user wants to keep their work past 72h.
- **Core value:** Goal-first, Effortless UX, Free, Seamless auth
- **Why:** The activation moment is the user typing a goal and getting an answer. A login wall before the first answer flips the moment from "wow" to "homework". The 72h window is the explicit agreement: long enough to demo the value, short enough that we're not running an unbounded anonymous storage tier. This is the CLI manifestation of `GLOBAL-007` and `GLOBAL-020`.
- **Consequence in code:** The first invocation of any data verb mints the anonymous token via `POST /v1/auth/anonymous` (or whatever the slice settles on) and stores it in the keychain. Subsequent calls reuse it. On `nlq login`, anonymous DBs are adopted by updating one row server-side (`docs/architecture.md §4.1`); no client-side migration. **CI mode skips this entirely** — see [`SK-CLI-008`](SK-CLI-008-ci-api-key-precedence.md).
- **Alternatives rejected:**
  - Force `nlq login` before first use — measurably worse for activation; contradicts `GLOBAL-007`.
  - Anonymous tokens in a flat config file, not the keychain — leaks via cloud backups + dotfile syncs; contradicts `GLOBAL-010`.
