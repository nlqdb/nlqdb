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
> §1.1 stranger-test primitive ([`tools/stranger-test/`](../../tools/stranger-test/) — Playwright walker for FLOW-001/002/003) ·
> §1.1+§1.4 **daily acquisition-health cron** (SK-STRG-003; [`acquisition-health.yml`](../../.github/workflows/acquisition-health.yml) walks all three scripts at 06:00 UTC, exits 0, 90-day artifact) ·
> §1.4 gate-valve **end-to-end verified twice** ([`scripts/flow-004-walk.sh`](../../scripts/flow-004-walk.sh)
> — mail.tm + curl walker; 2026-05-24 first pass HTTP 200 in 18s; 2026-05-24 re-walk HTTP 200 in 18s) ·
> §2.2 collection (HN+Reddit+GH+SO+IH) · §2.3 scoring + clustering + verdict · §2.1
> GitHub Issues + Stack Overflow + Indie Hackers sources · §3.1 first 5
> solve pages (paraphrased `<h1>`) · §3.3 amendment **site-wide `?invite=` capture** (`Base.astro` runs `captureInviteFromUrl()` on every page so `/solve/<slug>?invite=<code>` and `/vs/<slug>?invite=<code>` press-launch URLs reach first-value, not the gate — SK-GATE-007 Consequence updated; `verify-flows.sh` probes the bundled chunk for the `nlqdb_invite` literal) · §8 mirrored flow trackers (8 flows:
> 4 walker-evidenced = FLOW-001/002/003 (failed at gate) + **FLOW-004 (passed twice)**,
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
| Indie Hackers | `feed.indiehackers.world` JSON Feed (unofficial mirror) | Y | P1 ✅ shipped |
| Stack Overflow | [SE API 2.3](https://api.stackexchange.com) (anon 300/IP/day) | Y | P1/P3/P4/P6 ✅ shipped |
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

**GH issue queries:** `is:issue "text to sql"`, `is:issue "natural language" database`, `is:issue "ai agent" memory store`, `is:issue "query builder" too verbose`, `is:issue prisma migration overhead` — filter `created:>2025-11-01` to keep signal current.

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
> Issues API (5 queries, `created:>2025-11-01`, 10 results each). Items
> stored as `source: "github"`, deduped same as HN/Reddit.
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

### Status dashboard (updated 2026-05-24)

| Flow | Persona | Sub-tasks shipped | Verification | Mirror |
|---|---|---|---|---|
| FLOW-001 | P1 solo builder | 7 / 8 (88%) | failed 2026-05-24 step 5 (gate 403 on `/v1/ask`; walker-evidenced across 3 prompts) | [verify](./automated-icp-validation-plan-verification.md#flow-001--anonymous-first-happy-path) |
| FLOW-002 | P3 analyst | 6 / 7 (86%) | failed 2026-05-24 step 9 (steps 1–8 ok across 3 slugs; gate 403 on submit); invite-capture probe green pre-deploy on local dist | [verify](./automated-icp-validation-plan-verification.md#flow-002--pain-driven-aeo-inbound-search--solveslug--first-query) |
| FLOW-003 | P3 / P4 | 6 / 6 (100%) | failed 2026-05-24 step 8 (steps 1–7 + 9 ok across 3 slugs; gate 403 on submit); invite-capture probe green pre-deploy on local dist | [verify](./automated-icp-validation-plan-verification.md#flow-003--comparison-driven-inbound-search--vscompetitor--first-query) |
| FLOW-004 | P1 solo builder | 7 / 7 (100%) | **passed 2026-05-24 (4 walks)** + daily cron via SK-STRG-003 (`acquisition-health.yml`) | [verify](./automated-icp-validation-plan-verification.md#flow-004--waitlist-signup--invite-email--gate-bypass) |
| FLOW-005 | P2 agent builder | 5 / 6 (83%) | partial (OAuth discovery precondition passed 2026-05-23) | [verify](./automated-icp-validation-plan-verification.md#flow-005--agent-self-provisions-db-via-mcp) |
| FLOW-006 | P4 backend engineer | 5 / 6 (83%) | not yet attempted | [verify](./automated-icp-validation-plan-verification.md#flow-006--sdk-runsql-escape-hatch) |
| FLOW-007 | P1 / P3 | 5 / 6 (83%) | not yet attempted | [verify](./automated-icp-validation-plan-verification.md#flow-007--adopt-anonymous-db-on-signup) |
| FLOW-008 | cron / system | 9 / 9 (100%) | partial (curl probe of 5 sources passes 2026-05-23; Reddit/SO sandbox-egress advisory; cron-side checks need deployed Worker); Base.astro invite-capture chunk probe green on local dist | [verify](./automated-icp-validation-plan-verification.md#flow-008--weekly-icp-scrape-source-health) |

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
  - [x] `?invite=<code>` captured site-wide via `Base.astro` — [`SK-GATE-007`](../features/pre-alpha-gate/FEATURE.md) (was homepage + `/app/new` only; press-launch URLs into `/solve/<slug>` and `/vs/<slug>` now also carry the gate-bypass)
  - [ ] LLM-judge grades first-query success — [`SK-ONBOARD-005`](../features/onboarding/FEATURE.md) (baseline by 2026-06-01)
  - [x] §1.1 stranger-test primitive — [`SK-STRG-001`](../features/stranger-test/FEATURE.md) (`tools/stranger-test/`; daily cron + R2 archive still open)
- **Progress:** 7 / 8 · **88%**

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
  - [x] `?invite=<code>` captured on `/solve/<slug>?invite=<code>` press-launch URLs via `Base.astro` — [`SK-GATE-007`](../features/pre-alpha-gate/FEATURE.md) (impl plan §3.3 amendment)
  - [ ] `<h1>` amended to verbatim cluster quote once cluster file lands (future `SK-SOLVE-004`)
- **Progress:** 6 / 7 · **86%**

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
  - [x] `?invite=<code>` captured on `/vs/<slug>?invite=<code>` press-launch URLs via `Base.astro` — [`SK-GATE-007`](../features/pre-alpha-gate/FEATURE.md) (impl plan §3.3 amendment)
- **Progress:** 6 / 6 · **100%**

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
- **Source signal:** the 5 upstreams the Mon 06:00 UTC cron consumes per [`automated-icp-validation-plan.md §2.1`](./automated-icp-validation-plan.md) — [HN Algolia](https://hn.algolia.com/api) · [Reddit listings](https://www.reddit.com/r/SaaS/search.json?q=retool+alternative) · [GitHub Search Issues](https://docs.github.com/en/rest/search/search) · [Stack Exchange API 2.3](https://api.stackexchange.com) · [Indie Hackers JSON Feed](https://feed.indiehackers.world)
- **Implementation sub-tasks:**
  - [x] HN Algolia query — [`SK-ICP-001`](../features/icp-mining/FEATURE.md)
  - [x] Reddit subreddit search (16 subreddit/query pairs, `restrict_sr=on`) — [`SK-ICP-001`](../features/icp-mining/FEATURE.md)
  - [x] GitHub Issues search (5 queries, gated on `GH_TOKEN`) — [`SK-ICP-004`](../features/icp-mining/FEATURE.md)
  - [x] Stack Exchange `/search/advanced` (5 tag+query pairs, anon quota) — [`SK-ICP-005`](../features/icp-mining/FEATURE.md)
  - [x] Indie Hackers JSON Feed (5 P1-pain queries, client-side 7-day filter) — [`SK-ICP-006`](../features/icp-mining/FEATURE.md)
  - [x] KV dedup contract + LogSnag per-run notification — [`SK-ICP-001`](../features/icp-mining/FEATURE.md)
  - [x] Cluster + GitHub Contents API evidence-file write — [`SK-ICP-003`](../features/icp-mining/FEATURE.md)
  - [x] Agent-runnable source-health probe via `scripts/verify-flows.sh` — [`SK-ICP-007`](../features/icp-mining/FEATURE.md)
  - [x] Agent-runnable site-wide invite-capture probe (`Base.astro` bundle chunk grep for `nlqdb_invite`) in `scripts/verify-flows.sh` — [`SK-GATE-007`](../features/pre-alpha-gate/FEATURE.md)
- **Progress:** 9 / 9 · **100%**

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
| 2026-05-24 | §3.3 amendment site-wide `?invite=` capture | Verification-first: ran mirror integrity check (empty diff), `bash scripts/verify-flows.sh` against `https://nlqdb.com` (all curl-observable assertions green; Reddit/SO sandbox-egress advisory as expected), and `bash scripts/flow-004-walk.sh` (passed in 21s: control 403 + invite 200) BEFORE implementing. Then code inspection found a real gap: `apps/web/src/lib/invite.ts::captureInviteFromUrl()` was only invoked on the homepage and `/app/new` (matching SK-GATE-007 Consequence as originally written), but the impl plan §3.3 amendment and the preamble "What the next agent should pick" priority #6 both explicitly require press-launch URLs into `/solve/<slug>` and `/vs/<slug>` to carry the gate-bypass — once FLOW-004 verified the invite-valve, this was the only thing standing between a press-launch click-through and an HTTP 200 on `/v1/ask`. | `apps/web/src/layouts/Base.astro` now runs `captureInviteFromUrl()` once, site-wide (one bundled `<script>` block ~46 bytes minified that imports the existing `invite.ts` 390-byte chunk). Per-page duplicates removed from `apps/web/src/pages/index.astro` and `apps/web/src/pages/app/new.astro` (capture is idempotent; running on the same page twice is a no-op). New `apps/web/src/lib/invite.test.ts` (7 tests, bun:test): no-op on URL without `?invite=`; captures + strips on homepage; captures on `/solve/<slug>` press-launch URL; captures on `/vs/<slug>` press-launch URL; idempotent second call; preserves other query params (`?ref=hn&invite=...` → `?ref=hn`); SSR-safe (no throw when `window` undefined). [`docs/features/pre-alpha-gate/FEATURE.md`](../features/pre-alpha-gate/FEATURE.md) SK-GATE-007 Consequence updated: "on the homepage and `/app/new`" → "site-wide via `Base.astro` (so press-launch URLs into `/solve/<slug>` and `/vs/<slug>` per impl plan §3.3 amendment also capture)". `scripts/verify-flows.sh` gains a new agent-runnable probe (`Site-wide ?invite= capture — Base.astro bundled invite-capture is loaded`): fetches `/`, `/solve/<first-slug>/`, `/vs/<first-slug>/`; extracts the `/_astro/Base.astro_astro_type_script_index_0_lang.<hash>.js` src from the HTML; follows the `./invite.<hash>.js` import out of that bundle; greps the import target for `nlqdb_invite` (the localStorage key the capture writes — rollup keeps it as a string literal through minify). Asserts every probed page references the same Base.astro bundle hash. **Verification artifacts:** (a) `bun test apps/web/src/lib/invite.test.ts` → 7/7 pass; (b) `bun run --filter @nlqdb/web build` → 20 pages built, dist green; (c) probe against the local `apps/web/dist` (`python3 -m http.server 9999`) → all 12 invite-capture assertions pass — Base.astro bundle is 46 bytes (the import + call) and resolves to `invite.<hash>.js` which preserves `nlqdb_invite` through minify; (d) probe against the live `https://nlqdb.com` → 3 expected pre-deploy failures (deployed bundle pre-dates this PR — the probe correctly identifies the pre-deploy state and will turn green after the next `deploy-web.yml` run). §8 status dashboard updated (FLOW-001 6→7 of 8 (88%), FLOW-002 5→6 of 7 (86%), FLOW-003 5→6 of 6 (100%), FLOW-008 8→9 of 9 (100%)); FLOW-001/002/003 sub-task tables gained the new site-wide-invite-capture row; FLOW-008 gained the invite-capture probe row. Mirror integrity check (`diff` of `^#{2,3} FLOW-[0-9]+` across both `automated-icp-validation-plan{,-verification}.md`) remains empty — no new FLOW added; the existing FLOW blocks gained one sub-task each. No new GLOBAL/SK — this is a precision update to SK-GATE-007's Consequence so it matches the impl plan §3.3 amendment + preamble priority #6 the decision already implied. | Shipped pre-deploy. The invite-valve verified by FLOW-004 (signup → Resend → `X-Invite-Code` → 200) now extends to **every page**: a press-launch URL like `https://nlqdb.com/solve/cheap-internal-dashboard?invite=<code>` (Show HN, dev.to, IH long-form, AEO inbound) captures the code on landing and forwards it as `X-Invite-Code` on every subsequent `/v1/ask` — the gate-403 binding gap that has blocked FLOW-001/002/003 since their walker rows landed is now unblocked **for invite-bearing traffic specifically** (per priority #6 of the preamble). Unblocks priority #8 (Show HN with `?invite=` URL) materially: the launch URL now actually carries the user across the gate. Mirror integrity check empty. FLOW-001/002/003 walker re-pass requires the deploy to land + a real invite code in the walker, tracked as the existing `--invite-code` open question in `stranger-test/FEATURE.md`. |
