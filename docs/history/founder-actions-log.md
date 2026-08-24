# Founder-actions log — every human operator action, append-only

Why this file: the company is operated by agents; the human does only what
agents cannot (accounts, credentials, console clicks, account-walled
submissions, money). Those actions used to vanish on completion — queue
bullets are deleted once done ([`blocked-by-human.md`](../blocked-by-human.md)
charter, which now points here), so the only
record was git archaeology. This log is the durable, chronological record,
kept so that (a) standing up another product with an agent is a **replay**,
not a reconstruction, and (b) it seeds the founder-ops goal pack
([`SK-PIVOT-018`](../features/agent-memory-pivot/decisions/SK-PIVOT-018-goal-packs.md)).

Rules: append-only, newest at the bottom of each era; **metadata only —
never secret values** (credential *names* live in `.env.example`; the
accounts table in [`runbook.md §3`](../runbook.md) stays the canonical
account inventory, and the channel ledger
[`research/acquisition-channels.md`](../research/acquisition-channels.md)
the canonical *status* of anything submitted — this log records the action,
never re-states the outcome). One line per action: date · action · surface ·
what it unblocked · replay note. Decisions are excluded — they live in
decision records; this file is operator actions only.

## Era 0 — initial infrastructure (repo bootstrap; exact dates in `git log docs/runbook.md`)

One sitting-cluster, reconstructed from [`runbook.md §3`](../runbook.md) +
[`infrastructure-setup.md`](infrastructure-setup.md) (both stay canonical
for the *how*; this is the replay checklist). Dependency order for a
rebuild; the times are replay estimates, not measurements:

1. **Domains** — buy `nlqdb.com` (+ `nlqdb.ai`); zones onto Cloudflare Free. ~15 min.
2. **Accounts, in dependency order** (plans + identifiers per service: runbook §3):
   GitHub org (`nlqdb`) → Cloudflare → Neon → npm (`@nlqdb` scope) →
   Google Cloud project + OAuth consent screen → Resend (+ DKIM/SPF DNS) →
   Stripe (live-mode merchant, CHF) → Grafana Cloud → LogSnag → Tinybird →
   PostHog → Sentry → Fly.io → LLM providers (Google AI Studio, Groq,
   OpenRouter, + later Cerebras/Mistral/SambaNova/NVIDIA NIM).
   Docker Hub deliberately skipped (ghcr.io instead). ~2–4 h total.
3. **OAuth apps** — GitHub OAuth apps (prod + dev + canary pairs), Google
   OAuth client; callbacks pinned per runbook §5/§5b. ~30 min.
4. **Tokens/keys minted** — one per service into `.envrc` (canonical names
   in `.env.example`), then `scripts/mirror-secrets-gha.sh` +
   `mirror-secrets-workers.sh` propagate; `scripts/verify-secrets.sh`
   proves the set. Agent-doable once values exist; the *minting clicks* are
   human. ~1–2 h.
5. **One-time console opt-ins** — Neon project (us-east-1, PG 17, Neon Auth
   OFF), minutes. Cloudflare R2 is **not** a free click: it needs a payment
   method on file even inside the always-free allowance, so the R2 line was
   added **2026-04-26 and cancelled the same day** — replay both halves, and
   re-read the "does the bucket keep serving after cancellation?" unknown in
   [`runbook.md §7`](../runbook.md).

## Era 1 — Phase 0/1 operations (dated where a source records it)

