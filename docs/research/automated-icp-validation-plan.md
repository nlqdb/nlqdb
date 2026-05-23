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

> **Status:** in progress — §1.4, §2.2 (collection), §2.3 (all steps), §2.1 GitHub Issues source, §2.4 verdict automation shipped 2026-05-22. §3.1 first 5 hand-curated solve pages shipped 2026-05-23 (paraphrased search-intent `<h1>` per SK-SOLVE-001 — verbatim cluster quotes pending the 2026-05-26 first cluster file). §8 user-flow tracker shipped 2026-05-23 (7 mirrored flows; average implementation 84%; FLOW-001 / FLOW-002 / FLOW-003 each have curl-only partial passes recorded 2026-05-23 against the deployed AEO surfaces, full Playwright walks still pending; FLOW-002's CTA telemetry and gate continuation remain failed). §2.1 Stack Overflow source shipped 2026-05-23 — fourth scrape source live; live API probe returned 1 fresh `postgresql/setup` question with `quota_remaining=299`. §1.1 (stranger-test), §1.2 (KPI dashboard), §1.3 (in-app survey), the rest of §3 (gallery, reply queue), §4 (PMF capture) not yet started — **the pipeline collects signal and the AEO surfaces (vs + solve) are live, but no surface yet measures whether invited users land safely**. First ICP cron fires Mon 2026-05-26 06:00 UTC; until then no real ICP evidence has been written. The curl-observable subset of FLOW-001/002/003 is now agent-runnable via [`scripts/verify-flows.sh`](../../scripts/verify-flows.sh) (49 assertions across the homepage hero, all 5 `/solve` slugs, all 3 `/vs` slugs, `/llms.txt`, `/sitemap.xml`); a 2026-05-23 re-walk against `https://nlqdb.com` passed every assertion and surfaced one piece of new evidence — `/solve/<slug>` and `/vs/<slug>` now `307 → /<slug>/` (curl without `-L` reports 307 + 0 bytes; the script follows redirects and records the chain).
>
> **Context.** Every advertised surface ([progress.md §0](../progress.md))
> shipped; zero validated users.
> [`founder-playbook.md`](../founder-playbook.md) assumes 1:1 calls; the
> founder rejects 1:1 calls.
> The [pre-alpha-gate](../features/pre-alpha-gate/FEATURE.md) returns
> 403 on every "do-work" surface today (BIRD 0.318, Spider not measured).
> So "get real users" needs a release-valve and "validate" needs to be
> async.
>
> **Cross-refs:** [personas.md](./personas.md) ·
> [email-and-marketing.md](./email-and-marketing.md) ·
> [phase-1-exit-criteria.md](./phase-1-exit-criteria.md) ·
> [GLOBAL-024](../decisions/GLOBAL-024-demand-signal-telemetry.md) ·
> [GLOBAL-025](../decisions/GLOBAL-025-north-star.md) ·
> [GLOBAL-027](../decisions/GLOBAL-027-pre-alpha-gate.md) ·
> [founder-playbook.md](../founder-playbook.md) ·
> [GLOBAL-030](../decisions/GLOBAL-030-evidence-grade-acquisition-tracker-edits.md).

---

## Current status (updated 2026-05-23)

| KPI | Target | Status |
|---|---|---|
| Anonymous loop completions | ≥ 50 | 0 — gate open path unblocked as of 2026-05-21 |
| Signed-in users (invite-redeemed) | ≥ 10 | 0 — first invites will ship on next waitlist signup |
| Sean Ellis Q1 responses | ≥ 20 | 0 — survey not yet wired |
| Primary ICP shortlist | exactly 1 | not yet — verdict logic shipped 2026-05-22; first evidence file auto-generates Mon 2026-05-26 |
| TTFV p50 | ≤ 60s | not measured |
| First-query success | ≥ 60% | not measured |

**Honest gap (acquisition-risk):** the pipeline now identifies pain at
scale, the gate-valve issues invites, and the first AEO surfaces (vs +
solve) earn impressions, but **§1.1 stranger-test, §1.2 KPI dashboard,
and §1.3 in-app survey are still unshipped** — meaning we can pull
people in but can't yet detect whether they landed on a working flow or
churned silently. Those three remain the next correctness bar before
any large acquisition push (Show HN, Product Hunt — §3.3) goes live;
the static AEO surfaces (§3.1, §3.5 partial via comparison pages) ship
first because their failure mode is "no traffic", not "broken funnel
for inbound traffic".

**Verified 2026-05-23:** FLOW-002's deployed static `/solve` surface
passes the no-credential static and draft checks (`FAQPage` + `HowTo`
JSON-LD, honest-limits section, `nlqdb_draft` seeded, `/app/new`
rehydrated), but no `solve.try_query_clicked` hook event was observed;
a manual continuation to first-query submit fails with `403 feature_gated` from
`https://app.nlqdb.com/v1/ask`. Treat `/solve` as an acquisition surface
that can educate and collect intent, not as a verified first-value path,
until the gate bypass is present in that journey. Re-verified 2026-05-23
(this PR) via [`scripts/verify-flows.sh`](../../scripts/verify-flows.sh):
49 / 49 curl-observable assertions pass across the homepage hero, every
shipped `/solve` slug, every shipped `/vs` slug, `/llms.txt`, and
`/sitemap.xml`. New static-surface evidence — the deployed CDN now serves
`/solve/<slug>` and `/vs/<slug>` only via `307 → trailing-slash`; the
script follows redirects and records the chain so future agents don't
re-discover this. The FLOW-002 CTA + gate failure modes still require a
Playwright run to re-attempt. FLOW-001 hero form and FLOW-003 `/vs/<slug>`
template + JSON-LD have curl-only partial passes against all shipped
slugs (5/5 solve, 3/3 vs) for the first time. The live Stack Exchange
probe re-passed (1 fresh `postgresql/setup` question, `quota_remaining=299`,
`backoff=None`) and the GitHub Search probe re-passed
(`is:issue "text to sql" created:>2025-11-01` → `total_count=1642`,
`items=10`, `incomplete_results=false`).

---

## 0. Goals and non-goals

**Goal — 6 weeks, $0 ongoing spend, zero 1:1 calls, land on:**

- **One primary ICP** with 5+ verbatim pain quotes in an evidence file.
- **≥50 anonymous + ≥10 signed-in users** through the onboarding loop
  against a real LLM (not canned demo).
- **≥20 Sean-Ellis Q1 responses** with distribution attached.
- **A live dashboard** the founder refreshes weekly to make
  promote/iterate/cut calls — Calendly never opens.

**Non-goals.** Calls, cold email, paid ads, AppSumo, lifetime deals,
new surfaces, persona expansion past P1/P2/P3/P6.

---

## 1. Phase A — Onboarding loop must work for a stranger (Week 1)

The feature is documented ([`onboarding/FEATURE.md`](../features/onboarding/FEATURE.md),
[`web-app/FEATURE.md`](../features/web-app/FEATURE.md)). Not done:
end-to-end stranger-test, instrumented baselines, in-product survey
trigger, gate release-valve. Fix all four before any external link.

### 1.1 Stranger-test the happy path with synthetic agents

Headless Playwright loop from an IP we don't own (Workers cron in a
different region, or free-tier Browserless) hits `nlqdb.com`, types a
seeded "what are you building" prompt, completes anon
`<CreateForm>`, opens `/app`, runs a 2nd query, copies the snippet.
Pass = no 4xx (other than gate), no console error, TTFV < 60s p95.

