# Blocked by Human

The single file the founder reads. Per [`GLOBAL-033`](./decisions/GLOBAL-033-resolution-defaults.md),
agents resolve value-decidable questions themselves; this file is **only** for
what a human must do — operator actions an agent can't perform (set a prod
secret, click through a console, prune a DB) and genuine money / strategy /
legal bets — or a suggestion needing human approval before it can amend the
guidelines. Keep each a very short bullet. Delete a bullet once done.

## Human actions (clicks, secrets, legal)

- **Re-arm the Turnstile worker secret (agent-doable, after this PR merges + `deploy-api` redeploys)** — arming attempt 1 failed on bracket-access env getters Vite never inlines (SK-ANON-009 rollback); #717 fixed the getters, but `deploy-api.yml` built `apps/web` with no `PUBLIC_*` env, so the bundle `app.nlqdb.com` actually serves still compiled `solveChallenge()` to null (fixed in this PR). Procedure: (1) **bundle gate** — grep the `CreateForm.*.js` chunk referenced by `app.nlqdb.com/app/new` for the sitekey literal `0x4AAAAAAD3WnUiwKEWfcy_X`; (2) fetch the widget secret — `GET accounts/$CLOUDFLARE_ACCOUNT_ID/challenges/widgets/0x4AAAAAAD3WnUiwKEWfcy_X` → `.result.secret` (read token suffices); (3) `printf '%s' "<secret>" | bunx wrangler secret put TURNSTILE_SECRET` from `apps/api`; (4) verify a tokenless anon create 428s AND a real browser create succeeds; on any regression `wrangler secret delete TURNSTILE_SECRET` (fail-open restores). Until armed, abuse stays bounded by the SK-ANON-012 device cap + SK-ANON-010 global caps.
- **(Optional, deferred) Canary Stripe test-mode keys + a dedicated Neon-branch `DATABASE_URL`** — only for exercising billing / hosted `db.create` on `nlqdb-api-canary`; no healthy route depends on them. Real-IdP sign-in is otherwise fully wired (2026-07-16): Google + GitHub creds live in `.envrc` as `CANARY_*` and mirror via `scripts/mirror-secrets-canary.sh` ([SK-AUTH-008](./features/auth/decisions/SK-AUTH-008-three-oauth-app-pairs.md)), which live-verifies both sign-in legs.