| Date | Action (surface) | Unblocked | Replay note |
|---|---|---|---|
| 2026-05-20 | Bootstrap-publish `@nlqdb/sdk@0.1.0` from maintainer npm session (npm) | changesets/OIDC release lane — OIDC can't create a first version | ~5 min; canonical procedure `.changeset/README.md` |
| (unrecorded) | Bootstrap-publish `@nlqdb/cli@0.1.0` (npm) | `npx @nlqdb/cli` shim | same procedure |
| (unrecorded) | Stripe live-mode sitting: keys, 2 prices, webhook (5 events), Tax, customer portal (Stripe dashboard) | paid-plan readiness (scorecard row #20) | ~30 min; `docs/pricing-source-of-truth.md` |
| (unrecorded) | GSC service account + `GSC_SERVICE_ACCOUNT_JSON` (Google console) | `scripts/gsc-pull.ts` — scorecard row #7's Google-side instrument | ~10 min |
| 2026-06-12 | Submitted the original Anthropic MCP directory form (clau.de form) | nothing — produced no listing; superseded by the plan-gated admin-portal path (ledger row #9, still queued) | lesson: verify the live submission path first |

## Era 2 — the 2026-07-26 sitting (seven actions, queue 9 → 2)

Recorded live during the sitting (PR #834; verification per action in its
body). "Ledger row #N" = the channel row in
[`research/acquisition-channels.md`](../research/acquisition-channels.md),
which owns each listing's current status:

| # | Action (surface) | Unblocked | Replay note |
|---|---|---|---|
| 1 | `npm login` + bootstrap-publish `@nlqdb/mcp@0.1.0` `--no-provenance` (terminal + npm web auth) | the headless install path — first agent-usable route into nlqdb memory | ~5 min; paste was pre-staged in the queue bullet |
| 2 | Configure npm Trusted Publisher for `@nlqdb/mcp` → `release-npm.yml` (npmjs.com) | OIDC publishes with provenance for every later version | ~3 min; fields table `.changeset/README.md`; "allowed actions": publish (+ stage publish, unused) |
| 3 | Smithery: CLI `auth login` (browser OAuth) → `mcp publish` → approve OAuth scan → set listing metadata (smithery.ai) | directory listing, all 5 tools scanned (ledger row #4) | ~10 min incl. a local-network false start; homepage/utm field didn't persist — recheck |
| 4 | Flip "Always Use HTTPS", `nlqdb.com` zone (Cloudflare dashboard) | closed GLOBAL-039's plaintext-http residual gap | ~2 min; agent token can't touch zone settings |
| 5 | Submit mcp.so form (GitHub sign-in, mcp.so/submit) | the mcp.so listing, once approved (ledger row #7) | ~5 min; payload was pre-staged |
| 6 | Submit cursor.directory form (sign-in, /plugins/new) | the cursor.directory listing, once approved (ledger row #8) | ~5 min; payload was pre-staged |
| 7 | Fork + PR to `punkpeye/awesome-mcp-servers` ([#10984](https://github.com/punkpeye/awesome-mcp-servers/pull/10984), own GitHub account over SSH) | the list entry, once maintainers merge (ledger row #10) | ~10 min; agent sessions are repo-scoped, so cross-repo PRs stay human (or a scope-free session) |

Pattern worth keeping: every action took minutes **because the payload was
pre-staged by agents** — the founder-minute cost of an action is set by how
well the queue bullet was prepared, not by the action itself.

## Era 3 — 2026-07-27

| Date | Action (surface) | Unblocked | Replay note |
|---|---|---|---|
| 2026-07-27 | Deleted the orphaned Neon branches `pr-571` and `pr-648` (Neon API) | `ci.yml`'s `test-api-smoke-neon` and every preview needing a branch — the project sat at Free's 10-branch cap, so `POST /branches` answered `422 BRANCHES_LIMIT_EXCEEDED` on innocent PRs | ~2 min; **don't replay** — the same run made it self-healing: all three creation sites now set Neon's `expires_at`, so an orphan reaps itself server-side even when no runner survives to clean up |

## Era 4 — 2026-07-29 (advisor session, in-session decisions)

| Date | Action (surface) | Unblocked | Replay note |
|---|---|---|---|
| 2026-07-29 | **Go** on the `MEMORY_PRESET=1` prod flip — merged #835 (agent session, founder-directed live) | the `agent_memory_v1` preset + `nlqdb_remember` for every signed-in account; SK-PIVOT-016's prod prerequisite → D-04 is agent-drivable | ~1 min; the E-06 gate blocker (E-03, #851) had already shipped, so the decision was a clean go/no-go; rollback stays one var |
| 2026-07-29 | Merged the changesets release PR #826 (agent session, founder-directed live) | `@nlqdb/mcp@0.1.1` (corrected no-key stderr + README) and `@nlqdb/sdk@0.2.2` (import-entrypoint fix) publish via Trusted-Publisher OIDC — no manual `npm login` | ~1 min; a normal release step — merging the changesets PR is the whole action |
| 2026-07-29 | Provided `LOGSNAG_TOKEN` + `LOGSNAG_PROJECT` to the agent session env (CCR environment settings) | the `window.__nlqdb_logsnag` hook — client demand signals (GLOBAL-024) stop being no-ops; verified with one live ingest event (HTTP 200, channel auto-accepted) | ~2 min; both names were already in `.envrc` + `mirror-secrets-gha.sh`, so the GHA secrets side needed nothing new |
| 2026-07-29 | Pasted Dependabot alert #29's body into the session (sharp < 0.35.0 in `apps/docs`, 4 libvips CVEs) | the bump to sharp 0.35.3 (libvips 8.18.3) with a verified docs build — the alert was unreadable from any agent session (no alerts endpoint in the toolset) | ~1 min; replay: pasting the alert text beats waiting on a security-events grant |
| 2026-07-29 | Minted an `sk_mcp_` MCP key at `/app/keys` and set it as `NLQDB_MCP_API_KEY` in the agent-session env | R-04's cold-agent walk — ran green the same session (published `@nlqdb/mcp@0.1.1` + published guide, real prod write + read-back through the confirm flow), deleting the queue's last ~2-min item | ~2 min; the walk passes it to the binary as `NLQDB_API_KEY`; CCR-sandbox replays need `NODE_OPTIONS=--use-env-proxy` (direct egress blocked there) |
| 2026-07-29 | Submitted + claimed the Glama *server* listing (`glama.ai/mcp/servers` form, GitHub auth) → [`glama.ai/mcp/servers/nlqdb/nlqdb`](https://glama.ai/mcp/servers/nlqdb/nlqdb), `author:official` | the score-badge gate the `awesome-mcp-servers` maintainer put on PR #10984 (ledger rows #6/#10) — badge still waits on the Make-Release step (queue #2) | ~5 min; payload was pre-staged same-day (form values + root `glama.json` for the org-repo claim) |
| 2026-07-29 | Deployed the Glama build spec + published release `0.1.0` (Dockerfile admin form) | Glama scoring — tier **B** same hour (per-tool 4.3–4.6/5), unblocking the #10984 badge | ~10 min incl. one failed test: the CMD field must be the server start command (`sh -c "NLQDB_API_KEY=… nlqdb-mcp"`), not the key placeholder, build steps `npm install -g @nlqdb/mcp`, env schema renamed `SK_MCP_KEY`→`NLQDB_API_KEY` — Glama wraps CMD in `mcp-proxy` and auto-generates placeholder env values |
| 2026-07-29 | Emailed support@glama.ai about the listing's "no LICENSE" F flag (own inbox) | the only path to clearing the flag while staying FSL (`GLOBAL-019`): GitHub's detector covers choosealicense.com licenses only, so our LICENSE reads `NOASSERTION` and no rescan helps — asked for a manual override, citing the LICENSE link + SPDX id `FSL-1.1-ALv2` | ~3 min; draft was pre-staged in-session; relicensing was raised and declined per `SK-PIVOT-005` |

## Era 5 — 2026-08-04

| Date | Action (surface) | Unblocked | Replay note |
|---|---|---|---|
| 2026-08-04 | Disabled Cloudflare's managed robots.txt AI-crawler block on the `nlqdb.com` **and** `nlqdb.ai` zones (Cloudflare dash → AI Crawl Control / Content Signals) | AI-crawler + answer-engine access to every published page — the managed block Disallowed GPTBot/ClaudeBot/Google-Extended/CCBot/meta-externalagent/Amazonbot/Applebot-Extended/Bytespider and signaled `ai-train=no`, contradicting the repo's own AI-permissive `apps/web/public/robots.txt` (DESIGN §3.1 AEO/GEO); relevant context for the R-08 0/10 retrieval baseline | ~2 min per zone; verified live same day: nlqdb.com, docs.nlqdb.com and app.nlqdb.com all serve the repo robots.txt with no injected block (nlqdb.ai is a pure 301); on any new zone, check AI Crawl Control **and** Security → Bots "Block AI bots" |
| 2026-08-04 | Pushed the Glama score badge onto `awesome-mcp-servers` PR #10984 (fork branch `add-nlqdb`) + claimed the Glama *connector* (`glama.ai/mcp/connectors/com.nlqdb/nlqdb` via `/.well-known/glama.json`) | the maintainer's stated merge gate on #10984, and the connector's website/health follow-ups (ledger rows #6/#10) — both now awaiting external review | ~5 min; do not mark listed/merged until the external side confirms |
| 2026-08-04 | Ran `scripts/mirror-secrets-gha.sh` locally (PR-branch version) with `NLQDB_MCP_API_KEY` in `.envrc` — `NLQDB_API_KEY` (62 chars) set as a GH Actions repo secret, 47 secrets mirrored, CF-token self-verify HTTP 200 | the D-02 memory-sync workflow can authenticate (feeds SK-PIVOT-016 criterion 1) — still dark until D-04 sets the `NLQDB_MEMORY_DB` repo variable | ~2 min; the script maps the `.envrc` name `NLQDB_MCP_API_KEY` → `NLQDB_API_KEY` |
| 2026-08-04 | Linked `nlqdb.com` from founder-owned properties: salfati.group (DR 7) + GitHub/npm/social profile website fields (own sites/accounts) | nlqdb's first referring domains — DR was 0.0 with zero inbound links (R-10's measured baseline); next `/reach` DR read captures any movement | ~10 min; own-property links only — no outreach, no link requests (human-norm rule untouched) |
| 2026-08-04 | Set up Bing Webmaster Tools via one-click GSC import (bing.com/webmasters) | second-index visibility measurement: ChatGPT retrieval runs on Bing's index (upstream of the R-08 baseline), free backlink reports, and the IndexNow dashboard that verifies the key rotated in #901 | ~5 min; BWT backlink + IndexNow views are founder-console only — agents ask for a paste, like GSC before the service account |

## Era 6 — 2026-08-05 (advisor session — "Become AI" locks + directory submissions)

| Date | Action (surface) | Unblocked | Replay note |
|---|---|---|---|
| 2026-08-05 | Created the private `experts` repository (GitHub, all-rights-reserved, no license file) | `SK-EKP-003`'s private half has a home — EK-05 stays parked only on workspace access for agent sessions (Claude GitHub settings) | ~2 min; description text pre-staged in-session; FSL deliberately **not** applied there |
| 2026-08-05 | Submitted `nlqdb-memory` to Anthropic's community plugin directory (`clau.de/plugin-directory-submission`, signed-in form) — "received, review team will evaluate" | R-09 venue #4 / ledger row #22 moves to submitted-pending-review; on approval the plugin appears in the in-product `/plugin` Discover tab | ~5 min; platforms = Claude Code only (Cowork untested, deliberately unticked); path `apps/web/public/agent-artifacts`; privacy `nlqdb.com/privacy` |
| 2026-08-05 | Opened `cline/mcp-marketplace` `[Server Submission]` issue [#2197](https://github.com/cline/mcp-marketplace/issues/2197) with the 400×400 brand PNG | R-05 venue #10 / ledger row #24 → in-flight; approved listings are one-click installable inside Cline | ~10 min; logo now checked in at `apps/web/public/brand/nlqdb-400.png`; pitch goes in Additional Information (template has no "reason" field) |
| 2026-08-05 | Locked the goal-pack build order #2–#9 (in-session, stated lens: **depth of quality-impact on the niche over audience size**) | every future "which pack next" — sequence recorded in `pack-candidates.md`: support-bot resolution → research-agent source ledger → provenance/retention → coding-agent fleet → per-tenant cost → incident/on-call → eval ledger → sales/pipeline | ~2 min; agent-recommended order accepted verbatim; fleet ledger's self-seeding corpus is the named argument for any future swap toward #2 |

## Era 7 — 2026-08-07 (advisor session — Fable review of the /ek foundation)

| Date | Action (surface) | Unblocked | Replay note |
|---|---|---|---|
| 2026-08-07 | **F2 — approved the GLOBAL-037 amendment** (in-session): egress restated as three enumerated lanes (planning schema-only · narration disclosed w/ opt-out · interview/extraction authoring carve-out, own tenant only), replacing the overbroad "only schema ever leaves" headline that shipped code contradicted | resolves the two-canonical-texts conflict the Fable review found (SK-EKP-007's carve-out vs GLOBAL-037's absolute text); INV-EKP-037 and the EK INDEX hard rule now anchor to one truth | ~1 min; GLOBAL-037's own text required founder supersession — this is the only path that wasn't a P1 violation |
| 2026-08-07 | **F1 — chose Option B for the trust claim** (in-session): harden the product first — knowledge/granted asks skip narration by default + no-training interview provider pin (EK-09) — then publish the stronger "buyer queries never send your rows to an LLM" copy | EK-09 minted as the gating slice; the EK-03 ToS sign-off bullet narrows to final-wording-only once EK-09 is green | ~1 min; Option A's truthful text stays as the fallback in the draft |

## Era 8 — 2026-08-09

| Date | Action (surface) | Unblocked | Replay note |
|---|---|---|---|
| 2026-08-09 | Enabled Tawk's native **Consent Form** (Tawk dashboard → Administration → Chat Widget → Consent Form) | the `/app` chat cookie is now ePrivacy-gated in-widget per `SK-WEB-029` — the one operator step #959's consent design relies on; blocks the cookie until in-widget accept while keeping the chat bubble visible for everyone | ~2 min; founder-confirmed; keep it enabled. `TAWK_TO_API_KEY` (Secure-Mode identity HMAC) is reported mirrored to GHA + prod Worker in the PR body but has no log line — treat as unverified until confirmed; if unset, identity degrades to an anon id (no error) |

## Era 9 — 2026-08-10 (live review session)

| Date | Action (surface) | Unblocked | Replay note |
|---|---|---|---|
| 2026-08-10 | **Approved the SK-PIVOT-010 amendment** (in-session, one-word yes): preset create (`POST /v1/databases {preset}`) additionally accepts user-scoped keys (`sk_live_`/`sk_mcp_`); `anon`/`pk_live` stay rejected | #961 merged; the #963 hold on the #955/#961 pair released; next `/daily` ships the create-verb change → D-04 auto-provisions the prod memory DB (SK-PIVOT-016 path is now all agent work) | ~1 min; recorded as founder-confirmed in SK-PIVOT-010's amendment |
| 2026-08-10 | **Signed off the EK-03 ToS/DPA "not allowed" delta** (in-session guided walkthrough): Option A wording approved as the publishable contract text, with one founder-directed amendment — the use/train prohibitions carry an explicit, opt-in, withdrawable consent carve-out | EK-03 box 3's legal gate: a follow-up run publishes the blocks into `/terms` + `/privacy` with the EK-05 selling flow, no founder step left on that path; EK-09's stronger copy returns later as a separate one-sentence wording sign-off; queue bullet #3 deleted | ~15 min; substance map re-verified against shipped code before the yes; adjusts 08-07's F1 Option B — hardening still lands, but A's truthful text no longer waits on it |

## Era 10 — 2026-08-12

| Date | Action (surface) | Unblocked | Replay note |
|---|---|---|---|
| 2026-08-12 | Created the Supabase OAuth app (Supabase dashboard → Organization → OAuth Apps; scopes `database:write` + `projects:read`; callback `https://app.nlqdb.com/v1/db/connect/oauth/supabase/callback` per SK-AUTH-008) → set `SUPABASE_OAUTH_CLIENT_ID`/`_SECRET` in `.envrc`, mirrored to GHA (`scripts/mirror-secrets-gha.sh`) | `SK-DBCONN-003` (PR #981) blocker B5 — both OAuth creds provisioned ahead of the connect-routes build; Supabase shows the client secret once, now backed up in GHA | ~5 min; agent-buildable from here with **no founder step** — the build PR adds both names to `mirror-secrets-workers.sh` (api subset) + deploys, CI self-heals them GHA→Worker. Only a local live-E2E still needs `.envrc` (GHA secrets are write-only, so the raw value can't be read back) — tests stub the provider |

## Era 11 — 2026-08-14 (live review session — hosted-premium activation)

| Date | Action (surface) | Unblocked | Replay note |
|---|---|---|---|
| 2026-08-14 | **Confirmed the hosted-premium go-live decision** (in-session): directed activation of the meter, which sanctions the §6 monetization trigger PR #987 embedded (unsolicited-inbound threshold 5→1, declared tripped) | resolves the "is the threshold change founder's or the agent's?" review flag — the founder driving activation is the go-decision; `PREMIUM_METER_LIVE` stays the sole remaining flip | ~1 min; not a doc supersession — the founder acting on the tripped signal is the confirmation |
| 2026-08-14 | **Confirmed the Anthropic Console workspace + hard spend limit + minted `PREMIUM_ANTHROPIC_API_KEY`** (founder, own console) | hosted-premium bullet #2's console/money step — the platform key that the lane meters back to customers at 0% markup now exists, spend-capped | metadata only, no key value; the remaining secret-push is agent/operator via the workers mirror |
| 2026-08-14 | Created the **live** Stripe premium objects via the idempotent bootstrap logic (agent, authorized in-session): Billing Meter `nlqdb.premium_llm.overage.anthropic.claude-sonnet-4-6` (`mtr_61VDh7qq8hjksUC1r41GWIBMxReMa6bY`, sum, by-`stripe_customer_id`) + `$0.01/unit` metered overage price (`price_1U4JAWGWIBMxReMa890SAIg8`, lookup `nlqdb_premium_overage_anthropic_sonnet_4_6`) | `SK-PREMIUM-017` bullet #3's create-work — collapses the old #2–#4 into one go-live flip; catalog objects bill nothing until `PREMIUM_METER_LIVE` + real usage | ~2 min; test-mode pair created first + verified (`mtr_test_…`); IDs are object refs, not secrets; re-running is safe (find-or-create) |
| 2026-08-14 | Merged **#987** hosted-premium meter (SK-PREMIUM-009/-002/-017) after a 4-round review that fixed 3 real billing bugs (canceled-subscriber leakage, overage that could never invoice, a concurrent double-bill race) + a CI Biome-format miss | the whole hosted-premium lane lands, dark until the flip | agent merge (founder-authorized "you can merge it"); squash `37cfae2` |
| 2026-08-14 | **Lit the hosted-premium meter live** (founder, own Cloudflare + `.envrc`): created AI Gateway `nlqdb` (logs/cache/retry/auth all off — premium sets `skipGatewayCache`, is fail-loud, and calls the unauthenticated HTTP endpoint), added the 5 go-live secrets to `.envrc` + `PREMIUM_METER_LIVE=true`, ran `mirror-secrets-workers.sh remote api` | closes bullet #2 — `premiumConfigured` now true; verified `GET /v1/models` → `premium.live=true` in prod. The lane is buyable (`GLOBAL-023`), v1 Anthropic-only (`claude-sonnet-4-6`) | ~10 min; `AI_GATEWAY_ACCOUNT_ID`==`CLOUDFLARE_ACCOUNT_ID`; the two new gateway ids are now in both mirror allowlists so a CI deploy self-heals them |

## Era 12 — 2026-08-24 (live review session — planner-head gate waiver)

| Date | Action (surface) | Unblocked | Replay note |
|---|---|---|---|
| 2026-08-24 | **Waived the SK-LLM-053 planner-head measurement gate on record** (in-session, path b): approved merging PR #1041 (re-head strict-$0 planner from the 404-dead `zai-glm-4.7` to `qwen/qwen3.6-27b` on the existing `GROQ_API_KEY`) without a pre-merge BIRD/Spider dispatch | discharges `blocked-by-human.md` bullet #2 — prod was already on the weaker gpt-oss-120b/Gemini fallback, so a working 77%-SWE-bench head cannot regress below today's floor; revert is one line | ~1 min; a confirming quality-eval dispatch may still run post-merge but no longer blocks. Squash `0c07820`. Reviewed 3× (0 code issues), CI 35/35 green |