25 seeded prompts per persona:

- **P1 Solo Builder** (×10): `"I'm building a meal planner for couples"`
  · `"side project to track my reading"` · `"a tiny CRM for my coaching
  practice"` · etc.
- **P2 Agent Builder** (×8): `"give my Claude agent a place to remember
  user facts across sessions"` · `"vector store for an autonomous
  research agent"` · etc.
- **P3 Analyst** (×4): `"I have a CSV of leads — which are already
  customers"` · `"churn by acquisition channel last 6 months"` · etc.
- **P6 SRE** (×3): `"p99 latency for checkout last 6h by tier"` · etc.

Daily JSON to R2 + LogSnag ping on regression. Re-runs on every
`apps/web` / `apps/api` PR.

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
| Indie Hackers | RSS / scrape (low rate) | Y | P1 |
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
   NL→SQL at scale) while enabling §3. **Decision:** which valve;
   what cap (default proposed: N=200/week).
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

- §1.1 stranger-test → new `SK-WEB-011` in
  [web-app/FEATURE.md](../features/web-app/FEATURE.md).
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
| FLOW-001 | P1 solo builder | 5 / 7 (71%) | partial (curl steps 1–2 passed 2026-05-23) | [verify](./automated-icp-validation-plan-verification.md#flow-001--anonymous-first-happy-path) |
| FLOW-002 | P3 analyst | 5 / 6 (83%) | failed 2026-05-23 step 8 (re-verified curl steps 1, 3, 4 pass) | [verify](./automated-icp-validation-plan-verification.md#flow-002--pain-driven-aeo-inbound-search--solveslug--first-query) |
| FLOW-003 | P3 / P4 | 5 / 5 (100%) | partial (curl steps 1, 2, 4, 9 passed 2026-05-23) | [verify](./automated-icp-validation-plan-verification.md#flow-003--comparison-driven-inbound-search--vscompetitor--first-query) |
| FLOW-004 | P1 solo builder | 5 / 6 (83%) | not yet attempted | [verify](./automated-icp-validation-plan-verification.md#flow-004--waitlist-signup--invite-email--gate-bypass) |
| FLOW-005 | P2 agent builder | 5 / 6 (83%) | not yet attempted | [verify](./automated-icp-validation-plan-verification.md#flow-005--agent-self-provisions-db-via-mcp) |
| FLOW-006 | P4 backend engineer | 5 / 6 (83%) | not yet attempted | [verify](./automated-icp-validation-plan-verification.md#flow-006--sdk-runsql-escape-hatch) |
| FLOW-007 | P1 / P3 | 5 / 6 (83%) | not yet attempted | [verify](./automated-icp-validation-plan-verification.md#flow-007--adopt-anonymous-db-on-signup) |

**Honest takeaway:** every flow is ≥71% implemented but **0 of 7**
have passed an end-to-end agent walk. FLOW-001 / FLOW-002 / FLOW-003 each
have curl-only partial passes on the steps a headless HTTP client can
exercise (homepage hero markup, JSON-LD blocks, honest-limits section,
template H1, sitemap + llms.txt enumeration); none of those flows have a
full Playwright walk yet, and FLOW-002 still fails on CTA telemetry +
post-CTA gate. FLOW-004–FLOW-007 are still unattempted. The impl-vs-verify
gap is the §1.1 stranger-test gap, restated per-flow. The verification
mirror exists to close it.

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
  - [ ] §1.1 stranger-test (Playwright headless cron from external IP)
- **Progress:** 5 / 7 · **71%**

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
  - [ ] End-to-end inbox-receive walkthrough (verification mirror needs an email inbox or Resend webhook capture)
- **Progress:** 5 / 6 · **83%**

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
| 2026-05-23 | §8 verification automation + re-walk | Automate the curl-observable subset of FLOW-001/002/003 + re-verify three live sources before adding more scrape sources or flows | New `scripts/verify-flows.sh` (mirrors the `scripts/verify-secrets.sh` style: `ok`/`fail`/`note` per check, never prints secrets, 15 s per-fetch cap, exits non-zero on any failure, `NLQDB_BASE_URL` override for preview deployments). Walks 49 assertions: FLOW-001 step 1+2 against `/`; FLOW-002 step 1, 3, 4 against every shipped `/solve/<slug>` (5 slugs); FLOW-003 step 1, 2, 4 against every shipped `/vs/<slug>` (3 slugs); FLOW-003 step 9 against `/llms.txt` (enumerates 3 vs + 5 solve); a `/sitemap.xml` floor at 12 `<loc>` entries. Every assertion passed today against `https://nlqdb.com`. New static-surface evidence: `/solve/<slug>` and `/vs/<slug>` now `307 → trailing-slash` — the script follows redirects and records the chain so future curl-only agents don't re-discover it. Live re-probes today (with this VM's `GH_TOKEN` / `GROQ_API_KEY` / `GEMINI_API_KEY` / `LOGSNAG_*` / `RESEND_API_KEY` / `OPENROUTER_API_KEY` all present — correcting the 2026-05-23 entry that recorded `GH_TOKEN`/LogSnag as absent locally): Stack Exchange `/search/advanced?tagged=postgresql&q=setup` returned `items=1, quota_remaining=299, backoff=None`; GitHub `/search/issues?q=is:issue "text to sql" created:>2025-11-01` returned `total_count=1642, items=10, incomplete_results=false`. Verification mirror's FLOW-001/002/003 outcome logs each gain a new row; FLOW-002 triage gains a `Trailing-slash redirect` block. | Shipped. The mirror integrity check (`diff` of `^#{2,3} FLOW-[0-9]+` across both files) remains empty; future agents have a single one-command entry point for the static-surface acquisition assertions. |
