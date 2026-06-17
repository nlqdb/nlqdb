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
- **Final legal copy for `/privacy` + `/terms`** — the live pages (`apps/web/src/pages/{privacy,terms}.astro`) are honest plain-English **pre-alpha drafts** of what we actually collect/do today. Before general availability, replace them with lawyer-reviewed text (decide on jurisdiction, GDPR/CCPA stance, data-retention specifics, and a real entity name).
- **Verify the `GEMINI_API_KEY` project has NO Cloud Billing account** (Google Cloud Console — human only) — the previous key was suspended 2026-06-15 after a *billed* project accrued a charge that went unpaid (we expected $0 per `GLOBAL-013`; a billed project bills even free-model calls). The 2026-06-17 key works today, but if its project has billing linked it will silently bill again and can be re-suspended. Confirm no billing account is attached (or unlink it) so the project is hard-capped to the free tier. See `docs/history/gemini-free-tier-billing-suspension.md`.
