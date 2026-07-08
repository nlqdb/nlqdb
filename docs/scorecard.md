# Scorecard — current state

Point-in-time tracker, regenerated each
[`/daily`](../.claude/commands/daily.md) run. Current state only — no changelog
(≤20 KB cap). History: `git log` +
`progress/quality-score-verification-log.md` (engine).

**Weekly focus number (2026-07-04 → 07-11):** **BIRD raw EX → ≥ 0.60**
(row #8) — 0.526 (07-05 canonical), still the only pillar below a hard
[`GLOBAL-025`](decisions/GLOBAL-025-north-star.md) Phase-2 floor;
`SK-QUAL-005` mandates engine work until it clears. Every agent-movable
sub-lever is now measured to a verdict (SC N≥2 flat #619; the run-15
frontier-clamp fix lifted agentic-frontier to 0.693, still < the 0.80 floor,
confirming run 14's ≤ 0.70 ceiling call); the only live BIRD-free move left is
the parked **corrected-set** (license, P2) — so row #8 is a floor this week
(**dark for the lever**, rule 8) and engine is also anti-rut-blocked (3 of the
last 5 merged daily PRs pulled it, rule 7).

**Worst number today:** real strangers reaching a first answer = **0** — a
lagging metric moved through its agent-movable inputs (distribution
surfaces/yield). **Today's lever (07-08, run 23): docs-ambiguity 25 → 24**
(row #17) — row #8 dark + engine anti-rut-blocked (above); the distribution
lane (surfaces/queue/`/blog`, rows #6/#7) was just advanced by PR #631 (run 22,
blog RSS feed), **merged this cycle**, so step-0 non-overlap steered this run to
the next non-distribution lever. Pulled row #17: resolved `byo-connect` open
question **(c)** DNS-rebind TOCTOU — the posed question ("is the
connect-time→query-time re-point window a residual risk we accept?") is answered
by shipped, verified code (per-query egress re-guard on **both** engines,
fail-closed) plus a P2-grounded accept-with-revisit decision. A
keep-refs-in-sync resolution (P3), not a relabel. Detail in *Last change*.
**Step-0 non-overlap:** #631 (run 22) shipped row #7 + `apps/web/**` (blog RSS,
`Base.astro`, `data/blog.ts`) + `research/distribution-queue.md` this cycle;
this run touches none of them (one `docs/features/byo-connect/FEATURE.md` bullet
+ scorecard row #17/Last-change; zero code, zero web, zero queue).
**Engine finding (row #8), standing:** offline deterministic-ceiling lever
exhausted (`SK-LLM-043` #605); SC dead (#619); frontier-lens levers closed
(run 15, `SK-QUAL-022`). **0.526 is a floor whose only live move is the parked
corrected-set** (Kang VLDB-2026; no license, P2). Phase 2 exit gate: **1/9
pass** (row #16).

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (fresh 07-06 pull — CF GraphQL + remote D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 83 visits / 104 pageloads (06-29→07-06, raw). **New walker filter (run 12):** grouping by `userAgentBrowser` splits out the walker UA (parses as "Unknown": 70 visits) ⇒ **real-browser ≈ 13 visits** (12 excl. ChromeHeadless) | account-level RUM can't split per-path, but the browser-dimension cut is a usable walker filter going forward; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 8 total = 4 founder/company + 4 test/dev (unchanged) |
| 3 | DBs total | 162, all with `last_queried_at`; latest 07-06 00:32 UTC | stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not yet measurable** (run 16, `SK-ONBOARD-007`, remote-D1 07-07). Unfiltered counters read 3/8 = **37.5%** but a `tenant_id → user.email` join shows all 3 rows are founder (`omer.hochman@gmail.com`) + `test@example.com` — the 35–37% previously reported was 100% non-stranger | target ≥ 95%. **Attribution gap fixed** (was "the instrument's next fix"): write-side skips the stranger-test walker UA (`isSyntheticUserAgent`, anon case the join can't see); read-side joins `user` + excludes founder/test. Honest read is now N=0 (matches row #2), not a placebo rate |
| 5 | Session retention (≥ 2 queries) | 3 DBs with `first10_asks ≥ 2` (same attribution caveat as row #4) | share of DBs with `first10_asks ≥ 2` (row #4 counters) |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **84** (`/vs` 31 + `/solve` 33 + `/blog` 20) — run-20 lever: published `llm-timeout-looks-like-hallucination` (build-verified: `dist/blog/llm-timeout-looks-like-hallucination/`, in `llms.txt` + sitemap). Queue drains **3 → 2** (`one-way-internal-links-leak-yield` [run 19] + `serverless-db-cold-start-retry` [run 18] remain; < 3 ⇒ next run drafts) | leading input to rows #1–#3; `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts 20; 7d external referrals = **1** (`bing.com`, 1 pageload). **Run 22 lever: syndication feeds 0 → 1** — shipped `/rss.xml` (hand-rolled RSS 2.0 over `data/blog.ts`, autodiscovered site-wide via `<link rel="alternate">`; build-verified `dist/rss.xml` = valid feed, all 20 posts, 5 passing invariants in `rss.xml.test.ts`). Closes the "un-subscribable blog" gap: feed readers can now subscribe and dev.to/Medium/Hashnode can auto-import the canonical copy (each re-post carries `rel=canonical` back). External-referral re-measure lags a window (indexation/syndication pickup). **Run 19 lever: internal-link reciprocity 0 → 10** — `/blog` posts forward-linked to their `/solve`/`/vs` anchor, but those pages never linked back (link graph a tree, not a mesh). Added the reciprocal "Further reading" backlink on all 10 anchored `/solve`+`/vs` pages (`blogByAnchorPath`, same `anchor` field), so every published post now has ≥1 internal inbound link + visitors get a next hop. Internal links 2417 → 2427 (row #18) | CF `refererHost` — measured every run. Attacks the standing "volume without yield" finding at its SEO/UX input; external-referral re-measure lands next window (indexation lags) |
| | **Engine** — BIRD 07-05 · Spider 07-02 · persona-bench 07-02 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.526** (262/498 EA, 2 `gold_error`, 07-05 canonical, [run 28742006051](https://github.com/nlqdb/nlqdb/actions/runs/28742006051)). **`SK-QUAL-017` SC verdict (run 12, 07-06):** first N≥2 dispatch (N=3, temp 0.7, 150q smoke, [run 28761582097](https://github.com/nlqdb/nlqdb/actions/runs/28761582097)) = **79/150 = 0.5267, exactly flat vs the same-directive-set greedy comparator** (canonical run restricted to the identical 150 qids: 79/150; b=8/c=8, p=1.0; SC `no_sql` 1/150) — majority-vote at 3× quota buys 0 on the free chain; the 8↔8 swaps are provider-mix noise | target 0.65 / **Phase 2 floor 0.60 — below floor ⇒ engine work ships until cleared (`SK-QUAL-005`)**. Baseline re-seeded 07-05. `SK-LLM-043` live-verified (run 11): `\|\|` concats 7 → 3 run-wide. Offline deterministic-ceiling lever exhausted (07-04); **SC lever dead (#619); frontier-lens levers closed (run 15, `SK-QUAL-022`)** — only remaining live BIRD-free move is the parked corrected-set (license, P2). Pin-branch delete still 403-blocked (`eval/bird-resume-0e67e64` + `-8d3d7c5`) |
| 9 | Spider raw EX | 0.1926 (26/135, 07-02) | target 0.75; was 0.1852 (06-17). **Worst engine number.** 07-02 free lane capacity-throttled ⇒ undercounts; Spider SC smoke now presumptively skippable — BIRD's SC verdict (row #8) came back flat, so re-measuring Spider capacity-honestly matters more than SC |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-02) | full-chain ICP EX; 1.8× BIRD, 5× Spider — the GLOBAL-026 bet; N=23 ±1 noisy. Retrieval precision@1 saturated |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic-frontier 69.33%, 150-q smoke seed 20260607, 07-06 run 15, `SK-QUAL-022`; single-frontier lane 18.00 pts). persona-bench 0.00 pts (07-02) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69–0.70 unclamped < the 0.80 floor (row #16 fails on competence, not the instrument — run 15 `SK-QUAL-022` removed the 5 s frontier-plan clamp that had understated it). Smoke, no baseline touch; run history in git + `progress/quality-score-verification-log.md` |
| | **Ops** — 7d, CF Workers analytics (fresh 07-06 pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | 2,281 / 0 (0.00%) | mcp-server 425 req / 0 err; events-worker 4 req |
| 13 | nlqdb-api wall-time p50 / p95 | 10.1 ms / 1.35 s | mcp-server p95 331.5 s = long-lived SSE, expected; `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.75** — sdk ✅ 07-06 (1.00) · mcp ✅ 07-06 (1.00) · examples ✅ 07-06 (1.00) · opencheck ❌ (**Suite A 4/5, best since the 06-12 green** — [run 28768099957](https://github.com/nlqdb/nlqdb/actions/runs/28768099957)) | run 13 owns this row: the named fix (pre-flight over an ordered free-model list) shipped + trace-triaged suite fixes; sdk/mcp/examples re-dispatched same run (were staring at a 07-09 freshness cliff). **Run 18 owns this row: fixed Suite A's sole failure** — the app-side cold-start `db_unreachable` (2× trace-verified) — via `SK-ASK-013` exec-stage backoff (`300 ms × 2^(n−1)`, ≤900 ms) so a scale-to-zero Neon resumes before the retry lands; `plan`/`route` still retry instantly (LLM failover needs no wait). **Measured before→after (deterministic, `retry.test.ts`):** the same cold-start model (DB unreachable until t=700 ms) — *without* backoff all 3 instant attempts land cold and surface `db_unreachable`; *with* the exec backoff attempt 3 lands at t=900 ms and recovers. Real-world re-measure dispatched: opencheck `depth=a` on the branch ([run 28849127856](https://github.com/nlqdb/nlqdb/actions/runs/28849127856)) — capacity-confounded (agent-pool dependent), so the test is the primary signal; next run reads the completed run. Suite B 0/8 = weakest-candidate capacity (4 stronger pools simultaneously 429 at pick time), not a fix regression. Full triage: `e2e-coverage/opencheck-operations.md` 2026-07-06 rows |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** (first measurement, 07-02) — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.526, fresh 07-05); agentic-frontier ≥ 0.80 + Δ ≤ 25 pp (**honestly re-measured 07-06 run 15 post-`SK-QUAL-022` clamp fix, row #11: Δ 18.66 pp ✓ ≤ 25, agentic 0.693 ✗ < 0.80 — the clamp is removed, so this now fails on a genuine competence gap, not the instrument; confirms run 14's ≤ 0.70 ceiling**); TTFV p50 ≤ 60 s (unmeasured); first-10 ≥ 95% (35.3% walker-dominated, N=17 — row #4); destructive-op retry < baseline (unmeasured); MCP in 3+ host apps (no instrument); 1 public agent product on nlqdb (0 strangers); 3 non-engineer CSV tests (CSV upload unshipped) | agent-movable next: the agentic-frontier criterion is now **measurement-clean** (clamp fixed) — closing the remaining ~11 pp to 0.80 is a real engine-competence lift (multi-model frontier chain `SK-LLM-017`, or the parked corrected-set); first-10 instrument reads with traffic; stranger-dependent criteria hang on rows #2/#6 |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **24** (07-08; run 23 lever: −1, resolved `byo-connect` OQ **(c)** DNS-rebind TOCTOU — per-query egress re-guard shipped on both engines (verified in code), sub-TTL residual accepted for the BYO threat model, P2-grounded vs OWASP/industry re-resolve-before-use best practice; keep-refs-in-sync per P3, not a relabel — detail in *Last change*). **Prior levers** (git preserves full detail): run 21 −1 (`e2e-coverage` cold-start OQ → run 18 `SK-ASK-013`); run 17 −2 (`premium-tier` router contracts); run 8 −1 (`agent-memory` matrix-freshness guard hardened); run 6 −4 (4 body-already-settled bullets relabeled to match). | target ↓ 0. **Method pinned** (stops the 75↔85 drift): `- ` bullets under `## Open questions` whose text does **not** match, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed` (case-insensitive is load-bearing — a case-sensitive grep over-counts). Lever: research (P2/GLOBAL-033) → document (P4) → mark resolved |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting** (07-08 run-22 sweep: 104 pages, **2,555** internal links — +104 vs run 20 = the one `<link rel="alternate">` RSS-autodiscovery tag now on every page; `/rss.xml` resolves as a real file, not flagged) | target 0 — sweep is repeatable: `cd apps/web && bun run build && bun run check:links` (checks hrefs + sitemap + llms.txt against dist; exits 1 on dead) |
| | **Product-readiness** — client-blocking gaps the loop was blind to (added 07-04) | | non-deferral gaps that no prior row measured, so rule 2 ("no change without a number") could never select them; now agent-movable |
| 19 | Live-surface claim integrity | **0 tracked gaps** (07-05, was 4) | claim-vs-reality on shipped user-facing surfaces; target 0. Run-9 swept `/pricing`, MCP paths, CLI verbs, wrapper-publish status, and `architecture.md` prose to match what actually ships (detail in git). Next count re-audits fresh (e.g. paid-tier limit claims while billing is dark); standing candidate: extend `check:links` to assert each advertised capability has shipped code |
| 20 | Hosted-premium readiness (§6 build-before-signal) | **schema ✅ · BYOLLM lanes ✅ · picker: web ✅ (`SK-PREMIUM-013`, #610) · picker parity ✅ (`SK-PREMIUM-014`, run 10: `model` preset + routing on `/v1/ask` — `fast` pins free, `best` 409s `model_unavailable` sans frontier lane — + SDK `model`, CLI `--model`, MCP `model`, `<nlq-data model>`; residual gaps tracked: `nlq model set`, per-provider key storage) · premium chain ⬜ · CTA (`SK-PREMIUM-004`) ⬜ · spend-cap UI ⬜** | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is **built before** the signal (lighting it is a flag flip); only the *meter firing* (Lago→Stripe) + cost-incurring infra stay dark. The meter staying off is not a reason to leave the slot unbuilt; drive ⬜→✅ each run (#610 07-04, run 10 07-05); next slot: the premium chain (`SK-LLM-017`, flag-dark) or the CTA |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/20 + 12 memory `/vs` pages | tick on merge; mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — the only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; E-03…E-07 (per-agent RLS, TTL, hybrid recall, authed on-ramp, ClickHouse) all Neon/infra-gated |

## Shipped distribution (live URLs)

Canonical copies on `/blog` (`SK-BLOG-001`); venue variants stay in
`research/distribution-queue.md` as pointers:

- https://nlqdb.com/blog/agent-memory-vector-store-aggregation-gap/ (run 53 — anchors `/vs/pinecone`)
- https://nlqdb.com/blog/store-form-submissions-without-a-backend/ (run 106 — anchors `/solve/store-form-submissions-without-backend`)
- https://nlqdb.com/blog/not-in-subquery-null-trap/ (run 130 — anchors `/solve/find-rows-with-no-match-in-another-table`)
- https://nlqdb.com/blog/zep-recall-vs-analytical-agent-memory/ (run 20 — anchors `/vs/zep`)
- https://nlqdb.com/blog/null-timestamp-ttl-sweep-funnel-metric/ (run 2 — engine lesson)
- https://nlqdb.com/blog/mcp-server-what-does-the-agent-own/ (run 102 — anchors `/vs/hex`)
- https://nlqdb.com/blog/text-to-sql-accuracy-schemas-your-users-never-build/ (run 55 — engine lesson, persona-bench/SK-QUAL-018)
- https://nlqdb.com/blog/ai-internal-tool-builder-faster/ (run 67 — anchors `/vs/retool`)
- https://nlqdb.com/blog/offline-llm-eval-rate-limits/ (run 68 — engine lesson, SK-QUAL-013 capacity honesty)
- https://nlqdb.com/blog/sitemap-advertising-redirects/ (run 69 — engine lesson, trailing-slash canonical/sitemap hygiene)
- https://nlqdb.com/blog/text-to-sql-build-vs-buy/ (run 109 — anchors `/solve/add-ask-your-data-feature-without-building-text-to-sql`)
- https://nlqdb.com/blog/find-duplicate-rows-you-re-google-every-time/ (run 119 — anchors `/solve/find-duplicate-rows-in-my-data`)
- https://nlqdb.com/blog/your-bi-tool-got-acquired-data-layer/ (run 110 — anchors `/vs/mode`)
- https://nlqdb.com/blog/top-n-rows-per-group/ (run 131 — anchors `/solve/find-top-n-rows-per-group`)
- https://nlqdb.com/blog/http-200-error-in-body/ (run 7 — engine lesson, SK-LLM-042 gateway-200-error-body classifier)
- https://nlqdb.com/blog/llm-concatenates-columns-text-to-sql/ (run 12 — engine lesson, SK-LLM-043 projection directive / positional-tuple EX)
- https://nlqdb.com/blog/bird-gold-noise-distinct/ (run 14 — engine lesson, SK-QUAL-014 loss-bucketing before prompt directives)
- https://nlqdb.com/blog/model-preset-fail-loud/ (run 16 — engine/product lesson, SK-PREMIUM-014 honest model knob / fail-loud 409)
- https://nlqdb.com/blog/llm-preflight-probe-health/ (run 17 — CI/engine lesson, SK-LLM-042 probe-health ≠ agent-competence)
- https://nlqdb.com/blog/llm-timeout-looks-like-hallucination/ (run 20 — engine lesson, SK-QUAL-022 eval-budget ≠ prod SLA; abort ≠ parse failure; latency fingerprint)

## Last change

**2026-07-08 (run 23)** — lever: **docs-ambiguity (row #17), 25 → 24**.
Row #8 (weekly focus) is a floor this week (rule 8) + engine anti-rut-blocked
(rule 7); the distribution lane (rows #6/#7) was just advanced by PR #631 (run
22, blog RSS feed), **merged this cycle**, so step-0 non-overlap steered this
run to the next non-distribution lever. **Lever:** resolved `byo-connect` open
question **(c)** "DNS-rebind TOCTOU between connect-time guard and query-time
use" — a real security question (*is the connect→query re-point window a
residual risk we accept, or must we close it?*) whose body already carried the
answer its first line didn't reflect (the run-6 keep-refs-in-sync pattern, P3).
**Verified in code:** a per-query egress re-guard on **both** engines —
ClickHouse re-runs `guardEgressHostResolved` in `buildClickhouseByoQuery`
(`packages/db/src/clickhouse-byo.ts:107`), BYO-PG's `runByoPgQuery` re-resolves
+ re-classifies before the fetch (`apps/api/src/ask/build-deps.ts:280`), both
fail-closed. **P2 grounding** (web-searched current SSRF/DNS-rebinding
practice): re-validate-the-resolved-IP-immediately-before-use is the
industry-standard TOCTOU mitigation (OWASP; thingsboard/postiz 2025–26 fixes
match); full closure is IP-pinning at the connection layer (dial the IP +
`Host` header, or an egress proxy — Stripe's Smokescreen), which `neon()`/Workers
`fetch` don't expose — so the documented sub-TTL residual is correct and
**accepted for the BYO threat model** (user-supplied host ⇒ self-attack), with
the revisit trigger (non-BYO outbound path) intact. **Measured:** pinned grep
(case-insensitive `Resolved|Shipped|~~|Parked|Deferred|Decided:|Closed` under
`## Open questions`) = **25 → 24**. **KPI:** GLOBAL-025 engine-quality/UX — a
resolved security decision means the next agent applies the BYO egress contract
without re-deriving it (clarity increases, D3). **None degrade:** `typecheck`
clean, `lint` clean on the changed doc, workspace `test` green; docs-only (one
`byo-connect/FEATURE.md` bullet + scorecard rows #17 / Last-change), zero
code/web/queue. Engine baselines byte-untouched.

**Sources (P2):** [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) ·
[thingsboard #15253 (allow-list + re-resolve fix)](https://github.com/thingsboard/thingsboard/pull/15253) ·
[postiz GHSA-f7jj-p389-4w45 (TOCTOU DNS rebinding)](https://github.com/gitroomhq/postiz-app/security/advisories/GHSA-f7jj-p389-4w45)

**2026-07-08 (run 22)** — lever: **surface yield (row #7) — syndication feeds
0 → 1** (PR #631): shipped the blog's first RSS 2.0 feed (`rss.xml.ts` over
`data/blog.ts`, no dep — GLOBAL-013; site-wide autodiscovery) to close the
un-subscribable-blog yield leak (feed readers + dev.to/Medium/Hashnode import).
Build-verified valid feed, 20 posts, `rss.xml.test.ts` 5/5; internal links
2451 → 2555. Full detail in git (#631).
