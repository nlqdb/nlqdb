# nlqdb Runbook

Living state-of-the-world doc. Ground truth for *what's provisioned*,
*where it lives*, and *how to get back in*. Edit this whenever
infrastructure changes — if it goes stale, the rest of the repo gets
harder to operate.

- [DESIGN.md](./DESIGN.md) — why the architecture looks this way.
- [IMPLEMENTATION.md](./IMPLEMENTATION.md) — phased plan + prereqs.
- **this file** — what's actually set up right now.

**Last verified: 2026-04-24.** Running `./scripts/verify-secrets.sh`
should return 12/12 green (or more, as provisioning expands).

---

## 1. What is live

| Surface                     | URL                                 | State                          |
| :-------------------------- | :---------------------------------- | :----------------------------- |
| Coming-soon landing         | https://nlqdb.com                   | 200, HTTPS via Cloudflare      |
| Privacy policy              | https://nlqdb.com/privacy           | 200                            |
| Terms of service            | https://nlqdb.com/terms             | 200                            |
| `www.nlqdb.com`             | https://www.nlqdb.com               | 200 (same page)                |
| Alt apex                    | https://nlqdb.ai                    | 301 → `https://nlqdb.com/`     |
| Alt www                     | https://www.nlqdb.ai                | 301 → `https://nlqdb.com/…`    |
| Pages deployment URL        | https://nlqdb-coming-soon.pages.dev | 200 (same content as nlqdb.com)|

No runtime services yet — Phase 0 `apps/api` hasn't shipped.

---

## 2. Domains

Both zones are on Cloudflare's **Free plan**, nameservers
`jeremy.ns.cloudflare.com` + `kiki.ns.cloudflare.com`, registered at
GoDaddy. DNSSEC is off at both ends (safe for now; optional to
re-enable via Cloudflare later).

### `nlqdb.com`

- DNS managed by Cloudflare.
- Custom domain attached to the Pages project `nlqdb-coming-soon`
  (Cloudflare auto-created the DNS records on attach).
- `www` also attached to the same Pages project.
- **Cloudflare Email Routing ON:**
  - `hello@nlqdb.com` → founder's personal inbox (verified).
  - Catch-all: check current state at
    https://dash.cloudflare.com → zone → Email.

### `nlqdb.ai`

- DNS managed by Cloudflare.
- `AAAA @ → 100::` proxied (dummy target; Cloudflare Single Redirect
  rule intercepts before the target matters).
- `CNAME www → nlqdb.ai` proxied.
- **Single Redirect rule:** `All incoming requests` → dynamic
  expression `concat("https://nlqdb.com", http.request.uri)`, status
  301. Preserves path + query string.
- Email Routing: **not yet enabled.** When enabled, forward to the
  same destination as `nlqdb.com`.

---

## 3. Accounts

| Service          | Account                   | Plan                              | Non-secret identifier                              |
| :--------------- | :------------------------ | :-------------------------------- | :------------------------------------------------- |
| GitHub           | `omerhochman` (personal)  | Org `nlqdb` (free)                | Repo: `nlqdb/nlqdb`; tap: `nlqdb/homebrew-tap`     |
| npm              | `omerhochman`             | Free (unlimited public packages)  | Scope `@nlqdb`                                     |
| Cloudflare       | `omer.hochman@gmail.com`  | Free per zone                     | Token name: `nlqdb-phase0-dev`                     |
| Neon             | `omer.hochman@gmail.com`  | Free                              | Project in `us-east-1`, PG 17, **Neon Auth OFF**   |
| Upstash          | `omer.hochman@gmail.com`  | Free                              | Redis DB provisioned                               |
| Fly.io           | `omer.hochman@gmail.com`  | 7-day trial → PAYG (no card yet)  | Org `personal`, **no apps**, token scope: `org`    |
| Sentry           | `omer.hochman@gmail.com`  | 14-day Business trial → Developer | Project: `nlqdb-api` (Cloudflare Workers platform) |
| Google AI Studio | Existing                  | Free                              | Gemini API key                                     |
| Groq             | Existing                  | Free                              | —                                                  |
| OpenRouter       | Existing                  | Free (fallback)                   | —                                                  |
| Google Cloud     | `omer.hochman@gmail.com`  | Free                              | Project `nlqdb`, OAuth consent screen **Testing**  |
| Docker Hub       | **SKIPPED**               | —                                 | Using `ghcr.io/nlqdb` instead (paid-only org tier) |

