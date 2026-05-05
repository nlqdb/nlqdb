---
name: auth
description: Better Auth identity across all surfaces — sessions, refresh, device flow, GitHub/Google/magic-link.
when-to-load:
  globs:
    - apps/api/src/auth/**
    - packages/auth-internal/**
  topics: [auth, session, login, refresh, device-flow, oauth, magic-link]
---

# Feature: Auth

**One-liner:** Better Auth identity across all surfaces — sessions, refresh, device flow, GitHub/Google/magic-link.
**Status:** implemented
**Owners (code):** `apps/api/src/auth/**`, `packages/auth-internal/**`
**Cross-refs:** docs/architecture.md §4 (Authentication & identity) · docs/architecture.md §10 §2.5, Slice 5 (Better Auth) · docs/runbook.md §5 (Google OAuth) · docs/runbook.md §5b (GitHub OAuth)

## Touchpoints — read this skill before editing

- `apps/api/src/auth/**`
- `packages/auth-internal/**`

## Decisions

### SK-AUTH-001 — Better Auth on Workers + D1 is the auth library

- **Decision:** Identity is managed by Better Auth (MIT, TypeScript, framework-agnostic) running on Cloudflare Workers with D1 as the user store. We build the sign-in UI ourselves; Better Auth provides the primitives only.
- **Core value:** Free, Open source, Seamless auth, Bullet-proof
- **Why:** Better Auth has no per-MAU fees, no vendor lock on user data shape, and the Auth.js team merged into it in 2025 making it the de-facto TS standard. Workers + D1 keeps us inside the strict-$0 stack (`GLOBAL-013`). Building the sign-in page ourselves lets the auth surface express the brand instead of leaking a hosted-IdP look.
- **Consequence in code:** `packages/auth-internal` is the only thing that imports Better Auth; every other package consumes its primitives. New auth methods are added by extending the Better Auth config in `packages/auth-internal`, never by reaching for a parallel SDK.
- **Alternatives rejected:** Auth0 / Clerk / Supabase Auth — per-MAU fees break Free; data-shape lock-in conflicts with our identity-portability promise. Roll-your-own — `GLOBAL-016` rejects DIY when a small mature library exists.
- **Source:** docs/architecture.md §4.1

### SK-AUTH-002 — Sign-in methods at launch: magic link, passkey, GitHub, Google. No passwords, ever.

- **Decision:** Launch ships magic link (primary), passkey (promoted on second visit), GitHub OAuth, and Google OAuth. Passwords are never offered.
- **Core value:** Seamless auth, Bullet-proof, Effortless UX
- **Why:** Passwords are the largest reset/breach/social-engineering surface in any SaaS. Magic link + passkey covers the security-conscious and the convenience-first cohorts; GitHub + Google covers the "I just want to sign in" majority. Adding password auth later would expand attack surface for no UX gain — we'd rather cap that surface to zero now.
- **Consequence in code:** No password column in the user table, no `/auth/sign-in/password` endpoint, no password-reset flow, no rate-limit bucket dedicated to password attempts. PRs that add a password field are rejected.
- **Alternatives rejected:** Email + password baseline — every breach risk we're avoiding. SSO-only (no magic link) — punts the no-OAuth cohort to "create an account elsewhere first," contradicts `GLOBAL-007`.
- **Source:** docs/architecture.md §4.1

### SK-AUTH-003 — Session storage: 1h JWT access tokens + KV revocation set

- **Decision:** Sessions use HMAC-signed JWT access tokens with a 1h TTL. A Cloudflare Workers KV revocation set (keyed by `jti` for sessions, key-hash-prefix for API keys) is consulted on every request. KV-miss is ≤2 ms; revocation propagation is ≤2 s.
- **Core value:** Seamless auth, Bullet-proof, Fast
- **Why:** Pure JWT (no revocation list) makes revocation a lie; pure DB session lookup adds DB hops to every request and competes with the user's own DB on connection budget. KV revocation set is the small-cost bridge — JWT covers the 99.99% case, KV covers the "we just revoked this" case in seconds. Workers KV free tier (100k reads/day) absorbs the load.
- **Consequence in code:** Every authenticating handler does `verifyJwt → kv.get(revocation:<jti>)` before trusting the caller. The "≤2 s revocation" SLA is a contract test (revoke-from-web-then-CLI-401-on-next-call). Session TTL (`access: 1h`, `refresh: 30d sliding for web / 90d rotated for CLI`) is fixed in `packages/auth-internal`.
- **Alternatives rejected:** Long-lived JWTs with no revocation — `GLOBAL-018` violation. DB-only sessions — adds latency and load to every request. Short JWTs with no revocation — still has a window where a stolen token works.
- **Source:** docs/architecture.md §4.1, §4.3

### SK-AUTH-004 — Device-code flow with `verification_uri_complete` (one-click approve, no typing)

- **Decision:** CLI authentication uses OAuth 2.0 device-code flow against `POST /v1/auth/device`. The browser is opened straight to the embedded-code URL (`verification_uri_complete`); the typed `user_code` is the fallback path, not the primary one.
- **Core value:** Effortless UX, Seamless auth, Goal-first
- **Why:** Standard device-code asks the user to copy a 6-letter code into a separate URL — three small failures (typo, copy-paste loss, wrong tab) per sign-in. `verification_uri_complete` removes the typing entirely: `nlq login` opens a browser tab that already says "Approve this device?" One click and the polling CLI receives the access + refresh tokens. The user_code path remains for shell-only environments.
- **Consequence in code:** `nlq login` opens `verification_uri_complete` directly; the displayed code is shown after the URL, not before. CLI polls `/v1/auth/device/token` until tokens land, writes the refresh token to the OS keychain (per `GLOBAL-010`), and resumes the original command.
- **Alternatives rejected:** PKCE with a localhost callback — needs a free port and a browser that doesn't sandbox `127.0.0.1`; flaky in WSL/Codespaces. Long-lived password-style API key entered at install — `SK-AUTH-002` rejects passwords. Plain device-code without `verification_uri_complete` — UX regressions enumerated above.
- **Source:** docs/architecture.md §4.3

### SK-AUTH-005 — Edge is the only component that sees external credentials; downstream gets a 30 s internal JWT

- **Decision:** External credentials (bearer tokens, `pk_live_…`, `sk_live_…`, `sk_mcp_…`) terminate at the Cloudflare Worker edge. The edge mints a 30-second internal JWT carrying `{user_id, db_scope}` (signed with `INTERNAL_JWT_SECRET`, a Workers-only secret) and passes that JWT to every downstream component (plan cache, LLM router, DB pool).
- **Core value:** Bullet-proof, Simple, Seamless auth
- **Why:** A leaked external key has the blast radius of *that key's scope*; downstream components are protected even if a single secret leaks. Centralising external-credential validation means one place to add a credential type, one place to reason about revocation, one place to instrument. 30 s is short enough to bound replay risk and long enough to outlive any single DB call.
- **Consequence in code:** Downstream components verify the internal JWT, never the external bearer. `packages/auth-internal` exposes `mintInternalJwt({user_id, db_scope}, ttlSec=30)` and `verifyInternalJwt`; both are the only paths to the secret. The edge is the only file that imports Better Auth's session-verifier.
- **Alternatives rejected:** Each component re-validates the bearer — every component owns part of the auth surface; revocation rules duplicate; bugs multiply. Bearer pass-through with no internal token — a leaked DB-pool URL is a leaked external key.
- **Source:** docs/architecture.md §4.4

### SK-AUTH-006 — Authorization model is Owner / Member / Public — RBAC deferred to Phase 2

- **Decision:** Phase 1 has three roles: **Owner** (full), **Member** (read + query, no destructive ops or key creation), **Public** (anonymous, read-only via publishable key, rate-limited). Fine-grained RBAC ships in Phase 2 only if a paying customer asks twice.
- **Core value:** Simple, Goal-first, Free
- **Why:** Three roles cover every persona in `docs/runbook.md §10`; building an RBAC engine for hypothetical Phase-2 buyers locks code shape we don't yet understand. Two requests from paying customers is a clearer signal than "we'll need it eventually."
- **Consequence in code:** `authz.ts` is a switch on `role ∈ {owner, member, public}`. New roles require a `GLOBAL-NNN` (or skill-local SK-AUTH-NNN) decision and a customer-citation comment.
- **Alternatives rejected:** Full RBAC on day one — premature abstraction; locks data shape. Two roles (owner + public) — Members can't share access to a DB without giving away destructive ops.
- **Source:** docs/architecture.md §4.2

### SK-AUTH-007 — Cookie cache + KV revocation-set check land together; never separately

- **Decision:** Better Auth's `session.cookieCache` (which caches the verified session in the cookie itself to skip the DB read) is enabled paired with a KV revocation-set check on every session read. The pair lands in the same PR; cookie cache without the revocation hook is rejected at review.
- **Core value:** Bullet-proof, Fast, Honest latency
- **Why:** `cookieCache` alone drops `nlqdb.auth.verify` from ~30 ms p99 (D1-bound) to ~6 ms p99 (HMAC + KV) — but it would also defeat `GLOBAL-018` because the cached cookie would survive revocation until expiry. Adding the KV check on every read keeps the latency win and the revocation guarantee.
- **Consequence in code:** A test asserts that revoking a session via the dashboard returns 401 within ≤2 s on the next call from any surface. The `useSession` hook on web, the bearer-verifier on the API, and the device-token verifier in CLI all share the same `verifySessionWithRevocation` helper.
- **Alternatives rejected:** Cookie cache only — `GLOBAL-018` violated. KV check only (no cookie cache) — leaves perf on the table; auth verify dominates the cache-hit budget per `docs/performance.md §2.1`.
- **Source:** docs/architecture.md §4.3, §4.5; docs/architecture.md §10 Slice 6 (CI assertion)

### SK-AUTH-008 — Two GitHub OAuth Apps (prod + dev) because OAuth Apps support exactly one callback URL

- **Decision:** We register `nlqdb-web` (prod, callback `https://app.nlqdb.com/api/auth/callback/github`) and `nlqdb-web-dev` (dev, callback `http://localhost:8787/api/auth/callback/github`) as separate OAuth Apps under the `nlqdb` org. Better Auth selects the credential pair by `NODE_ENV` / Wrangler env.
- **Core value:** Bullet-proof, Simple
- **Why:** GitHub OAuth Apps **do not support** multiple callback URLs (multi-callback is a GitHub-App feature, a different product whose installation/permission semantics we don't need). One callback per app forces the two-app split. Sharing one app between prod and localhost is impossible without rewriting the callback at request time, which is its own bug source.
- **Consequence in code:** `.envrc` carries `OAUTH_GITHUB_CLIENT_ID` + `OAUTH_GITHUB_CLIENT_SECRET` (prod) and `OAUTH_GITHUB_CLIENT_ID_DEV` + `OAUTH_GITHUB_CLIENT_SECRET_DEV` (dev). `verify-secrets.sh` probes both. Documentation about which app is which lives in `docs/runbook.md §5b`.
- **Alternatives rejected:** Single OAuth App with a callback-rewrite proxy — adds a moving part and a request-time rewrite step. GitHub App instead of OAuth App — the installation-permission model is wrong for sign-in only.
- **Source:** docs/runbook.md §5b · docs/architecture.md §10 §2.5

### SK-AUTH-009 — Env-var prefix `OAUTH_GITHUB_*`, never `GITHUB_*`

- **Decision:** The GitHub OAuth env-var pair is named `OAUTH_GITHUB_CLIENT_ID` / `OAUTH_GITHUB_CLIENT_SECRET` (and `_DEV` siblings). The `GITHUB_` prefix is reserved for GitHub Actions' built-in tokens.
- **Core value:** Bullet-proof, Simple
- **Why:** GitHub Actions rejects org/repo secrets prefixed with `GITHUB_` (reserved namespace). Naming the pair `GITHUB_CLIENT_ID` would force a different name in CI than locally and in Workers — three places to misalign. The `OAUTH_GITHUB_*` prefix mirrors 1:1 across `.envrc`, GitHub Actions secrets, and Wrangler secrets.
- **Consequence in code:** `.env.example`, `wrangler.toml`, GitHub Actions workflows, and `verify-secrets.sh` all use `OAUTH_GITHUB_*`. PRs that introduce a `GITHUB_CLIENT_*` secret name fail mirror-check in CI.
- **Alternatives rejected:** `GITHUB_CLIENT_ID` (matches the Better Auth docs default) — blocked by GHA's reserved namespace; would diverge between local and CI. `GH_OAUTH_*` — saves three characters at the cost of pattern-matching with the rest of the auth env-var family.
- **Source:** docs/architecture.md §10 §2.5 · docs/runbook.md §5b

### SK-AUTH-010 — Anonymous-mode adoption is a single-row update — no conditional code paths

- **Decision:** Anonymous DBs are tied to an opaque `localStorage` token. On first sign-in, adoption is a single `UPDATE databases SET user_id = ? WHERE anon_token = ?` — there is no separate "anonymous flow" branch in any handler. Anonymous DBs live for 72 h tied to the token; if not adopted, they're swept (per `docs/runbook.md §9`).
- **Core value:** Simple, Bullet-proof, Free
- **Why:** Conditional code paths for "is the caller anonymous" multiply across every handler, and every multiplication is a chance for a path to diverge. One row write at sign-in keeps the data model uniform; the only difference between anonymous and authed is which `user_id` value the row has.
- **Consequence in code:** No `if (anonymous)` branches in `/v1/ask`, `/v1/run`, or any handler. The anonymous-token check is a thin pre-handler that looks up `anon_token → row` and otherwise treats the row exactly like an authed DB. The 72 h sweep (per `docs/runbook.md §9`) is the only anonymous-specific code.
- **Alternatives rejected:** Two parallel handler trees (anonymous vs. authed) — every handler doubles. Migrate-on-sign-in (copy rows to a "real" DB) — wastes work, breaks the 72 h continuity guarantee.
- **Source:** docs/architecture.md §4.1 · docs/runbook.md §9

### SK-AUTH-011 — Rotation has a 60-day grace window + webhook; global sign-out leaves `sk_live_` / `pk_live_` alone

- **Decision:** `nlq keys rotate <id>` mints a new key and deprecates the old with a 60-day grace, emitting a webhook on rotation. "Global sign-out" invalidates all sessions, device refresh tokens, and `sk_mcp_…` keys — but **does not** revoke `sk_live_…` or `pk_live_…` (those are production credentials and rotate separately).
- **Core value:** Bullet-proof, Effortless UX, Seamless auth
- **Why:** Hard-revoking a production secret on sign-out from a developer's laptop would take down their deployed app — a foot-gun. The 60-day grace lets ops swap a `sk_live_…` across deployments without a flag day. The webhook lets customers automate the swap if they prefer.
- **Consequence in code:** `keys.rotate()` writes the new key, marks the old as deprecated with `expires_at = now + 60d`, and enqueues the rotation webhook. `globalSignout()` filters by key type — the SQL `WHERE` excludes `sk_live_*` / `pk_live_*`. UI labels global-sign-out as "Sign out everywhere" and explicitly notes that production keys must be rotated separately.
- **Alternatives rejected:** Hard-revoke on rotate (no grace) — production outages on every rotation. No webhook — customers polling the dashboard for rotations.
- **Source:** docs/architecture.md §4.5

### SK-AUTH-012 — No plaintext key retrieval — lost means rotate

- **Decision:** API keys (`pk_live_…`, `sk_live_…`, `sk_mcp_…`) are hashed with Argon2id at rest. The last 4 characters are stored cleartext for display ("sk_live_…a4f7"). There is no "reveal" path — losing the key means rotating it.
- **Core value:** Bullet-proof, Free, Open source
- **Why:** A reveal button is a single XSS / session-hijack / shoulder-surf away from a credential leak. Forcing rotation when a key is lost is mildly inconvenient and the right default; making rotation cheap (`SK-AUTH-011`) is the trade-off.
- **Consequence in code:** No endpoint returns plaintext key material after creation. The `keys` table stores `key_hash` + `last_4`. PRs that add a "show key" button are rejected.
- **Alternatives rejected:** Reveal-once flag tied to email re-confirmation — adds an "or you can have it back" path that erodes the discipline. Encrypted-at-rest with a master key — still a key-recovery surface; same risk model as plaintext.
- **Source:** docs/architecture.md §4.1

### SK-AUTH-013 — Both auth gates (Hono CORS allow-list + Better Auth `trustedOrigins`) cover Workers-Versions preview URLs

- **Decision:** Workers-Versions preview origins (`<short-version-id>-nlqdb-web.omer-hochman.workers.dev`, uploaded via `wrangler versions upload` per `.github/workflows/preview-web.yml`) pass through **both** auth gates in `apps/api`: (a) the Hono CORS allow-list in `src/index.ts` carries `/^https:\/\/[a-f0-9]{8}-nlqdb-web\.omer-hochman\.workers\.dev$/`, and (b) Better Auth's `trustedOrigins` in `src/auth.ts` carries the wildcard `https://*-nlqdb-web.omer-hochman.workers.dev`. Both must be updated together — fixing only CORS lets the preflight pass but Better Auth then refuses to redirect to the preview's `callbackURL` after Google/GitHub/magic-link verify, so sign-in completes on the API but the user lands on `baseURL` instead of the preview tab.
- **Core value:** Bullet-proof, Effortless UX, Seamless auth
- **Why:** Two independent gates exist by design — CORS protects browser-initiated cross-origin requests with credentials, `trustedOrigins` protects post-sign-in redirects (so a leaked token + crafted `callbackURL` can't bounce a verified session into an attacker-owned origin). Previews need to clear both. Anchoring both patterns to `omer-hochman.workers.dev` (the team's account subdomain) is what keeps the widening safe: only Workers under our own account can publish under that suffix, so the wildcard is functionally identical in blast radius to enumerating each per-PR hash. The CORS regex pins exactly 8 hex chars to match the Workers-Versions short-id format (`wrangler versions upload` truncates the version UUID); Better Auth's matcher does glob, not regex, so the `trustedOrigins` entry uses `*-nlqdb-web.omer-hochman.workers.dev` — Better Auth's wildcard correctly rejects `evil-host.evil.com` and bare `nlqdb-web.omer-hochman.workers.dev` (no prefix), verified against `node_modules/better-auth/dist/auth/trusted-origins.mjs`.
- **Consequence in code:** New preview-URL shapes (different worker name, different account, future Cloudflare format change) require updating both `CORS_ALLOWED_ORIGINS` in `apps/api/src/index.ts` and `trustedOrigins` in `apps/api/src/auth.ts` in the same PR. Each is paired with a comment pointing back to this SK; PRs that touch one without the other should fail review. The continue-page `ALLOWED_NEXT_ORIGINS` in `apps/web/src/pages/auth/continue.astro` does **not** need updating — `next` always points at the API origin (`app.nlqdb.com`), and the verify endpoint then redirects to the (now-trusted) preview `callbackURL`. Magic-link emails continue to route through the prod marketing-site continue page; that's a one-hop UX wart we accept rather than threading the preview origin through email rendering.
- **Alternatives rejected:** **Test auth only on `localhost`.** Localhost (`http://localhost:4321`/`:8787`) is already in both allow-lists, but localhost-only testing misses cross-origin cookie behaviour (SameSite, third-party-cookie restrictions) and the real OAuth-provider callback round-trip — exactly the bugs previews exist to catch. **Allow `*.workers.dev`.** Scoped too wide; any Worker on any Cloudflare account could clear our gates. **Stand up a per-PR preview API + pin the preview web's `PUBLIC_API_BASE` to it.** Stricter isolation (preview web → preview API only; prod API stays untouched), but requires per-PR OAuth callback URLs which `SK-AUTH-008` rules out (GitHub OAuth Apps support exactly one callback URL). Defer until a customer or audit asks for hard preview/prod isolation. **Update CORS only and skip `trustedOrigins`.** What we shipped first — preflight clears, sign-in completes, but post-callback redirect falls back to `baseURL`, leaving the user stuck on `app.nlqdb.com` instead of the preview tab. Neither half works in isolation. **Disable Better Auth `trustedOrigins` validation for preview only.** Better Auth doesn't expose a per-request bypass, and a "preview-only" toggle compiled into a single Worker version is a footgun; not worth the risk.
- **Source:** `apps/api/src/index.ts` §CORS allow-list comment · `apps/api/src/auth.ts` §`trustedOrigins` comment · `node_modules/better-auth/dist/auth/trusted-origins.mjs` (wildcard matcher) · `apps/web/wrangler.toml` lines 26-29 · `apps/api/wrangler.toml` lines 60-68

### SK-AUTH-014 — `nlqdb-api` keeps `workers_dev = true` so `wrangler versions upload` returns a `preview_url`

- **Decision:** `apps/api/wrangler.toml` carries `workers_dev = true` even though the worker has a custom domain (`app.nlqdb.com`). This exposes a second URL — `nlqdb-api.omer-hochman.workers.dev` — alongside the custom domain, and is what enables Workers-Versions preview URLs (`<short-version-id>-nlqdb-api.omer-hochman.workers.dev`) for every PR upload.
- **Core value:** Effortless UX, Bullet-proof, Free
- **Why:** Wrangler defaults `workers_dev` to `false` whenever `[[routes]]` are defined — the rationale for the marketing site (`apps/web`) where an exposed `*.workers.dev` would compete with `nlqdb.com` for SEO. With `workers_dev = false`, the worker's `*.workers.dev` subdomain is never provisioned, and `wrangler versions upload` (used by `preview-api.yml`) cannot return a `preview_url` because the parent subdomain doesn't exist. `scripts/extract-wrangler-preview-url.sh` correctly diagnoses this state ("preview_url missing in version-upload event… first deploy provisions the *.workers.dev subdomain"), but the sticky preview comment then loses its clickable URL and reviewers have to navigate the CF dashboard. For an API surface the SEO concern is moot — APIs aren't crawled, and OAuth callbacks are pinned to `app.nlqdb.com` (`SK-AUTH-008`), so the second URL doesn't compete for callback handling or production traffic.
- **Consequence in code:** `apps/api/wrangler.toml` carries `workers_dev = true` with a comment pointing back to this SK. After the next `deploy-api.yml` run merges, the workers.dev subdomain is provisioned for `nlqdb-api`, and from then on every `wrangler versions upload` returns a `preview_url` that the extraction script captures. PRs that flip this to `false` (or remove it during a config refactor) re-break the preview-URL comment and make API-side auth previews un-linkable.
- **Alternatives rejected:** **Stand up a separate preview Worker (`nlqdb-api-preview`).** Cleaner prod/preview isolation but loses shared bindings (KV / D1 / Queue / R2); migrations and binding wiring duplicate per environment. Wrong tradeoff at current scale. **Construct the URL synthetically (`<version-id>-nlqdb-api.omer-hochman.workers.dev`) when wrangler omits it.** Per the comment in `extract-wrangler-preview-url.sh` and Cloudflare's docs, that URL doesn't actually route until the workers.dev subdomain is provisioned — it resolves to "There is nothing here yet". A constructed-but-broken URL is worse than no URL. **Accept "URL parse degraded" forever and leave the preview comment pointing at the dashboard.** Active erosion of the preview-loop value; reviewers stop opening previews when the link is two clicks deep. **Set `workers_dev = true` only in a `preview` env block.** Wrangler's env model doesn't toggle `workers_dev` per-version on the same worker — it's a worker-level flag. Splitting into envs reintroduces the binding-duplication problem.
- **Source:** `apps/api/wrangler.toml` lines 6-22 (`workers_dev` comment) · `scripts/extract-wrangler-preview-url.sh` lines 130-141 (bootstrap diagnostic) · Cloudflare Workers Versions preview docs

## GLOBALs governing this feature

Canonical text in [`docs/decisions.md`](../../docs/decisions.md). The list below names the rules that constrain this feature; any skill-local commentary is nested under the rule.

- **GLOBAL-007** — No login wall before first value.
- **GLOBAL-008** — One Better Auth identity across all surfaces.
- **GLOBAL-009** — Tokens refresh silently — never surface a 401.
- **GLOBAL-018** — Revocation is instant and visible across devices.

## Open questions / known unknowns

- **Passkey UX details (when promoted on second visit).** Better Auth ships passkey primitives, but the prompt copy / when-to-show heuristic is not yet specified. Track in the auth slice when the second-visit UX lands.
- **Phase 2 RBAC trigger.** `SK-AUTH-006` defers RBAC until "two paying customers ask." We don't yet have an explicit way to count those requests in the support tracker. Add a `rbac_request` tag to the customer-feedback intake when Phase 2 starts.
- **`session.cookieCache` failure mode under KV outage.** The `(cookie cache, revocation check)` pair in `SK-AUTH-007` assumes KV is reachable. If KV is unreachable, do we fail-closed (deny) or fail-open (trust the cookie until expiry)? Design.md doesn't decide. Open.
- **Magic-link domain verification.** `RESEND_API_KEY` is provisioned, but `nlqdb.com` SPF/DKIM/DMARC verification is deferred until Phase 1 (per `docs/architecture.md §10 §2.5`). Magic-link sign-in cannot ship until that lands.
