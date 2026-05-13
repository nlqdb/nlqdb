# SK-AUTH-009 — Env-var prefix `OAUTH_GITHUB_*`, never `GITHUB_*`

- **Decision:** The GitHub OAuth env-var pair is named `OAUTH_GITHUB_CLIENT_ID` / `OAUTH_GITHUB_CLIENT_SECRET` (and `_DEV` siblings). The `GITHUB_` prefix is reserved for GitHub Actions' built-in tokens.
- **Core value:** Bullet-proof, Simple
- **Why:** GitHub Actions rejects org/repo secrets prefixed with `GITHUB_` (reserved namespace). Naming the pair `GITHUB_CLIENT_ID` would force a different name in CI than locally and in Workers — three places to misalign. The `OAUTH_GITHUB_*` prefix mirrors 1:1 across `.envrc`, GitHub Actions secrets, and Wrangler secrets.
- **Consequence in code:** `.env.example`, `wrangler.toml`, GitHub Actions workflows, and `verify-secrets.sh` all use `OAUTH_GITHUB_*`. PRs that introduce a `GITHUB_CLIENT_*` secret name fail mirror-check in CI.
- **Alternatives rejected:** `GITHUB_CLIENT_ID` (matches the Better Auth docs default) — blocked by GHA's reserved namespace; would diverge between local and CI. `GH_OAUTH_*` — saves three characters at the cost of pattern-matching with the rest of the auth env-var family.
- **Source:** docs/phase-plan.md · docs/runbook.md §5b
