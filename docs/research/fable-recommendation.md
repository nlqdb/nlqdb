# Fable recommendation — why progress feels invisible, and how to fix it

*Written 2026-06-12 by Claude (Fable), from a full repo scan, live production data
(D1, Cloudflare API), and web research on benchmark SOTA. Every number below is
sourced. This doc raises decisions per P1; it changes nothing by itself.*

## 0. TL;DR

Your machine works. Your compass is broken — in one specific, fixable place.

1. **The front door is open (§2).** The product is fully public — any
   stranger can reach a first answer with no gate and no invite code. The
   BIRD/Spider thresholds stay as a public progress bar, not a lock. The
   bottleneck is traffic and engine quality, not access.
2. **The company has zero external contact, measured.** Production D1 today:
   7 users (you ×3 + 4 test accounts), 0 external. Web analytics are unreadable
   (the API token lacks the analytics scope). The only feedback nlqdb has ever
   received is from itself.
3. **The quality loop is open, not closed.** 12 planner levers (SK-LLM-023…035)
   shipped blind; one aggregate measurement since they landed (2026-06-09); the canonical
   re-seed has sat in `blocked-by-human.md` waiting for a click. Agents optimize
   what they can see — merged PRs, resolved open questions — because the number
   that matters is measured roughly never. *(Update, same day: the re-seed ran
   — BIRD 0.522, Spider 0.1704 — and the newest lever wave shipped WITH
   same-seed before/after smokes. The loop is starting to close; §8 tracks
   what's left.)*

The fix: the door decision is resolved (§2), the quality loop is closing
(§8), and ~3 of the 7 daily agents re-point from *building* to *measuring
and distributing*. Status checklist in §8; the operating loop in §9.

## 1. Ground truth (measured 2026-06-12)

| Fact | Value | Source |
|---|---|---|
| Company age | ~7 weeks (CF account 2026-04-24) | Cloudflare API |
| Real registered users | **0 external** (7 rows: founder + tests) | D1 `user` table |
| BIRD-dev EX (free chain) | 0.35 (lower bound, 1 run, 2026-06-09; re-seeded **0.522** by the 2026-06-12 canonical 6-provider run) | `tools/eval/baseline-2026-06-15.json` |
| Spider 2.0-lite EX (free chain) | 0.12 (re-seeded **0.1704**, 2026-06-12 — still far below the 0.75 target) | same |
| Engine-quality thresholds | BIRD ≥ 0.65 AND Spider ≥ 0.75 | GLOBAL-025 |
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

## 2. The door is open

The original 2026-06-12 finding flagged a tension between an engine-quality
gate and the north-star floors. That gate has since been removed entirely:
the product is fully public, with no access gate and no invite codes — any
stranger can run a query today.

- GLOBAL-025 (north-star) — correctly calibrated. Spider 2.0-lite free chain:
  Phase 2 "report only", Phase 3 floor **≥ 15%**. It even says: "The Spider 2.0
  frontier in 2026 is 5–23% — proof that engine work, not model picking, is
  where the moat lives."
- The BIRD ≥ 0.65 AND Spider ≥ 0.75 numbers survive only as the public
  engine-quality **progress bar** (GLOBAL-025 treatment), not as an access
  lock. The bottleneck is traffic + engine quality, not access.

What survives as agent work: build the **persona-bench** — ~50–100 NL
questions from `personas.md` over nlqdb-created 5–20-table schemas (the actual
ICP shape) — as a tracked, user-relevant quality number alongside BIRD/Spider.

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
| 1 | **Scorecard** | Pull eval results, D1 counts, CF analytics, LogSnag → regenerate `docs/scorecard.md` (current-state tracker, no changelog) → flag the worst number | all (read-only) |
| 2 | **Eval loop** | Pick ONE lever → run mini-eval (fixed 60-q slice) before/after → merge only if Δ ≥ 0, else revert + record | persona-bench %, BIRD % |
| 3 | **Distribution** | Produce one publishable artifact/day: Show-HN draft, dev.to post, answer to a real SO/Reddit thread, comparison-page improvement, directory submission. Queue in `docs/research/distribution-queue.md`; published autonomously (daily step 3) | external visits, registered strangers |
| 4 | **User evidence** | ICP mining toward the ≥30-quote bar; draft (not send) outreach to authors of mined pain-quotes; in-product Sean Ellis survey slice | scored quotes, survey responses |
| 5 | **Stranger test** | Keep as-is — it's genuinely good — plus: alert when a *real* (non-bot) email enters the funnel | funnel pass-rate |
| 6 | **Feature** | One lane, demand-ordered: finish BYO Postgres end-to-end before ClickHouse/OTel; billing lane frozen until first "how do I pay" | TTFV, first-10-queries success |
| 7 | **Review/merge** | Keep, plus enforce: a PR that names no measured KPI delta in its body doesn't merge | gate on all of the above |

**Prompt pattern for every lane** (this is the rethink you asked about):
start with "read `docs/scorecard.md`; state the one number you intend to move
today"; end with "re-measure it; overwrite the scorecard's Last-change entry
with the delta; if it didn't move, revert and write one line on why." An agent that can't name its
number does docs cleanup instead of shipping code.

## 4. Growth, within your real constraints ($0, no calls, Claude-run)

You don't need sales or calls. You need **published artifacts + an open door +
honest measurement**. All async, all free, all agent-run (published
autonomously since 2026-07-01; only Show-HN stays founder-only):

1. **Open the door — done.** The product is fully public; any stranger can
   reach a first answer with no gate and no invite code.
2. **Launch posts, in order of effort:** Show HN ("a database you talk to, no
   backend — built and run ~entirely by Claude Code" is itself a hook),
   lobste.rs, r/SideProject + r/Database, Hacker News comment presence on
   text-to-SQL threads. The Claude-runs-the-company angle is a genuine story;
   use it.
3. **Answer real questions where they already are.** The ICP miner finds the
   pain-threads; the distribution agent writes a genuinely helpful answer that
   mentions nlqdb once. This is the no-sales version of outreach.
4. **AEO you already built:** `/solve/*`, `/vs/*`, `llms.txt`, MCP directory
   submission (form submitted 2026-06-12 — §8). These are inbound
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

- Funnel: visits → query attempts → first-answer successes → registered
  strangers → activated users → returning users (all *bot-excluded*; the
  synthetic stranger-test traffic must be filtered or it poisons every number).
- Engine: persona-bench %, BIRD %, Spider %, free-vs-frontier delta, with the
  date last measured (a stale date is itself an alert).
- Ops: p50/p95 ask latency, error rate, $ spend (should be ~0).
- One line: "worst number this week" + which lane owns it.

Plumbing gaps found today, all free to fix: the CF token's
`Zone Analytics:Read` was granted by the founder 2026-06-12 (scorecard agent
verifies on its first pull); PostHog key is ingestion-only (per GLOBAL-034 it's Phase-2-optional — CF Web
Analytics + D1 + LogSnag suffice for now); `GH_TOKEN_WORKFLOW` may already
allow agents to `workflow_dispatch` the eval — the `/daily` scorecard step
verifies on its first dispatch.

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
guesses wearing tables. The product is open to anyone — distribution (§4) is
the missing half.

Cheap techniques you haven't used (all async, $0, agent-runnable):

- **Launch-platform comments as interviews:** every Show-HN reply is a free
  user interview; agents can cluster and grade them like ICP quotes.
- **Public-repo signal:** GLOBAL-019 says Apache-2 open core — if the repo
  isn't public yet, making it so turns stars/issues into a demand instrument.
- **Competitor-user mining:** scrape public complaints about Supabase/Neon/
  text-to-SQL tools specifically (not generic dev pain) — sharper than the
  current 9-source sweep.
- **In-product micro-surveys** (Sean Ellis + "what did you expect this query
  to return?") — feedback at the moment of failure beats any interview.

## 8. Status — done vs left (updated 2026-06-12, evening)

Done same day this doc was written:

- ✅ **R1 resolved**: the product is open (no gate, no invite codes); thresholds
  stay a progress bar — §2.
- ✅ **Canonical 6-provider eval re-seed ran.** BIRD 0.522 (261/500,
  chain-exhaustion `no_sql` 51 → 3), Spider 0.1704. BIRD is now **12.8 pp from
  its 0.65 bar**.
- ✅ **Per-lever measurement adopted.** SK-LLM-036/037 shipped with same-seed
  before/after smokes (BIRD 37.3 → 51.3, Spider 15 → 25) plus the
  capacity-honest budget-stop (SK-QUAL-013). This is R2's core habit.
- ✅ CF token `Zone Analytics:Read` granted (founder; scorecard agent verifies
  on first pull) · MCP directory form submitted (first outbound artifact) ·
  `now.md` §1 trimmed · this doc relocated to `docs/research/`.
- ✅ `blocked-by-human.md` cut to the two deliberate deferrals (Stripe
  live-mode, Reddit OAuth). The Suite-A hedge call is delegated to the
  measured-delta loop (e2e-coverage → Open questions).
- ✅ **Daily agent prompt** codified — `.claude/commands/daily.md` (§9 as one
  executable loop).

Left — all agent-side; nothing waits on the founder (§9):

- ☐ **Persona-bench** (§2) — the user-relevant quality number.
- ☐ **`docs/scorecard.md` + daily regenerator** (bot-filtered funnel + engine
  numbers + "worst number this week"). The first `/daily` run creates it.
- ☐ **Distribution queue** — zero publishable artifacts yet; still zero
  external humans (D1 re-checked today). One draft/day into
  `docs/research/distribution-queue.md`.
- ☐ In-product Sean Ellis micro-survey; 20 KB CI check; retire the daily
  open-questions quota. (Billing-lane freeze is codified — `/daily` rule 5.)

## 9. The repeatable process

The loop that turns 7 agents into compounding progress — one page, no new
tooling. Runnable form: [`.claude/commands/daily.md`](../../.claude/commands/daily.md).

**Daily (agents, in order):**

1. **Measure first.** Scorecard agent regenerates `docs/scorecard.md` from
   live sources (D1 counts bot-filtered, latest eval results, CF analytics
   once readable, LogSnag) and names the **worst number**. Until the file
   exists, the agent creates it — that's day one's whole job.
2. **One lever per lane, measured.** Every lane agent starts by quoting the
   scorecard number it will move and ends with the same number re-measured:
   engine lanes via the same-seed smoke (the SK-LLM-036/037 pattern, now
   proven), funnel lanes via the stranger-test walkers. Δ ≥ 0 merges; Δ < 0
   reverts with a one-line note. An agent that can't name its number does
   deletion/cleanup (D5) instead of building.
3. **One artifact out.** Distribution agent publishes one thing — queue
   drafts ship to `nlqdb.com/blog` autonomously (founder-resolved
   2026-07-01; `/daily` step 3); nothing waits for review. Publishing is
   a daily output, not a launch event. `blocked-by-human.md` stays
   reserved for true human-only blockers.
4. **Review gate.** The merge agent rejects any PR whose body names no
   measured delta — the existing CLAUDE.md §8 quality gates plus one line.

**Weekly (an agent run, not a founder session):** runnable form
[`/weekly`](../../.claude/commands/weekly.md). The agent audits the week's
dailies (trend, monoculture, yield, dark metrics, delta integrity, prompt
drift), dispatches or verifies the canonical eval, and sets the weekly focus
number at the top of the scorecard. Publishing is autonomous (daily step 3).
The founder may override the focus number — a founder-written number is never
overwritten — and clears `blocked-by-human.md` on their own cadence, but
nothing waits on them.

**The invariant** behind both cadences: *no change without a number, no number
without a next change.* Measure → pick the worst number → smallest change →
re-measure → publish or revert → repeat. The engine lane already runs this
loop (+17 pp on BIRD in a day); the door is open. The scorecard
plus the distribution queue extend the same loop to the only numbers that
ultimately matter: real strangers reaching real first answers.
