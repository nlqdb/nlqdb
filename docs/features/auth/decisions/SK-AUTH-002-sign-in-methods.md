# SK-AUTH-002 — Sign-in methods at launch: magic link, passkey, GitHub, Google. No passwords, ever.

- **Decision:** Launch ships magic link (primary), passkey (promoted on second visit), GitHub OAuth, and Google OAuth. Passwords are never offered.
- **Core value:** Seamless auth, Bullet-proof, Effortless UX
- **Why:** Passwords are the largest reset/breach/social-engineering surface in any SaaS. Magic link + passkey covers the security-conscious and the convenience-first cohorts; GitHub + Google covers the "I just want to sign in" majority. Adding password auth later would expand attack surface for no UX gain — we'd rather cap that surface to zero now.
- **Consequence in code:** No password column in the user table, no `/auth/sign-in/password` endpoint, no password-reset flow, no rate-limit bucket dedicated to password attempts. PRs that add a password field are rejected.
- **Alternatives rejected:** Email + password baseline — every breach risk we're avoiding. SSO-only (no magic link) — punts the no-OAuth cohort to "create an account elsewhere first," contradicts `GLOBAL-007`.
- **Source:** docs/architecture.md §4.1
