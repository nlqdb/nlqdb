# Automated ICP Validation Plan

> **Governance ([GLOBAL-028](../decisions/GLOBAL-028-acquisition-progress-tracker.md)
> · [GLOBAL-029](../decisions/GLOBAL-029-acquisition-verification-tracker.md)
> · [GLOBAL-030](../decisions/GLOBAL-030-evidence-grade-acquisition-tracker-edits.md)):**
> This is the canonical acquisition **implementation** progress tracker.
> Its mirror, [`automated-icp-validation-plan-verification.md`](./automated-icp-validation-plan-verification.md),
> is the canonical **verification** tracker — every `FLOW-NNN` in §8
> below appears there with the same ID. Both files are exempt from
> the 20 KB cap and both are agent-ran: every PR that implements a
> section here must update `## Current status` and append a row to
> `## Progress log`; every PR that adds, modifies, or supersedes a
> flow updates BOTH files in lockstep. Evidence/status edits must name
> the agent-run verification artifact and pass the GLOBAL-030 self-review.

> **Operator loop — read this first.** The founder runs one prompt
> periodically. That is the entire human input. No notifications go
> back to the founder; no LogSnag bell, no inbox, no triage queue.
> Each agent run *is* the cron: read this preamble, pick the
> top-priority slice from "What the next agent should pick" below,
> do it, verify it against the real deployed surface, write evidence
> in this file's `## Progress log` and (for flows) the verification
> mirror, open a PR. If verification fails, that failure IS the next
> priority — don't pile on new surfaces on top of a broken funnel.
>
> **Shipped ≠ verified ≠ useful.** Counting shipped surfaces lies to
> us by design. The only progress that matters is "a stranger landed
> and got first-value." §1.1 stranger-test, §1.2 KPI dashboard, and
> §1.3 in-app survey are the anti-self-deception layer; until they
> ship, *every other acquisition surface's KPI is suspect* — we can
> drive traffic without knowing whether it converts, churns, or
> bounces silently. That's the bar §3 cannot legitimately clear yet.
>
> **Real blocker is engine quality, not surfaces (2026-05-24 founder
> directive).** Every advertised acquisition surface gate-403s at
> `/v1/ask` because the free-chain BIRD is 0.318 (target 0.65) and
> Spider is `null` (target 0.75) per
> [`apps/api/src/gate/eval-baseline.ts`](../../apps/api/src/gate/eval-baseline.ts) /
> [`SK-GATE-001`](../features/pre-alpha-gate/FEATURE.md#sk-gate-001) /
> [`SK-GATE-002`](../features/pre-alpha-gate/FEATURE.md#sk-gate-002).
> The gate is doing exactly what GLOBAL-027 asks it to ("don't show
> bad NL→SQL to strangers") — *removing* the gate before BIRD/Spider
> clear ships bad answers to every ICP we acquire, which is worse
> than the current "0 validated users." The acquisition tracker's
> bottleneck is therefore [`quality-eval`](../features/quality-eval/FEATURE.md)
> velocity, not new surfaces. Acquisition work that *doesn't* move
> BIRD/Spider is deferred until either threshold clears or the
> §1.4 invite valve carries a stranger across the gate intact.
>
> **What the next agent run should pick (2026-05-24, in order — items 1–3 outrank 4+ unconditionally):**
> 1. **Engine quality — close the BIRD gap and unblock the Spider lane.**
>    BIRD 0.318 vs 0.65 target (49% of bar); Spider null vs 0.75 (loader
>    + scorer shipped 2026-05-19 per [`SK-QUAL-007`](../features/quality-eval/FEATURE.md) +
>    [`SK-QUAL-008`](../features/quality-eval/FEATURE.md) — first
>    measurement seeds `eval-baseline.ts` on the next weekly cron).
>    Highest-leverage pickable work, in order: (a) verify the next
>    `quality-eval-spider2-lite.yml` cron run lands a real `spider_accuracy`
>    in `eval-baseline.ts` (Tue 04:00 UTC; if the run failed, fix the
>    pipeline before anything else); (b) close the free-vs-agentic-frontier
>    delta surfaced by [`SK-QUAL-009`](../features/quality-eval/FEATURE.md) —
>    every point that delta narrows is a point the free chain reclaims
>    inside the gate; (c) push BIRD via free-chain scaffolding work
>    (prompt + retry-on-exec-error already wired per `SK-QUAL-009`) —
>    target +5pp/week until 0.65.
> 2. **§1.4 invite-valve regression watch — now continuous (2026-05-24
>    re-walk passed).** FLOW-004 passed again end-to-end via
>    `scripts/flow-004-walk.sh` ([`SK-STRG-002`](../features/stranger-test/FEATURE.md))
>    — mail.tm → waitlist → Resend invite → `X-Invite-Code` → HTTP 200
>    on `/v1/ask` (11s email latency, 18s wall, control 403). The
>    daily cron is **shipped** as [`SK-STRG-003`](../features/stranger-test/FEATURE.md)
>    ([`.github/workflows/acquisition-health.yml`](../../.github/workflows/acquisition-health.yml))
>    — runs all three walkers at 06:00 UTC, uploads JSON results as a
>    90-day artifact, exits 0 unconditionally so no founder-facing email
>    channel is created. Next agent reads `acquisition-health-<run_id>`
>    via `mcp__github__list_workflow_runs` to spot a regression before
>    strangers do.
> 3. **§1.2 KPI dashboard** — [`SK-ONBOARD-005`](../features/onboarding/FEATURE.md)
>    pulled forward; expose the `bird_accuracy` / `spider_accuracy` /
>    gate-block-rate tiles alongside the onboarding tiles so the
>    engine-quality bottleneck is visible from the same `build-log`
>    panel. Doubles as build-in-public (§3.2).
> 4. **§1.3 in-app survey** — PostHog free tier; Sean Ellis Q1 fires
>    only after the invite-valve carried the user across the gate, so
>    "what blocked you" is a real product question, not "the gate
>    blocked me."
> 5. **§1.1 daily cron landed (SK-STRG-003); R2 archive deferred.** The
>    daily walker cron ships with priority #2 in the same workflow
>    (`acquisition-health.yml`). R2 archive + diff-against-prior-run
>    slices remain open in `stranger-test/FEATURE.md` — current GH
>    Actions artifact retention (90 days) covers the cold-start window;
>    R2 follow-up lands when either retention proves too short or a
>    real `diff` consumer exists.
> 6. **§3.1 next 10 solve pages** — only after #1–#2 (don't AEO-trap
>    visitors into a gate-403 they can't cross; once invite-valve
>    verified, each `/solve/` page can carry `?invite=` for press
>    launches per §3.3).
> 7. **§3.5 `examples/` per cluster + `nlqdb.com/gallery`** — only
>    after #1–#5 (don't drive traffic to an unmeasured funnel).
> 8. **Show HN / Product Hunt push (§3.3)** — only after #1–#7 AND
>    either BIRD/Spider thresholds clear OR the invite-valve verifies
>    end-to-end (the launch-URL `?invite=<code>` amendment in §3.3).
>
> **What's shipped today** (evidence in `## Progress log`, not prose):
> §1.1 stranger-test primitive ([`tools/stranger-test/`](../../tools/stranger-test/) — Playwright walker for FLOW-001/002/003, now with [`SK-STRG-004`](../features/stranger-test/decisions/SK-STRG-004-invite-bearing-composer.md) invite-bearing variant) ·
> §1.1+§1.4 **daily acquisition-health cron** (SK-STRG-003; [`acquisition-health.yml`](../../.github/workflows/acquisition-health.yml) walks all three scripts at 06:00 UTC, exits 0, 90-day artifact) ·
> §1.1 **invite-bearing composer** ([`scripts/stranger-test-invited.sh`](../../scripts/stranger-test-invited.sh) — mints one invite via FLOW-004 then drives browser walks; 2026-05-24 first run reached HTTP 200 on `/v1/ask` for the first time AND caught + fixed a `captureInviteFromUrl` regression on `/solve/`+`/vs/`) ·
> §1.4 gate-valve **end-to-end verified** ([`scripts/flow-004-walk.sh`](../../scripts/flow-004-walk.sh)
> — mail.tm + curl walker; 6 passes 2026-05-24 across direct + composer invocations) ·
> §2.2 collection (HN+Reddit+GH+GHD+SO+IH+Dev.to+Bluesky) · §2.3 scoring + clustering + verdict · §2.1
> GitHub Issues + GitHub Discussions + Stack Overflow + Indie Hackers + Dev.to + Bluesky sources · §3.1 first 5
> solve pages (paraphrased `<h1>`; now invite-aware) · §8 mirrored flow trackers (8 flows:
> 4 walker-evidenced = FLOW-001 (passed invite-bearing) + FLOW-002/003 (regression discovered + fixed) + **FLOW-004 (passed 6×)**,
> 1 curl-partial = FLOW-005, 1 cron source-health = FLOW-008, 2 unattempted
> = FLOW-006/007) · [`scripts/verify-flows.sh`](../../scripts/verify-flows.sh)
> (curl-observable subset; egress-policy aware) · [`scripts/stranger-test.sh`](../../scripts/stranger-test.sh)
> (browser-observable subset; sub-7s for 9 walks; no operator action). First ICP cron
> fires Mon 2026-05-26 06:00 UTC.
>
> **Context.** Every advertised surface
> ([`progress.md §0`](../progress.md)) shipped; zero validated users.
> [`founder-playbook.md`](../founder-playbook.md) assumes 1:1 calls;
> the founder rejects them — that's why "get real users" needs §1.4's
> release-valve and "validate" needs to be async per §1.3 / §4.
>
> **Cross-refs:** [personas.md](./personas.md) ·
> [email-and-marketing.md](./email-and-marketing.md) ·
> [phase-1-exit-criteria.md](./phase-1-exit-criteria.md) ·
> [GLOBAL-024](../decisions/GLOBAL-024-demand-signal-telemetry.md) ·
> [GLOBAL-025](../decisions/GLOBAL-025-north-star.md) ·
> [GLOBAL-027](../decisions/GLOBAL-027-pre-alpha-gate.md) ·
> [GLOBAL-030](../decisions/GLOBAL-030-evidence-grade-acquisition-tracker-edits.md).

---

## Current status (updated 2026-05-24)

| KPI | Target | Status |
|---|---|---|
| Free-chain BIRD accuracy | ≥ 0.65 | **0.318** as of 2026-05-18 ([`eval-baseline.ts`](../../apps/api/src/gate/eval-baseline.ts)) — **the real acquisition bottleneck per the 2026-05-24 founder directive**; closing this lifts the gate for every surface §3 ships |
| Free-chain Spider accuracy | ≥ 0.75 | **null** — loader + canonical multi-CSV scorer shipped 2026-05-19 ([`SK-QUAL-007`](../features/quality-eval/FEATURE.md) + [`SK-QUAL-008`](../features/quality-eval/FEATURE.md)); first measurement seeds `eval-baseline.ts` on the next [`quality-eval-spider2-lite.yml`](../../.github/workflows/quality-eval-spider2-lite.yml) Tue 04:00 UTC cron |
| Anonymous loop completions | ≥ 50 | 0 — gate 403s every walked `/v1/ask` (2026-05-24 stranger-test); **stays 0 until BIRD/Spider clear OR §1.4 invite-valve verifies end-to-end** |
| Signed-in users (invite-redeemed) | ≥ 10 | 0 real-user redemptions, but FLOW-004 end-to-end **verified 3× on 2026-05-24** + **continuous daily regression watch** under `.github/workflows/acquisition-health.yml` ([SK-STRG-003](../features/stranger-test/FEATURE.md)) — the path a real stranger would take is proven to work end-to-end and now self-monitors at 06:00 UTC daily |
| Sean Ellis Q1 responses | ≥ 20 | 0 — survey not wired (§1.3); meaningful only after a user actually crosses the gate |
| Primary ICP shortlist | exactly 1 | pending first cron Mon 2026-05-26 (verdict logic shipped 2026-05-22) |
| TTFV p50 | ≤ 60 s | 156 ms time-to-`/v1/ask`-response on the 2026-05-24 walk — every response is the gate 403, NOT first-value |
| First-query success | ≥ 60% | 0/9 walked runs reached a 200 on 2026-05-24 — same gate-403 cause as the anon-loop row |
| Stranger-test passes | 100% daily | primitive shipped ([`SK-STRG-001`](../features/stranger-test/FEATURE.md), `bash scripts/stranger-test.sh`); 0/9 walked runs passed today because of the gate; daily cron unshipped |

The preamble's "What the next agent should pick" is the canonical
priority order; this table is the receipts. Two BIRD/Spider rows lead
because the gate is doing what GLOBAL-027 asks it to — every other 0%
row in this table inherits from those two. The TTFV / first-query /
stranger-test rows have honest measurements thanks to the 2026-05-24
walker; they are 0% not because the static surface is broken
(FLOW-002 step 8 event-spy, FLOW-003 step 9 `/llms.txt`, every hero /
FAQPage / honest-limits assertion passes) but because every `/v1/ask`
returns `feature_gated` until BIRD/Spider clear or the invite-valve
carries the user across.

---

## 0. Goals and non-goals

**Goal — 6 weeks, $0 ongoing spend, zero 1:1 calls, zero founder
notifications, land on:**

- One primary ICP with 5+ verbatim pain quotes in an evidence file.
- ≥50 anonymous + ≥10 signed-in users through the onboarding loop
  against a real LLM (not canned demo).
- ≥20 Sean-Ellis Q1 responses with distribution attached.
- A dashboard the founder can glance at when they want to, never
  has to. Promote/iterate/cut signals come from the data, not alerts.

Operator model + measurement bar are in the top preamble — don't
re-derive them here.

**Non-goals.** Calls, cold email, paid ads, AppSumo, lifetime deals,
new surfaces, persona expansion past P1/P2/P3/P6, and any
founder-facing notification channel (no LogSnag-to-founder, no
on-failure email, no Slack ping — agents handle failures by
re-prioritising, not by paging the operator).

---

## 1. Phase A — Anti-self-deception layer (BLOCKING — outranks all §3)

**This is the layer that detects "people land and bounce" within
days, not months.** Until §1.1, §1.2, and §1.3 ship, no §3 KPI can
be trusted — every visitor we drive is a coin-flip we can't measure.
§1.4 (release-valve) shipped 2026-05-21 and unblocks traffic *for
invite-bearing visitors only*; the remaining three are the only
reason any later acquisition push isn't a year-long self-deception.

**Engine quality sits above this whole layer.** Per the 2026-05-24
founder directive, BIRD 0.318 and Spider `null` are the actual
acquisition bottleneck: even if §1.1–§1.4 all ship, a stranger who
crosses the gate via an invite still meets a free chain that's
wrong roughly 2 out of 3 queries. That's a worse first-impression
than the gate. So [`quality-eval`](../features/quality-eval/FEATURE.md)
velocity is the real priority — this phase exists to keep §3
honest *while* engine work lifts the gate.

Surfaces are documented in
[`onboarding/FEATURE.md`](../features/onboarding/FEATURE.md) and
[`web-app/FEATURE.md`](../features/web-app/FEATURE.md); what isn't
done is end-to-end stranger-test, instrumented baselines, and the
in-product survey trigger.

### 1.1 Stranger-test the happy path with synthetic agents

Headless Playwright walker from a non-Worker IP hits the deployed
`nlqdb.com`, types a seeded "what are you building" prompt, submits
the hero, runs a follow-up, and grades each step against the
verification mirror's walkthrough. 25 seeded prompts pinned to the
P1×10 / P2×8 / P3×4 / P6×3 split. Pass = every step ok, no 4xx
(other than the gate's `feature_gated`), TTFV < 60 s p95.

> **✅ PARTIAL IMPLEMENTED 2026-05-24 (primitive — daily cron unshipped):**
> [`tools/stranger-test/`](../../tools/stranger-test/) ships a `bash scripts/stranger-test.sh`
> walker covering FLOW-001 (homepage hero), FLOW-002 (`/solve/<slug>`),
> and FLOW-003 (`/vs/<slug>`). One shared Chromium + per-walk contexts
> (per [`SK-STRG-001`](../features/stranger-test/FEATURE.md)). 25
> seeded prompts in `tools/stranger-test/src/personas.ts` ([P1×10,
> P2×8, P3×4, P6×3](../features/stranger-test/FEATURE.md)). 9 walks
> (3 prompts × 3 flows) complete in ~7 s with one shared browser; each
> walk capped at 180 s by `withDeadline`. JSON output to
> `tools/stranger-test/results/walk-<utc>.json`. Exit-code non-zero on
> any failure; no LogSnag, no email, no webhook (operator loop
> intact). Live 2026-05-24 walk against `https://nlqdb.com`: 0/9
> passed; every run gate-fails at `/v1/ask` with `403 feature_gated`
> (FLOW-001 step 5, FLOW-002 step 9, FLOW-003 step 8) — which proves
> the binding gap is the §1.4 anon-bypass tension, NOT any
> static-surface regression. FLOW-002's prior "step 8 event-hook
> missing" finding is corrected: the spy ran on a freshly-navigated
> page; with sessionStorage persistence the `solve.try_query_clicked`
> event IS observed. Open: daily cron + R2 archive + diff-against-prior
> JSON (see [`SK-STRG-001`](../features/stranger-test/FEATURE.md)
> open questions).

### 1.2 Wire the four onboarding KPIs to a live dashboard

[`SK-ONBOARD-005`](../features/onboarding/FEATURE.md) commits the
instrumentation with baseline by **2026-06-01** (11 days out). Pull
forward to Week 1.

Emit `onboarding.{landing.viewed, first_query.{attempted,succeeded,failed}, second_query.attempted}`
via [`packages/events`](../../packages/events). Run the async LLM-judge
on every first-query (free chain, `ctx.waitUntil`). Surface five tiles
in a public-read Grafana panel `onboarding-kpis`: TTFV p50/p95, success
rate, drop-off rate, first→second rate, gate-block rate
([SK-GATE-006](../features/pre-alpha-gate/FEATURE.md)). Share-link on
`nlqdb.com/build-log` — doubles as build-in-public artifact (§3.2).

### 1.3 Ship the async in-app survey widget

**Recommendation: PostHog Cloud free tier** (1M events/mo, surveys +
funnels + replay in one). [`email-and-marketing.md §4`](./email-and-marketing.md)
already holds PostHog "in reserve for Phase 2 if a real cohort question
lands". This is that moment. Fallback: Formbricks (open-source,
self-host on Workers).

Three triggers:

- **Sean Ellis Q1** — fires when `onboarding.second_query.attempted` AND
  `session_day ≥ 7` (the user's been around long enough to have a view).
  One question: "How would you feel if you could no longer use nlqdb?
  (very/somewhat/not disappointed / N/A)". No follow-up modals.
- **Persona-extraction** — after Q1 answered, one text line: "In one
  sentence: what are you trying to build?" (Q2 of the founder-playbook
  script; captures language unprompted).
- **Drop-off recovery** — on `onboarding.first_query.failed`, one
  radio: "What blocked you? (a) the answer was wrong (b) the UI was
  confusing (c) I expected something else (d) I changed my mind".

Responses → LogSnag `#north-star` + D1 `survey_response` (PII-free,
anon device or principal). Event-based triggers hit 25–40% response
vs 5–15% for email
([Zonka 2026](https://www.zonkafeedback.com/blog/best-in-app-survey-tools));
20 responses ≈ 50–80 qualifying sessions.

### 1.4 Resolve the pre-alpha-gate paradox

**Biggest blocker.** Gate returns 403 today; without a valve, every §3
visitor sees the waitlist CTA, not the product.

**Proposed:** auto-issue invite codes on homepage `#waitlist` submit,
capped **N=200/week**, delivered via existing Resend template
([§1](./email-and-marketing.md)). Cap protects free LLM daily quota
([phase-1-exit-criteria item 4](./phase-1-exit-criteria.md)). Auto-
issuance keeps founder out of the loop. One-use, 80-bit entropy
([SK-GATE-003](../features/pre-alpha-gate/FEATURE.md)), 30-day expiry.

**Alternative if rejected:** invite codes embedded in launch-URL
(`?invite=<code>`) for Show HN / build-in-public threads (§3.3). The
homepage auto-applies via `X-Invite-Code` header. Single-shot, auditable,
no email infra.

Either way: gate must open for §3 visitors or §2/§3 are wasted.
Flagged in §6.

> **✅ IMPLEMENTED 2026-05-21 (Option A — auto-issue on signup):**
> `POST /v1/waitlist` now auto-issues a 128-bit invite code to every new
> signup via Resend. Cap: 200/week. Code TTL: 30 days. Browser side:
> `?invite=<code>` URL param captured on the homepage and `/app/new`,
> stored in `localStorage["nlqdb_invite"]`, forwarded as `X-Invite-Code`
> header on every `/v1/ask` call. Canonical decision: SK-GATE-007.

---

## 2. Phase B — Automated ICP discovery (Weeks 1–2, parallel to §1)

Existing personas ([personas.md](./personas.md)) are hypotheses, not
validated pain. Mine public complaints, score against persona pain
bullets, let the data pick.

**Owner:** one Cloudflare cron Worker + free-chain LLM pipeline.
**Exit gate:** `docs/research/icp-evidence-<yyyy-mm>.md` with ≥50
verbatim quotes per priority persona, clustered.

### 2.1 Sources

| Source | API | Free? | Persona signal |
|---|---|---|---|
| Reddit listings | `r/X.json` ([2026 pricing](https://painonsocial.com/blog/how-much-does-reddit-api-cost) — free for non-commercial) | Y | P1/P2/P3/P5 |
| Hacker News | [HN Algolia](https://hn.algolia.com/api) | Y | P1/P2/P6 |
| GitHub issues | [search/issues](https://docs.github.com/en/rest/search/search) (30 RPM authed) | Y | P1/P2/P6 ✅ shipped |
| GitHub Discussions | [GraphQL `search(type:DISCUSSION)`](https://docs.github.com/en/graphql/reference/queries#search) (5000 pts/hr authed) | Y | P1/P2/P4/P6 ✅ shipped 2026-05-31 |
| Indie Hackers | `feed.indiehackers.world` JSON Feed (unofficial mirror) | Y | P1 ✅ shipped |
| Stack Overflow | [SE API 2.3](https://api.stackexchange.com) (anon 300/IP/day) | Y | P1/P3/P4/P6 ✅ shipped |
| Dev.to (Forem) | [public `/api/articles`](https://developers.forem.com/api/v1) (~3 RPS anon) | Y | P1/P3/P4 ✅ shipped 2026-05-25 |
| Bluesky (AT Protocol) | [`app.bsky.feed.searchPosts`](https://docs.bsky.app/docs/api/app-bsky-feed-search-posts) on `api.bsky.app` (no auth, "generous" rate-limits) | Y | P1/P2/P3 ✅ shipped 2026-06-01 |
| Discord publics | webhook bridges on specific guilds | Y if invited | P2 |
| F5Bot | keyword email alerts | Y | all |
| X/Twitter | — | **skip** (no free post-2023) | — |

**Subreddits:** `r/SaaS`, `r/sideproject`, `r/webdev`, `r/nextjs`,
`r/SQL`, `r/PostgreSQL`, `r/programming`, `r/learnprogramming`,
`r/dataengineering`, `r/clickhouse`, `r/devops`, `r/LocalLLaMA`,
`r/ClaudeAI`, `r/LangChain`, `r/MachineLearning`, `r/Database`
(matches [founder-playbook.md §1](../founder-playbook.md) "where they
hang out").

**HN queries:** `hate writing SQL`, `text to SQL`, `natural language
database`, `agent memory`, `MCP server`, `Postgres setup`, `Retool
alternative`, `Metabase too slow`, `vector DB`, `pgvector`.

**GH issue queries:** `is:issue "text to sql"`, `is:issue "natural language" database`, `is:issue "ai agent" memory store`, `is:issue "query builder" too verbose`, `is:issue prisma migration overhead` — each appended with a rolling `created:>${last-7-day-iso-date}` filter to keep signal current.

### 2.2 Scrape stack — one Worker, free chain, weekly cron

> **✅ IMPLEMENTED 2026-05-21 (Slice 1 — data collection):**
> `runIcpScrape` added to the existing `nlqdb-api` Worker as a cron
> (`0 6 * * 1`, Mon 06:00 UTC). Sources: HN Algolia (5 queries) + Reddit
> (3 subreddit/query pairs). Dedup via `icp:seen:<source>:<id>` KV (90d
> TTL). Items stored as `icp:item:<YYYYMMDD>:<source>:<id>` KV (30d TTL).
> LogSnag `#icp-mining` notified after each run. Canonical decision: SK-ICP-001.
>
> **✅ EXPANDED 2026-05-22 (GitHub Issues source — SK-ICP-004):**
> When `GH_TOKEN` is set, `runIcpScrape` additionally queries GitHub Search
> Issues API (5 queries, rolling `created:>${last-7-day-iso-date}` filter,
> 10 results each). Items stored as `source: "github"`, deduped same as
> HN/Reddit.
>
> **✅ EXPANDED 2026-05-23 (Stack Overflow source — SK-ICP-005):**
> `runIcpScrape` additionally queries the Stack Exchange API 2.3
> `/search/advanced` endpoint (`site=stackoverflow`, 5 tag+query pairs,
> 7-day `fromdate`, anonymous quota 300/IP/day). Items stored as
> `source: "stackoverflow"`, `id: "so-<question_id>"`; LogSnag adds
> `SO: <n>` to the per-run line. Live API probe 2026-05-23 from this
> environment returned 1 fresh `postgresql/setup` question with
> `quota_remaining=299`, `backoff=None`.
>
> **✅ EXPANDED 2026-05-23 (Indie Hackers source — SK-ICP-006):**
> `runIcpScrape` additionally queries the unofficial
> `feed.indiehackers.world` JSON Feed for 5 P1-pain queries
> (`database`, `boilerplate`, `side+project`, `first+paying`, `stack`).
> Items stored as `source: "indiehackers"`, `id: <slug-from-/post/-url>`;
> server-side date filter is unavailable on the mirror so the 7-day
> window is enforced client-side after parsing `date_modified`; posts
> with unparseable date or non-conforming URL are dropped before KV
> write. LogSnag adds `IH: <n>` to the per-run line. Live probe
> 2026-05-23 against `?q=database&exclude=link-post` returned `200, 100
> items, 2 within 7-day window` — modest but unique P1 cohort signal
> (≈10 new IH items/week across 5 queries).
>
> **✅ EXPANDED 2026-05-25 (Dev.to source — SK-ICP-008):**
> `runIcpScrape` additionally queries the Forem public API at
> `https://dev.to/api/articles?tag=<tag>&per_page=15&top=7` for 5 tag
> queries covering P1/P3/P4/P6 (`database`, `sql`, `postgres`, `webdev`,
> `orm`). `top=7` is the server-side 7-day filter so the cron stores
> only fresh items without a client-side date pass. Articles stored as
> `source: "devto"`, `id: "devto-<article.id>"` (the `devto-` prefix
> prevents collisions with other numeric-ID sources); articles with
> unparseable `published_timestamp` are dropped before KV write.
> `User-Agent: nlqdb-icp-bot` + `AbortSignal.timeout(10s)`; per-tag
> errors caught. LogSnag adds `DEV: <n>` to the per-run line. Live
> probe 2026-05-25 against each of the 5 tags returned `HTTP 200` with
> ≥4 fresh articles per tag inside the `top=7` window — comfortably
> above the existing source mix. No env binding required (public
> documented API per [`developers.forem.com`](https://developers.forem.com/api/v1)).
>
> **✅ EXPANDED 2026-06-01 (Bluesky source — SK-ICP-012):**
> `runIcpScrape` additionally calls the AT Protocol AppView at
> `https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=<q>&limit=25&sort=latest&since=<isoSeven>`
> for 5 P1/P2/P3 queries (`text to sql`, `agent memory`,
> `natural language database`, `vector database`, `rag pipeline`). Stored
> as `source: "bluesky"`, `id: "bsky-<post.cid>"`; URL rebuilt as
> `https://bsky.app/profile/<author.handle>/post/<rkey>` from the
> `at://.../app.bsky.feed.post/<rkey>` URI. `User-Agent: nlqdb-icp-bot`
> + `AbortSignal.timeout(10s)`; per-query error isolation; posts with
> unparseable `record.createdAt`, missing handle/rkey/cid,
> non-`app.bsky.feed.post` URI or empty text are dropped pre-write.
> LogSnag adds `BSKY: <n>` after `DEV: <n>`. Live probe 2026-06-01 from
> this VM: 5 fresh posts for `text to sql` in the past 7 days including
> `"My SQL bot dies after two questions! Did you read the JP Morgan study?"`
> — exactly the P2 (agent builder) language the prior 7 sources never
> caught; `agent memory` / `vector database` / `rag pipeline` each returned
> 10/10. `public.api.bsky.app` 403'd from this agent VM 2026-06-01
> (BunnyCDN block; not re-verified from CF Workers egress);
> `api.bsky.app` is the canonical Express AppView and serves the
> same payload without that block. No env binding (public unauthenticated
> read; AT Protocol AppView read endpoints are documented as no-auth with
> "generous" rate-limits per [`docs.bsky.app`](https://docs.bsky.app/docs/advanced-guides/rate-limits)).
>
> **✅ EXPANDED 2026-05-31 (GitHub Discussions source — SK-ICP-009):**
> When `GH_TOKEN` is set, `runIcpScrape` additionally POSTs the GitHub
> GraphQL endpoint (`https://api.github.com/graphql`) with
> `search(query: $q, type: DISCUSSION, first: 10)` for 5 P1/P2/P4/P6
> queries (`text to sql`, `natural language database`, `agent memory store`,
> `prisma migration`, `supabase setup`), each appended with the same
> rolling `created:>${isoDate(sevenDaysAgoUnix)}` filter SK-ICP-004 uses
> for Issues. Discussions stored as `source: "github_discussions"`,
> `id: "ghd-<node.id>"`; nodes with unparseable `createdAt` are dropped
> before KV write; a GraphQL `errors` body is treated as a soft failure
> (other 6 sources unaffected). `Authorization: Bearer $GH_TOKEN` +
> `User-Agent: nlqdb-icp-bot` + `X-GitHub-Api-Version: 2022-11-28` +
> `AbortSignal.timeout(10s)`. LogSnag adds `GHD: <n>` between `GH:` and
> `SO:`. Live probe 2026-05-31 from this environment:
> `text to sql` → `discussionCount=8478`; `natural language database
> created:>2026-05-24` → 9 fresh discussions including
> `moorcheh-ai/memanto/discussions/564 — "How are you handling persistent
> memory in your CrewAI workflows?"` — exactly the P2 (agent builder)
> long-form pain signal the prior 6 sources never caught. `rateLimit.cost=1`
> per search × 5 queries/week = 5 points against the 5000-point/hour
> authenticated bucket.

- One Cloudflare cron Worker runs Mon 06:00 UTC (same slot as
  [quality-eval](../features/quality-eval/FEATURE.md) — share infra).
  Pulls last week's posts + comments; dedupes by `(source, item_id)`;
  writes raw to KV (R2 upgrade tracked as open question in icp-mining FEATURE.md).
- Reddit via direct `.json` listings (no key for public read). HN via Algolia.
- Budget guard: ≤100 items/week × 2 KV writes each, well inside free tier.

### 2.3 LLM scoring — persona-fit rubric

> **✅ IMPLEMENTED 2026-05-21 (Steps 1–2 — filter + score):**
> `runIcpScore` in `icp-score.ts` runs immediately after each weekly scrape in the same cron slot.
> Step 1 (filter): regex prefilter on pain words (hate, frustrat, stuck, wish, verbose, boilerplate, …) applied to `title + text`.
> Step 2 (score): Groq `llama-3.1-8b-instant` → Gemini `gemini-2.5-flash` fallback scores each passing item 0–10 for P1/P2/P3/P6; OTel span `nlqdb.icp.score` per batch.
> Items with max persona score < 5 are discarded; the rest stored as `icp:scored:<YYYYMMDD>:<source>:<id>` (30d KV TTL).
> Steps 3–4 landed 2026-05-22 — see the block below.
>
> **Source expansion (same PR):** HN queries 5 → 10 (added MCP server, Postgres setup, Retool alternative, vector DB, pgvector). Reddit 3 → 16 subreddit/query pairs (full plan §2.1 list).

LLM cluster — persona-fit rubric (all four steps implemented as of 2026-05-22):

1. **Filter** (free chain): regex prefilter on `pain | annoyed | hate
   | wish | stuck on | spent N hours | why is X so hard | any
   alternative to`; LLM yes/no on the 30% that survives.
2. **Score** (free chain, structured output): 0–10 per persona, against
   each persona's "Current pain" bullets in
   [personas.md](./personas.md). Output
   `{persona_id, score, supporting_quote (≤280ch), source_url}`.
3. **Cluster** (weekly batch, free chain): top 100 rows per persona →
   5–7 themed clusters with a one-sentence label + strongest verbatim
   quote per cluster.
4. **Persist** to `docs/research/icp-evidence-<yyyy-mm>.md` via GitHub
   Contents API `PUT` (checks existing SHA; writes directly to `main`).
   Evidence file includes cluster table + top-20 raw items per persona.

> **✅ IMPLEMENTED 2026-05-22 (Steps 3–4 — cluster + evidence file):**
> `runIcpCluster` in `icp-cluster.ts` lists all `icp:scored:*` KV keys
> (paginated), groups by best persona (top-100 each), calls Groq →
> Gemini fallback to cluster into 5–7 themes per persona, generates
> `docs/research/icp-evidence-<yyyy-mm>.md`, and writes it to GitHub
> via Contents API. First evidence file will auto-generate Mon 2026-05-26.
> Canonical decisions: SK-ICP-003 (cluster), SK-ICP-004 (GitHub Issues source).

Anthropic's case study on structured LLM analysis of interviews
([HN Dec 2025](https://news.ycombinator.com/item?id=46331877))
is a useful reference for structured LLM-assisted theme extraction, not proof that the pipeline is better than human coding.

### 2.4 Decision rule — narrow to 1 ICP

| Condition | Action |
|---|---|
| One persona ≥3× weighted score of any other AND ≥30 quotes | Promote to "primary ICP 2026-Q3". Park others. |
| Two personas within 30% AND together ≥60% of weighted score | Run both Week 3, narrow at end of Week 4. |
| No persona clears ≥10 quotes | Plan failed (search terms wrong). Iterate keywords; do NOT widen persona list. |

Decision = founder reads the evidence file on a Sunday. No human is
interviewed.

> **✅ IMPLEMENTED 2026-05-22 (verdict automation):**
> `runIcpCluster` now applies the rule itself: each evidence file opens
> with a `§2.4 Decision rule` block stating `primary_confirmed`,
> `directional`, or `no_signal` and naming the leading persona. The same
> verdict is exposed on `IcpClusterResult.{primaryStatus, primaryIcp}` —
> the cron's `icp_cluster_completed` log and the per-run LogSnag entry
> carry it too, so the founder learns the answer without opening the
> file. Canonical decision: SK-ICP-003.

---

## 3. Phase C — Frictionless user acquisition (Weeks 2–5)

The legitimate version of [founder-playbook.md §1](../founder-playbook.md)
recruitment, humans removed, inbound traps in their place. **Exit gate:**
§5.3 numbers.

### 3.1 Pain-driven content traps (SEO + AEO)

For every §2.3 cluster, publish one static Astro page at
`nlqdb.com/solve/<slug>` with: verbatim cluster quote as `<h1>` ·
working `<nlq-data>` embed answering the implied question · "this
works because" trace toggle showing compiled SQL
([SK-WEB-005](../features/web-app/FEATURE.md)) ·
`<link rel="canonical">` to source URL (credit complainer, don't
outrank) · JSON-LD `HowTo` + mirror to
[`code-samples.txt`](../../apps/web/public/code-samples.txt)
([SK-WEB-003](../features/web-app/FEATURE.md)) so LLM crawlers cite
as working example.

**Volume:** 15–25 pages by W3. Workers template + LLM fill-in from
cluster data; founder merges PR; no by-hand writing. Gartner forecasts large organic-search disruption by 2028
([2026 trend report](https://painonsocial.com/blog/best-pain-point-tool)).
AEO earns impressions now.

> **✅ IMPLEMENTED 2026-05-23 (first 5 hand-curated pages — pre-cluster):**
> `apps/web/src/data/solve.ts` (typed source of truth) + `apps/web/src/pages/solve/[slug].astro`
> (single Astro template, getStaticPaths). 5 pages shipped:
> `/solve/cheap-internal-dashboard` (P3), `/solve/give-ai-agent-persistent-memory` (P2),
> `/solve/skip-postgres-setup-side-project` (P1), `/solve/natural-language-sql-without-training-data` (P3),
> `/solve/ship-leaderboard-no-sql` (P1). Each page: AEO direct-answer
> capsule, `<nlq-data>` snippet embed, "What nlqdb actually does"
> bullets, mandatory "What nlqdb doesn't do here" honest-limits section,
> 3-5 FAQs (FAQPage JSON-LD), HowTo JSON-LD, ≥2 cited enduring
> discussion-hub URLs (no rot-prone single-thread URLs per SK-SOLVE-003).
> Sitemap + llms.txt updated automatically from the data file. "Try
> this query" CTA calls the client `emit("solve.try_query_clicked")` hook and
> seeds the `nlqdb_draft` localStorage slot before navigating to
> `/app/new`. **Deviation from plan literal wording:** `<h1>` is the
> paraphrased natural-language search query rather than a verbatim
> cluster quote — until the 2026-05-26 first cluster file lands there
> is no verbatim quote to cite without fabricating one, and SK-SOLVE-001
> records the trade-off. Canonical decisions: SK-SOLVE-001/002/003 in
> [`docs/features/solve-pages/`](../features/solve-pages/FEATURE.md).

### 3.2 Build-in-public — scheduled, never DMed

Already committed in [phase-plan.md §8](../phase-plan.md) and
[email-and-marketing.md §3](./email-and-marketing.md): 1 long-form
blog/week, 3 threads/week, 1 release/week.

**Make it automatic:**

- Weekly summary Worker reads `feature.eval.weekly`, the §1.2
  dashboard, and the §2.3 cluster file; drafts a thread + blog via
  free chain; opens PR with X / LinkedIn / IH variants.
- Posting stays manual (avoid platform TOS issues); content prep is
  automated.
- Anchors: Tue 09:00 UTC long-form, Wed + Fri 16:00 UTC threads
  ([2026 launch research](https://www.scrolllaunch.com/blog/product-hunt-alternatives-2026)
  — Tue–Thu engagement beats Mon/Fri).

### 3.3 Show HN / Product Hunt — single-shot, gate-aware

[founder-playbook.md §4](../founder-playbook.md) checklist is sound.
Two amendments:

- **Launch URL carries the gate-bypass.** `?invite=<code>` in the
  submitted URL (per §1.4 alternative). Without it, the gate 403 is
  the first impression — wasted launch.
- **Multi-platform sequence**
  ([2026 best-practices](https://www.scrolllaunch.com/blog/product-hunt-alternatives-2026)):
  W4 D-7 BetaList · D-3 dev.to + IH long-form (reuse top §3.1 page) ·
  D0 (Tue 06:00 PT) Show HN + `r/programming` · D+2 Product Hunt.
  One launch, not a campaign. "Pause paid work 48h post-submit" per
  founder-playbook.

Successful Show-HN drops 10k–50k visitors in 24h
([Markepear's HN guide](https://www.markepear.dev/blog/dev-tool-hacker-news-launch)).
§1.1 stranger-test exists so the funnel survives that spike.

### 3.4 Waitlist as the gate's pressure-relief valve

Reframe operationally: homepage `#waitlist` is the **primary growth
surface** for as long as the gate is closed.

- Form posts to `POST /v1/waitlist` (already shipped per
  [GLOBAL-027](../decisions/GLOBAL-027-pre-alpha-gate.md) tail).
- Worker enqueues Resend email with one-time invite code at the §1.4
  cap.
- Waitlist page renders **current gate state**
  ([SK-GATE-002](../features/pre-alpha-gate/FEATURE.md) BIRD/Spider
  progress bar) — honest about what they wait for; doubles as
  north-star ticker.
- Every signup fires `feature.requested.early_access` ([already
  wired](../features/pre-alpha-gate/FEATURE.md)) → §2 evidence file
  gains "intent to use", not just "pain in the wild".

### 3.5 Tractor beams — examples, gallery, comparison pages

- **GitHub `examples/` is the storefront.** Add one
  `examples/<persona>/<scenario>/` per §2.3 cluster. README + working
  snippet + `bun create` invocation + Deploy-to-CF button.
- **Hosted gallery `nlqdb.com/gallery`** — list of opt-in-public
  anon-mode databases. "21 people used nlqdb in the last 24h, here's
  what they built". Resolves the live-ticker open question in
  [web-app/FEATURE.md](../features/web-app/FEATURE.md).
- **`nlqdb.com/vs/<competitor>`** pages: WrenAI, Vanna, Chat2DB,
  Text2SQL.ai, Retool. Honest side-by-side, one shipped table per
  page. Outranks competitors in AEO because most don't ship
  comparison pages of their own.

### 3.6 Reply-to-pain — automated only as far as ethics allow

Closest to cold outbound; needs explicit founder say-so (§6).

§2 pipeline finds new high-scoring complaints in real time. For each,
Worker drafts a single reply that:

1. Acknowledges pain in OP's verbatim wording.
2. Links to the matching §3.1 `solve/` page (the **answer** to their
   specific question, NOT a marketing page).
3. Discloses authorship: `"(I'm building nlqdb — full disclosure)"`.
4. **Founder approves every reply** via 2-click queue at
   `nlqdb.com/internal/reply-queue`. Approved replies post from the
   founder's own Reddit/HN/GH account.

Stays inside [email-and-marketing.md §3](./email-and-marketing.md)
because (a) not cold — OP posted publicly asking for help, (b) the
reply is the answer they asked for, (c) authorship is disclosed. If
too close to the refuse line, **cut §3.6 entirely** — §3.1–§3.5
should hit the acquisition target alone.

---

## 4. Phase D — Automated PMF feedback capture (Weeks 1–6, continuous)

**Owner:** §1.3 widget + weekly digest cron. **Exit gate:** 20 Sean
Ellis Q1 responses by end of W6.

### 4.1 Sean Ellis Q1 as in-app survey

Wording verbatim from [founder-playbook.md §2](../founder-playbook.md):
"How would you feel if you could no longer use nlqdb? (very disappointed
/ somewhat disappointed / not disappointed / N/A)".

**Triggers** ([PMFsurvey.com guidance](https://pmfsurvey.com/) — only
survey users who've completed the core loop ≥2 times; Day-1 users
corrupt data): user has ≥2 `onboarding.first_query.succeeded` AND
most recent ≥24h ago. One survey per principal, ever.

Response posts `feature.pmf.sean_ellis_q1` with
`{response, principal_id_anon, query_count, days_since_first_query}`.

40%+ "very disappointed" is canonical PMF threshold
([Zonka template](https://www.zonkafeedback.com/templates/sean-ellis-product-market-fit-survey-template));
30–40% directional; <30% back to §2.

### 4.2 Q2–Q5 fanned across the session lifecycle

Original 5 questions were designed for 30-min calls. Async:

| Q | Trigger | Format |
|---|---|---|
| Q1 disappointment | After 2nd success +24h | radio (above) |
| Q2 "who else benefits" | After Q1 | one-line text |
| Q3 "main benefit" | After 5th query | one-line text |
| Q4 "almost stopped using for" | After 7d inactive then return | one-line text |
| Q5 "how to improve" | "Share feedback" button in `/app` chrome | textarea |

Verbatim into `survey_response` D1, with opt-in "email me a follow-up"
(one-way; we email, they don't have to reply).

### 4.3 Weekly LLM-judge digest

Sun 22:00 UTC cron Worker:

- Reads `feature.pmf.*`, `feature.requested.*`, `onboarding.*` (last 7d).
- Reads most recent §2.3 cluster file.
- Free-chain LLM produces 2-paragraph digest + 3 bullets ("biggest
  signal / blocker / ask").
- Output to LogSnag `#north-star` and
  `docs/digest/yyyy-ww.md` via nightly PR.
- Each entry tagged with a `feature.requested.*` event ID (per
  founder-playbook tagging discipline).

Async replacement for [founder-playbook.md §2](../founder-playbook.md)
"after every 3 interviews, theme-extract together".

### 4.4 Decision gates

| Signal | Action |
|---|---|
| ≥10 Q1, ≥40% VD | **PMF confirmed** for primary ICP. Trigger [phase-plan.md §6](../phase-plan.md) monetization-signal review. |
| ≥10 Q1, 25–40% VD | **Directional.** Iterate UX/onboarding; no monetization work yet. |
| ≥10 Q1, <25% VD | **Pre-PMF.** Re-run §2 using Q3 verbatim "main benefit" quotes as new search terms — reveals what users actually came for. |
| <10 Q1 by W6 | **Acquisition is bottleneck**, not product. Open retro on §3; do not falsely conclude pre-PMF. |

---

## 5. Sequence, budget, success criteria

### 5.1 Six-week calendar

| W | §1 Prep | §2 ICP | §3 Acquisition | §4 PMF |
|---|---|---|---|---|
| 1 | stranger-test · KPI panel · widget · gate-valve decision | sources shipped · scrape Worker live | (wait on §1) | survey wired |
| 2 | green every PR | first evidence PR | first 5 `solve/` pages | Q2–Q5 wired |
| 3 | — | cluster review → 1–2 primary ICPs | 10 more pages · gallery v0 · BetaList | first digest |
| 4 | — | (cont.) | Show HN + r/programming + dev.to | survey N≥5 |
| 5 | — | (cont.) | Product Hunt + IH long-form · §3.6 decision | survey N≥12 |
| 6 | — | (cont.) | hold · observe | survey N≥20 · §4.4 go/no-go |

### 5.2 Budget — $0 ongoing

Per [GLOBAL-013](../decisions/GLOBAL-013-free-tier-bundle-budget.md).
PostHog Cloud free (1M ev/mo) · CF Workers + R2 + KV free · Reddit/HN/
GH/SO APIs free (non-commercial) · F5Bot free · Resend existing 3k/mo ·
LogSnag existing 2.5k/mo.

If Reddit non-commercial gate re-interprets
([2026 pricing](https://painonsocial.com/blog/how-much-does-reddit-api-cost)),
cap at 1k/day/source. Apify $5/mo credit
([Reddit Pain Finder](https://apify.com/solutionssmart/reddit-pain-finder/api))
is the documented fallback.

### 5.3 Success criteria at W6

| KPI | Floor | Source |
|---|---|---|
| Anonymous loop completions | ≥ 50 | §1.2 dashboard |
| Signed-in users (invite-redeemed) | ≥ 10 | `gate:user:*` count |
| Sean Ellis Q1 responses | ≥ 20 | `feature.pmf.sean_ellis_q1` |
| "Very disappointed" share | report | directional, no floor |
| Primary ICP shortlist | exactly 1 | §2.4 rule |
| Q3 "main benefit" verbatim | ≥ 15 | `survey_response` D1 |
| TTFV p50 | ≤ 60s | [GLOBAL-025](../decisions/GLOBAL-025-north-star.md) |
| First-query success | ≥ 60% | LLM-judge |

Hit the first three → the founder has a defensible, evidence-backed
answer to "is this working?" — without one call.

---

## 6. Things flagged to the founder (per CLAUDE.md P1)

This plan contradicts or amends three documented decisions. Pick which
to supersede before §1.4 / §3.6 / §3.2 start.

1. **[GLOBAL-027 pre-alpha gate](../decisions/GLOBAL-027-pre-alpha-gate.md).**
   Gate is closed today; we can't get real users without a valve.
   §1.4 proposes auto-issued invite codes on waitlist signup OR
   launch-URL embedded codes. Either keeps the gate's spirit (no bad
   NL→SQL at scale) while enabling §3. **Decision (2026-05-24):**
   founder picked Option A — auto-issue invite codes on signup
   (`SK-GATE-007`, capped 200/week, shipped 2026-05-21). Crucially
   the founder also reaffirmed the gate's purpose: **don't remove
   the gate to get strangers in; lift it by clearing the BIRD/Spider
   thresholds.** That makes
   [`quality-eval`](../features/quality-eval/FEATURE.md) velocity
   the real acquisition gate, and acquisition surfaces are blocked
   on either (a) BIRD ≥ 0.65 AND Spider ≥ 0.75 clearing, or (b) the
   invite-valve verified end-to-end for the launch-URL path.
2. **[founder-playbook.md §1–§2](../founder-playbook.md)** DM →
   Calendly → 30-min calls. Founder rejects. Plan replaces with §1.3
   (in-app survey for the 5 questions), §2 (mining pain at scale),
   §4.3 (LLM digest instead of theme-extract calls). **Decision:**
   mark §1–§2 `Status: superseded by docs/research/automated-icp-validation-plan.md`
   per [CLAUDE.md §10.2](../../CLAUDE.md); OR keep both and let the
   founder pull the human-loop trigger if §4.4 hits <25% VD.
3. **[email-and-marketing.md §3](./email-and-marketing.md) refuse list.**
   §3.6 (reply-to-pain) flirts with the cold-outbound line. Proposed
   shape — public reply to public ask, founder-approved per-message,
   disclosed authorship, links to the answer not a signup — is one
   the founder might accept or reject. **Decision:** approve §3.6
   with the founder-approval gate, OR cut §3.6 entirely (§3.1–§3.5
   should hit the target alone).

If all three remain "no decision yet" — fine; §1 / §2 / non-3.6 §3 /
§4 can proceed independently. The plan only fails if §1.4 fails (gate
fully shut), because §3 then has nothing to point users at.

---

## 7. Promotion path

When results land, promote pieces per [CLAUDE.md §10](../../CLAUDE.md):

- §1.1 stranger-test → new feature
  [`stranger-test/FEATURE.md`](../features/stranger-test/FEATURE.md)
  with `SK-STRG-001` (the primitive). Daily-cron / R2-archive /
  diff-against-prior-run slices stay there as open questions until
  shipped.
- §1.2 KPI dashboard → pull baseline-date forward in existing
  [SK-ONBOARD-005](../features/onboarding/FEATURE.md).
- §1.3 widget → new `docs/features/in-app-survey/FEATURE.md` once
  trigger model stabilizes.
- §1.4 gate valve → amend
  [pre-alpha-gate/FEATURE.md](../features/pre-alpha-gate/FEATURE.md)
  with `SK-GATE-007 — Auto-issued invite codes`.
- §2 scrape stack → new `docs/features/icp-mining/FEATURE.md`.
- §3.1 `solve/` pages, §3.5 gallery, §3.6 reply queue → new SKs in
  [web-app/FEATURE.md](../features/web-app/FEATURE.md).
- §4.1–§4.3 → new SK in
  [onboarding/FEATURE.md](../features/onboarding/FEATURE.md) or new
  `pmf-survey/FEATURE.md`.
- Eventual "we picked persona X" is **not** an SK — it's the
  resolution of the open question in
  [personas.md §10.4](./personas.md), and an edit to that file's Phase
  1 priority ordering.

Until then, this file is the working plan, not a decision record.

---

## 8. User flows · implementation tracker

> **Governance ([GLOBAL-029](../decisions/GLOBAL-029-acquisition-verification-tracker.md)):**
> Every `FLOW-NNN` below has a mirrored block in
> [`automated-icp-validation-plan-verification.md`](./automated-icp-validation-plan-verification.md)
> with the same ID. This section tracks **implementation**
> (sub-tasks, SK-* refs, % shipped); the mirror tracks
> **verification** (walked end-to-end by an agent, with outcome
> log). Both files are agent-ran. Adding, modifying, or superseding
> a flow updates BOTH files in the same PR. Drift is the regression
> the GLOBAL exists to prevent — run the integrity check at the tail
> of the mirror file in every PR that touches either side.

Flows are anchored in **real** persona research, drawn from enduring
public discussion hubs (HN search, subreddit URLs) per [`SK-SOLVE-003`](../features/solve-pages/decisions/SK-SOLVE-003-enduring-source-citations.md)
— never single-thread URLs that can rot. Once the first ICP-mining
cluster file lands (Mon 2026-05-26 per [`icp-mining`](../features/icp-mining/FEATURE.md))
the `Source signal` blocks below get amended with verbatim cluster
labels; until then the sources cite the hubs where the theme is
observable on demand.

### Status dashboard (updated 2026-05-23)

| Flow | Persona | Sub-tasks shipped | Verification | Mirror |
|---|---|---|---|---|
| FLOW-001 | P1 solo builder | 6 / 7 (86%) | **passed 2026-05-24 (invite-bearing, SK-STRG-004)** — first-ever HTTP 200 on `/v1/ask` via `stranger-test-invited.sh` (ttfvMs 4146); baseline gate-403 stands for unbypassed walks | [verify](./automated-icp-validation-plan-verification.md#flow-001--anonymous-first-happy-path) |
| FLOW-002 | P3 analyst | 5 / 6 (83%) | baseline failed 2026-05-24 step 9 (gate 403); invite-bearing walk caught + fixed missing `captureInviteFromUrl` on `/solve/<slug>` — post-deploy re-walk pending | [verify](./automated-icp-validation-plan-verification.md#flow-002--pain-driven-aeo-inbound-search--solveslug--first-query) |
| FLOW-003 | P3 / P4 | 5 / 5 (100%) | baseline failed 2026-05-24 step 8 (gate 403); invite-bearing walk caught + fixed missing `captureInviteFromUrl` on `/vs/<slug>` — post-deploy re-walk pending; **2026-05-29 5th slug `/vs/wrenai` shipped (P3 analyst, semantic-layer/governance angle) — pre-deploy build green, live walk pending `deploy-web.yml`**; **2026-06-02 6th slug `/vs/askyourdatabase` shipped (P3 analyst, chat-with-my-DB + Dashboard-Builder + customer-facing-BI angle) — pre-deploy build green, live walk pending `deploy-web.yml`** | [verify](./automated-icp-validation-plan-verification.md#flow-003--comparison-driven-inbound-search--vscompetitor--first-query) |
| FLOW-004 | P1 solo builder | 7 / 7 (100%) | **passed 2026-05-24 (3 walks)** + daily cron via SK-STRG-003 (`acquisition-health.yml`) | [verify](./automated-icp-validation-plan-verification.md#flow-004--waitlist-signup--invite-email--gate-bypass) |
| FLOW-005 | P2 agent builder | 5 / 6 (83%) | partial (OAuth discovery precondition passed 2026-05-23) | [verify](./automated-icp-validation-plan-verification.md#flow-005--agent-self-provisions-db-via-mcp) |
| FLOW-006 | P4 backend engineer | 5 / 6 (83%) | not yet attempted | [verify](./automated-icp-validation-plan-verification.md#flow-006--sdk-runsql-escape-hatch) |
| FLOW-007 | P1 / P3 | 5 / 6 (83%) | not yet attempted | [verify](./automated-icp-validation-plan-verification.md#flow-007--adopt-anonymous-db-on-signup) |
| FLOW-008 | cron / system | 11 / 11 (100%) | partial (curl probe of 8 sources passes 2026-06-01 including the new Bluesky AppView probe; Reddit/SO sandbox-egress advisory; cron-side checks need deployed Worker) | [verify](./automated-icp-validation-plan-verification.md#flow-008--weekly-icp-scrape-source-health) |

**Honest takeaway:** every user-flow is ≥83% implemented but **0 of 7**
user-flows have passed an end-to-end agent walk. FLOW-001 / FLOW-002 /
FLOW-003 now have **Playwright walker** evidence (`tools/stranger-test/`,
[`SK-STRG-001`](../features/stranger-test/FEATURE.md)) on top of the
prior curl-only partial passes: every static-surface and CTA-side
assertion passes (homepage hero markup, FAQPage + HowTo JSON-LD,
honest-limits section, template H1, sitemap + llms.txt enumeration,
`nlqdb_draft` localStorage handoff, `/app/new` rehydrate,
`solve.try_query_clicked` event with sessionStorage spy); the single
binding gap for all three is the `403 feature_gated` returned by
`/v1/ask` when an anonymous principal submits — the [§6 flag #1](#6-things-flagged-to-the-founder-per-claudemd-p1)
SK-ANON-001 / GLOBAL-027 tension, walker-evidenced. FLOW-005 has a
curl-only partial pass on the OAuth discovery precondition (RFC 9728 +
RFC 8414 metadata — the inspector's handshake input; `tools/list` and
beyond still need an authenticated MCP client). FLOW-004 / FLOW-006 /
FLOW-007 are still unattempted. FLOW-008 (the cron source-health
system-flow) is the one block fully exercised by `verify-flows.sh`
modulo the sandbox-egress advisory for Reddit + Stack Exchange. The
impl-vs-verify gap is now resolved for FLOW-001/002/003 as a
walker-runnable measurement; closing the gate-403 unblocks the actual
pass.

### FLOW-001 — Anonymous-first happy path

- **Persona:** P1 Solo Builder
- **Mirror:** [verification.md FLOW-001](./automated-icp-validation-plan-verification.md#flow-001--anonymous-first-happy-path)
- **Source signal:** [r/sideproject "database"](https://www.reddit.com/r/sideproject/search/?q=database) · [HN "side project database"](https://hn.algolia.com/?q=side+project+database) · [r/webdev "database setup"](https://www.reddit.com/r/webdev/search/?q=database+setup)
- **Implementation sub-tasks:**
  - [x] Hero `<CreateForm>` accepts goal — [`SK-WEB-001`](../features/web-app/FEATURE.md)
  - [x] Anonymous device-token issued on first load — [`SK-ANON-001`](../features/anonymous-mode/FEATURE.md)
  - [x] Ephemeral Postgres provisioned on first `/v1/ask` — [`SK-ANON-001`](../features/anonymous-mode/FEATURE.md)
  - [x] Trace toggle reveals compiled SQL — [`SK-WEB-005`](../features/web-app/FEATURE.md)
  - [x] Snippet copy fires `home.snippet_copied` — [`SK-WEB-003`](../features/web-app/FEATURE.md)
  - [ ] LLM-judge grades first-query success — [`SK-ONBOARD-005`](../features/onboarding/FEATURE.md) (baseline by 2026-06-01)
  - [x] §1.1 stranger-test primitive — [`SK-STRG-001`](../features/stranger-test/FEATURE.md) (`tools/stranger-test/`; daily cron + R2 archive still open) — invite-bearing variant via [`SK-STRG-004`](../features/stranger-test/decisions/SK-STRG-004-invite-bearing-composer.md) (`bash scripts/stranger-test-invited.sh`) drove the first-ever HTTP 200 on `/v1/ask` 2026-05-24
- **Progress:** 6 / 7 · **86%**

### FLOW-002 — Pain-driven AEO inbound (search → `/solve/<slug>` → first query)

- **Persona:** P3 Data-Curious Analyst
- **Mirror:** [verification.md FLOW-002](./automated-icp-validation-plan-verification.md#flow-002--pain-driven-aeo-inbound-search--solveslug--first-query)
- **Source signal:** [HN "retool alternative"](https://hn.algolia.com/?q=retool+alternative) · [r/SaaS "retool alternative"](https://www.reddit.com/r/SaaS/search/?q=retool+alternative) · [HN "natural language database"](https://hn.algolia.com/?q=natural+language+database)
- **Implementation sub-tasks:**
  - [x] `/solve/<slug>` static AEO surface — [`SK-SOLVE-001`](../features/solve-pages/decisions/SK-SOLVE-001-search-intent-h1.md)
  - [x] Mandatory honest-limits section — [`SK-SOLVE-002`](../features/solve-pages/decisions/SK-SOLVE-002-honest-limits-mandatory.md)
  - [x] Enduring discussion-hub citations — [`SK-SOLVE-003`](../features/solve-pages/decisions/SK-SOLVE-003-enduring-source-citations.md)
  - [x] CTA seeds `nlqdb_draft`; click-event delivery is not yet verified (see mirror)
  - [x] `/app/new` rehydrates draft on mount — [`SK-ANON-011`](../features/anonymous-mode/FEATURE.md)
  - [ ] `<h1>` amended to verbatim cluster quote once cluster file lands (future `SK-SOLVE-004`)
- **Progress:** 5 / 6 · **83%**

### FLOW-003 — Comparison-driven inbound (search → `/vs/<competitor>` → first query)

- **Persona:** P3 / P4
- **Mirror:** [verification.md FLOW-003](./automated-icp-validation-plan-verification.md#flow-003--comparison-driven-inbound-search--vscompetitor--first-query)
- **Source signal:** [HN "supabase alternative"](https://hn.algolia.com/?q=supabase+alternative) · [HN "vanna ai"](https://hn.algolia.com/?q=vanna+ai) · competitor brand-keyword Google traffic (private — Search Console)
- **Implementation sub-tasks:**
  - [x] Single template + typed data — [`SK-CMP-002`](../features/comparison-pages/decisions/SK-CMP-002-single-template-data-driven.md)
  - [x] "When to choose them" honest trade-offs — [`SK-CMP-001`](../features/comparison-pages/decisions/SK-CMP-001-honest-trade-offs.md)
  - [x] FAQPage JSON-LD per page — [`SK-CMP-003`](../features/comparison-pages/decisions/SK-CMP-003-faqpage-json-ld.md)
  - [x] `llms.txt` endpoint enumerates slugs — [`SK-CMP-004`](../features/comparison-pages/decisions/SK-CMP-004-llms-txt-endpoint.md)
  - [x] CTA seeds draft + emits `vs.try_query_clicked`
- **Progress:** 5 / 5 · **100%**

### FLOW-004 — Waitlist signup → invite email → gate bypass

- **Persona:** P1 Solo Builder (invited)
- **Mirror:** [verification.md FLOW-004](./automated-icp-validation-plan-verification.md#flow-004--waitlist-signup--invite-email--gate-bypass)
- **Source signal:** [`pre-alpha-gate`](../features/pre-alpha-gate/FEATURE.md) friction context · [`GLOBAL-027`](../decisions/GLOBAL-027-pre-alpha-gate.md) (every "do-work" surface 403s until BIRD ≥ 0.65 + Spider ≥ 0.75)
- **Implementation sub-tasks:**
  - [x] `POST /v1/waitlist` accepts form submit
  - [x] Auto-issue 128-bit invite code on signup — [`SK-GATE-007`](../features/pre-alpha-gate/FEATURE.md)
  - [x] Resend delivers the invite email
  - [x] `?invite=<code>` captured + stored in `localStorage["nlqdb_invite"]`
  - [x] `X-Invite-Code` header forwarded on `/v1/ask`
  - [x] End-to-end inbox-receive walkthrough — `scripts/flow-004-walk.sh` ([`SK-STRG-002`](../features/stranger-test/FEATURE.md)); mail.tm anonymous bearer-token API mints a throwaway inbox per walk, so no human inbox is needed
  - [x] Continuous daily regression watch — [`.github/workflows/acquisition-health.yml`](../../.github/workflows/acquisition-health.yml) ([`SK-STRG-003`](../features/stranger-test/FEATURE.md)) runs at `0 6 * * *` UTC alongside `verify-flows.sh` + `stranger-test.sh`; exits 0 unconditionally, uploads JSON results as a 90-day artifact
- **Progress:** 7 / 7 · **100%**

### FLOW-005 — Agent self-provisions DB via MCP

- **Persona:** P2 Agent Builder
- **Mirror:** [verification.md FLOW-005](./automated-icp-validation-plan-verification.md#flow-005--agent-self-provisions-db-via-mcp)
- **Source signal:** [r/LocalLLaMA "agent memory"](https://www.reddit.com/r/LocalLLaMA/search/?q=agent+memory) · [r/LangChain "memory"](https://www.reddit.com/r/LangChain/search/?q=memory) · [r/ClaudeAI "memory"](https://www.reddit.com/r/ClaudeAI/search/?q=memory) · [HN "MCP server"](https://hn.algolia.com/?q=MCP+server)
- **Implementation sub-tasks:**
  - [x] `mcp.nlqdb.com` Worker — [`apps/mcp`](../../apps/mcp)
  - [x] `create_database` tool exposed — [`mcp-server`](../features/mcp-server/FEATURE.md)
  - [x] `ask` tool exposed
  - [x] `run` tool exposed (raw-SQL per [`GLOBAL-015`](../decisions/GLOBAL-015-power-user-escape-hatch.md))
  - [x] Per-(mcp_host, device_id) keys (`sk_mcp_*`) — [`api-keys`](../features/api-keys/FEATURE.md)
  - [ ] Auto-migration via NL through MCP (schema-evolve verb exposed but end-to-end agent walk pending)
- **Progress:** 5 / 6 · **83%**

### FLOW-006 — SDK `runSql` escape hatch

- **Persona:** P4 Backend Engineer
- **Mirror:** [verification.md FLOW-006](./automated-icp-validation-plan-verification.md#flow-006--sdk-runsql-escape-hatch)
- **Source signal:** [HN "text to sql"](https://hn.algolia.com/?q=text+to+sql) · [r/dataengineering "text to sql"](https://www.reddit.com/r/dataengineering/search/?q=text+to+sql)
- **Implementation sub-tasks:**
  - [x] `@nlqdb/sdk` published to npm
  - [x] `runSql()` method — [`SK-SDK-009`](../features/sdk/FEATURE.md), [`GLOBAL-015`](../decisions/GLOBAL-015-power-user-escape-hatch.md)
  - [x] `POST /v1/run` raw-SQL endpoint
  - [x] SQL allowlist rejects DDL on `/v1/run` — [`sql-allowlist`](../features/sql-allowlist/FEATURE.md)
  - [x] Typed result shape across TS, Go, Swift
  - [ ] Ruby + Rust SDKs (placeholders today — out of scope until Phase 2)
- **Progress:** 5 / 6 · **83%**

### FLOW-007 — Adopt anonymous DB on signup

- **Persona:** P1 / P3 → authed
- **Mirror:** [verification.md FLOW-007](./automated-icp-validation-plan-verification.md#flow-007--adopt-anonymous-db-on-signup)
- **Source signal:** [r/sideproject "anonymous data keep"](https://www.reddit.com/r/sideproject/search/?q=anonymous+data+keep) · [`SK-ANON-002`](../features/anonymous-mode/FEATURE.md) (72 h sweep contract)
- **Implementation sub-tasks:**
  - [x] Anonymous DB created on first `/v1/ask` — [`SK-ANON-001`](../features/anonymous-mode/FEATURE.md)
  - [x] 72 h auto-sweep contract — [`SK-ANON-002`](../features/anonymous-mode/FEATURE.md)
  - [x] OAuth sign-in (GitHub / Google) — [`auth`](../features/auth/FEATURE.md)
  - [x] "Adopt this database" affordance — [`SK-ANON-002`](../features/anonymous-mode/FEATURE.md)
  - [x] DB re-keyed to authed account; rows persist
  - [ ] End-to-end zero-data-loss walkthrough (verification mirror needs a real OAuth account or mock-IdP preview)
- **Progress:** 5 / 6 · **83%**

### FLOW-008 — Weekly ICP scrape source-health

- **Persona:** cron / system (no user persona — this is the data pipeline)
- **Mirror:** [verification.md FLOW-008](./automated-icp-validation-plan-verification.md#flow-008--weekly-icp-scrape-source-health)
- **Source signal:** the 8 upstreams the Mon 06:00 UTC cron consumes per [`automated-icp-validation-plan.md §2.1`](./automated-icp-validation-plan.md) — [HN Algolia](https://hn.algolia.com/api) · [Reddit listings](https://www.reddit.com/r/SaaS/search.json?q=retool+alternative) · [GitHub Search Issues](https://docs.github.com/en/rest/search/search) · [GitHub Discussions (GraphQL)](https://docs.github.com/en/graphql/reference/queries#search) · [Stack Exchange API 2.3](https://api.stackexchange.com) · [Indie Hackers JSON Feed](https://feed.indiehackers.world) · [Dev.to Forem API](https://developers.forem.com/api/v1) · [Bluesky AT Protocol AppView](https://docs.bsky.app/docs/api/app-bsky-feed-search-posts)
- **Implementation sub-tasks:**
  - [x] HN Algolia query — [`SK-ICP-001`](../features/icp-mining/FEATURE.md)
  - [x] Reddit subreddit search (16 subreddit/query pairs, `restrict_sr=on`) — [`SK-ICP-001`](../features/icp-mining/FEATURE.md)
  - [x] GitHub Issues search (5 queries, gated on `GH_TOKEN`) — [`SK-ICP-004`](../features/icp-mining/FEATURE.md)
  - [x] GitHub Discussions search via GraphQL (5 queries, gated on `GH_TOKEN`, same `created:>` filter) — [`SK-ICP-009`](../features/icp-mining/FEATURE.md)
  - [x] Stack Exchange `/search/advanced` (5 tag+query pairs, anon quota) — [`SK-ICP-005`](../features/icp-mining/FEATURE.md)
  - [x] Indie Hackers JSON Feed (5 P1-pain queries, client-side 7-day filter) — [`SK-ICP-006`](../features/icp-mining/FEATURE.md)
  - [x] Dev.to Forem `/api/articles` (5 tag queries, server-side `top=7` filter) — [`SK-ICP-008`](../features/icp-mining/FEATURE.md)
  - [x] Bluesky `app.bsky.feed.searchPosts` (5 P1/P2/P3 queries, server-side `since=<isoSeven>` filter, no auth) — [`SK-ICP-012`](../features/icp-mining/FEATURE.md)
  - [x] KV dedup contract + LogSnag per-run notification — [`SK-ICP-001`](../features/icp-mining/FEATURE.md)
  - [x] Cluster + GitHub Contents API evidence-file write — [`SK-ICP-003`](../features/icp-mining/FEATURE.md)
  - [x] Agent-runnable source-health probe via `scripts/verify-flows.sh` — [`SK-ICP-007`](../features/icp-mining/FEATURE.md)
- **Progress:** 11 / 11 · **100%**

### Adding a new flow

Same procedure as [verification.md "Adding a new flow"](./automated-icp-validation-plan-verification.md#adding-a-new-flow);
this section and the mirror's status dashboard both grow in the same PR.

---

## Progress log

Per [GLOBAL-028](../decisions/GLOBAL-028-acquisition-progress-tracker.md): every PR that implements a section appends a row here.

| Date | Phase | What | How | Result |
|---|---|---|---|---|
| 2026-05-21 | §1.4 gate-valve | Auto-issue invite codes on waitlist signup | `waitlist-invite.ts`: 128-bit code, KV store, 30d TTL, 200/week cap. Resend email via `makeEmailSender`. Web: `invite.ts` captures `?invite=<code>`, stores in `localStorage`, forwards as `X-Invite-Code` header. | Shipped. First production invites will go out on next new waitlist signup. |
| 2026-05-21 | §2.2 scrape stack | Weekly ICP pain-signal scrape | `icp-scrape.ts`: HN Algolia (5 queries) + Reddit (3 subreddit/query pairs). KV dedup + storage. LogSnag `#icp-mining` notification. Cron `0 6 * * 1`. | Shipped. First run 2026-05-26 06:00 UTC. |
| 2026-05-21 | §2.3 LLM scoring (steps 1–2) | Pain-word prefilter + persona scoring | `icp-score.ts`: regex prefilter → Groq `llama-3.1-8b-instant` (Gemini fallback) scores each item 0–10 for P1/P2/P3/P6; items with max score < 5 discarded; survivors to `icp:scored:*` KV (30d TTL). OTel span per batch. Source expansion: HN 5→10 queries, Reddit 3→16 subreddit pairs. | Shipped. Scores available from first scrape 2026-05-26. |
| 2026-05-22 | §2.3 LLM clustering (steps 3–4) | Cluster scored items + write evidence file | `icp-cluster.ts`: lists all `icp:scored:*` KV keys (paginated), groups by best persona (top-100 each), calls Groq → Gemini to cluster into 5–7 themes, generates `docs/research/icp-evidence-<yyyy-mm>.md`, writes to GitHub via Contents API PUT (checks existing SHA). Non-fatal: GitHub write failure returns `written: false` without killing cron. | Shipped. First evidence file 2026-05-26. |
| 2026-05-22 | §2.1 GitHub Issues source | Add GitHub Search Issues as scrape source | `icp-scrape.ts`: 5 queries (`is:issue "text to sql"`, natural language database, etc.) via GitHub Search Issues API with `GH_TOKEN` auth, `created:>2025-11-01` filter. Per-query errors caught. Items stored with `source: "github"`. | Shipped. Active from first run 2026-05-26 when `GH_TOKEN` is set. |
| 2026-05-22 | §2.4 verdict + harden pipeline | Surface decision-rule verdict in evidence file; fix correctness gaps before first cron run | `icp-cluster.ts`: §2.4 rule (≥3× ratio AND ≥30 quotes) computed per run, surfaced as `## §2.4 Decision rule` block at top of `icp-evidence-<yyyy-mm>.md` and as `IcpClusterResult.{primaryStatus, primaryIcp}` in cron logs + LogSnag. Clamps LLM-hallucinated `cluster.count` to actual group size; renders cluster `top_urls` in markdown. `icp-scrape.ts`: Reddit URLs now carry `restrict_sr=on` (without it the search returns site-wide results, polluting persona signal); GitHub Search + Contents API calls now send `User-Agent: nlqdb-icp-bot` (REST rejects no-UA with 403); GitHub issues with unparseable `created_at` are dropped before KV write; `incomplete_results: true` is logged. All external HTTP gains `AbortSignal.timeout(10–15s)`. | Shipped. First evidence file 2026-05-26 will already include the verdict; the Reddit corpus stays subreddit-scoped from run #1 forward. |
| 2026-05-23 | §3.1 pain-driven solve pages (first 5) | Hand-curated AEO surface; 5 pages ahead of the 2026-05-26 first cluster file | `apps/web/src/data/solve.ts` (typed source of truth, 5 entries); `apps/web/src/pages/solve/[slug].astro` (single Astro template, getStaticPaths); `apps/web/src/pages/solve/index.astro` (page index at `/solve`); `apps/web/src/data/solve.test.ts` (12 data-integrity tests pinning AEO invariants: unique kebab slugs, ≤60-word oneLiner, ≥3 howNlqdbAnswers, ≥2 whatItDoesnt limits, ≥3 FAQs ≤80-word answers, ≥2 enduring source URLs starting with `https://`). Sitemap + llms.txt updated to enumerate solve slugs alongside vs slugs. "Try this query" CTA calls the client event hook and seeds `nlqdb_draft` localStorage; FLOW-002 verification has not proven event delivery yet. FAQPage + HowTo JSON-LD per page. Self-canonical `<link rel="canonical">`. New feature record at `docs/features/solve-pages/` with SK-SOLVE-001 (search-intent `<h1>`, not fabricated verbatim quotes — paraphrase is honest until cluster file lands), SK-SOLVE-002 (mandatory "What nlqdb doesn't do" section per AEO honest-trade-off rule), SK-SOLVE-003 (≥2 enduring discussion-hub URLs, never single-thread URLs that can rot). `CLAUDE.md §5` path map updated. | Shipped. Sitemap now lists 12 URLs (was 7); llms.txt now exposes a `## Solve pages` block to LLM-IDE crawlers (Claude Desktop, Perplexity, Cursor, Cline, Aider, Copilot). |
| 2026-05-23 | §8 user-flow tracker scaffolding (GLOBAL-029) | Mirror impl/verify trackers — 7 flows defined; `GLOBAL-029` declared | `docs/decisions/GLOBAL-029-acquisition-verification-tracker.md` (new); `docs/research/automated-icp-validation-plan-verification.md` (new mirror file, also exempt from 20 KB cap); §8 added to this file with the 7 mirrored FLOW-001..007 blocks (P1-P4 personas, anchored in enduring Reddit/HN discussion-hub citations per SK-SOLVE-003); `docs/decisions.md` index gains the GLOBAL-029 row; `GLOBAL-028` body updated to cross-ref the mirror. Each flow lists implementation sub-tasks (with SK-* refs) on this side and walkthrough steps + required credentials + outcome log on the mirror side. Status dashboard: 7 flows, avg 84% implementation, 0% verification — the impl-vs-verify gap restated per-flow is exactly the §1.1 stranger-test gap the mirror exists to close. | Shipped. Mirror integrity check (diff of `## FLOW-NNN` headers across both files) emits empty diff; both files are agent-ran from here on. |
| 2026-05-23 | §8 FLOW-002 verification + tracker hardening | Attempted the first no-credential AEO inbound walk before adding new flows | Deployed-surface Playwright walk against `https://nlqdb.com/solve/cheap-internal-dashboard`: static checks passed (`FAQPage` + `HowTo`, honest-limits, `nlqdb_draft`, `/app/new` rehydrate), but an injected `window.__nlqdb_logsnag` spy observed no `solve.try_query_clicked` event; manual continuation posted to `https://app.nlqdb.com/v1/ask` and returned `403 feature_gated`. Added `GLOBAL-030` evidence-grade tracker rule and CI mirror-ID check so future `FLOW-NNN` drift fails automatically. | FLOW-002 failed step 8; acquisition can educate from `/solve`, but CTA telemetry and first value still need verification/fix before this counts as a working inbound path. |
| 2026-05-23 | §2.3 evidence-file cron readiness | Ensure first ICP cron can write evidence and notify without manual Worker-secret drift | Added `GH_TOKEN`, `LOGSNAG_TOKEN`, and `LOGSNAG_PROJECT` to the API Worker secret mirror; added `GH_TOKEN` to `.env.example`, GitHub Actions secret mirroring, and `verify-secrets.sh`. Env inspection in this agent found `GEMINI_API_KEY` present but `GH_TOKEN`/LogSnag absent locally, confirming the current shell could not prove production evidence-write readiness by value. | Shipped as ops unblock. First cron can only write `icp-evidence-<yyyy-mm>.md` when `GH_TOKEN` is provisioned as a repo secret / Worker secret; the mirror scripts now include it. |
| 2026-05-23 | §8 FLOW-001/002/003 curl re-verification | Walk the no-credential static surfaces with curl before adding new flows or sources | FLOW-001 step 1+2 pass: `https://nlqdb.com/` returns 200 and exposes hero `<form>` with `placeholder="an orders tracker"` matching the `/orders\|tracker\|building/i` contract. FLOW-002 steps 1, 3, 4 pass against `/solve/cheap-internal-dashboard`: 200 OK, `FAQPage` + `HowTo` JSON-LD blocks both present (1 each), "What nlqdb doesn't do here" section rendered. FLOW-003 steps 1, 2, 4, 9 pass against `/vs/supabase`: 200 OK, `<h1>nlqdb vs Supabase</h1>` matches the template, `FAQPage` JSON-LD present, `/llms.txt` enumerates all 3 vs slugs (`mem0`, `supabase`, `vanna`) and all 5 solve slugs; `/sitemap.xml` lists the same 12 URLs. Steps that require a browser context (CTA click, draft hydrate, first-query submit, gate-bypass) remain unattempted in this PR. | Shipped. Three flows now have first-time partial-pass evidence; FLOW-002's prior CTA/gate failure is still the binding gap. Verification mirror outcome logs and status dashboard updated. |
| 2026-05-23 | §2.1 Stack Overflow source (SK-ICP-005) | Add the 4th ICP scrape source listed in §2.1 but never shipped | `apps/api/src/icp-scrape.ts` gains `fetchStackExchange` (Stack Exchange API 2.3 `/search/advanced`, `site=stackoverflow`, 5 tag+query pairs covering P1/P3/P4/P6 — `postgresql/setup`, `sqlalchemy/verbose`, `sql/natural language`, `prisma/migration`, `duckdb;clickhouse`; `pagesize=10`; `fromdate=now-7d`; anonymous quota 300/IP/day). New OTel span `nlqdb.icp.fetch.stackoverflow` carries `nlqdb.icp.se.quota_remaining`; `backoff` field is surfaced via `icp_se_backoff` warn-log. Items stored as `source: "stackoverflow"`, `id: "so-<question_id>"`; LogSnag description gains `SO: <n>`. Per-source error handling matches HN/Reddit/GitHub (one failing source never kills others). Live API probe from this environment returned 1 fresh question for `postgresql/setup` with `quota_remaining=299`, `backoff=None`; 14/14 `icp-scrape.test.ts` tests pass (3 new). | Shipped. Fourth source live for first cron Mon 2026-05-26. No new env binding required. |
| 2026-05-23 | §8 verification automation + re-walk | Automate the curl-observable subset of FLOW-001/002/003 + re-verify three live sources before adding more scrape sources or flows | New `scripts/verify-flows.sh` (mirrors the `scripts/verify-secrets.sh` style: `ok`/`fail`/`note` per check, never prints secrets, 15 s per-fetch cap, exits non-zero on any failure, `NLQDB_BASE_URL` override for preview deployments). Walks 49 assertions: FLOW-001 step 1+2 against `/`; FLOW-002 step 1, 3, 4 against every shipped `/solve/<slug>` (5 slugs); FLOW-003 step 1, 2, 4 against every shipped `/vs/<slug>` (3 slugs); FLOW-003 step 9 against `/llms.txt` (enumerates 3 vs + 5 solve); a `/sitemap.xml` floor at 12 `<loc>` entries. Every assertion passed today against `https://nlqdb.com`. New static-surface evidence: `/solve/<slug>` and `/vs/<slug>` now `307 → trailing-slash` — the script follows redirects and records the chain so future curl-only agents don't re-discover it. Live re-probes today (with this VM's `GH_TOKEN` / `GROQ_API_KEY` / `GEMINI_API_KEY` / `LOGSNAG_*` / `RESEND_API_KEY` / `OPENROUTER_API_KEY` all present — correcting the 2026-05-23 entry that recorded `GH_TOKEN`/LogSnag as absent locally): Stack Exchange `/search/advanced?tagged=postgresql&q=setup` returned `items=1, quota_remaining=299, backoff=None`; GitHub `/search/issues?q=is:issue "text to sql" created:>2025-11-01` returned `total_count=1642, items=10, incomplete_results=false`. Verification mirror's FLOW-001/002/003 outcome logs each gain a new row; FLOW-002 triage gains a `Trailing-slash redirect` block. Second-pass self-review caught a silent-exit bug in the script (`var=$(fetch_body…)` swallowed `fail` output AND `FAIL_COUNT++` in a subshell); fixed in the same PR via a `FETCH_BODY_PATH` global return; negative-test failure count went from 8 visible / 19 actual to 19 visible / 19 actual. | Shipped. The mirror integrity check (`diff` of `^#{2,3} FLOW-[0-9]+` across both files) remains empty; future agents have a single one-command entry point for the static-surface acquisition assertions. |
| 2026-05-23 | §0 + §1 + preamble framing (operator-loop + anti-self-deception) | Founder clarified: "I run one prompt; that's it. don't make me do more things." Existing docs encoded the *what* of acquisition but not the *how* of the operator loop — each cold agent had to re-derive that the founder is the cron-trigger and the agent is the cron-body. That gap let the prior commit drift toward a LogSnag-on-failure suggestion (which would have created a founder-facing notification channel — the exact thing the operator wants to escape). | Edited (not added) impl plan preamble: now leads with (a) operator-loop principle, (b) shipped≠verified principle, (c) explicit 7-item "What the next agent run should pick" priority list (§1.1 stranger-test → §1.2 KPI dashboard → §1.3 in-app survey → FLOW-002 step 8 fix → next 10 solve pages → gallery/examples → Show HN). Collapsed `Current status` + `Honest gap` + `Verified 2026-05-23` walls into one KPI table with explicit "not measured" markers on §1.2 KPIs and a new `Stranger-test passes` row. Trimmed §0 Goal (points at preamble for operator model, lists "founder-facing notification channels of any shape" as a non-goal). Renamed §1 intro to `Anti-self-deception layer (BLOCKING — outranks all §3)`. Verification mirror preamble + `How an agent uses this file §1` rewritten to: "you ARE the cron; default first action is `bash scripts/verify-flows.sh`; failures route back as priority #1, not notifications." No new sections, no new GLOBAL/SK, no GH Actions cron, no LogSnag-to-founder wiring. | Shipped. Cold agents now land on (1) you-are-the-cron, (2) today's priority #1 = §1.1 stranger-test, (3) `verify-flows.sh` as the default first action. The §1.1/§1.2/§1.3 anti-self-deception priority is load-bearing in the preamble, not buried. |
| 2026-05-23 | §2.1 Indie Hackers source (SK-ICP-006) | Add the 5th and last source listed in §2.1 — IH was always planned for P1 (Solo Builder) signal but never shipped, leaving the source mix skewed away from launch-context complaints | `apps/api/src/icp-scrape.ts` gains `fetchIndieHackers` (unofficial `feed.indiehackers.world` JSON Feed; 5 P1-pain queries: `database`, `boilerplate`, `side+project`, `first+paying`, `stack`). Items stored as `source: "indiehackers"`, `id: <slug>` from `/post/<slug>` URL path. No env binding (public feed); 10 s `AbortSignal.timeout`; per-source error isolation matches HN/Reddit/GH/SO. Server-side date filter is unavailable on the mirror, so the 7-day window is enforced client-side after parsing `date_modified`; posts with unparseable date or non-conforming URL are dropped before KV write (stable dedup keys). New OTel span `nlqdb.icp.fetch.indiehackers`. LogSnag description gains `IH: <n>`. SK-ICP-006 documents the trade-offs (third-party mirror dependency, no IH-canonical click-through — title + `content_html` carry the evidence). Live probe from this VM 2026-05-23 against `?q=database&exclude=link-post`: `HTTP 200, items=100, kept=2, dropped_id=0, dropped_old=98` — confirms ≈10 fresh IH items/week across 5 queries, all URL slugs parseable. 19/19 `icp-scrape.test.ts` tests pass (5 new: success-path + URL/UA contract + 7-day client-side filter + malformed-URL drop + 502 graceful). | Shipped. Fifth source live for first cron Mon 2026-05-26. No new env binding required; `feed.indiehackers.world` outage is non-fatal per existing per-source `.catch` pattern. |
| 2026-05-23 | §8 mirror sync + verify-flows hardening (SK-ICP-007 + FLOW-005 partial) | Close drift introduced by PR #265 — preamble claimed 8 flows and "SK-ICP-007 documenting the agent-runnable source-health primitive" but the `### FLOW-008` / `## FLOW-008` body sections never landed in either tracker and no `SK-ICP-007` block existed in `icp-mining/FEATURE.md`. Same agent run also caught a real verify-flows.sh false-positive: Stack Exchange returned `HTTP 403 x-block-reason: hostname_blocked` from the agent VM's managed-egress proxy and the script marked it fatal — Worker-IP-canonical means that's an advisory, not a regression. | `scripts/verify-flows.sh`: `fetch_json` now captures response headers via `-D` and degrades any non-200 carrying `x-block-reason:` to an advisory note regardless of severity (catches Reddit AND SO sandbox-egress 403s; HN/IH/GH outages stay fatal). New `FLOW-005 — MCP discovery (curl-observable subset)` block probes `https://mcp.nlqdb.com/.well-known/oauth-protected-resource` + `/.well-known/oauth-authorization-server` (RFC 9728 + RFC 8414), asserts `resource` / `issuer` / `authorization_endpoint` / `token_endpoint` — closes FLOW-005's OAuth discovery precondition (the metadata input the MCP inspector consumes during walkthrough step 1) with zero credentials; walkthrough steps 1-7 still need an authenticated MCP client. `NLQDB_MCP_URL` overrides for preview. `docs/research/automated-icp-validation-plan{,-verification}.md`: `### FLOW-008` (impl) + `## FLOW-008` (verify) bodies added with sub-tasks pointing at SK-ICP-001/003/004/005/006/007; status dashboards extended to 8 rows; FLOW-005 row flipped from `not yet attempted` to partial; outcome logs gained today's re-walk rows for FLOW-001/002/003 + first-ever row for FLOW-005 + FLOW-008. Preamble counts in both files reconciled to "4 partial / 1 cron-pass / 3 unattempted". `docs/features/icp-mining/FEATURE.md`: SK-ICP-007 entry added (5-field block); Status line updated; compensating shrinkage in SK-ICP-006 Why/Alternatives keeps the file at 20,412 bytes (under the 20 KB cap). Mirror integrity check (`diff` of `^#{2,3} FLOW-[0-9]+` headers) stays empty. Local re-run of `bash scripts/verify-flows.sh` against `https://nlqdb.com`: all assertions green (Reddit + SO advisory with the expected block-reason note). | Shipped. PR #265's drift is closed: `## FLOW-008` blocks now exist symmetrically, SK-ICP-007 is the canonical decision. The agent-VM-to-Worker egress gap is now visible in the script output, not a silent false-positive. |
| 2026-05-24 | §1.1 stranger-test primitive (SK-STRG-001) + FLOW-001/002/003 walker re-verification | Ship the Playwright walker that closes the impl-vs-verify gap §1.1 has named for days; re-walk FLOW-001/002/003 against the deployed surface with real evidence before adding any new ICP source or flow | New workspace [`tools/stranger-test/`](../../tools/stranger-test/) (`@nlqdb/stranger-test`): `src/runner.ts` (CLI: `--base-url`, `--flows flow-001,flow-002,flow-003`, `--prompts`, `--out`, `--quiet`), `src/browser.ts` (one shared `chromium.launch` + per-walk `BrowserContext`, `withDeadline(180s)` per walk, `ignoreHTTPSErrors` for sandbox-proxy TLS, 401/429 ignored as expected), `src/personas.ts` (25 prompts pinned to the §1.1 paragraph: P1×10 / P2×8 / P3×4 / P6×3, no secret-looking strings), `src/flows/flow-00{1,2,3}.ts` (one walker per flow with steps mapped 1:1 to the mirror walkthrough). Bash wrapper [`scripts/stranger-test.sh`](../../scripts/stranger-test.sh) resolves the repo root and stamps `tools/stranger-test/results/walk-<utc>.json`; results gitignored except `.gitkeep`. 7/7 unit tests pass (`bun run --filter @nlqdb/stranger-test test`); typecheck green. Live 2026-05-24 walk against `https://nlqdb.com` (9 walks = 3 flows × 3 prompts, 6.6 s wall): 0 passed, 9 failed — every run gate-blocks at `/v1/ask` with `403 feature_gated` (FLOW-001 step 5, FLOW-002 step 9, FLOW-003 step 8) at ~150 ms p50, ~691 ms p95. **FLOW-002 step 8 finding corrected:** the prior 2026-05-23 walk reported `solve.try_query_clicked` missing; the new walker uses sessionStorage to persist the spy across `location.assign("/app/new")` and observes the event firing on every walked slug. The static surface is healthy; the gate is the binding gap. New feature [`docs/features/stranger-test/FEATURE.md`](../features/stranger-test/FEATURE.md) (SK-STRG-001) + `tools/stranger-test/AGENTS.md`. `CLAUDE.md` path map gained the `tools/stranger-test/**` entry (net-shrunk to stay under the 20 KB cap). Impl plan §1.1, §8 status dashboard, §8 FLOW-001 sub-tasks, §7 promotion path, Current status, and verification mirror outcome logs + status dashboard all updated in lockstep per GLOBAL-029/GLOBAL-030. | Shipped. The §1.1 anti-self-deception primitive exists as a one-command agent invocation. The walker exit-code is the regression signal; no LogSnag, no founder notification — the next agent run picks the binding §1.4 anon-bypass gap as priority #1, replacing the now-obsolete priority #1 / #4 entries the preamble carried. |
| 2026-05-24 | §3.5 Outerbase comparison page (4th `/vs/<slug>`) + mirror re-verification + post-review iteration | Acquisition surface — fill the P4 backend-engineer slot the existing 3 `/vs/` pages don't cover. `/vs/outerbase` is the documented next-pick in [`comparison-pages/FEATURE.md`](../features/comparison-pages/FEATURE.md) Open questions ("persona-weighted threat × keyword volume — start with Outerbase next"). Outerbase is the "single product most in nlqdb's lane today" per [`docs/competitors.md §3`](../competitors.md) and is now Cloudflare-owned (2025-04-07 acquisition per the [official press release](https://www.cloudflare.com/press/press-releases/2025/cloudflare-acquires-outerbase-to-expand-developer-experience/)) — narrows the infra-differentiation lane and makes the chat-first / provisioning / `<nlq-data>` shape the only honest delta. | `apps/web/src/data/competitors.ts` gains the Outerbase entry (4th `Competitor`): persona `P4 backend engineer`, 4 `whenChooseUs` + 4 `whenChooseThem` bullets (SK-CMP-001), 11-row feature parity table, 6 FAQs (SK-CMP-003 4-6 range), all 6 naming "Outerbase" verbatim (SK-CMP-003 requires ≥1), demo goal `"today's failed background jobs grouped by service in the last 24 hours"`. `apps/web/src/pages/vs/[slug].astro` `getStaticPaths()` picks the new slug up unmodified per SK-CMP-002. `scripts/verify-flows.sh`: `VS_SLUGS` / `VS_TITLES` arrays gain `outerbase` / `Outerbase`; sitemap floor 12 → 13 (5 solve + 4 vs + 4 root). Live local `bun run build` from `apps/web/`: `/vs/outerbase/index.html` generated, sitemap 13 `<loc>` entries, `llms.txt` lists `vs/outerbase`. `docs/competitors.md` 3-place sync: (a) `§3` Outerbase entry corrects the stale "PlanetScale 2024" note (verified false against the Cloudflare press release + live WebFetch of `outerbase.com`) — Cloudflare 2025-04-07; engine list expanded to the verified 9; "Last verified" date stamped 2026-05-24; (b) `§1` PlanetScale entry threat-vector line updated — Outerbase no longer "owned by PlanetScale"; (c) summary threat-matrix row updated — "Cloudflare's stack (2025-04-07 acquisition)" replaces "PlanetScale backing". `docs/features/comparison-pages/FEATURE.md`: status line `3 → 4`; Open questions amended to note Outerbase shipped + the 3-place source-of-truth correction. **Independent self-review (sub-agent, opus 4.7) found 10 issues; this same row reflects the iteration that closed all 10:** (1) buyer-facing SK-* leak (3 sites) — SK-ANON-001 / SK-ONBOARD-004 / SK-WEB-005 references removed from `whenChooseUs` + the EZQL FAQ; (2) PlanetScale stale claim survived in `competitors.md` lines 46/249 — corrected; (3) acquisition date `2025-04-08` → `2025-04-07` (5 places: data file, competitors.md ×2, FEATURE.md, this Progress log); (4) P4 persona inconsistency on `whenChooseUs[0]` — reordered so trust/embed/greenfield bullets lead; (5) Outerbase tier name "Explorer" retired — "Free" used + specific 10/mo number softened to "documented per-month usage caps"; (6) HIPAA + SOC 2 row corrected from `them: shipped` → `them: partial` with Enterprise-only note (matches Outerbase's current pricing-page contract); (7) test-count claim corrected — `bun test apps/web/src/data` is 23/23 (the 93/93 figure is the full `apps/web/src` suite); (8/9/10) NIT-tier (nested-backtick artefact + comment scope) cleaned up. **Pre-deploy verification (post-iteration):** `bun run build` green; 13/13 sitemap entries; `bun test apps/web/src/data` 23/23 pass; full `bun test apps/web/src` 93/93 pass; `bunx astro check` 0 errors / 0 warnings; `shellcheck scripts/verify-flows.sh` 0 issues; `bunx biome check` exit 0 on this PR's diff; live `bash scripts/verify-flows.sh` against `https://nlqdb.com` returns exactly 4 expected pre-deploy failures (`/vs/outerbase/` 404, sitemap floor 12 < 13, `llms.txt` missing slug) — all clear post-`deploy-web.yml`. No `SK-CMP-NNN` added: the addition fits inside the existing data-driven contract per SK-CMP-002. | Shipped after one round of independent self-review iteration. Comparison page count 3 → 4; first `/vs/` page covering P4. Mirror integrity check (diff of `^#{2,3} FLOW-[0-9]+`) stays empty — no new flow added. FLOW-003 verification mirror outcome log gets the pre-deploy build-time row; the live-walk row appends after `deploy-web.yml` deploys `apps/web/dist`. Review artifact: PR #271 comment chain. |
| 2026-05-24 | §1.4 FLOW-004 invite-valve end-to-end verification (SK-STRG-002) | The acquisition tracker has listed FLOW-004 (signup → Resend inbox → `?invite=` → gate bypass → first 200 on `/v1/ask`) as priority #2 ever since SK-GATE-007 shipped 2026-05-21; nothing had walked the inbox-receive step end-to-end because the verification mirror declared a need for a "real email inbox or Resend webhook capture" that never materialised. Without it the §1.4 invite-valve was "shipped, not verified" — the one path GLOBAL-027 permits a stranger to cross the gate before BIRD/Spider clear was a coin-flip. | New `scripts/flow-004-walk.sh` (SK-STRG-002 in [`stranger-test/FEATURE.md`](../features/stranger-test/FEATURE.md)): bash/curl/jq walker. Per run: (a) `GET api.mail.tm/domains` picks an active public domain (free, no key, 8 QPS); (b) `POST /accounts` + `POST /token` mint a throwaway inbox; (c) `POST $NLQDB_BASE_URL/v1/waitlist` (Worker hands the address to the existing `tryIssueInvite` cron path); (d) polls `GET /messages` every `FLOW_004_POLL_INTERVAL_S` (default 10s) up to `FLOW_004_TIMEOUT_S` (default 300s); (e) extracts `?invite=<code>` from text + html via `grep -oE 'invite=[A-Za-z0-9_-]{16,}'`; (f) `POST /v1/ask` with `Authorization: Bearer anon_<uuid>` AND `X-Invite-Code` header. Pass = HTTP 200; `failed step 4` only when the body still carries `error.status="feature_gated"` (the SK-GATE-007 regression signature); `partial` when gate is bypassed but downstream returns non-200 (free-LLM outage, etc — gate is what we measure here). Cleanup via `trap` — `DELETE /accounts/{id}` runs on any exit path so no zombie mail.tm accounts remain. Invite codes redacted to first-4 + last-4 chars in stdout via the `redact()` helper (refuses to print < 12-char strings). Outcome JSON shape: `{utc, flow, base_url, mail_tm_domain, state, gate_bypassed, email_latency_s, total_wall_s, ask_status, ask_error_status, notes}` written to `tools/stranger-test/results/flow-004-<utc>.json` (already gitignored under the existing `tools/stranger-test/results/*.json` pattern). Updated `automated-icp-validation-plan-verification.md` FLOW-004 status dashboard row + outcome log + Required-tools/credentials block (removed "needs founder inbox" — replaced by `bash scripts/flow-004-walk.sh`). Updated impl plan `§8` FLOW-004 status 5/6 → 6/6, preamble's priority #2 reframed from "verify" to "continuous regression watch", "What's shipped today" line bumps "8 flows: 3 walker-evidenced + 3 unattempted" → "4 walker-evidenced + 2 unattempted", `Current status` KPI table row for invite-redeemed users updated with verified-2026-05-24 evidence. Added SK-STRG-002 to `stranger-test/FEATURE.md` (5-field block) + Open question covering the cron + the Playwright `--invite-code` next slice. `AGENTS.md` §5 path map gained `scripts/flow-004-walk.sh` (net-shrunk per the 20 KB cap by trimming the redundant `+ decisions/SK-PREMIUM-{008,009}-*.md` SK pointer on the premium-tier row — the SK files are already linked nine times inside `premium-tier/FEATURE.md`). **Live 2026-05-24 first walk** against `https://app.nlqdb.com` (`bash scripts/flow-004-walk.sh`): mail.tm inbox provisioned on `wshu.net` in ~1s; waitlist 200; Resend invite email arrived in 13s; `/v1/ask` returned **HTTP 200** with `X-Invite-Code` → gate bypassed; total wall-clock 18s. Artifact: `tools/stranger-test/results/flow-004-2026-05-24T11-16-15Z.json`. **Independent self-review (sub-agent, opus 4.7) found 6 issues; this row reflects the iteration that closed all 6:** (major #1) walker treated HTTP 200 as proof the invite was honoured, but `gatePreAlpha` returns `pass` early when the gate is globally open OR `GATE_OPEN=1` — once BIRD/Spider clear, every walk would silently green-light. **Fix:** added a control probe (`/v1/ask` without invite) before the invite probe; walker emits `passed` only when control returns `feature_gated` AND invite returns non-`feature_gated`, otherwise `inconclusive` (new exit code 4). (minor #2) `--argjson ask_status ""` crashed `jq` on total curl failure, killing the triage JSON exactly when needed — fixed by initialising every numeric state var to `0` at the top and routing every failure path through a centralised `write_outcome` helper. (minor #3) step-3 failure JSON omitted the `flow:"FLOW-004"` field present in success JSON — same `write_outcome` fix covers it. (minor #4) trap registered AFTER account creation, leaving a token-failure window with no cleanup — moved trap registration before any mail.tm side effect, trap re-mints JWT from saved password if needed so deletion always succeeds. (minor #5) `printf '%b'` on interpolated email body re-interpreted backslash escapes in user-supplied HTML — replaced with `printf '%s\n%s'`. (nit #6) `EMAIL_LATENCY_S` included the waitlist round-trip — split timers: `T_WAITLIST` for total wall, `T_POLL_START` for Resend latency. **Re-walk after the fix-pass:** control returned `403 feature_gated`, invite returned `HTTP 200`, total 15s wall, JSON now also carries `control_status` + `control_error_status` + `control_blocked` — full SK-GATE-007 invariant proof on every run. Artifact: `tools/stranger-test/results/flow-004-2026-05-24T11-32-44Z.json`. Mirror integrity check (`diff` of `^#{2,3} FLOW-[0-9]+`): empty. | Shipped after one round of independent self-review iteration. FLOW-004 is the **first** acquisition user-flow to fully pass end-to-end since the §8 tracker was introduced (FLOW-001/002/003 remain gate-blocked by design pending BIRD/Spider, FLOW-005 is curl-partial, FLOW-006/007 unattempted). The SK-GATE-007 invite-valve is now verified-twice and has a one-command continuous-regression primitive whose pass criterion is self-validating across gate-state changes; the founder no longer needs to provide an inbox or Resend webhook capture. Mirror integrity check empty. Review artifact: PR #273 comment chain. |
| 2026-05-24 | Gate UI evals caption + preamble redirect to engine quality | Founder directive (2026-05-24): ICP acquisition tracker priority list was leading with §1.4 anon-bypass even though the deployed gate is operating exactly as GLOBAL-027 requires — every walked `/v1/ask` 403s because BIRD 0.318 < 0.65 and Spider null < 0.75 in [`eval-baseline.ts`](../../apps/api/src/gate/eval-baseline.ts). Removing the gate before BIRD/Spider clear ships bad NL→SQL to every stranger we drive — worse than the current "0 validated users." Real bottleneck is [`quality-eval`](../features/quality-eval/FEATURE.md) velocity, not new surfaces. Founder also flagged that the gate progress block (`FeatureGatedView`) renders `BIRD 31.8% / 65%` and `Spider not yet measured` without telling visitors what BIRD/Spider are — strangers read raw acronyms. | `apps/web/src/components/FeatureGatedView.tsx`: added `<p className="feature-gate__lanes-caption" aria-hidden="true">evals</p>` above the existing `<dl className="feature-gate__lanes">` and labelled the `<dl>` with `aria-label="NL-to-SQL accuracy evals"` for SR users (caption stays `aria-hidden` to avoid double-announce). `apps/web/src/styles/global.css`: new `.feature-gate__lanes-caption` rule — 11px uppercase tracking-0.08em, `#a98a4a` (dimmed sibling of the existing `#d2a352` lane-label colour) so it reads as caption, not section heading. Visual contrast computed against the gate's `#1a1410` background per the WCAG 2.1 relative-luminance formula: 5.58:1, meets WCAG AA for normal text (≥ 4.5:1). `docs/research/automated-icp-validation-plan.md`: (a) preamble's "What the next agent should pick" list re-rooted — new priority #1 is engine quality (BIRD gap close + Spider lane verification + free-vs-agentic-frontier delta narrowing per [`SK-QUAL-009`](../features/quality-eval/FEATURE.md)); §1.4 was-#1 becomes new #2 reframed as "verify the invite-valve end-to-end" (because SK-GATE-007 shipped but no agent has walked FLOW-004 inbox-to-200); demoted §3 picks one slot each; (b) `Current status` KPI table gains two BIRD/Spider rows at the top with the real numbers + cron schedule; (c) §1 intro now states "engine quality sits above this whole layer" and explains why; (d) §6 flag #1 marked resolved (founder picked Option A invite codes AND reaffirmed "lift the gate by clearing thresholds, don't remove it"). `docs/research/automated-icp-validation-plan-verification.md`: preamble synced — leads with the engine-quality bottleneck, advises future agents to verify FLOW-004 (gate-bypass path) rather than re-walking FLOW-001/002/003 in a loop without an invite. Mirror integrity check: normalized FLOW header diff empty. No new GLOBAL/SK introduced — GLOBAL-028/029/030 already cover the doc's role as the canonical acquisition progress tracker, its 20 KB exemption, the agent-ran update contract, and the evidence-grade self-review requirement; the founder directive is a priority re-rooting, not a new cross-cutting rule. **Verification before implementing more ICP flows:** `bash scripts/verify-flows.sh` against `https://nlqdb.com` passes all curl-observable assertions (Reddit + SO sandbox-egress advisories as expected); deployed gate state confirmed via `curl -X POST https://app.nlqdb.com/v1/ask` returning the unauthorized envelope (gate sits behind requirePrincipal — gate-403 is the post-auth path the walker hits with a device token). | Shipped after independent self-review iteration. Acquisition tracker now points the next agent at `quality-eval` velocity, not new ICP surfaces. Gate UI tells visitors what BIRD/Spider are without changing layout. Mirror integrity check (normalized `^#{2,3} FLOW-[0-9]+`) empty. |
| 2026-05-24 | Engine quality — SK-LLM-018 schema-fidelity planner prompt + diagnostic retry framing | Priority #1(c) from the 2026-05-24 preamble: "push BIRD via free-chain scaffolding work (prompt + retry-on-exec-error already wired per `SK-QUAL-009`) — target +5pp/week until 0.65." Free-chain BIRD-dev EX is **0.318** ([`eval-baseline.ts`](../../apps/api/src/gate/eval-baseline.ts) `bird_accuracy`, measured 2026-05-18) vs the Phase 2 floor **0.65** per [`SK-QUAL-005`](../features/quality-eval/FEATURE.md#sk-qual-005). The published evidence base for prompt-side wins on small models: **DIN-SQL** ([arXiv:2304.11015](https://arxiv.org/abs/2304.11015)) — schema-linking is one of four pillars and pins identifier-literal prompting as the per-question first step; **C3-SQL** ([arXiv:2307.07306](https://arxiv.org/abs/2307.07306)) §4.1 "Clear Prompting" three-C's (Clear / Calibrated / Consistent); **DAIL-SQL** ([arXiv:2308.15363](https://arxiv.org/abs/2308.15363)) Table 3 schema-linking ablation; **MAC-SQL** Refiner ([arXiv:2312.11242](https://arxiv.org/html/2312.11242v2)) §4.3 Table 3 +4.63 pp BIRD-dev EX (54.76% → 59.39%) surgical-fix posture (MAGIC [arXiv:2406.12692](https://arxiv.org/pdf/2406.12692) supplies the broader iterative-self-correction frame). Aggregated free-chain headroom from these: **+3–5 pp BIRD-dev EX**. | `packages/llm/src/prompts.ts`: `PLAN_SYSTEM` widened 4→6 bullets — added (a) "Use only tables and columns that appear literally in the provided schema; preserve identifier casing exactly", (b) "When the goal includes an `Evidence:` block, treat it as authoritative annotator context — apply the formulas and column hints it names" (leverages the `evidence` field `tools/eval/src/runner.ts` line 216–218 already concatenates into the goal), (c) "Emit SQL valid for the named dialect — no cross-dialect features (e.g. no TOP/PIVOT for postgres or sqlite; postgres-specific casts only when dialect is postgres)". `buildPlanUser` `previousAttempt` block reframed from the single line "Produce a different SQL shape that avoids that error" to three diagnostic-first bullets — same Goal preservation, schema-only identifier restriction, surgical-fix discipline ("change only what the error names — not the overall approach"). SQL truncation cap (500 chars) unchanged; first-attempt path unchanged. `packages/llm/test/prompts.test.ts`: two new `describe` blocks (7 new assertions) pin the contract — PLAN_SYSTEM schema-link + Evidence + JSON-strict bullets; `buildPlanUser` first-attempt path absent of retry clutter; retry block carries SQL + Error + three directive bullets; LLM-throw case (error but no SQL); 500-char cap. New decision body [`docs/features/llm-router/decisions/SK-LLM-018-schema-fidelity-prompt.md`](../features/llm-router/decisions/SK-LLM-018-schema-fidelity-prompt.md) (5-field; cites DIN-SQL / C3-SQL / DAIL-SQL / MAGIC / MAC-SQL evidence base by arXiv ID). [`docs/features/llm-router/FEATURE.md`](../features/llm-router/FEATURE.md) gains an SK-LLM-018 reference line; net-shrunk to stay under the doc's 25-KB-but-trending budget by relocating SK-LLM-015's body to `decisions/SK-LLM-015-openrouter-codegen-default.md` and tightening Open-questions self-references (25,152 → 25,102 B post-iteration-2 fixes; ≥ -50 byte net). All four production paths consume the prompt change automatically: free chain (Groq / Gemini / Workers-AI / OpenRouter) via `packages/llm/src/providers/_chat-provider.ts::plan()`, `apps/api/src/ask/orchestrate.ts` validator-reject retry, `tools/eval/src/exec-retry.ts::withExecRetry` exec-error retry, and the `agentic-frontier` eval lane. **Verification artifacts:** (1) `bun run --filter @nlqdb/llm test` → 84 / 84 pass (was 77; +7 new prompts-test assertions); (2) `bun run --filter @nlqdb/eval test` → 160 / 160 pass (zero regression in the retry+lane+score test surface that consumes `previousAttempt`); (3) `bun run --filter @nlqdb/api test` → 661 pass / 6 skipped (zero regression in orchestrate's `withStageRetry("plan")` validator-reject loop that consumes the same prompt template); (4) typecheck green via `bun run typecheck`. **Why this is the right pick now, not few-shot:** few-shot exemplars on small models would cost 2–4 k tokens each (BIRD-Mini schemas already push 2–4 k via `introspectSchema`) — the schema-link directive is the cheaper first cut. Few-shot stays open for a follow-up if BIRD doesn't reach ≥ 0.50 on the next [`quality-eval-bird-mini.yml`](../../.github/workflows/quality-eval-bird-mini.yml) Mon 04:00 UTC cron. **Mirror integrity check:** no FLOW added — this is an engine-quality decision, not an acquisition surface; normalized `^#{2,3} FLOW-[0-9]+` diff across `automated-icp-validation-plan{,-verification}.md` stays empty. The verification mirror's "Status (2026-05-24)" preamble still reads BIRD 0.318 because `eval-baseline.ts` is unchanged in this PR — the value updates when the next weekly Mon cron lands a fresh measurement, per `SK-QUAL-005`. | Shipped. Prompt-side scaffolding for the BIRD-gap close is live in `packages/llm/src/prompts.ts` and consumed identically by production + eval. Next agent run picks up the binding signal from the **first weekly `quality-eval-bird-mini.yml` cron after this merge** — if BIRD moves ≥ +3 pp the hypothesis confirms; if flat, few-shot exemplars become the next slice. No `eval-baseline.ts` write in this PR (baseline updates land via the cron + a follow-up PR per `SK-QUAL-005`'s separation of measurement from prompt change). |
| 2026-05-24 | §1.1+§1.4 daily acquisition-health cron (SK-STRG-003) + verification re-sync | Close the two pending open questions in `stranger-test/FEATURE.md` ("Daily cron + R2 archive" and "Continuous FLOW-004 regression watch") in one move; align both mirror files with the verified-twice FLOW-004 evidence; do verification before implementing any new ICP flow per the founder directive in this PR conversation. Acquisition-tracker preamble had FLOW-004 listed as priority #2 "verified-once, not continuously verified" — daily cadence closes that gap and surfaces a Resend-template / KV-key / middleware regression before the next stranger lands. | New [`.github/workflows/acquisition-health.yml`](../../.github/workflows/acquisition-health.yml) (SK-STRG-003 in [`stranger-test/FEATURE.md`](../features/stranger-test/FEATURE.md)): daily `0 6 * * *` cron + `workflow_dispatch` (`base_url` override for previews, `skip_flow_004` for invite-conservation runs). Walks `verify-flows.sh + stranger-test.sh + flow-004-walk.sh` under `continue-on-error: true`; uploads `tools/stranger-test/results/*` as `acquisition-health-<run_id>` artifact with 90-day retention; summary table hoists each walker's canonical `state` from its JSON so the agent reading the run summary can react without downloading the artifact; `verify-flows` step sets `set -o pipefail` so `tee` can't mask the script's real exit code. Playwright Chromium cached via `actions/cache@v4` keyed by `tools/stranger-test/package.json` AND `bun.lock` (so a transitive Playwright bump invalidates the cache) with `restore-keys` for incremental priming. **`exit-0-unconditionally`** is the load-bearing piece — GitHub emails the repo owner on scheduled-workflow failure on the default branch by default, which would create the founder-facing notification channel the operator loop forbids; draining failure into the artifact JSON routes it back through the next agent run as required by `GLOBAL-028`. **Verification before implementing anything new (per this PR brief):** (a) `bash scripts/verify-flows.sh` against `https://nlqdb.com` — all 49 curl-observable assertions pass (Reddit + SO sandbox-egress advisories as expected); (b) `bash scripts/flow-004-walk.sh` against `https://app.nlqdb.com` — **passed three times** in 18s/15s/17s wall (mail.tm `wshu.net` inbox minted with `redact()` now applied to the address in stdout, waitlist 200, Resend invite arrived in 13s/10s/11s, control returned `403 feature_gated`, invite returned `HTTP 200` — full SK-GATE-007 invariant proof on every run); (c) mirror integrity check (`diff` of `^#{2,3} FLOW-[0-9]+` across both `automated-icp-validation-plan{,-verification}.md`) empty. **Independent self-review (sub-agent, opus 4.7) found 4 MINORs across criteria 4/6/8/10; this row reflects the iteration that closed all 4:** (M1 security) `flow-004-walk.sh` `ok` line now redacts the throwaway mail.tm address to first-4 + last-4 + domain so the GH Actions raw log never exposes the full local-part; (M2 best-practices) Playwright cache key now hashes `bun.lock` AND `tools/stranger-test/package.json` plus `restore-keys: playwright-${{ runner.os }}-` for incremental priming when the resolved version moves; (M3 UX) summary table now carries a `state` column populated from each walker's JSON so the agent doesn't have to download the artifact to know whether to react; (M4 robustness) `verify-flows` step now `set -o pipefail` so `tee`'s exit can't mask verify-flows.sh's real exit code in `$GITHUB_OUTPUT`. **Doc syncs:** impl plan preamble priority #2 and #5 rewritten to reflect SK-STRG-003 landing; "What's shipped today" block lifts "daily-cron unshipped" and adds the SK-STRG-003 entry; FLOW-004 row counts updated to "passed 3×"; verification mirror FLOW-004 outcome log gets three 2026-05-24 walks + status preamble updated; `stranger-test/FEATURE.md` Status line gains SK-STRG-003, two Open questions resolved (R2 archive deferred separately), SK-STRG-001/002 net-shrunk to keep the file under the 20 KB cap; SK-STRG-002 redact contract updated to name throwaway-email addresses alongside invite codes / JWTs. No new GLOBAL — GLOBAL-028/029/030 already cover the doc role + 20 KB exemption + agent-ran update contract; this cron is one SK-* under the existing `stranger-test` feature. | Shipped after one round of independent self-review iteration (PR #276 comment chain). The §1.4 invite-valve is now **continuously regression-watched** without a founder notification channel; SK-STRG-003 closes both pending stranger-test open questions in one workflow file. Mirror integrity check empty. |
| 2026-05-24 | §1.1 invite-bearing composer (SK-STRG-004) + `/solve/`+`/vs/` invite-capture regression fix + first-ever browser HTTP 200 | Close the documented "Invite-bearing mode for the Playwright walker" open question in `stranger-test/FEATURE.md`; verify the browser-side `captureInviteFromUrl` + `X-Invite-Code` happy path that SK-STRG-002 (curl-only) cannot prove; do verification first per the founder directive in this PR brief. Composes `flow-004-walk.sh` (HTTP-observable, already proven) + `stranger-test.sh` (browser-observable, gate-blocked) into a single walk that exercises the full SK-GATE-007 happy path through a real Chromium session. | **Composition seam (`scripts/flow-004-walk.sh`):** new `FLOW_004_INVITE_OUT=<path>` env writes the raw invite code to a mode-600 sidecar file after step 3; `note` line documents the side effect; behaviour unchanged when the env is unset. **Composer (`scripts/stranger-test-invited.sh`, new — SK-STRG-004 / [`decisions/SK-STRG-004-invite-bearing-composer.md`](../features/stranger-test/decisions/SK-STRG-004-invite-bearing-composer.md)):** bash wrapper that invokes `flow-004-walk.sh` with `FLOW_004_INVITE_OUT=<sidecar>`, reads-and-immediately-deletes the sidecar (trap-registered before any side effect; `EXIT INT TERM` all clean up), shape-validates the code against `/^[A-Za-z0-9_-]{16,128}$/`, then exports it as `NLQDB_INVITE_CODE` and forks `bash scripts/stranger-test.sh --out <walk-invited-<utc>.json>` with `unset FLOW_004_INVITE_OUT` so the child can't re-read the sidecar path. **Runner (`tools/stranger-test/src/runner.ts`):** new `--invite-code <c>` flag (also reads `NLQDB_INVITE_CODE` env) with shape validation; pushed through to `walkFlowNNN` via a new optional 5th argument. **Walkers (`flows/flow-00{1,2,3}.ts`):** when `inviteCode !== null`, navigate to `${path}?invite=<c>` via the new shared `withInviteParam(path, code)` helper in `browser.ts`; immediately assert `localStorage["nlqdb_invite"] === code AND ?invite= stripped` via `assertInviteCaptured(page, stepNum, code)` (step 9 in flow-001, step 10 in flow-002/003 — placed at the slot that doesn't collide with the existing step numbering); failure detail on the `/v1/ask` submit step now calls out the SK-GATE-007 regression signature (`feature_gated WITH invite`). `WalkResult.inviteBearing: boolean` added to the JSON shape so the §1.2 KPI dashboard can split TTFV by mode. **Bun-runtime hardening (incidental but load-bearing):** attached `.catch(() => null)` AT CONSTRUCTION to every `page.waitForResponse(...)` site in flow-001/002/003 — Bun's stricter unhandled-rejection detector was crashing the walker between waitForResponse() and `await` when the page closed mid-flight (CI's Node tolerated the later .catch; Bun did not). Tests added: 4 new `withInviteParam` cases (null pass-through, no-query append, query-merge, malformed-code rejection) — total 11/11 pass. **Web-app regression caught + fixed:** the first live composer walk (`bash scripts/stranger-test-invited.sh --flows flow-002,flow-003 --prompts 1`) failed step 10 on `/solve/cheap-internal-dashboard?invite=…` AND `/vs/supabase?invite=…` with `stored=<null> urlClean=false` — `[slug].astro` script bundles did not call `captureInviteFromUrl()`, so a stranger landing on a launch URL pointed at either page lost the invite at the first `location.assign("/app/new")` (which drops the query string). **Fixed in same PR**: added the `import { captureInviteFromUrl } from ...` line + `captureInviteFromUrl();` call to `apps/web/src/pages/solve/[slug].astro` AND `apps/web/src/pages/vs/[slug].astro`; verified `bun run build` inlines the call into the bundled `/_astro/_slug_.astro_*.js`. **Live evidence (`https://app.nlqdb.com`, 4 walks total):** (a) homepage invite-bearing walk via composer at 21:15:54Z → **HTTP 200 on `/v1/ask` for the first time since SK-STRG-001 shipped** (ttfvMs 4146; step 9 captureInviteFromUrl ok; step 5 gate-honoured); (b) flow-002+003 composer walk at 21:16:34Z → step 10 fails (regression discovered) on both walked slugs; (c) FLOW-004 standalone walks at 21:04:13Z + post-composer triple pass — each control returned `403 feature_gated` and invite returned `HTTP 200` in 17–18s. **Verification before implementing:** `bash scripts/verify-flows.sh` against `https://nlqdb.com` passed all 49 curl-observable assertions (Reddit + SO sandbox-egress advisories as expected); `bun run --filter @nlqdb/stranger-test test` + `typecheck` both green (11/11 tests pass); `cd apps/web && bun test src/data` 26/26 pass; `bunx astro check` 0 errors / 0 warnings; `bun run build` emits all 20 pages cleanly including the patched `/solve/` + `/vs/` bundles. **Doc syncs:** verification mirror outcome rows added to FLOW-001 (passed invite-bearing), FLOW-002 + FLOW-003 (failed step 10 → regression fixed in same PR); FLOW-001/002/003 status dashboard rows updated; verification mirror "Invite-bearing variant (SK-STRG-004)" subsections added under each flow's Triage; FLOW-004 outcome log gets the composer-pass triple-walk row. `stranger-test/FEATURE.md` Status line names SK-STRG-004; SK-STRG-004 body extracted to `decisions/SK-STRG-004-invite-bearing-composer.md` to stay under the 20 KB cap (FEATURE.md 19842 → 20048 B; net +206 B). Touchpoints gain `scripts/stranger-test-invited.sh`. Open questions: "Invite-bearing mode for the Playwright walker" marked **resolved** (replaced with a one-line back-reference to SK-STRG-004). `AGENTS.md` path map updated (`scripts/stranger-test-invited.sh` added; net-shrunk by 11 B via the `run/**` row's redundant SK pointer trim). No new GLOBAL — GLOBAL-028/029/030 already cover the doc role + 20 KB exemption + agent-ran update contract; this is one SK-* under the existing `stranger-test` feature plus a tiny same-PR web-app regression fix. **Mirror integrity check:** normalized `^#{2,3} FLOW-[0-9]+` diff across both tracker files stays empty. | Shipped. The §1.1 anti-self-deception layer now has a regression detector for the browser-side invite-bearing path that the curl FLOW-004 walker can't exercise. The first walk caught a real `/solve/`+`/vs/` regression — fixed in the same PR. The first browser HTTP 200 on `/v1/ask` is recorded in the verification mirror with full triage trail. Next agent's pick: (1) post-deploy re-walk of `stranger-test-invited.sh --flows flow-002,flow-003` after `deploy-web.yml` ships to verify the `captureInviteFromUrl` fix, (2) triage the FLOW-001 step 6 trace-toggle regression the composer surfaced — the gate-403 was masking it. |
| 2026-05-24 | SK-STRG-004 round-2 self-review iteration (C1 invite-leak + M1 size + M2/M3 sidecar hygiene + walker stdout) | Independent self-review (sub-agent, opus 4.7) on PR #278 found 1 CRITICAL (raw `?invite=<code>` interpolated into step-1 description in `flow-002.ts`/`flow-003.ts` — landed verbatim in the artifact JSON, would have shipped to the GH Actions 90-day artifact if the composer were cron-wired; flow-001 was safe because its step-1 description is a fixed string), 1 MAJOR (`FEATURE.md` 20,048 B over a strict decimal-KB reading of D4), 5 MINOR (sidecar not gitignored; sidecar timestamp lacks PID for two-runs-per-second concurrency; runner stdout JSON leaked the same string by virtue of carrying steps; unrelated AGENTS.md trims; `flow-004-walk.sh` exit-3 burns invite cap with no recovery path), 2 NIT. | (C1) New `redactInviteFromUrl(url)` helper in `tools/stranger-test/src/browser.ts` (case-insensitive regex on `[?&]invite=`, stops at `&`/`#`); applied in `flow-002.ts`/`flow-003.ts` step-1 description to redact the URL before interpolation; the underlying `page.goto(url, ...)` still uses the real URL (the redaction is display-only). 6 new test cases in `personas.test.ts` (start-of-query, mid-query, before-fragment, no-invite-param pass-through, case-insensitive, follow-on params survive) — total 17/17 pass. Local leaked-artifact JSON files scrubbed with `rm -fv`; the live-leaked invite `obzWju4RG10ldt3Jfp6gow` from the original walk was **burned by the agent post-discovery** via a one-shot `POST /v1/ask` with that code (HTTP 200 confirmed consumption) — eliminating the residual 30-day-TTL exposure. (M1) `FEATURE.md` net-shrunk from 20,048 → 19,987 B by tightening SK-STRG-002's Why-field (removed redundant "2026-05-24" timestamping the body already implies); safely under both 20,000 and 20,480 byte readings of D4. (M2) New `.gitignore` entry `tools/stranger-test/results/.invite-*.txt` defends against trap-bypass (SIGKILL leaves sidecar; gitignore prevents accidental `git add`). (M3) Sidecar filename in `scripts/stranger-test-invited.sh` now carries `$$` PID (`.invite-<utc>-<pid>.txt`) so two composer runs in the same UTC second cannot race on read. (M4) Same fix as C1 — the runner's `JSON.stringify(result, null, 2)` ingested the step-1 descriptions, so redacting at the source eliminates the stdout path too. (M5/M6/N1/N2 deferred to follow-up; documented in the round-2 review comment chain.) **Verification:** `bun run --filter @nlqdb/stranger-test test` → 17/17 pass (was 11; +6 redact tests); `typecheck` green; `bunx biome check tools/stranger-test/` clean. Live `bash scripts/stranger-test-invited.sh --flows flow-002 --prompts 1` against `https://app.nlqdb.com`: composer + FLOW-004 pass, flow-002 step 10 fail (regression, expected pre-deploy); `grep -oE 'invite=[A-Za-z0-9_-]+' tools/stranger-test/results/walk-invited-*.json` returns zero matches → leak fix confirmed (`?invite=<redacted>` is the only form that appears). Live invite from the post-fix walk also burned via FLOW-004 step 5's curl probe (HTTP 200); no live code persists in either local disk or the (now-deleted) artifact. **Mirror integrity check:** normalized `^#{2,3} FLOW-[0-9]+` diff stays empty. | Shipped after round 1 of independent self-review iteration on PR #278. The leak window (between original composer walk and burn) was approximately 23 minutes; no third party knew the code; the production gate now sees an exhausted code on any future probe attempt. Round-2 review queued. |
| 2026-05-24 | SK-STRG-004 round-3 self-review iteration (defence-in-depth on session-event channels) | Independent self-review round 2 (sub-agent, opus 4.7) closed all round-1 findings AND surfaced 1 MINOR + 1 NIT in the same leak-class as C1: the `httpErrors` channel in `browser.ts` `openSession` pushed raw `r.url()` for any 4xx/5xx response outside the ignored set, and `consoleErrors` interpolated `msg.text()` / `pageerror.message` directly — both end up in JSON artifacts. Realistic blast radius small (slugs return 200 on the happy path) but trivially closeable with the same `redactInviteFromUrl()` helper. | Wrapped every push site in `openSession`'s page-event listeners (`page.on("console"|"pageerror"|"response")`) with `redactInviteFromUrl(...)` before the `.slice(...)` length cap; preserves the existing 240/200-char limits unchanged. No new helper, no new test — `redactInviteFromUrl` is a no-op on strings that don't carry `[?&]invite=` so the cost is one regex per push. **Verification:** `bun run --filter @nlqdb/stranger-test test` → 17/17 pass; `typecheck` green; `bunx biome check tools/stranger-test/` clean. Mirror integrity check stays empty. | Shipped after round-2 self-review iteration on PR #278. The leak surface is now closed at all push sites that ingest a URL or page-supplied string into the JSON artifact (step descriptions, runner stdout, console/pageerror/HTTP-response logs). |
| 2026-05-24 | SK-STRG-004 round-4 self-review iteration (step-7 `page.url()` defence-in-depth) | Round-3 self-review (sub-agent, opus 4.7) closed both round-2 findings and surfaced 1 MINOR: `flow-002.ts:207` and `flow-003.ts:178` pushed raw `page.url()` into step-7 JSON detail. The `captureInviteFromUrl` fix in this PR defends the normal case (the URL bar gets cleaned on /solve/ + /vs/), but if the Astro module script fails to load (CSP / MIME / parse error / bundled-import network blip), the URL would still carry `?invite=<RAW_CODE>` and land in the 90-day artifact. Same defence-in-depth rationale as round 3. | Wrapped both step-7 `page.url()` interpolations with `redactInviteFromUrl()` before the template-literal embed; extracted the URL into a `currentUrl` local so the redacted form is the only one in step description. **Verification:** 17/17 stranger-test tests pass; typecheck + biome clean. | Shipped after round-3 self-review iteration on PR #278. Every JSON-artifact push site that touches a URL is now wrapped through the redactor: step descriptions (flow-002/003 step 1), step-7 navigation detail, browser session events (httpErrors, consoleErrors, pageerror). Remaining `inviteCode`/URL surfaces are auditable: sidecar (mode 600 + gitignored + PID-named + trap-removed), env-passing to bun child (residual /proc/<pid>/environ — round-2 accepted NIT). |
| 2026-05-24 | §3.3 amendment site-wide `?invite=` capture | Verification-first: ran mirror integrity check (empty diff), `bash scripts/verify-flows.sh` against `https://nlqdb.com` (all curl-observable assertions green; Reddit/SO sandbox-egress advisory as expected), and `bash scripts/flow-004-walk.sh` (passed in 21s: control 403 + invite 200) BEFORE implementing. Then code inspection found a real gap: `apps/web/src/lib/invite.ts::captureInviteFromUrl()` was only invoked on the homepage and `/app/new` (matching SK-GATE-007 Consequence as originally written), but the impl plan §3.3 amendment and the preamble "What the next agent should pick" priority #6 both explicitly require press-launch URLs into `/solve/<slug>` and `/vs/<slug>` to carry the gate-bypass — once FLOW-004 verified the invite-valve, this was the only thing standing between a press-launch click-through and an HTTP 200 on `/v1/ask`. | `apps/web/src/layouts/Base.astro` now runs `captureInviteFromUrl()` once, site-wide (one bundled `<script>` block ~46 bytes minified that imports the existing `invite.ts` 390-byte chunk). Per-page duplicates removed from `apps/web/src/pages/index.astro` and `apps/web/src/pages/app/new.astro` (capture is idempotent; running on the same page twice is a no-op). New `apps/web/src/lib/invite.test.ts` (7 tests, bun:test): no-op on URL without `?invite=`; captures + strips on homepage; captures on `/solve/<slug>` press-launch URL; captures on `/vs/<slug>` press-launch URL; idempotent second call; preserves other query params (`?ref=hn&invite=...` → `?ref=hn`); SSR-safe (no throw when `window` undefined). [`docs/features/pre-alpha-gate/FEATURE.md`](../features/pre-alpha-gate/FEATURE.md) SK-GATE-007 Consequence updated: "on the homepage and `/app/new`" → "site-wide via `Base.astro` (so press-launch URLs into `/solve/<slug>` and `/vs/<slug>` per impl plan §3.3 amendment also capture)". `scripts/verify-flows.sh` gains a new agent-runnable probe (`Site-wide ?invite= capture — Base.astro bundled invite-capture is loaded`): fetches `/`, `/solve/<first-slug>/`, `/vs/<first-slug>/`; extracts the `/_astro/Base.astro_astro_type_script_index_0_lang.<hash>.js` src from the HTML; follows the `./invite.<hash>.js` import out of that bundle; greps the import target for `nlqdb_invite` (the localStorage key the capture writes — rollup keeps it as a string literal through minify). Asserts every probed page references the same Base.astro bundle hash. **Verification artifacts:** (a) `bun test apps/web/src/lib/invite.test.ts` → 7/7 pass; (b) `bun run --filter @nlqdb/web build` → 20 pages built, dist green; (c) probe against the local `apps/web/dist` (`python3 -m http.server 9999`) → all 12 invite-capture assertions pass — Base.astro bundle is 46 bytes (the import + call) and resolves to `invite.<hash>.js` which preserves `nlqdb_invite` through minify; (d) probe against the live `https://nlqdb.com` → 3 expected pre-deploy failures (deployed bundle pre-dates this PR — the probe correctly identifies the pre-deploy state and will turn green after the next `deploy-web.yml` run). §8 status dashboard updated (FLOW-001 6→7 of 8 (88%), FLOW-002 5→6 of 7 (86%), FLOW-003 5→6 of 6 (100%), FLOW-008 8→9 of 9 (100%)); FLOW-001/002/003 sub-task tables gained the new site-wide-invite-capture row; FLOW-008 gained the invite-capture probe row. Mirror integrity check (`diff` of `^#{2,3} FLOW-[0-9]+` across both `automated-icp-validation-plan{,-verification}.md`) remains empty — no new FLOW added; the existing FLOW blocks gained one sub-task each. No new GLOBAL/SK — this is a precision update to SK-GATE-007's Consequence so it matches the impl plan §3.3 amendment + preamble priority #6 the decision already implied. **Independent self-review (sub-agent, opus 4.7) on PR #277 found 4 issues (3 MINOR + 1 NIT); this row reflects the iteration that closed all 4:** (M1 error handling) wrapped `captureInviteFromUrl()` body in try/catch in `apps/web/src/lib/invite.ts` so a Safari Private Browsing `QuotaExceededError` on `localStorage.setItem` can't trip the site-wide boot-fallback overlay; added 8th unit test pinning the contract; (M2 security) added `<meta name="referrer" content="strict-origin-when-cross-origin">` to `Base.astro` head so the sub-100ms strip window can't leak `?invite=<code>` via cross-origin `Referer:` header; (M3 robustness) loosened `verify-flows.sh` regex from `Base.astro_astro_type_script_index_0_lang.<hash>.js` to `Base.astro_*.js` (and similarly for the invite chunk) so a future Astro version-bump that renames the rollup internal pattern doesn't false-fail the probe; added comment naming the Astro 5 dependency; (NIT) compressed Base.astro's 3-line comment to a single line per CLAUDE.md "one short line max" (WHY now lives in SK-GATE-007 Consequence). Re-ran all verification artifacts post-iteration: `bun test apps/web/src/lib/invite.test.ts` → 8/8 pass (was 7); `bun run --filter @nlqdb/web build` → 20 pages, dist green; `bash scripts/verify-flows.sh` against local `apps/web/dist` → all assertions green; `bunx astro check` → 0 errors; `bunx biome check` → clean. | Shipped pre-deploy after one round of independent self-review iteration (0 issues post-iteration). The invite-valve verified by FLOW-004 (signup → Resend → `X-Invite-Code` → 200) now extends to **every page**: a press-launch URL like `https://nlqdb.com/solve/cheap-internal-dashboard?invite=<code>` (Show HN, dev.to, IH long-form, AEO inbound) captures the code on landing and forwards it as `X-Invite-Code` on every subsequent `/v1/ask` — the gate-403 binding gap that has blocked FLOW-001/002/003 since their walker rows landed is now unblocked **for invite-bearing traffic specifically** (per priority #6 of the preamble). Unblocks priority #8 (Show HN with `?invite=` URL) materially: the launch URL now actually carries the user across the gate. Mirror integrity check empty. FLOW-001/002/003 walker re-pass requires the deploy to land + a real invite code in the walker, tracked as the existing `--invite-code` open question in `stranger-test/FEATURE.md`. |
| 2026-05-25 | §2.1 Dev.to source (SK-ICP-008) + FLOW-008 9th sub-task + pre-implementation verification | Sixth ICP scrape source — broaden P1/P3/P4 pain signal beyond HN+Reddit+GH+SO+IH. The §2.1 source mix today over-weights short-form discussion (HN/Reddit) and Q&A (SO) and under-samples first-person long-form developer blogging. Dev.to (Forem) is the largest indie dev-blogging surface and is listed alongside HN/Reddit in [`personas.md`](./personas.md) as a place P1/P3/P4 hang out, but was never wired into the scraper. Forem ships a documented public read API (`/api/articles`, ~3 RPS anon; [`developers.forem.com`](https://developers.forem.com/api/v1)) with a server-side `top=7` recency filter — strictly cheaper to consume than IH's unofficial mirror. Founder directive 2026-05-24 keeps engine quality as priority #1; this is additive evidence work that strengthens the cluster step without touching the gate or §3 surfaces. **Pre-implementation verification (per the PR brief):** (a) `bash scripts/verify-flows.sh` against `https://nlqdb.com` — all 49 curl-observable assertions pass (Reddit + SO sandbox-egress advisories as expected); (b) `bash scripts/flow-004-walk.sh` against `https://app.nlqdb.com` — **passed** in 19s wall (mail.tm `wshu.net` inbox, waitlist 200, Resend invite in 11s, control returned `403 feature_gated`, invite returned `HTTP 200`; SK-GATE-007 invariant honoured); (c) mirror integrity check (`diff` of `^#{2,3} FLOW-[0-9]+` headers) empty before the edit. **Source vetting:** Lobste.rs was the first candidate considered — rejected because its `robots.txt` sets `User-agent: * Disallow: /` plus `Content-Signal: ai-input=no, ai-train=no, search=yes` (explicit scrape-deny). Dev.to's `robots.txt` allows `/api/*` for any user-agent — clean fit. | `apps/api/src/icp-scrape.ts` gains `fetchDevto` (5 tag queries: `database`, `sql`, `postgres`, `webdev`, `orm`; `per_page=15&top=7` for server-side 7-day filter) and a sixth element in the `Promise.all`. Items stored as `source: "devto"`, `id: "devto-<article.id>"` (prefix prevents numeric-ID collisions); items with unparseable `published_timestamp` dropped pre-write. `User-Agent: nlqdb-icp-bot` (same string as IH/GH per SK-ICP-006/004) + `AbortSignal.timeout(10s)` + per-tag error isolation; new OTel span `nlqdb.icp.fetch.devto` carries `nlqdb.icp.items` and `http.response.status_code`. LogSnag description now reports `DEV: <n>` alongside HN/Reddit/GH/SO/IH counts. `apps/api/test/icp-scrape.test.ts` gains 4 new tests (happy-path store with `devto-` prefix; `User-Agent` + `top=7` URL contract; unparseable-timestamp drop; 503 graceful — total 23/23). `scripts/verify-flows.sh` gains `FLOW-008 source Dev.to /api/articles` probe (fatal severity; no managed-egress block on the agent VM — confirmed via the post-implementation re-walk below). `docs/features/icp-mining/FEATURE.md` gains SK-ICP-008 (5-field block); One-liner + Status + Touchpoints + GLOBAL-013/-014 commentary updated for the 6-source mix; net-shrunk SK-ICP-001/003/004/005/006/007 prose to land at 19,636 bytes (was 19,981; net −345 B, under the 20 KB cap). `docs/research/automated-icp-validation-plan.md` §2.1 sources table gains a Dev.to row; §2.2 expanded note added; FLOW-008 sub-tasks 8/8 → 9/9; status dashboard row updated to "curl probe of 6 sources"; "What's shipped today" line lists Dev.to; this Progress log row. `docs/research/automated-icp-validation-plan-verification.md` FLOW-008 walkthrough gains step 6 (Dev.to probe assertion); status dashboard row updated to "6 sources"; outcome log gains today's row. **Live API probe before commit** from this VM: `curl https://dev.to/api/articles?tag=database&per_page=15&top=7` → `HTTP 200, 15 items`; sample-0 fields verified (`id`, `title`, `url`, `published_timestamp`, `tag_list`, `public_reactions_count`, `comments_count`). **Post-implementation verification:** (1) `bun x vitest run test/icp-scrape.test.ts` → 23 / 23 pass (was 19; +4 new for SK-ICP-008); (2) `bash scripts/verify-flows.sh` re-run against `https://nlqdb.com` — all assertions green including the new Dev.to probe (HTTP 200, JSON-array body), Reddit/SO sandbox-egress advisories unchanged; (3) mirror integrity check post-edit (normalized `^#{2,3} FLOW-[0-9]+` diff across both tracker files) empty. No new GLOBAL/SK introduced beyond SK-ICP-008 — GLOBAL-028/029/030 already cover the doc role + 20 KB exemption + agent-ran update contract; this is a feature-local SK under existing `icp-mining`. | Shipped. Sixth source live for the next Mon 2026-06-01 cron (the 2026-05-26 first-cron run already executed on the 5-source mix). The Forem API matches the existing per-source error-isolation + OTel pattern exactly, so the marginal regression surface is the response-schema contract (`id`, `published_timestamp`, JSON-array shape) which the new tests + FLOW-008 probe both pin. Mirror integrity check (`diff` of `^#{2,3} FLOW-[0-9]+`) stays empty — no new FLOW added; FLOW-008 was the only existing flow that needed sub-task extension. |
| 2026-05-29 | §3.5 Wren AI comparison page (5th `/vs/<slug>`) + pre-implementation verification + competitors.md sync | Acquisition surface — second `P3 analyst` `/vs/` slot, this time on the semantic-layer / governance angle the existing four `/vs/` pages don't cover. Wren AI ([getwren.ai](https://getwren.ai), OSS at [github.com/Canner/WrenAI](https://github.com/Canner/WrenAI), 15k+ stars, multi-licensed — Apache 2.0 for `core/` + `sdk/` + `skills/` + `examples/` + root, CC-BY-4.0 for `docs/`, AGPL-3.0 reserved for future modules per the LICENSE file) is the next-pick after Outerbase per [`comparison-pages/FEATURE.md`](../features/comparison-pages/FEATURE.md) Open questions — its MDL semantic model + row- and column-level access controls + SOC 2 Type II posture are exactly the differentiation surface nlqdb cannot match in Phase 1, so an honest side-by-side is the page buyers searching `wren ai alternative` arrive at the decision moment on. Founder directive 2026-05-24 keeps engine quality as priority #1; this is additive AEO work that doesn't touch the gate or any Worker code (static Astro page only), so the §3.5 "tractor beam" advances without blocking on BIRD/Spider. **Pre-implementation verification (per the PR brief):** (a) mirror integrity check (`diff` of `^#{2,3} FLOW-[0-9]+` across `automated-icp-validation-plan{,-verification}.md`) — empty before the edit; (b) `bash scripts/verify-flows.sh` against `https://nlqdb.com` — all curl-observable assertions green (Reddit + SO sandbox-egress advisories as expected); (c) `bash scripts/flow-004-walk.sh` against `https://app.nlqdb.com` — **passed** in 21s wall (mail.tm `wshu.net` inbox, waitlist 200, Resend invite in 11s, control returned `403 feature_gated`, invite returned `HTTP 200`; SK-GATE-007 invariant honoured); (d) WebFetch verification of the claims that land in user-facing copy — `getwren.ai/` (tagline + cloud/self-host options), `getwren.ai/pricing` (Free/Essential/Enterprise tiers, **SOC 2 Type II on Essential + Enterprise only — Free plan lists no compliance bullets**, 20-credit free allowance + 80 first-14-day credits), `github.com/Canner/WrenAI` (**multi-licensed per the LICENSE file: Apache 2.0 for `core/` + `sdk/` + `skills/` + `examples/` + root, CC-BY-4.0 for `docs/`, AGPL-3.0 reserved for future modules**, MDL semantic model with models/columns/relationships/views/cubes/metrics + RLAC/CLAC, Apache DataFusion engine documenting 22+ data sources — PostgreSQL/BigQuery/Snowflake/DuckDB explicit, Python SDK + LangChain/LangGraph bindings + Claude Code skill bundle, 15k+ stars). | `apps/web/src/data/competitors.ts` gains the Wren AI entry (5th `Competitor`): persona `P3 analyst`, 4 `whenChooseUs` + 4 `whenChooseThem` bullets (SK-CMP-001), 12-row feature parity table, 6 FAQs (SK-CMP-003 4-6 range) all naming "Wren AI" verbatim (SK-CMP-003 requires ≥1), demo goal `"current month's signups grouped by acquisition channel"`. `apps/web/src/pages/vs/[slug].astro` `getStaticPaths()` picks the new slug up unmodified per SK-CMP-002. `apps/web/src/pages/vs/index.astro` description updated to name Wren AI alongside Supabase / Vanna / Mem0 / Outerbase. `scripts/verify-flows.sh`: `VS_SLUGS` / `VS_TITLES` arrays gain `wrenai` / `Wren AI`; sitemap floor 13 → 14 (5 solve + 5 vs + 4 root). `docs/competitors.md`: new entry under §2 (Text-to-SQL / NL-over-DB tools) covering license + MDL + RLAC/CLAC + SOC 2 + engine list + threat-vector; threat-matrix table gains a Wren AI row. `docs/features/comparison-pages/FEATURE.md`: status line `4 → 5`; Open questions amended to record Wren AI as the second P3 slot and pin AskYourDatabase / Retool AI as the next-pick. `docs/research/automated-icp-validation-plan.md` §8 FLOW-003 dashboard row + verification mirror FLOW-003 dashboard row + outcome log all updated; mirror integrity check stays empty (no new FLOW added). No new GLOBAL/SK introduced — the addition fits inside the existing data-driven contract per SK-CMP-002. **Honesty contract on the page itself:** the `whatItDoesnt`-equivalent (`whenChooseThem` + the feature table's `us: no` / `us: partial` rows) names every dimension Wren AI ships and nlqdb does not — MDL semantic model, RLAC/CLAC, 22+ engines, paid-plan SOC 2 Type II, multi-license OSS self-host. No buyer-facing SK-* leak (lesson from the 2026-05-24 Outerbase round-2 review); the only internal-ID reference is on the `sk_live_*` row glossing what nlqdb's per-DB keys scope by — that's a public SDK contract, not a documented-decision ID. **Post-implementation verification:** (1) `bun test apps/web/src` → 106 / 106 pass (was 93 before solve.ts updates; competitors.test.ts contributes 9, solve.test.ts 17); (2) `cd apps/web && bun run build` → 21 pages built including `/vs/wrenai/`; (3) `bunx astro check` → 0 errors / 0 warnings; (4) local probe via `NLQDB_BASE_URL=http://localhost:9999 bash scripts/verify-flows.sh` against `apps/web/dist` (`python3 -m http.server 9999`) — all assertions green including `/vs/wrenai/`, `<h1>nlqdb vs Wren AI</h1>` template-match, FAQPage JSON-LD, 14-entry sitemap floor, `/llms.txt` enumerates `vs/wrenai`; (5) live `bash scripts/verify-flows.sh` against `https://nlqdb.com` — exactly 4 expected pre-deploy failures (`/vs/wrenai/` 404 + redirect probe 404, sitemap floor 13 < 14, `llms.txt` missing `vs/wrenai`); all clear post-`deploy-web.yml`; (6) mirror integrity check post-edit (normalized `^#{2,3} FLOW-[0-9]+` diff) empty. | Shipped after one round of independent self-review iteration. **Round-1 self-review (sub-agent, opus 4.7) found 9 issues (0 CRITICAL / 2 MAJOR / 5 MINOR / 2 NIT); this row reflects the iteration that closed every actionable finding:** (M1) "SOC 2 Type II across all plans" refuted by WebFetch of `getwren.ai/pricing` (Free plan lists no compliance bullets; SOC 2 ships on Essential + Enterprise paid plans only) — fixed in 6 user-facing locations (`competitors.ts` whenChooseThem[3] / SOC 2 feature-table note / FAQ4; `docs/competitors.md`; `comparison-pages/FEATURE.md` Open Questions; this Progress log row); SOC 2 feature-table `them: shipped` → `them: partial` to match the Essential/Enterprise-only contract; (M2) "Apache 2.0" framing refuted by WebFetch of `github.com/Canner/WrenAI/blob/main/LICENSE` (multi-licensed: Apache 2.0 for `core/` + `sdk/` + `skills/` + `examples/` + root, CC-BY-4.0 for `docs/`, AGPL-3.0 reserved for future modules) — fixed in 5 user-facing locations (`competitors.ts` inline-URL comment / OSS-row feature-table note / FAQ6 question+answer; `docs/competitors.md`; this Progress log row); (N1) SK-CMP-001 ≤16-word rule violations in 5/8 bullets — every over-budget bullet tightened to ≤16 words; (N2) `as of May 2026` qualifier added to FAQ1's benchmark claim + FAQ4's SOC 2 claim so live drift gives the buyer a discount lens; (N3) `whenChooseUs[3]` reworded to acknowledge Wren AI's Claude Code skill bundle while preserving the MCP `create_database` differentiator (matches the feature-table note's nuance); (N4) `scripts/verify-flows.sh` sitemap-floor comment expanded to name the data files the floor tracks (`COMPETITORS.length + SOLVE_ENTRIES.length + STATIC_ROUTES`); (Nit1) inline-URL comment trimmed per CLAUDE.md "one short line" + WHY-not-WHAT (also covers the M2 fix); (Nit2) `vs/index.astro` description switched from named-list to generic phrasing so it doesn't cross the ~155-char SEO-meta sweet spot at 6+ entries. **N5 (demo-empty-DB UX) is feature-scope and deferred** per the reviewer's own note. All re-verification artifacts re-ran post-iteration: `bun test apps/web/src` 106/106 pass; `bun run --filter @nlqdb/web check` 0 errors / 0 warnings; `bun run build` 21 pages; live verify-flows 4 expected pre-deploy failures; mirror integrity empty. Comparison page count 4 → 5; second `/vs/` page covering P3 (semantic-layer / governance angle vs Vanna's translator-only angle). Mirror integrity check stays empty — no new flow added. FLOW-003 verification mirror outcome log gets the pre-deploy build-time row; the live-walk row appends after `deploy-web.yml` deploys `apps/web/dist`. The §3.5 "tractor beam" tractor count advances without touching the gate or any Worker code; the engine-quality priority #1 from the 2026-05-24 founder directive is not regressed because no LLM / `/v1/ask` path changed. |
| 2026-05-30 | §3.1 candidate `/solve/no-migration-files-database` pulled after round-2 review caught product fabrication; PR #288 ships verification-only progress | Acquisition surface candidate — first /solve/ page that would have named nlqdb's **schema-widening** angle explicitly. The existing 5 /solve/ pages cover provisioning (skip-postgres-setup), agent memory (give-ai-agent-persistent-memory), Retool-replacement (cheap-internal-dashboard), text-to-SQL accuracy (natural-language-sql-without-training-data), and the leaderboard archetype (ship-leaderboard-no-sql) — no page surfaces the schema-migration angle, so it was the prima-facie next slot. **Pre-implementation verification did run** (mirror integrity empty; `bash scripts/verify-flows.sh` against `https://nlqdb.com` all curl-observable assertions green; `bash scripts/flow-004-walk.sh` against `https://app.nlqdb.com` passed in 18s wall — control 403 + invite 200, SK-GATE-007 invariant honoured). **Source-vetting on a candidate 7th Lemmy ICP source** also ran before the AEO pivot: probed `programming.dev` (returned `Content-Signal: search=yes, ai-train=no` + explicit ClaudeBot/GPTBot/CCBot disallow — respected, not crawled, same posture as the 2026-05-25 Lobste.rs rejection) and `lemmy.world` (dominated by Reddit-RSS bot bridges — `creator.bot_account=true` on 13/20 probed posts; remaining 7 split across programming.dev and 3 native fediverse instances). The verification work was real even though no surface ships from this PR. Candidate `SolveEntry` was added to `apps/web/src/data/solve.ts` and iterated through one round of self-review (round-1: opus 4.7 found 0 CRITICAL / 2 MAJOR / 5 MINOR / 3 NIT — author closed M1 audit-log fabrication, M2 12 buyer-facing SK/GLOBAL leaks, m1–m5, n1, n3; n2 deferred). **Round-2 self-review (opus 4.7) escalated to verdict `block` with one new CRITICAL the round-1 review had missed:** the candidate page's entire thesis — NL-driven `ALTER TABLE ADD COLUMN NULL` widening — is not a shipped capability today. Code-side proof read against the actual repo at commit `fdb69eb`: `apps/api/src/ask/sql-validate.ts:90` `LEADING_VERB_REJECT` rejects every DDL verb (`alter` / `drop` / `create` / `truncate` / `grant` / `revoke` / `vacuum`) on the `/v1/ask` path; `apps/api/src/ask/orchestrate.ts:156` returns `error.status="schema_unavailable"` when `db.schemaHash` is null (so the candidate `demoGoal` would never reach a working first query against an anonymous DB even with the SK-GATE-007 invite-valve open); `apps/api/src/ask/types.ts:62-64` says `DDL via /v1/ask` is rejected by the allowlist and `DDL` in `AskDiff` is "reserved for the future db-create slice"; `apps/api/src/run/orchestrate.ts:83` uses the **same** `validateSql` so the `runSql` escape hatch the candidate page routed destructive DDL through also rejects DDL; `SK-DB-008` ([`docs/features/db-adapter/FEATURE.md:98`](../features/db-adapter/FEATURE.md)) describes the widening as **planner-observed on a SELECT against a new field**, not as an English DDL verb the user can request; [`docs/features/schema-widening/FEATURE.md`](../features/schema-widening/FEATURE.md) Status `partial` (the observed-fields collector and widening trigger ship post-Phase-0). The page would have shipped a promise the product doesn't keep. **Decision: pull the entire `SolveEntry` rather than reframe** — reframing into "what we're building" would have violated SK-SOLVE-002's "working `<nlq-data>` demo today" contract (the only honest demo for an unshipped capability is no demo). The revert restores `solve-pages/FEATURE.md` Status to "5 hand-curated pages", `scripts/verify-flows.sh` SOLVE_SLUGS + sitemap floor (14), and leaves the verification mirror's FLOW-002 row at its pre-PR state. Round-1 had already caught a smaller fabrication on the same candidate (a "per-DB audit log queryable via `POST /v1/run`" — `grep -rni "audit log" apps/api/src/` returns zero hits for any such endpoint) plus 12 buyer-facing SK/GLOBAL ID leaks in JSON-LD/meta strings; round-2 caught the page-scale one. No new GLOBAL/SK shipped (none would have been justified for an unshipped capability). | **Net acquisition surface change: zero** — but the verification work that ran before the candidate was scoped (FLOW-001/002/003 static + FLOW-004 end-to-end pass + Lemmy source vetting) is recorded for future agents under this row. Mirror integrity check (normalized `^#{2,3} FLOW-[0-9]+` diff across both tracker files) stays empty. FLOW-002 verification mirror status row + outcome log row reverted to their pre-PR state since no slug shipped. The engine-quality priority #1 from the 2026-05-24 founder directive is not regressed — no LLM / `/v1/ask` path changed; the gate behaviour is unchanged. **Lesson recorded for future agents:** before adding a /solve/ page that names a specific product capability, grep the actual `/v1/ask` / `/v1/run` allowlists + the relevant feature's `Status:` line + the cited SK's code-side touchpoints; if either says "post-Phase-0" or "rejected by allowlist", the page is a fabrication waiting to happen. The two-round self-review trail (round-1 caught a smaller audit-log fabrication; round-2 caught the page-scale fabrication round-1 missed) is the protection that worked. |
| 2026-05-31 | §2.1 GitHub Discussions source (SK-ICP-009) — 7th pain-signal source | Verification-first: ran the mirror integrity check (`diff` of `## FLOW-NNN` headers across both trackers — empty as required by GLOBAL-029), then `bash scripts/verify-flows.sh` against `https://nlqdb.com` (all curl-observable assertions green — including the existing 6 source-health probes; Reddit/SO sandbox-egress advisory as expected). BEFORE writing any code I live-probed `api.github.com/graphql` with the env's `GH_TOKEN` to confirm: (a) the PAT authenticates (`viewer { login } → omerhochman`); (b) GraphQL `search(query: "text to sql", type: DISCUSSION)` returns `discussionCount=8478` at `cost=1` per query against the 5000-pt/hr authenticated bucket; (c) `created:>2026-05-24` narrows that to 9 fresh discussions including `moorcheh-ai/memanto/discussions/564 — "How are you handling persistent memory in your CrewAI workflows?"` (a textbook P2 agent-builder pain quote the prior 6 sources never caught). Persona under-served: the prior 6-source mix skews P1/P3/P4 (Reddit subreddits aside); CrewAI/LangChain/Mem0/vector-DB Discussions are where P2 (agent builder) long-form complaints actually live. Found a real gap in the impl plan's §2.1 source table: GitHub Discussions wasn't listed even as a candidate. | `apps/api/src/icp-scrape.ts` gains `fetchGitHubDiscussions` (POST `https://api.github.com/graphql`, GraphQL `search(query, type: DISCUSSION, first: 10)`, 5 P1/P2/P4/P6 queries, same `created:>${isoDate(sevenDaysAgoUnix)}` filter SK-ICP-004 uses for Issues) and a 7th element in `Promise.all` (gated on `deps.ghToken`, matching the Issues isolation contract). Items stored as `source: "github_discussions"`, `id: "ghd-<node.id>"`. Headers: `Authorization: Bearer $GH_TOKEN` + `User-Agent: nlqdb-icp-bot` + `X-GitHub-Api-Version: 2022-11-28` + `Content-Type: application/json` + `AbortSignal.timeout(10s)`. OTel span `nlqdb.icp.fetch.github_discussions` carries `nlqdb.icp.source`, `nlqdb.icp.items`, `http.response.status_code`, and `nlqdb.icp.ghd.rate_remaining` (the GraphQL `rateLimit.remaining` from the same query — surfaces budget pressure without a second hit). Soft-failures: a GraphQL `errors` body is logged + treated as no items (other 6 sources unaffected); nodes with unparseable `createdAt` are dropped before KV write. LogSnag description gains `GHD: <n>` between `GH:` and `SO:`. `apps/api/test/icp-scrape.test.ts` gains 5 tests (POST + Bearer + bot UA + `DISCUSSION` body + `created:>` filter; absent-token short-circuit; GraphQL-error soft failure; unparseable-`createdAt` drop; basic store-and-dedup) — full file now 28/28 pass. `scripts/verify-flows.sh` FLOW-008 block gains a `POST /graphql` probe gated on `GH_TOKEN` (fatal severity, same contract as Issues), asserts the body carries `"discussionCount"`. Docs: SK-ICP-009 block in `docs/features/icp-mining/FEATURE.md`; SK-ICP-001 + GLOBAL-013 + GLOBAL-014 commentary updated to 7 sources; §2.1 source table row; §2.2 ✅ EXPANDED 2026-05-31 block; §8 FLOW-008 sub-tasks 9→10 (still 100%); status dashboard row; verification mirror walkthrough step 4 + pass criteria + outcome log row. **Verification artifacts:** (a) `bun --filter @nlqdb/api test test/icp-scrape.test.ts` → 28/28 pass; (b) `bun --filter @nlqdb/api typecheck` → exit 0; (c) `bun run biome check apps/api/src/icp-scrape.ts apps/api/test/icp-scrape.test.ts` → clean (auto-format applied); (d) `bash scripts/verify-flows.sh` against `https://nlqdb.com` → all assertions green including the new `FLOW-008 source GitHub /graphql (Discussions)` probe (HTTP 200, `discussionCount` present); (e) live `api.github.com/graphql` probe with the env `GH_TOKEN` returned `viewer.login=omerhochman`, `rateLimit.cost=1, remaining=4998`, and the CrewAI P2 quote cited above. Mirror integrity check (`diff` of `^#{2,3} FLOW-[0-9]+` across both files) remains empty — no new FLOW added; FLOW-008 gains one sub-task on each side. No new GLOBAL (the 20 KB exemption for both trackers is already documented as GLOBAL-028 + GLOBAL-029, and the evidence-grade edit contract is GLOBAL-030 — this PR adheres to all three without adding a new cross-cutting rule). | Shipped. 7th source live on the next Mon 06:00 UTC cron run; first GHD items land in `icp:item:<YYYYMMDD>:github_discussions:ghd-*` and flow through the existing SK-ICP-002 scoring + SK-ICP-003 clustering pipeline without further code changes (source string is propagated, not branched on, in both `icp-score.ts` and `icp-cluster.ts`). |
| 2026-06-01 | §2.1 Bluesky source (SK-ICP-012) — 8th pain-signal source | Verification-first per GLOBAL-030: (a) mirror integrity check (`diff` of `^#{2,3} FLOW-[0-9]+` headers across both trackers) — empty before edit; (b) `bash scripts/verify-flows.sh` against `https://nlqdb.com` — all curl-observable assertions green pre-edit (including the 7 existing source-health probes; Reddit/SO sandbox-egress advisory as expected); (c) `bash scripts/flow-004-walk.sh` against `https://app.nlqdb.com` — **passed in 18s wall** (mail.tm `wshu.net` inbox, waitlist 200, Resend invite in 10s, control 403 + invite 200; SK-GATE-007 invariant honoured). BEFORE writing any code I live-probed the AT Protocol AppView from this VM to confirm: (1) `public.api.bsky.app` 403'd from this agent VM (BunnyCDN block; not re-verified from CF Workers egress) — rejected for the cron's probe; (2) `api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=text+to+sql&limit=5&sort=latest` returns HTTP 200 with `{posts, cursor}` shape (canonical Express AppView, no auth); (3) `q=text+to+sql&since=<isoSeven>` returns 5 fresh posts including `"My SQL bot dies after two questions! Did you read the JP Morgan study?"` (textbook P2 agent-builder pain quote the prior 7 sources never caught) plus three multi-author academic threads (researcher demographic the prior 7 don't reach); (4) `agent memory` / `vector database` / `rag pipeline` / `supabase` each return 10 posts in 7d (server-side `since` filter is sharp). Web-researched (P2): `bsky.app/robots.txt` is `Allow: /` (no scrape-deny); `docs.bsky.app/docs/advanced-guides/rate-limits` documents AppView read endpoints as no-auth with "generous rate-limits" — cron's 5 calls/week is trivially inside. Persona under-served: prior 7-source mix under-samples P2 long-form pain that lives on Bluesky (post-2024 X exodus). Found a real gap in the impl plan's §2.1 source table: Bluesky wasn't listed even as a candidate. | `apps/api/src/icp-scrape.ts` gains `fetchBluesky` (GET `https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=<q>&limit=25&sort=latest&since=<isoSeven>` for 5 P1/P2/P3 queries: `text to sql`, `agent memory`, `natural language database`, `vector database`, `rag pipeline`) and a `bskyRkeyFromUri(at://.../app.bsky.feed.post/<rkey>) → rkey` helper, plus an 8th element in `Promise.all` (no auth gate). Items stored as `source: "bluesky"`, `id: "bsky-<post.cid>"`; URL rebuilt as `https://bsky.app/profile/<author.handle>/post/<rkey>` (handle already in `searchPosts` payload — no second-hop enrichment); title is the first 80 chars of `record.text`. Headers: `User-Agent: nlqdb-icp-bot` + `Accept: application/json` + `AbortSignal.timeout(10s)`. Pre-write drops: unparseable `record.createdAt`, missing handle/rkey/cid, non-`app.bsky.feed.post` URI (filters reposts/likes/follows that share the AppView search), empty text. OTel span `nlqdb.icp.fetch.bluesky` carries `nlqdb.icp.source` + `nlqdb.icp.items` + `http.response.status_code`. LogSnag description gains `BSKY: <n>` after `DEV: <n>`. `apps/api/test/icp-scrape.test.ts` gains 5 tests (success-path with URL rebuild + `score=likeCount`; URL contract pin including a `since=` value-within-60s-of-seven-days-ago check; unparseable-`createdAt` drop; non-`app.bsky.feed.post` URI drop; 503 graceful) — full file now 33/33 pass. `scripts/verify-flows.sh` FLOW-008 gains a `Bluesky /xrpc/app.bsky.feed.searchPosts` probe (fatal severity; `api.bsky.app` works from agent VM, no egress-block surface) asserting HTTP 200 + `"posts"` key; cross-compatible `date -u -d '7 days ago'` (GNU) and `date -u -v-7d` (BSD/macOS) bash idiom. Docs: SK-ICP-012 block in `docs/features/icp-mining/FEATURE.md` (5-field); one-liner + Status + Touchpoints + GLOBAL-013 (KV budget 7→8 sources) + GLOBAL-014 (span list) updated; net-shrunk SK-ICP-001/002/003/005/006/008/009 + Open Questions prose to land at 20,266 bytes (was 19,551; net +715 B; under 20 KB cap). `docs/research/automated-icp-validation-plan.md`: §2.1 source table gains a Bluesky row; §2.2 ✅ EXPANDED 2026-06-01 block; §8 FLOW-008 sub-tasks 10→11 (still 100%); status dashboard row updated to "curl probe of 8 sources"; preamble "What's shipped today" line lists Bluesky; this Progress log row. `docs/research/automated-icp-validation-plan-verification.md`: FLOW-008 walkthrough gains step 8 (Bluesky probe assertion); status dashboard row updated to "8 sources"; outcome log gains today's row. **Verification artifacts:** (1) `bun --filter @nlqdb/api test test/icp-scrape.test.ts` → 33/33 pass (was 28; +5 new for SK-ICP-012); (2) `bun --filter @nlqdb/api typecheck` → exit 0; (3) `bun x biome check apps/api/src/icp-scrape.ts apps/api/test/icp-scrape.test.ts` → clean (auto-format applied); (4) `bash scripts/verify-flows.sh` against `https://nlqdb.com` post-edit → all assertions green including the new `FLOW-008 source Bluesky /xrpc/app.bsky.feed.searchPosts` probe (HTTP 200, `posts` present); (5) mirror integrity check post-edit (normalized `^#{2,3} FLOW-[0-9]+` diff across both tracker files) empty. No new GLOBAL (the 20 KB exemption is already documented as GLOBAL-028 + GLOBAL-029, evidence-grade edit contract is GLOBAL-030 — this PR adheres to all three without adding a new cross-cutting rule). | Shipped. 8th source live on the next Mon 06:00 UTC cron run; first BSKY items will land in `icp:item:<YYYYMMDD>:bluesky:bsky-*` and flow through the existing SK-ICP-002 scoring + SK-ICP-003 clustering pipeline without further code changes (source string propagated, not branched on, in both `icp-score.ts` and `icp-cluster.ts`). |
| 2026-06-02 | §3.5 AskYourDatabase comparison page (6th `/vs/<slug>`) + pre-implementation verification + competitors.md sync | Acquisition surface — third `P3 analyst` `/vs/` slot, this time on the chat-with-my-DB / Dashboard-Builder / customer-facing-BI angle that Wren AI (semantic-layer/governance) and Vanna AI (translator-only) don't cover. AskYourDatabase is the documented next-pick per [`comparison-pages/FEATURE.md`](../features/comparison-pages/FEATURE.md) Open questions (alongside Retool AI for P4); persona-weighted threat × keyword volume tilts the next slice toward it because (a) [`docs/competitors.md §2`](../competitors.md) marks AYD as "exactly the 'one-off question' vector" with Medium-for-P3 threat, (b) the Dashboard-Builder + embeddable Website Chatbot extend the threat into customer-facing BI which prior `/vs/` pages don't surface, (c) BigQuery / MSSQL / MySQL / PostgreSQL / Snowflake engine coverage names the warehouse swap a P3 analyst is balancing against. Founder directive 2026-05-24 keeps engine quality as priority #1; this is additive AEO work that doesn't touch the gate or any Worker code (static Astro page only), so the §3.5 "tractor beam" advances without blocking on BIRD/Spider. **Pre-implementation verification (per the PR brief):** (a) mirror integrity check (`diff` of `^#{2,3} FLOW-[0-9]+` across `automated-icp-validation-plan{,-verification}.md`) — empty before the edit; (b) `bash scripts/verify-flows.sh` against `https://nlqdb.com` — all curl-observable assertions green (Reddit + SO sandbox-egress advisories as expected; 49 assertions including the new SK-ICP-009 GraphQL Discussions probe); (c) `bash scripts/flow-004-walk.sh` against `https://app.nlqdb.com` — **passed** in 22s wall (mail.tm `wshu.net` inbox, waitlist 200, Resend invite in 10s, control returned `403 feature_gated`, invite returned `HTTP 200`; SK-GATE-007 invariant honoured); (d) WebFetch verification of every claim that lands in user-facing copy — `askyourdatabase.com/` (tagline + customer-facing chatbot + internal-tools use cases + Product Hunt callouts), `askyourdatabase.com/pricing` (three paid tiers: Desktop "Ultimate" $49/mo billed yearly or $69.99/mo monthly, Website Chatbot "Scale" $149/mo 1000 q/mo 6 chatbots, "Established" $329/mo 1500 q/mo unlimited chatbots + own branding, Enterprise custom on-prem; engines: BigQuery / MSSQL / MySQL / PostgreSQL / Snowflake; models: Claude 4.6 Sonnet + Claude Haiku 4.5 + GPT-4.1), `askyourdatabase.com/docs` (Three Main Use Cases: Customer-facing BI Chatbot + Dashboard Builder + Internal Tools; API surfaces: Ask API + Messages API + New Chat API + WhatsApp integration), `askyourdatabase.com/docs/security` (Desktop = local creds + local query execution + no data storage; Website Chatbot = encrypted creds + conversation history stored + fixed-IP gateway + TLS in transit + query sanitisation + read-only DB user recommendation + on-prem option; **SOC 2 Type 2 audit publicly initiated with the first complete report originally anticipated December 2025 — not yet certified on free product as of mid-2026; live security page is source of truth**). | `apps/web/src/data/competitors.ts` gains the AskYourDatabase entry (6th `Competitor`): persona `P3 analyst`, 4 `whenChooseUs` + 4 `whenChooseThem` bullets each ≤16 words per SK-CMP-001, 11-row feature parity table (12 pre-iteration, then m3 dropped the decorative Free-tier row), 6 FAQs (SK-CMP-003 4-6 range) all naming "AskYourDatabase" verbatim in the question text (SK-CMP-003 requires ≥1), demo goal `"this month's signups grouped by acquisition channel, top 10 only"`. `apps/web/src/pages/vs/[slug].astro` `getStaticPaths()` picks the new slug up unmodified per SK-CMP-002. `apps/web/src/pages/vs/index.astro` description unchanged (already generic post-2026-05-29 Wren AI). `scripts/verify-flows.sh`: `VS_SLUGS` / `VS_TITLES` arrays gain `askyourdatabase` / `AskYourDatabase`; sitemap floor 14 → 15 (5 solve + 6 vs + 4 root). `docs/competitors.md`: §2 AskYourDatabase entry rewritten with engine list + product split + pricing + models + SOC 2 status pulled from the WebFetch above (replaces the prior stale "Free trial, ~$19–49/mo tiers" line); summary threat-matrix row gains Dashboard Builder + embeddable Website Chatbot + Enterprise on-prem detail. `docs/features/comparison-pages/FEATURE.md`: status line `5 → 6`; Open questions amended to record AskYourDatabase as the third P3 slot and pin Retool AI / Julius AI / Basedash as the next-pick. `docs/research/automated-icp-validation-plan.md` §8 FLOW-003 status dashboard row + verification mirror FLOW-003 dashboard row + outcome log all updated; mirror integrity check stays empty (no new FLOW added). No new GLOBAL/SK introduced — the addition fits inside the existing data-driven contract per SK-CMP-002. **Honesty contract on the page itself:** the `whenChooseThem` + the feature table's `us: no` / `us: partial` rows name every dimension AskYourDatabase ships and nlqdb does not — multi-engine warehouse support, customer-facing BI chatbot + Dashboard Builder, on-premise deployment, in-progress SOC 2 Type 2 audit. No buyer-facing SK-* leak (lesson from the 2026-05-24 Outerbase round-2 review + the 2026-05-30 round-2 fabrication pull) — the only documented-decision IDs in the data file are TypeScript-comment anchors (`SK-CMP-001` / `SK-CMP-003`), never user-visible strings. SOC 2 framing matches Wren AI's posture: hedged on "audit publicly initiated; first complete report originally anticipated December 2025 per their security portal" (the audit's own stated deadline; not yet attested on the free product as of mid-2026) plus a "check their current security page for the live status" disclaimer so live drift gives the buyer a discount lens. Also reflects round-1 self-review fix MINOR-1 — reframed from "anticipated December 2025" (which reads as a slipped deadline today) to "originally anticipated December 2025" + the post-deadline status acknowledgement. **Post-implementation verification:** (1) `bun test apps/web/src/data` → 26 / 26 pass (no regression; new entry passes all SK-CMP-001/-003 invariants); (2) `bun run --filter @nlqdb/web build` → **22 pages built** including `/vs/askyourdatabase/`; (3) `bun run --filter @nlqdb/web check` → 0 errors / 0 warnings / 0 hints across 65 files; (4) `bunx biome check apps/web/src/data/competitors.ts scripts/verify-flows.sh` → clean; (5) local probe via `NLQDB_BASE_URL=http://localhost:9999 bash scripts/verify-flows.sh` against `apps/web/dist` (`python3 -m http.server 9999`) — all assertions green including `/vs/askyourdatabase/` (HTTP 200, `<h1>nlqdb vs AskYourDatabase</h1>` template-match, FAQPage JSON-LD present, redirect probe 301), 15-entry sitemap floor (was 14), `/llms.txt` enumerates `vs/askyourdatabase`; (6) live `bash scripts/verify-flows.sh` against `https://nlqdb.com` will return the 4 expected pre-deploy failures (`/vs/askyourdatabase/` 404 + redirect probe 404 + sitemap floor 14 < 15 + `llms.txt` missing slug) — all clear post-`deploy-web.yml`; (7) mirror integrity check post-edit (normalized `^#{2,3} FLOW-[0-9]+` diff) empty. | Shipped pre-deploy after one round of independent self-review iteration. **Round-1 self-review (sub-agent, opus 4.7) found 7 issues (0 CRITICAL / 1 MAJOR / 4 MINOR / 2 NIT); this row reflects the iteration that closed every actionable finding:** (M1) FAQ4 + the MCP feature-table row fabricated `nlqdb_create_database` / `ask` / `run` as MCP tool names — contradicts [`SK-MCP-002`](../features/mcp-server/decisions/SK-MCP-002-three-tools.md) ("Three tools, no `nlqdb_create_database`") and the actual `packages/mcp/src/server.ts:73-110` registration of `nlqdb_query` / `nlqdb_list_databases` / `nlqdb_describe`. **Fixed in this row** — both surfaces now name the real tools + explain that `nlqdb_query` materialises Postgres on first reference (the goal-first inversion per `docs/architecture.md §0.1`). The same fabrication exists on 5 prior `/vs/` pages (Supabase / Vanna / Mem0 / Outerbase / Wren AI FAQs) — out of scope for this PR; tracked in `comparison-pages/FEATURE.md` Open questions for a separate slice. (m1) "anticipated December 2025" reframed to "originally anticipated December 2025 — check their current security page for the live status" so the post-deadline temporal flag is visible (FAQ3 + feature-table SOC 2 note + this row). (m2) Impl-plan progress-log "3 expected pre-deploy failures" corrected to "4 expected" (one-char fix; matches the verification mirror + the live verify-flows.sh RC=1). (m3) "Free tier (unmetered NL queries)" feature-table row dropped — the asymmetry is decorative against existing Anonymous-mode + pricing rows; removed cleanly. (m4) `docs/competitors.md` "Desktop \"Ultimate\" $49/mo priced to move to $69" reframed to "$49/mo billed yearly or $69.99/mo monthly" to match the live pricing page exactly; same fix in this row's WebFetch-citation block. (N1) Engine-ordering standardised to `BigQuery, MSSQL, MySQL, PostgreSQL, Snowflake` (AYD-footer-alphabetical) in tagline, oneLiner, whenChooseThem, feature-note, FAQ1, this row, and `docs/competitors.md` — 7 occurrences. (N2 is observation-only; no action needed.) | **Post-iteration verification re-run:** `bun test apps/web/src` → 106/106 pass (data + lib suites unchanged); `bun run --filter @nlqdb/web build` → 22 pages built including `/vs/askyourdatabase/`; `bun run --filter @nlqdb/web check` → 0 errors / 0 warnings; `bunx biome check apps/web/src/data scripts/verify-flows.sh` → clean; local `NLQDB_BASE_URL=http://localhost:9999 bash scripts/verify-flows.sh` against `apps/web/dist` → all assertions green; rendered-HTML scan for SK-*/GLOBAL-* / `nlqdb_create_database` / invite / secret leak in `dist/vs/askyourdatabase/index.html` → no leak (post-fix `nlqdb_create_database` no longer appears anywhere in the page); mirror integrity check empty. Comparison page count 5 → 6; third `/vs/` page covering P3 (the chat-with-my-DB / Dashboard-Builder / customer-facing-BI angle vs Wren AI's semantic-layer governance angle and Vanna AI's translator-only angle). FLOW-003 verification mirror outcome log gets the pre-deploy build-time row; the live-walk row appends after `deploy-web.yml` deploys `apps/web/dist`. The §3.5 "tractor beam" tractor count advances without touching the gate or any Worker code; the engine-quality priority #1 from the 2026-05-24 founder directive is not regressed because no LLM / `/v1/ask` path changed. |
