# Fable recommendation — why progress feels invisible, and how to fix it

*Written 2026-06-12 by Claude (Fable), from a full repo scan, live production data
(D1, Cloudflare API), and web research on benchmark SOTA. Every number below is
sourced. This doc raises decisions per P1; it changes nothing by itself.*

> **Resolution (2026-06-12): R1 is settled — invite-only.** The
> invite/allowlist door is already open (a hand-picked crowd queries
> end-to-end via `X-Invite-Code`); public launch to un-invited traffic
> is a deliberate future decision at a persona-bench bar, **not** an
> automatic eval crossing. [`GLOBAL-027`](../decisions/GLOBAL-027-pre-alpha-gate.md)
> now records this (the BIRD/Spider auto-open is a dormant frontier
> backstop). The diagnosis below is the original rationale — where it
> says "Open the door (R1)" it conflated the invite valve (done) with
> the public-launch bar (deferred); read it with that correction.

## 0. TL;DR

Your machine works. Your compass is broken — in one specific, fixable place.

1. **The front door is locked behind an impossible number.** GLOBAL-027 gates
   every do-work endpoint on Spider 2.0-lite ≥ 0.75. Your own GLOBAL-025 records
   the 2026 Spider 2.0 frontier at 5–23% and sets a Phase-3 *floor* of 15%.
   On the Spider 2.0-lite leaderboard (checked 2026-06-12), the best published
   method scores ~55% (ReFoRCE + o3) and the best closed agentic system 73.13
   (DivSkill-SQL) — on frontier models, not free ones. **The gate can never
   self-remove.** Until
   it changes, no human can ever use the product, so no feedback loop can exist,
   so "lost" is the structurally correct feeling — it is not a personal failure.
2. **The company has zero external contact, measured.** Production D1 today:
   7 users (you ×3 + 4 test accounts), 66 waitlist rows of which 62 are your own
   stranger-test bots, 3 are probes, and 1 is you. Web analytics are unreadable
   (the API token lacks the analytics scope). The only feedback nlqdb has ever
   received is from itself.
3. **The quality loop is open, not closed.** 12 planner levers (SK-LLM-023…035)
   shipped blind; one aggregate measurement since they landed (2026-06-09); the canonical
   re-seed has sat in `blocked-by-human.md` waiting for a click. Agents optimize
   what they can see — merged PRs, resolved open questions — because the number
   that matters is measured roughly never.

The fix is one recalibration decision, one closed loop, and re-pointing ~3 of
the 7 daily agents from *building* to *measuring and distributing*. Details and
a this-week checklist below.

## 1. Ground truth (measured 2026-06-12)

