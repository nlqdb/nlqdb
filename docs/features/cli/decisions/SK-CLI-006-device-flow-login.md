# SK-CLI-006 — `nlq login` uses OAuth 2.0 Device Authorization Grant with `verification_uri_complete`

- **Decision:** `nlq login` runs the OAuth 2.0 Device Authorization Grant. The browser lands on `verification_uri_complete` with the code pre-filled in the URL — one "Approve this device?" click, no typing. The raw user_code is printed as a fallback for SSH / headless / `--no-browser` cases. On approval: anonymous DBs are adopted; refresh token (90d, rotated on every use) writes to OS keychain; access token (1h, JWT) stays in memory.
- **Core value:** Seamless auth, Effortless UX, Bullet-proof
- **Why:** Device-code with `verification_uri_complete` is the lowest-friction sign-in for a CLI — no copy-paste of codes, no port-binding callback (which fails on remote SSH and behind firewalls), and the code is visible in the browser URL so the human verifies they're approving the right device. 90d refresh + 1h access matches `docs/architecture.md §4.3` exactly so refresh logic is shared with `packages/sdk` (`GLOBAL-001`).
- **Consequence in code:** The login flow POSTs `/v1/auth/device`, opens `verification_uri_complete` (or prints it on `--no-browser`), polls `/v1/auth/device/token`, writes the refresh token to keychain on success. Refresh token rotation is mandatory — every refresh issues a new refresh token; the old one is revoked. Tests cover the SSH-no-browser path and the firewall-blocks-localhost path.
- **Alternatives rejected:**
  - localhost-callback OAuth — fails on SSH / headless; brittle behind firewalls.
  - Long-lived bearer tokens with no refresh — would force re-login on expiry; breaks the seamless-auth value.
  - Username/password — banned by `docs/architecture.md §4.1` ("No passwords, ever").