**Not yet provisioned** — pending §2.5 / §2.6:

- Resend — transactional email
- AWS SES — email fallback (Phase 1)
- Stripe — test mode first
- GitHub OAuth app under `nlqdb` org
- Grafana Cloud

---

## 4. Secrets

Every credential's canonical name lives in
[`.env.example`](./.env.example). Never commit real values.

- **Local dev:** `.envrc` (gitignored), loaded automatically by
  direnv. Regenerate self-signed secrets by running
  `scripts/bootstrap-dev.sh` after deleting `.envrc`.
- **CI (GitHub Actions):** not yet mirrored — §2.7 pending.
- **Runtime (Cloudflare Workers):** not yet mirrored — §2.7 pending.

**Live verification:** `./scripts/verify-secrets.sh`. Current baseline
is 12/12 (BETTER_AUTH_SECRET, INTERNAL_JWT_SECRET, CLOUDFLARE_*×3,
NEON_API_KEY, DATABASE_URL, FLY_API_TOKEN, UPSTASH_REDIS_REST_TOKEN,
GEMINI, GROQ, OPENROUTER, SENTRY_DSN).

**Values never echoed** — all checks are length/HTTP-status based.

---

## 5. Google OAuth — what's configured

Google has a long verification review, so we opened the project early.
Currently in **Testing** mode; verification submission is a Phase 1
prereq (waiting on product stability).

