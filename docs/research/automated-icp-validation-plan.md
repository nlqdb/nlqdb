# Automated ICP Validation Plan

> **Governance ([GLOBAL-028](../decisions/GLOBAL-028-acquisition-progress-tracker.md)):**
> This is the canonical acquisition progress tracker. It is the **only**
> file in the repo exempt from the 20 KB cap. All updates are agent-ran:
> every PR that implements a section here must update `## Current status`
> and append a row to `## Progress log`.

> **Status:** in progress — §1.4, §2.2 (collection), §2.3 (all steps), §2.1 GitHub Issues source, §2.4 verdict automation shipped 2026-05-22. §3.1 first 5 hand-curated solve pages shipped 2026-05-23 (paraphrased search-intent `<h1>` per SK-SOLVE-001 — verbatim cluster quotes pending the 2026-05-26 first cluster file). §1.1 (stranger-test), §1.2 (KPI dashboard), §1.3 (in-app survey), the rest of §3 (gallery, reply queue), §4 (PMF capture) not yet started — **the pipeline collects signal and the AEO surfaces (vs + solve) are live, but no surface yet measures whether invited users land safely**. First ICP cron fires Mon 2026-05-26 06:00 UTC; until then no real ICP evidence has been written.
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
> [founder-playbook.md](../founder-playbook.md).

---

## Current status (updated 2026-05-22)

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
| Stack Overflow | [SE API](https://api.stackexchange.com) (10k/day) | Y | P1/P3/P6 |
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
validates this is higher-quality than human coding.

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
cluster data; founder merges PR; no by-hand writing. Gartner: 50% of
search volume → AI chatbots by 2028
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
> this query" CTA emits `solve.try_query_clicked` to LogSnag with `{slug, goal}`
> and seeds the `nlqdb_draft` localStorage slot before navigating to
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
| 2026-05-23 | §3.1 pain-driven solve pages (first 5) | Hand-curated AEO surface; 5 pages ahead of the 2026-05-26 first cluster file | `apps/web/src/data/solve.ts` (typed source of truth, 5 entries); `apps/web/src/pages/solve/[slug].astro` (single Astro template, getStaticPaths); `apps/web/src/pages/solve/index.astro` (page index at `/solve`); `apps/web/src/data/solve.test.ts` (12 data-integrity tests pinning AEO invariants: unique kebab slugs, ≤60-word oneLiner, ≥3 howNlqdbAnswers, ≥2 whatItDoesnt limits, ≥3 FAQs ≤80-word answers, ≥2 enduring source URLs starting with `https://`). Sitemap + llms.txt updated to enumerate solve slugs alongside vs slugs. "Try this query" CTA emits `solve.try_query_clicked` LogSnag event + seeds `nlqdb_draft` localStorage. FAQPage + HowTo JSON-LD per page. Self-canonical `<link rel="canonical">`. New feature record at `docs/features/solve-pages/` with SK-SOLVE-001 (search-intent `<h1>`, not fabricated verbatim quotes — paraphrase is honest until cluster file lands), SK-SOLVE-002 (mandatory "What nlqdb doesn't do" section per AEO honest-trade-off rule), SK-SOLVE-003 (≥2 enduring discussion-hub URLs, never single-thread URLs that can rot). `CLAUDE.md §5` path map updated. | Shipped. Sitemap now lists 12 URLs (was 7); llms.txt now exposes a `## Solve pages` block to LLM-IDE crawlers (Claude Desktop, Perplexity, Cursor, Cline, Aider, Copilot). |
