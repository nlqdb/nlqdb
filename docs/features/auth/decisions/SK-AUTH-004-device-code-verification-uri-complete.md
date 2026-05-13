# SK-AUTH-004 — Device-code flow with `verification_uri_complete` (one-click approve, no typing)

- **Decision:** CLI authentication uses OAuth 2.0 device-code flow against `POST /v1/auth/device`. The browser is opened straight to the embedded-code URL (`verification_uri_complete`); the typed `user_code` is the fallback path, not the primary one.
- **Core value:** Effortless UX, Seamless auth, Goal-first
- **Why:** Standard device-code asks the user to copy a 6-letter code into a separate URL — three small failures (typo, copy-paste loss, wrong tab) per sign-in. `verification_uri_complete` removes the typing entirely: `nlq login` opens a browser tab that already says "Approve this device?" One click and the polling CLI receives the access + refresh tokens. The user_code path remains for shell-only environments.
- **Consequence in code:** `nlq login` opens `verification_uri_complete` directly; the displayed code is shown after the URL, not before. CLI polls `/v1/auth/device/token` until tokens land, writes the refresh token to the OS keychain (per `GLOBAL-010`), and resumes the original command.
- **Alternatives rejected:** PKCE with a localhost callback — needs a free port and a browser that doesn't sandbox `127.0.0.1`; flaky in WSL/Codespaces. Long-lived password-style API key entered at install — `SK-AUTH-002` rejects passwords. Plain device-code without `verification_uri_complete` — UX regressions enumerated above.
- **Source:** docs/architecture.md §4.3
