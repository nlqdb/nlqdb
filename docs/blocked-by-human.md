# Blocked by Human

The single file the founder reads. Per [`GLOBAL-033`](./decisions/GLOBAL-033-resolution-defaults.md),
agents resolve value-decidable questions themselves; this file is **only** for
what a human must do — operator actions an agent can't perform (set a prod
secret, click through a console, prune a DB) and genuine money / strategy /
legal bets — or a suggestion needing human approval before it can amend the
guidelines. Keep each a very short bullet. Delete a bullet once done.

## Human actions (clicks, secrets, legal)

- **PR #588 (cross-tenant isolation fix) is reviewed + CI-green but merge/deploy is gated on #583.** Its CRIT fix runs every hosted query under `SET LOCAL ROLE tenant_<hash>`, which fails closed on the ~151 existing prod DBs until a one-time per-tenant role backfill (#583) runs. Run #583 in coordination with the deploy, then merge #588. Also confirm `NODE_ENV` is `production`/`canary` in prod or the new fail-closed Turnstile/Stripe guards won't engage. (#584–#587 track the deferred backups / KEK-rotation / spend-cap / GDPR items.)
- **Confirm `BYO_SECRET_KEK` is set in the prod Worker** (GLOBAL-031 BYO-connect envelope key). Only `OPENROUTER_FRONTIER_API_KEY` was verified live on 07-02 (a frontier eval lane ran); `BYO_SECRET_KEK` was not. Generate `openssl rand -base64 32`, add to `.envrc`, run `scripts/mirror-secrets-gha.sh`; until then `/v1/db/connect` returns 503 `sealing_unconfigured`.
- **Final legal copy for `/privacy` + `/terms` — free, no lawyer, no subscription.** The live pages (`apps/web/src/pages/{privacy,terms}.astro`) are **pre-beta drafts**. Use **Termly's free tier** (`termly.io`) — a short-form questionnaire that outputs a GDPR + CCPA privacy policy and **discloses our LLM/cloud subprocessors** (built-in vendor checklist + a custom-vendor field) at $0; generate the Terms of Service free from **TermsFeed's** base T&C. You decide only: real legal entity name, jurisdiction / governing law, and retention period — then an agent wires the generated copy + subprocessor list into the two pages.

## Suggestions needing approval (to amend the guidelines)

- **Extend a D4 carve-out to `docs/progress/quality-score-verification-log.md`?** It's an append-only per-lever evidence log (~20 KB) — the same shape as the exempt ICP tracker; if exempted, agents stop net-shrinking it on every recross. *(Settled 2026-06-24: `scorecard.md` restructured to a bounded current-state tracker — no changelog, nothing to prune — per the founder's "no pruner" steer. `distribution-queue.md` stays self-pruning under the cap via its own archive/collapse policy, so it needs no carve-out. The other near-cap docs — `agent-memory-pivot/FEATURE.md` and the `quality-score-source-of-truth.md` lever table — are fixable by sharding per the `decisions/` precedent: agent-doable, no approval needed.)*
