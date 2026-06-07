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
**Cross-refs:** docs/architecture.md §4 (Authentication & identity) · docs/performance.md §4 Slice 5 (Better Auth) · docs/runbook.md §5 (Google OAuth) · docs/runbook.md §5b (GitHub OAuth)

## Touchpoints — read this feature before editing

- `apps/api/src/auth/**`
- `packages/auth-internal/**`

## Decisions

Canonical bodies live in [`decisions/`](decisions/) — one file per `SK-AUTH-NNN`. The list below is the index; open the linked file for the full five-field block (Decision / Core value / Why / Consequence / Alternatives). New decisions get a new ID and a new file; existing IDs are sticky.

- [**SK-AUTH-001**](decisions/SK-AUTH-001-better-auth-on-workers-d1.md) — Better Auth on Workers + D1 is the auth library.
- [**SK-AUTH-002**](decisions/SK-AUTH-002-sign-in-methods.md) — Sign-in methods at launch: magic link, passkey, GitHub, Google. No passwords, ever.
- [**SK-AUTH-003**](decisions/SK-AUTH-003-session-storage-jwt-kv-revocation.md) — Session storage: 1h JWT access tokens + KV revocation set.
- [**SK-AUTH-004**](decisions/SK-AUTH-004-device-code-verification-uri-complete.md) — Device-code flow with `verification_uri_complete` (one-click approve, no typing).
- [**SK-AUTH-005**](decisions/SK-AUTH-005-edge-sees-external-creds-internal-jwt.md) — Edge is the only component that sees external credentials; downstream gets a 30 s internal JWT.
- [**SK-AUTH-006**](decisions/SK-AUTH-006-authorization-owner-member-public.md) — Authorization model is Owner / Member / Public — RBAC deferred to Phase 2.
- [**SK-AUTH-007**](decisions/SK-AUTH-007-cookie-cache-with-kv-revocation.md) — Cookie cache + KV revocation-set check land together; never separately.
- [**SK-AUTH-008**](decisions/SK-AUTH-008-three-oauth-app-pairs.md) — Three OAuth App pairs (prod + canary + dev) because OAuth Apps support exactly one callback URL.
- [**SK-AUTH-009**](decisions/SK-AUTH-009-oauth-github-env-prefix.md) — Env-var prefix `OAUTH_GITHUB_*`, never `GITHUB_*`.
- [**SK-AUTH-010**](decisions/SK-AUTH-010-anon-adoption-single-row-update.md) — Anonymous-mode adoption is a single-row update — no conditional code paths.
- [**SK-AUTH-011**](decisions/SK-AUTH-011-rotation-grace-global-signout-skips-live.md) — Rotation has a 60-day grace window + webhook; global sign-out leaves `sk_live_` / `pk_live_` alone.
- [**SK-AUTH-012**](decisions/SK-AUTH-012-no-plaintext-key-retrieval.md) — No plaintext key retrieval — lost means rotate.
- [**SK-AUTH-013**](decisions/SK-AUTH-013-cors-and-trustedorigins-cover-previews.md) — Both auth gates cover Workers-Versions preview URLs. *Superseded by `SK-AUTH-016`.*
- [**SK-AUTH-014**](decisions/SK-AUTH-014-nlqdb-api-workers-dev-true.md) — `nlqdb-api` keeps `workers_dev = true` so `wrangler versions upload` returns a `preview_url`.
- [**SK-AUTH-015**](decisions/SK-AUTH-015-oauth-init-top-level-get.md) — OAuth init is a top-level GET to `/api/auth/oauth-init/:provider`, not a `fetch + JS redirect`.
- [**SK-AUTH-016**](decisions/SK-AUTH-016-merged-web-api-worker.md) — `apps/web` and `apps/api` ship as a single Cloudflare Worker on `app.nlqdb.com`.
- [**SK-AUTH-017**](decisions/SK-AUTH-017-canary-real-idp-gate.md) — Canary worker is the real-IdP integration gate between PR previews (mock) and production.
- [**SK-AUTH-018**](decisions/SK-AUTH-018-mock-idp-mock-stripe-preview-flags.md) — Preview-only `MOCK_IDP` / `MOCK_STRIPE` flags bypass external IdP, Resend, and Stripe round-trips.
- [**SK-AUTH-019**](decisions/SK-AUTH-019-sign-out-bypasses-origin-check.md) — `/api/auth/sign-out` bypasses `originCheckMiddleware` via direct `auth.api.signOut`.
- [**SK-AUTH-020**](decisions/SK-AUTH-020-cookie-cache-fail-open-on-kv-outage.md) — On a KV outage the revocation check fails open: a valid cookie is trusted to its expiry (availability over the tighter revocation window).

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list below names the rules that constrain this feature; any feature-local commentary is nested under the rule.

- **GLOBAL-007** — No login wall before first value.
- **GLOBAL-008** — One Better Auth identity across all surfaces.
- **GLOBAL-009** — Tokens refresh silently — never surface a 401.
- **GLOBAL-018** — Revocation is instant and visible across devices.

## Open questions / known unknowns

- **Passkey UX details — Parked until the second-visit UX slice** (`GLOBAL-033`, UX micro-decision → goal-first, zero modals; never block first value). Better Auth ships passkey primitives; the prompt copy / when-to-show heuristic is a non-blocking, dismissible promotion on the second visit, decided in that slice rather than on spec.
- **Phase 2 RBAC trigger — Parked until Phase 2** (`GLOBAL-033`, genuinely-deferred → decision-to-defer, not an open question). `SK-AUTH-006` defers RBAC until "two paying customers ask"; the `rbac_request` feedback-intake tag is the cheap counter, added when Phase 2 opens the support tracker — not before there is paid demand to count.
- **`session.cookieCache` failure mode under KV outage** — Resolved by [`SK-AUTH-020`](decisions/SK-AUTH-020-cookie-cache-fail-open-on-kv-outage.md): fail open (trust a valid cookie to its expiry; revocation resumes when KV recovers).
- **Magic-link domain verification.** Done — `nlqdb.com` verified in Resend (DKIM `resend._domainkey`, SPF + MX on `send.nlqdb.com`). Magic-link sign-in is unblocked on the email-delivery side; remaining work is UI only.
