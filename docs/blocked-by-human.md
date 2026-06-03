# Blocked by Human

Short-lived list of actions only a human can take, or suggestions needing human approval
before they can be applied to the guidelines. Remove each line once done.

## Human actions (clicks, secrets, legal)

- **`wrangler secret put API_KEY_SECRET`** — Phase 2: create a dedicated HMAC secret for API key signing separate from `BETTER_AUTH_SECRET` (`SK-APIKEYS-008`). Rotate one without invalidating the other.
- **Stripe live-mode flip** — When going live: (1) update webhook endpoint in Stripe Dashboard → copy new `whsec_…` secret, then `wrangler secret put STRIPE_WEBHOOK_SECRET`; (2) activate Stripe Tax in live mode (Stripe Dashboard → Tax → Enable); (3) remove `STRIPE_PUBLISHABLE_KEY` from the go-live secrets checklist in `docs/runbook.md §6` (it's unused — confirmed 2026-06-03).
- **Anthropic Connectors Directory submission** — Fill out `https://clau.de/mcp-directory-submission`. Pre-requisite engineering (Origin-header validation in `apps/mcp/src/index.ts` + branded logo 256×256 SVG) can be done without this, but the form itself requires a human.
