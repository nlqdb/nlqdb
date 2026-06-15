# Blocked by Human

The single file the founder reads. Per [`GLOBAL-033`](./decisions/GLOBAL-033-resolution-defaults.md),
agents resolve value-decidable questions themselves; this file is **only** for
what a human must do — operator actions an agent can't perform (set a prod
secret, click through a console, prune a DB) and genuine money / strategy /
legal bets — or a suggestion needing human approval before it can amend the
guidelines. Keep each a very short bullet. Delete a bullet once done.

## Human actions (clicks, secrets, legal)

- **Stripe live-mode go-live** (deferred by founder 2026-06-12 — gated on the [`phase-plan.md §6`](phase-plan.md) demand signal: ≥5 inbound "how do I pay" OR ≥30% test-checkout completion over 50 sessions). Steps, all human: create live products + price IDs; add the live webhook endpoint (Dashboard → copy `whsec_…`); enable Stripe Tax in live mode; then `wrangler secret put` for `STRIPE_SECRET_KEY` / `STRIPE_PRICE_HOBBY` / `STRIPE_PRICE_PRO` / `STRIPE_WEBHOOK_SECRET`. Until then the flow stays in test mode and `/v1/billing/checkout` 503s.
- **Reddit ICP source** (deferred by founder 2026-06-12) — set `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` after manually approving a Reddit OAuth app (Reddit's Nov-2025 policy needs a human). The source self-skips until they're wired (`SK-ICP-011`).
- **Release decision — changesets PR [#393](https://github.com/nlqdb/nlqdb/pull/393)** is green and ready; merging it publishes `@nlqdb/sdk@0.2.1` (the SDK JSDoc + BYOLLM validation-message patch) to the public npm registry. npm publish is effectively irreversible, so "release now" is a human timing call — merge when you want it shipped.
- **Gemini API key denied gemini-2.5 access** (found 2026-06-15, `/daily` run 6) — the shared `GEMINI_API_KEY` project returns `403 PERMISSION_DENIED` ("Your project has been denied access") on the entire gemini-2.5 family (live-probed 4/4; gemini-2.0 returns 429 = access OK, quota-throttled). So Gemini is dead weight in the free chain and the eval (it 403s every call), which is the root of the 2026-06-12 baseline's Spider `gemini:http_4xx` losses. Fix in the Google AI Studio / Cloud console (human only): enable `generativelanguage.googleapis.com` + link a billing account on the project, or rotate to a project that has 2.5 access. Until then, SK-LLM-039 at least makes the denial legible (`gemini:auth_denied`) and the chain falls over cleanly to the other 5 providers. If 2.5 access can't be restored, the cheap in-code alternative is pinning the Gemini default model to `gemini-2.0-flash` (which this key *can* call) — but that's a quality call best made once you know whether prod's key differs from CI's.
- **Final legal copy for `/privacy` + `/terms`** — the live pages (`apps/web/src/pages/{privacy,terms}.astro`) are honest plain-English **pre-alpha drafts** of what we actually collect/do today. Before general availability, replace them with lawyer-reviewed text (decide on jurisdiction, GDPR/CCPA stance, data-retention specifics, and a real entity name).