- **GCP project:** `nlqdb`
- **OAuth consent screen** (Branding tab):
  - App name: `nlqdb`
  - User support email: `contact@nlqdb.com` (needs Email Routing rule
    — currently only `hello@` is forwarded; add `contact@` or flip
    catch-all on if Google's verification emails get lost)
  - Privacy policy: https://nlqdb.com/privacy
  - Terms of service: https://nlqdb.com/terms
  - Authorized domain: `nlqdb.com`
- **Audience:** External, Testing status.
  - Test users: `omer.hochman@gmail.com` (add more as needed, up to 100)
- **Data access (scopes):** `openid`, `/auth/userinfo.email`,
  `/auth/userinfo.profile` — all non-sensitive, no long review needed
  when we submit for verification.
- **OAuth 2.0 Client** — Web application named `nlqdb-web`:
  - Authorized JavaScript origins:
    - `https://app.nlqdb.com`
    - `https://nlqdb.com`
    - `http://localhost:4321` (Astro dev)
    - `http://localhost:8787` (Wrangler dev)
  - Authorized redirect URIs:
    - `https://app.nlqdb.com/auth/callback/google`
    - `https://nlqdb.com/device/approve`
    - `http://localhost:4321/auth/callback/google`
    - `http://localhost:8787/auth/callback/google`
  - Credentials in `.envrc` as `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`.

**Verification submission TODO** (Phase 1):

1. Publish Privacy Policy + Terms (done — PR #12 merged).
2. Verify domain ownership of `nlqdb.com` via Google Search Console
   (DNS TXT record in Cloudflare — 2 min).
3. Add an app logo (min 120×120 PNG).
4. Switch publishing status from Testing → In Production.
5. Google reviews; with only non-sensitive scopes it's usually days,
   not weeks.

---

## 5b. GitHub OAuth — what's configured

Classic **OAuth App** under the `nlqdb` GitHub org (not a GitHub App —
we need sign-in only, no installation/permission semantics). nlqdb is
**engine-agnostic** — describe its sign-in to the user as "Sign in to
nlqdb." rather than naming a specific backend.

- **Org settings page:** `https://github.com/organizations/nlqdb/settings/applications`
- **App name:** `nlqdb-web` (production sign-in).
- **Homepage URL:** `https://nlqdb.com`
- **Authorization callback URL** — exactly **one** URL per OAuth App.
  GitHub OAuth Apps **do not support** multiple callback URLs (that
  capability is for GitHub Apps, a different product). Multi-env
  strategy:
  - **`nlqdb-web` (this app, prod):** `https://app.nlqdb.com/auth/callback/github` ✅
  - **`nlqdb-web-dev` (deferred — Phase 0 §3):** a *separate* OAuth
    App under the same `nlqdb` org, callback
    `http://localhost:8787/auth/callback/github`, credentials
    populated into `.envrc` under `OAUTH_GITHUB_CLIENT_ID_DEV` /
    `OAUTH_GITHUB_CLIENT_SECRET_DEV` (or `.dev.vars` per Wrangler
    convention — TBD when the auth code lands). Provision this
    when implementing the Better Auth scaffold so devs can sign in
    against `wrangler dev`.
  - `https://nlqdb.com/device/approve` is the **device-flow user-prompt
    page**, not an OAuth redirect — device flow polls and never invokes
    the callback URL, so it doesn't need to be registered.
- **Enable Device Flow:** ✅ — CLI uses device-code flow (`nlq login`)
  per [DESIGN.md §3.3](./DESIGN.md#33-cli-and-device-code-flow).
- **Webhook URL:** _none_ — auth-only, no webhook.
- **Credentials in `.envrc`** as `OAUTH_GITHUB_CLIENT_ID` +
  `OAUTH_GITHUB_CLIENT_SECRET` (the `OAUTH_*` prefix avoids GHA's
  reserved `GITHUB_*` namespace; same names used in CI / Workers
  secrets so mirroring is 1:1). Refresh `.envrc.age` via
  `scripts/backup-envrc.sh` after pasting.

**Verification:** `./scripts/verify-secrets.sh` does a live probe of
`POST /applications/{client_id}/token` with the secret pair as Basic
auth and a deliberately-bogus token in the body. Expected HTTP **404**
= Basic auth accepted, the bogus token correctly not-found. **401** is
the failure path (Basic auth rejected = wrong id or secret).

---

## 6. Deployments

### Coming-soon page

- Source: `apps/coming-soon/` (HTML + CSS, no build step).
- Hosting: Cloudflare Pages project `nlqdb-coming-soon`.
- Deploy: `./scripts/deploy-coming-soon.sh` (idempotent — creates the
  project on first run, pushes a new deployment on re-runs).
  Shortcut: `bun --cwd apps/coming-soon run deploy`.
- Custom domains: `nlqdb.com`, `www.nlqdb.com`.

### Nothing else — Phase 0 `apps/api` hasn't shipped

When it does, it'll deploy via `wrangler deploy` from `apps/api/`.

---

## 7. Prerequisites checklist (§2 of IMPLEMENTATION.md)

| §    | Item                               | Status       |
| :--- | :--------------------------------- | :----------- |
| 2.1  | `nlqdb.com` zone + Pages + SSL     | ✅            |
| 2.1  | `nlqdb.com` Email Routing          | ✅            |
| 2.1  | `nlqdb.ai` zone + 301 redirect     | ✅            |
| 2.1  | `nlqdb.ai` Email Routing           | ⏳ (optional) |
| 2.2  | GitHub org `nlqdb`                 | ✅            |
| 2.2  | Repo transfer to `nlqdb/nlqdb`     | ✅            |
| 2.2  | Secret scanning + Dependabot       | ✅            |
| 2.2  | `nlqdb/homebrew-tap` repo          | ✅ (empty)    |
| 2.2  | npm org `@nlqdb`                   | ✅            |
| 2.2  | Docker Hub org                     | ⏭ skipped → `ghcr.io/nlqdb` |
| 2.3  | `CLOUDFLARE_API_TOKEN` + account ID | ✅            |
| 2.3  | Neon DB + `DATABASE_URL`           | ✅            |
| 2.3  | `NEON_API_KEY` (control plane)     | ✅            |
| 2.3  | Upstash Redis + token              | ✅            |
| 2.3  | `FLY_API_TOKEN` (org scope)        | ✅            |
| 2.4  | Gemini / Groq / OpenRouter keys    | ✅            |
| 2.5  | `BETTER_AUTH_SECRET` (self-gen)    | ✅            |
| 2.5  | `INTERNAL_JWT_SECRET` (self-gen)   | ✅            |
| 2.5  | GitHub OAuth app — `nlqdb-web` (prod)  | ✅            |
| 2.5  | GitHub OAuth app — `nlqdb-web-dev`     | ⏳ (Phase 0 §3 with auth code) |
| 2.5  | Google OAuth client                | ✅ (Testing)  |
| 2.5  | Resend + domain verification       | ⏳            |
| 2.5  | AWS SES fallback                   | ⏳ (Phase 1)  |
| 2.5  | Stripe (test mode)                 | ⏳            |
| 2.6  | Sentry DSN                         | ✅            |
| 2.6  | Grafana Cloud                      | ⏳            |
| 2.7  | Mirror `.envrc` → GHA secrets      | ⏳            |
| 2.7  | Mirror `.envrc` → Workers secrets  | ⏳            |

---

## 8. Recovery playbook

### Returning after time away

```bash
git pull                        # pick up any merged PRs
direnv allow .                  # re-source .envrc if needed
./scripts/verify-secrets.sh     # should be all-green
gh pr list                      # what's open
```

### New machine (or recovering from lost `.envrc`)

```bash
git clone git@github.com:nlqdb/nlqdb.git && cd nlqdb
scripts/bootstrap-dev.sh        # tools + stub .envrc from .env.example
scripts/restore-envrc.sh        # decrypts iCloud backup over the stub
./scripts/verify-secrets.sh     # should be all-green
```

**Encrypted `.envrc` backup lives outside the repo.** `.envrc.age` is
gitignored — the repo history was rewritten on 2026-04-25 to remove a
previously-committed copy; do not re-introduce one. Default location:
`~/Library/Mobile Documents/com~apple~CloudDocs/nlqdb-backups/.envrc.age`
(iCloud Drive). Produced by `scripts/backup-envrc.sh` using age
passphrase mode (scrypt KDF, cost 2^18). Refresh after any `.envrc`
change:

```bash
scripts/backup-envrc.sh         # encrypts .envrc → $NLQDB_BACKUP_DIR/.envrc.age
```

Override the sync location:

```bash
NLQDB_BACKUP_DIR=/path/to/private/folder scripts/backup-envrc.sh
```

### When a credential fails verify

| Credential             | Rotation path                                                              |
| :--------------------- | :------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN` | https://dash.cloudflare.com/profile/api-tokens → regenerate (same perms)   |
| `CLOUDFLARE_ACCOUNT_ID`| `wrangler whoami` — never rotates                                          |
| `NEON_API_KEY`         | Neon → Account settings → API keys → create new                            |
| `DATABASE_URL`         | Neon → Branches → main → Roles → `neondb_owner` → Reset password           |
| `FLY_API_TOKEN`        | `fly tokens create org --name nlqdb-phase0-<purpose>`                      |
| `UPSTASH_REDIS_REST_*` | console.upstash.com → DB → REST API section                                |
| `GEMINI_API_KEY`       | https://aistudio.google.com/apikey                                         |
| `GROQ_API_KEY`         | https://console.groq.com/keys                                              |
| `OPENROUTER_API_KEY`   | https://openrouter.ai/settings/keys                                        |
| `SENTRY_DSN`           | Sentry → project settings → Client Keys (DSN). Project-scoped, safe-ish to re-share. |
| `GOOGLE_CLIENT_*`      | GCP → APIs & Services → Credentials → reset secret (client ID stays)       |
| `BETTER_AUTH_SECRET`   | `bun -e 'console.log(require("crypto").randomBytes(48).toString("base64url"))'` — rotating this invalidates every active session. |
| `INTERNAL_JWT_SECRET`  | Same generator as above. Workers-only; rotating is safe any time (30 s TTL). |

### When a domain goes wrong

1. Check NS: `dig +short NS nlqdb.com @1.1.1.1` — must return `jeremy.ns.cloudflare.com` + `kiki.ns.cloudflare.com`. If different, GoDaddy reverted — log in → Nameservers → re-apply.
2. Check zone status: dash.cloudflare.com → the zone → Overview → should be Active.
3. Check Pages custom domain: dash.cloudflare.com → Workers & Pages → `nlqdb-coming-soon` → Custom domains → should show `nlqdb.com` with a green "Active" pill.
4. If `nlqdb.com` returns "This domain is not configured": the Pages custom-domain attachment got removed — re-add via the UI (see IMPLEMENTATION §2.1, step 4).

### When the coming-soon page looks wrong

```bash
./scripts/deploy-coming-soon.sh
```

Idempotent. Pushes a fresh deployment within ~2s.
