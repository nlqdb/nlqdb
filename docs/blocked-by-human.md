# Blocked by Human

The single file the founder reads. Per [`GLOBAL-033`](./decisions/GLOBAL-033-resolution-defaults.md),
agents resolve value-decidable questions themselves; this file is **only** for
what a human must do — operator actions an agent can't perform (set a prod
secret, click through a console, prune a DB) and genuine money / strategy /
legal bets — or a suggestion needing human approval before it can amend the
guidelines. Keep each a very short bullet. Delete a bullet once done.

## Human actions (clicks, secrets, legal)

- **Stripe live-mode go-live** (your call — gated on the [`phase-plan.md §6`](phase-plan.md) demand signal: ≥5 inbound "how do I pay" OR ≥30% test-checkout completion over 50 sessions). Steps, all human: create live products + price IDs; add the live webhook endpoint (Dashboard → copy `whsec_…`); enable Stripe Tax in live mode; then `wrangler secret put` for `STRIPE_SECRET_KEY` / `STRIPE_PRICE_HOBBY` / `STRIPE_PRICE_PRO` / `STRIPE_WEBHOOK_SECRET`. Until then the flow stays in test mode and `/v1/billing/checkout` 503s. Config-only after the surrounding ⭐ TODOs in `stripe-billing/FEATURE.md` ship (self-service portal; drop unused `STRIPE_PUBLISHABLE_KEY`).
- **Reddit ICP source** — set `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` after manually approving a Reddit OAuth app (Reddit's Nov-2025 policy needs a human). The source self-skips until they're wired (`SK-ICP-011`).
- **Opencheck Suite-A reliability fix** (re-diagnosed 2026-06-12, PR #377) — the fast engine probe showed the chain head (Cerebras gpt-oss-120b) is 8/8 self-consistent on the Suite-A round-trip, so the "references a table this database doesn't have" flake is **provider fallback under budget exhaustion + hedge amplification**, NOT lead-model NL→SQL quality. The fix touches the production router (`SK-LLM-014` hedge / `SK-LLM-023` chain), so it needs your call (P1): **(a)** drop the hedge on `schema_infer`/`plan` (it 2×-burns the scarce 5-RPM Cerebras head and routes wins to an often-exhausted Gemini) and/or widen the Cerebras head budget — makes the head carry every run; **vs (b)** gate CI on per-suite green over an N-run window, accepting the intermittent fallback flake. Engine-vs-process call, not value-decidable. Context in `docs/features/e2e-coverage/opencheck-operations.md`.
