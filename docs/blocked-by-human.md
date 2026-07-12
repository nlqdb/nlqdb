# Blocked by Human

The single file the founder reads. Per [`GLOBAL-033`](./decisions/GLOBAL-033-resolution-defaults.md),
agents resolve value-decidable questions themselves; this file is **only** for
what a human must do — operator actions an agent can't perform (set a prod
secret, click through a console, prune a DB) and genuine money / strategy /
legal bets — or a suggestion needing human approval before it can amend the
guidelines. Keep each a very short bullet. Delete a bullet once done.

## Human actions (clicks, secrets, legal)

- **Create a Cloudflare Turnstile widget (CF console) when the anon bot-floor should return** — the account has zero widgets and `TURNSTILE_SECRET` was never set, so the anon-create captcha floor is down by design (SK-ANON-009; abuse stays bounded by the SK-ANON-012 device cap + SK-ANON-010 global caps). Set the secret **only in the same release** that ships the real client widget (`solveChallenge()` in `apps/web/src/lib/turnstile.ts` is a stub) — a secret without the widget 428-kills every anon create (the run-56 outage).
- **Mint `HOMEBREW_TAP_GITHUB_TOKEN` and add it to the repo's Actions secrets** — fine-grained PAT, `contents: write`, scoped to `nlqdb/homebrew-tap` (runbook §"CLI releases"). It has never been valid: every deploy-cli run since 2026-05-19 401'd pushing the formula, so `brew install nlqdb/tap/nlq` (advertised in `cli/README.md` + the npm-shim fallback message) points at an empty tap. Releases now skip the tap push cleanly when the token is absent (2026-07-12 fix); once the PAT is set, the next `cli/**` merge (or a `release-cli.yml` re-dispatch of the latest tag) seeds the formula.
- **Re-provision the `nlqdb-api-canary` worker secrets (`bun run secrets:canary <NAME>` per runbook §4)** — the canary 500s on every `/v1/*` route (found run 56: manual secret drift; deploy-canary green, runtime red), so the SK-AUTH-017 real-IdP gate is dark; each worker has its own secret store and only an operator holds the values.
- **Post the r/SQL variant for `/blog/llm-concatenates-columns-text-to-sql`** — per `docs/research/distribution-queue.md`; needs your reddit account (dev.to half posted 2026-07-07).
- **Final legal copy for `/privacy` + `/terms` — free, no lawyer, no subscription.** The live pages (`apps/web/src/pages/{privacy,terms}.astro`) are **pre-beta drafts**. Use **Termly's free tier** (`termly.io`) — a short-form questionnaire that outputs a GDPR + CCPA privacy policy and **discloses our LLM/cloud subprocessors** (built-in vendor checklist + a custom-vendor field) at $0; generate the Terms of Service free from **TermsFeed's** base T&C. You decide only: real legal entity name, jurisdiction / governing law, and retention period — then an agent wires the generated copy + subprocessor list into the two pages.

## Suggestions needing approval (to amend the guidelines)

- **Extend a D4 carve-out to `docs/progress/quality-score-verification-log.md`?** It's an append-only per-lever evidence log (~20 KB) — the same shape as the exempt ICP tracker; if exempted, agents stop net-shrinking it on every recross. *(Settled 2026-06-24: `scorecard.md` restructured to a bounded current-state tracker — no changelog, nothing to prune — per the founder's "no pruner" steer. `distribution-queue.md` stays self-pruning under the cap via its own archive/collapse policy, so it needs no carve-out. The other near-cap docs — `agent-memory-pivot/FEATURE.md` and the `quality-score-source-of-truth.md` lever table — are fixable by sharding per the `decisions/` precedent: agent-doable, no approval needed.)*