| Fact | Value | Source |
|---|---|---|
| Company age | ~7 weeks (CF account 2026-04-24) | Cloudflare API |
| Real registered users | **0 external** (7 rows: founder + tests) | D1 `user` table |
| Real waitlist signups | **0 external** (66 rows: 62 bots, 3 probes, founder) | D1 `waitlist` table |
| BIRD-dev EX (free chain) | 0.35 (lower bound, 1 run, 2026-06-09; re-seeded **0.522** by the 2026-06-12 canonical 6-provider run) | `apps/api/src/gate/eval-baseline.ts` |
| Spider 2.0-lite EX (free chain) | 0.12 (re-seeded **0.1704**, 2026-06-12 — still far below the 0.75 gate, so §2 stands) | same |
| Gate thresholds | BIRD ≥ 0.65 AND Spider ≥ 0.75 | GLOBAL-027 |
| Spider 2.0-lite world SOTA | 73.13 (DivSkill-SQL, closed frontier agentic); 55.21 (best published, [ReFoRCE + o3](https://arxiv.org/abs/2502.00675)) | [leaderboard](https://spider2-sql.github.io/), checked 2026-06-12 |
| BIRD-dev canonical SOTA | ~73–77 dev (frontier / agentic) | GLOBAL-025 §KPI (your own, correct) |
| Eval runs since the 12 levers shipped | 1 (T1–T16 measured as one bundle, 2026-06-09; one pre-lever baseline 2026-05-18) | `docs/progress/quality-score-source-of-truth.md` |
| Docs corpus | 286 md files, ~2.1 MB; 10+ files over the 20 KB cap | `find docs` |
| Commit rate | 50 commits / 6 days, ~7 agent lanes | `git log` |
| Design-partner interviews / outreach sent | 0 / 0 | `founder-playbook.md`, `icp-evidence-2026-05.md` |
| ICP evidence corpus | 1 scored quote (need ≥30 per own bar) | `icp-evidence-2026-05.md` |

Read that table as a sentence: *a 7-week-old company with a working product
pipeline, world-class process discipline, zero users by design, and one
quality measurement.*

## 2. The structural bug: GLOBAL-027 contradicts GLOBAL-025 (P1 escalation)

This is the load-bearing finding, raised per P1 for your decision:

- GLOBAL-025 (north-star) — correctly calibrated. Spider 2.0-lite free chain:
  Phase 2 "report only", Phase 3 floor **≥ 15%**. It even says: "The Spider 2.0
  frontier in 2026 is 5–23% — proof that engine work, not model picking, is
  where the moat lives."
- GLOBAL-027 (pre-alpha gate) — requires Spider **≥ 75%** on the *free chain*
  before any stranger may run a query. That is ~5× your own Phase-3 floor,
  above the best closed frontier-agentic system on Earth, and likely a
  Spider-1.0 number applied to Spider 2.0 (75–85% EX was normal on Spider 1.0).

Consequences while this stands: FLOW-001/002/003 fail at gate-403 *by design*,
the waitlist converts nobody (there's nobody to convert), Sean Ellis can never
run, every onboarding/UX/distribution KPI reads zero, and all four north-star
pillars except engine quality are unmeasurable. One decision quarantines the
company from reality.

**Recommendation R1 — recalibrate the gate to a user-relevant bar.**

- Replace the academic gate with a **persona-bench gate**: ~50–100 NL questions
  drawn from `personas.md`'s representative queries over schemas nlqdb itself
  creates (5–20 tables — your actual ICP shape, not 1000-column enterprise
  warehouses). Gate on e.g. ≥ 80% there. Your users are Maya with a side
  project, not a Snowflake analyst; BIRD/Spider measure the wrong difficulty.
- Keep BIRD + Spider exactly as GLOBAL-025 already treats them: tracked KPIs
  with floors and alerts, the free-vs-frontier delta as the headline — but not
  a launch lock.
- Keep the gate *mechanism* (it's well built); change `eval-baseline.ts`'s
  contract to the persona-bench number. Label the product pre-alpha loudly;
  GLOBAL-023 trust-UX (confidence, diff preview) already does the
  expectation-setting the gate was bought for.
- If you keep any academic threshold, GLOBAL-025's own Phase-2 floors (BIRD
  ≥ 0.60, Spider report-only) are the defensible ones.

This supersedes part of GLOBAL-027 — your call, not mine. But note the gate's
own "Why" says it "buys time … before strangers form an opinion." Seven weeks in,
the measured number of strangers with any opinion is zero. The narrative-risk
trade has been all cost, no benefit.

## 3. The daily agents: rebuild around the loop, not the backlog

What the 7 lanes actually produced (last 200 commits): e2e-opencheck 15,
byo-db 9, llm-levers 7, docs-open-questions 10, billing 5, acquisition-flows ~6.
Three problems:

1. **Output ≠ outcome.** Agents are rewarded by merged PRs. Nothing in any
   lane's loop requires a KPI to move. Result: 12 quality levers with zero
   per-lever before/after; dunning emails, re-subscribe flows, and checkout
   dedup (4 billing PRs) for a product with **zero customers and a 503'd
   checkout**; BYO ClickHouse introspection before one user has connected one
   Postgres.
2. **The doc-churn lane.** "Resolve 10 open questions per GLOBAL-033" ships
   ~daily. GLOBAL-033 (resolve open questions from the documented values
   instead of escalating) is a good rule, but a *daily quota* of
   resolved questions manufactures decisions for the sake of resolution — the
   opposite of D5. Retire it as a routine; apply GLOBAL-033 inline when an
   agent actually hits an open question.
3. **No measurement lane.** The single most important daily output — "did the
   numbers move" — has no agent. Eval dispatch is blocked on a human click
   (`GH_TOKEN_WORKFLOW` exists in the env; an agent can likely dispatch
   workflows today — verify and unblock).

**Recommendation R2 — the new lane roster (still ~7, different jobs):**

| # | Agent | Daily loop | The number it owns |
|---|---|---|---|
| 1 | **Scorecard** | Pull eval results, D1 counts, CF analytics, LogSnag → regenerate `docs/scorecard.md` (one page, ≤ 5 KB) → flag the worst number | all (read-only) |
| 2 | **Eval loop** | Pick ONE lever → run mini-eval (fixed 60-q slice) before/after → merge only if Δ ≥ 0, else revert + record | persona-bench %, BIRD % |
| 3 | **Distribution** | Produce one publishable artifact/day: Show-HN draft, dev.to post, answer to a real SO/Reddit thread, comparison-page improvement, directory submission. Queue in `blocked-by-human.md` for one-click approval | external visits, real waitlist rows |
| 4 | **User evidence** | ICP mining toward the ≥30-quote bar; draft (not send) outreach to authors of mined pain-quotes; in-product Sean Ellis survey slice | scored quotes, survey responses |
| 5 | **Stranger test** | Keep as-is — it's genuinely good — plus: alert when a *real* (non-bot) email enters the funnel | funnel pass-rate |
| 6 | **Feature** | One lane, demand-ordered: finish BYO Postgres end-to-end before ClickHouse/OTel; billing lane frozen until first "how do I pay" | TTFV, first-query success |
| 7 | **Review/merge** | Keep, plus enforce: a PR that names no measured KPI delta in its body doesn't merge | gate on all of the above |

**Prompt pattern for every lane** (this is the rethink you asked about):
start with "read `docs/scorecard.md`; state the one number you intend to move
today"; end with "re-measure it; append the delta to the scorecard; if it
didn't move, revert and write one line on why." An agent that can't name its
number does docs cleanup instead of shipping code.

## 4. Growth, within your real constraints ($0, no calls, Claude-run)

You don't need sales or calls. You need **published artifacts + an open door +
honest measurement**. All async, all free, all agent-draftable with you as the
one-click approver:

1. **Open the door** (R1) — nothing else on this list works while every visitor
   gets a 403.
2. **Launch posts, in order of effort:** Show HN ("a database you talk to, no
   backend — built and run ~entirely by Claude Code" is itself a hook),
   lobste.rs, r/SideProject + r/Database, Hacker News comment presence on
   text-to-SQL threads. The Claude-runs-the-company angle is a genuine story;
   use it.
3. **Answer real questions where they already are.** The ICP miner finds the
   pain-threads; the distribution agent writes a genuinely helpful answer that
   mentions nlqdb once. This is the no-sales version of outreach.
4. **AEO you already built:** `/solve/*`, `/vs/*`, `llms.txt`, MCP directory
   submission (sitting in blocked-by-human — submit it). These are inbound
   channels that work while you sleep, but today nothing measures whether they
   receive a single visit → see §5.
5. **In-product Sean Ellis** instead of interview calls: after a user's Nth
   query, one question, one click. The founder-playbook script survives; the
   phone call doesn't.
6. **Public build-log.** A weekly auto-drafted changelog/devlog post from the
   merged-PR stream. Zero marginal effort, compounding search surface.

## 5. Observability of progress: one scorecard, not 286 files

"With so many features it's hard to create visibility" — correct, because
status lives in 37 FEATURE.md `Status:` lines, a phase plan, a progress
tracker, a quality source-of-truth, and now.md. Nothing aggregates.

**Recommendation R3 — `docs/scorecard.md`, regenerated daily by agent #1:**
one page, one table, committed (so trends live in git history):

- Funnel: visits → query attempts → first-answer successes → real waitlist
  rows → activated users → returning users (all *bot-excluded*; the synthetic
  flow-004 traffic must be filtered or it poisons every number).
- Engine: persona-bench %, BIRD %, Spider %, free-vs-frontier delta, with the
  date last measured (a stale date is itself an alert).
- Ops: p50/p95 ask latency, error rate, $ spend (should be ~0).
- One line: "worst number this week" + which lane owns it.

Plumbing gaps found today, all free to fix: the Cloudflare API token lacks
`Zone Analytics:Read` (grant it — then agent #1 can pull real pageviews);
PostHog key is ingestion-only (per GLOBAL-034 it's Phase-2-optional — CF Web
Analytics + D1 + LogSnag suffice for now); `GH_TOKEN_WORKFLOW` may already
allow agents to `workflow_dispatch` the eval — test it and delete that
blocked-by-human bullet if so.

## 6. Docs: yes, too many — and the style optimizes for the wrong reader

2.1 MB across 286 files for a product with zero users, written in 7 weeks.
Specific issues:

- **Your own rules are violated:** D4 caps files at 20 KB; 10+ files exceed it
  (runbook 53 KB, anonymous-mode 38 KB, hosted-db-create 35 KB…). Either
  enforce with a CI check or drop the rule.
- **`now.md` is the worst offender stylistically.** Its five sections are
  ~1,500 words of run-on paragraphs where every clause cites three IDs. An agent
  (or you) cannot extract "what's next" without reading all of it. Rewrite
  each section as: *Goal · Done (link list) · Next (one line) · Number it
  moves*. Ten lines per priority, max.
- **Decision records are good; narrative duplication is the bloat.** The
  GLOBAL/SK system is genuinely excellent — keep it. What grows without bound
  is prose that *re-tells* shipped work (now.md, progress files, FEATURE
  status narration). Shipped work is in git; docs should hold only decisions
  (why) and current state (status line + open questions). Apply D5
  aggressively: a paragraph describing what a merged PR did is deletable.
- **The deeper issue:** docs are your agents' working memory, so doc style *is*
  agent performance. Every KB of narrative an agent must read before acting is
  latency and dilution. Decisions-per-byte is the metric; the scorecard +
  trimmed now.md raise it more than any new doc would.

## 7. Research verdict, and what to add

What you did well: the persona set is thoughtful; the ICP miner is real
desk research with an honest bar ("need ≥ 30 quotes; have 1"); the stranger-test
harness is a genuinely unusual anti-self-deception instrument; the acquisition
tracker's evidence-grading (GLOBAL-030) is better hygiene than most funded
startups have.

What's missing is one category: **contact**. Every technique used so far
observes users from orbit; none has put the product in front of one stranger or
put one question to one human. The personas' willingness-to-pay numbers are
guesses wearing tables. Until the gate opens, this cannot improve — which is
why R1 is the research recommendation too.

Cheap techniques you haven't used (all async, $0, agent-runnable):

- **Fake-door / smoke tests:** the waitlist already is one — but it has never
  been exposed to traffic. Publishing (§4) is the missing half.
- **Launch-platform comments as interviews:** every Show-HN reply is a free
  user interview; agents can cluster and grade them like ICP quotes.
- **Public-repo signal:** GLOBAL-019 says Apache-2 open core — if the repo
  isn't public yet, making it so turns stars/issues into a demand instrument.
- **Competitor-user mining:** scrape public complaints about Supabase/Neon/
  text-to-SQL tools specifically (not generic dev pain) — sharper than the
  current 9-source sweep.
- **In-product micro-surveys** (Sean Ellis + "what did you expect this query
  to return?") — feedback at the moment of failure beats any interview.

## 8. This week

Founder (clicks only, ~1 hour total):
1. ~~Decide R1~~ — **resolved**: invite-only; the door is open via invite/allowlist (GLOBAL-027). No action.
2. Run the two eval `workflow_dispatch`es (or let an agent try with
   `GH_TOKEN_WORKFLOW` first).
3. ~~Grant the CF token `Zone Analytics:Read`~~ (**done** — verified live 2026-06-12); confirm the Cerebras/Mistral repo secrets.
4. Approve the first Show-HN draft when lane 3 produces it.

Agents (this week's reprompted routine — applies only if you adopt R2):
1. Build persona-bench (questions from `personas.md` over self-created schemas).
2. Build `docs/scorecard.md` + the daily regenerator, bot-filtered.
3. Rewrite `now.md` in the §6 format; add the 20 KB CI check.
4. Retire the daily open-questions quota; freeze the billing lane.
5. Start the distribution queue (one artifact/day into blocked-by-human).

The honest close: you haven't been failing to make progress — you've been
making excellent progress at industrial speed toward a door you locked from
the inside, while measuring everything except the two numbers that matter
(does the engine answer real users' questions; does any real user exist). Open
the door to a deliberately small crowd, close the eval loop, and the same
seven agents that produced 50 PRs in 6 days become a growth machine instead of
a feature factory.
