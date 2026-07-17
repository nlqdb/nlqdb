# Blocked by Human

The single file the founder reads. Per [`GLOBAL-033`](./decisions/GLOBAL-033-resolution-defaults.md),
agents resolve value-decidable questions themselves; this file is **only** for
what a human must do — operator actions an agent can't perform (set a prod
secret, click through a console, prune a DB) and genuine money / strategy /
legal bets — or a suggestion needing human approval before it can amend the
guidelines. Keep each a very short bullet. Delete a bullet once done.

## Human actions (clicks, secrets, legal)

- **Re-arm the prod `TURNSTILE_SECRET` after #718's `deploy-api` run ships** —
  gate first: the sitekey literal `0x4AAAAAAD3WnUiwKEWfcy_X` must appear in the
  `CreateForm.*.js` chunk `app.nlqdb.com/app/new` references (the gate the first
  arming skipped). Widget secret is readable via
  `GET accounts/$CLOUDFLARE_ACCOUNT_ID/challenges/widgets/<sitekey>` → `.result.secret`;
  set it with `wrangler secret put TURNSTILE_SECRET` from `apps/api`, verify a
  tokenless anon create 428s and a browser create succeeds, and on any regression
  delete the secret — fail-open restores (`SK-ANON-009`).
- **Provide a Stripe test-mode key for the canary Worker** (`sk_test_…`, e.g.
  `CANARY_STRIPE_SECRET_KEY` in `.envrc`) — an agent then mirrors test products /
  prices + the webhook endpoint onto `nlqdb-api-canary` via
  `wrangler secret put --config wrangler.canary.toml` (never prod secrets;
  `SK-AUTH-008` canary convention). Neon half DONE 2026-07-17: branch `canary`
  (`br-nameless-forest-a4b7cn69`) is live as the canary `DATABASE_URL` — it's a
  copy-on-write snapshot of prod data, so scrub/reset is your call.
- **Confirm the Tawk.to property ID is ours** — `SupportChat.astro` embeds
  `6a58f0cc096ab21d402a6b88/1jtlmp8d1` (PR #715); log into tawk.to and confirm
  it's your dashboard, else user chats go to a stranger.
- **Tawk.to + PostHog went active without the 30-day advance notice
  `SUBPROCESSORS.md` promises** — send the notice email to `subprocessors@nlqdb.com`
  subscribers, or accept the gap pre-beta (no customers under DPA yet).

## Suggestions needing approval (to amend the guidelines)

- **Rebrand: do you want the database + speech-bubble logo?** The #715 mark was
  reverted (raster-in-SVG, contra `SK-PIVOT-004`); shipping it needs that decision
  superseded + a true vector mark in the documented palette.
- **Chat on marketing pages?** Site-wide Tawk needs `GLOBAL-034` superseded
  (marketing stays SDK-free / no cookie banner) + an EU cookie-consent review.
