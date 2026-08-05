# Goal-pack candidate backlog — packs #3..N (proposals)

**What this is.** A ranked list of candidate [`SK-PIVOT-018`](../../decisions/SK-PIVOT-018-goal-packs.md)
goal packs — proposals only, written for founder ranking (asked 2026-07-29: *"do we have a
list of niche useful agents in the queue?"* — we did not; only pack #1 repo-ops and pack #2
founder-ops [D-05](D-05-founder-ops-pack.md) existed).
**Build order: founder-locked 2026-08-05** (in-session) under the founder's stated
lens — **depth of quality-impact on the pack's niche, not audience size**. The section
numbers below ARE the locked build sequence for every pack after founder-ops (D-05);
each entry keeps a labeled note on where the pre-lock evidence×fit×reach formula had it
and why the lens moved it. No `SK-*` ID is minted per candidate and no skill file exists
yet — a pick still becomes a `D-NN` slice when its turn comes.
**Promotion path.** Founder picks one → a new `D-NN` slice is cut in [`INDEX.md`](INDEX.md)
(same shape as D-05: goal, criterion moved, read-first, steps, `Done when`) → the pack ships
as extraction recipe + seed entities + ≥ 5 golden queries in the `SK-QUAL-023` family, on
the one `agent_memory_v1` schema, **no pack-specific** schema/endpoint/tool. Per
[`SK-PIVOT-021`](../../decisions/SK-PIVOT-021-one-click-goal-pack-journeys.md), it is not
finished until that declarative pack runs through the shared one-click product journey
with resumable auth/source handoffs, honest progress, durable proof and cleanup.

**Admission test** (every candidate below passes, or it isn't listed): ≥ 3 natural queries
that need `GROUP BY` / `JOIN` / aggregate / time-window over what the agent remembered —
the gap Mem0 / Zep / Letta / vector stores structurally don't serve
([`competitors.md` §4](../../../../competitors.md)). A pack whose queries are all
nearest-neighbour recall belongs to them, not to us.
**Ordering** is the 2026-08-05 founder lock (#1 was already founder-set 2026-07-29 and
stays pinned). Channel names in each entry are
[acquisition ledger](../../../../research/acquisition-channels.md) rows.

---

## 1. Language-tutor personal assistant — **founder-set #1** · pilot "become AI" pack (`SK-EKP-004`)

- **Persona:** the founder themself first (founder-ops adjacent, like D-05), then P2a/P2b
  builders shipping personal-assistant agents.
- **Niche agent it makes useful:** a personal assistant with calendar/email/GitHub/Linear
  access that *also* teaches its user a chosen language — it remembers vocabulary encounters
  and mistakes, casually corrects grammar/spelling slips made in ordinary conversation, and
  translates hard words inline. Voice chat + Telegram/WhatsApp reach are part of the full
  vision, **not** of this pack.
- **Pack slice (the queue-eligible part):** extraction recipe = vocabulary encounters and
  mistakes-with-corrections as `facts` tagged by word / grammar rule; lesson and conversation
  sessions as `episodes`; words, rules and topics as `entities`. On-schema, no new
  columns/endpoint/tool.
- **Seed entities:** word, grammar rule, topic, session.
- **Golden queries:** *grammar rules I slipped on most this month* (analytical + temporal) ·
  *words I got wrong ≥ 3 times* (analytical) · *vocabulary due for spaced-repetition review
  this week* (temporal) · *progress trend by week* (temporal) · *which topics produce the most
  corrections*.
- **Distribution:** flagship demo — *"an assistant that provably remembers your learning
  journey, in a database you can query"* — carried by founder-owned venues (Hacker News row 13,
  demo video 21) rather than a search-intent page.
- **Evidence:** **founder-directed 2026-07-29 — flagship vision, founder is first user.** No
  external demand evidence gathered; ranked by founder conviction, not the formula above.
- **Effort:** pack slice ~2 runs. The full assistant (connectors, voice, Telegram/WhatsApp) is
  a separate vision — [`docs/future/language-tutor-assistant.md`](../../../../future/language-tutor-assistant.md),
  written in parallel — **excluded** from this estimate, eventually-built, and must **not**
  block the `SK-PIVOT-016` gate or any `D-*` slice. Only the pack slice is queue-eligible.


## 2. Support-bot resolution ledger

- **Persona:** P2b (agent-SaaS builder, multi-tenant).
- **Niche agent it makes useful:** the support-bot fleet operator who must prove the bot
  *resolved* tickets rather than merely deflected them.
- **Extraction recipe sketch:** per conversation — tenant, topic/intent, outcome tag,
  escalation reason, handoff time, repeat-contact link to a later conversation by the same
  end-user, and cost. Entities: tenant, topic, escalation reason. Episodes: conversations.
- **Seed entities:** the operator's own last 30 days of transcript metadata (never transcript
  prose — structure only, per `SK-PIVOT-017`).
- **Golden queries:** *repeat-contact rate within 7 days, by topic* (temporal + analytical) ·
  *escalation reasons by topic, this week vs last* (temporal) · *cost per resolved ticket by
  tenant* (analytical) · *which topics deflect but don't resolve* · *top 10 topics by volume
  with their resolution rate*.
- **Distribution:** organic search (row 1) via `solve/store-query-chatbot-conversation-history`
  + Reddit `r/AI_Agents` (14, founder-posted).
- **Evidence:** real — the 2026 buyer's stated requirement is exactly this instrumentation:
  *"outcome tagging, escalation reasons, repeat-contact tracking inside a 7-day window, and
  cost-per-resolved-ticket reporting"*, against vendor-reported deflection of 30–60 % vs
  independent 10–25 %
  ([digitalapplied](https://www.digitalapplied.com/blog/ai-customer-support-metrics-deflection-csat-framework-2026),
  [lorikeet](https://www.lorikeetcx.ai/articles/resolution-rate-ai-customer-support-benchmarks-2026),
  [eesel](https://www.eesel.ai/blog/deflection-rate-what-is-it-and-how-to-improve-it)).
- **Effort:** ~2 runs. **Locked #2** (founder 2026-08-05, niche-quality lens): the niche is measuring itself
  with inflated vendor dashboards; this ledger gives an operator ground truth — the deepest
  quality transformation on the list, on the strongest written-down demand. (Formula had it
  #3: the corpus is the user's, nothing self-seeds.)


## 3. Research-agent source ledger

- **Persona:** P2a.
- **Niche agent it makes useful:** the deep-research agent that re-fetches the same sources,
  can't show which claim rests on what, and occasionally cites a URL that never existed.
- **Extraction recipe sketch:** per run — claim, source URL, domain, fetch date, dedupe group,
  support verdict (supported / unsupported / unreachable). Entities: source domain, claim.
  Episodes: fetches.
- **Seed entities:** domain, claim, run.
- **Golden queries:** *sources per claim, and claims with only one source* (analytical) ·
  *domain-authority mix per run over time* (temporal) · *duplicate-source rate per run*
  (analytical) · *which domains produced unreachable citations* · *claims contradicted by a
  later run* (join).
- **Distribution:** Hacker News (13, founder-posted — the audience that reads citation-audit
  posts) + organic search (1).
- **Evidence:** real — a 2026 ACM paper builds deep research around a *persistent Research
  Ledger* tracking claims, contradictions and gaps; open agents dedupe at 90 % shingle
  similarity; 3–13 % of cited URLs are fabricated and citation-support metrics overestimate
  reliability ([Dossier, ACM](https://dl.acm.org/doi/10.1145/3786335.3813122),
  [arXiv 2604.03173](https://arxiv.org/pdf/2604.03173)).
- **Effort:** ~2 runs. **Locked #3** (founder 2026-08-05, niche-quality lens): the most categorical quality
  upgrade here — claim↔source↔verdict tracking makes a research agent a different class of
  trustworthy, the analytical shape is the purest (a ledger *is* a table), and the EK research
  work dogfoods it. (Formula had it #6 purely on audience size — the factor the founder
  discounted.)


## 4. Per-end-user memory provenance & retention ledger

- **Persona:** P2b.
- **Niche agent it makes useful:** the builder who must answer *"what does our agent know
  about this end-user, from where, and when does it expire?"* before shipping.
- **Extraction recipe sketch:** per memory row — end-user, tenant, source (conversation /
  tool output / import), first-written date, retention class, last-touched. No new columns:
  source and retention class ride the existing `facts`/`episodes` shape as typed content plus
  `entity_facts` edges.
- **Seed entities:** end-user, source, retention class.
- **Golden queries:** *memories per end-user by source and age bucket* (analytical) · *rows
  past their retention class, per tenant* (temporal) · *which end-users have memories older
  than 90 days* (temporal) · *how many memories reference an entity we were asked to forget*
  (join) · *write volume per tenant per week*.
- **Distribution:** organic search (1) on the two pages that already exist —
  `solve/expire-old-agent-memory`, `solve/isolate-ai-agent-memory-per-tenant`.
- **Evidence:** real — the named 2026 failure is *"you cannot delete what you do not know the
  agent stored"*, erasure is the EDPB's enforcement priority, and Spain's DPA published a
  71-page technical guide on agent-memory systems in Feb 2026
  ([astraea](https://astraea.law/insights/ai-agent-memory-tool-privacy-compliance),
  [typegraph](https://typegraph.ai/blog/retention-policies-ai-memory-compliance)).
- **Effort:** ~2 runs. **Locked #4** (founder 2026-08-05 — unchanged from formula): for its niche this is the
  difference between shippable and not (erasure enforcement, Spain's DPA guide) —
  **boundary:** the pack stays *queryable provenance* and makes **no** compliance claim (A1
  regulated enterprise is an anti-persona).


## 5. Coding-agent fleet ledger

- **Persona:** [P2a](../../../../research/personas.md) (+ P1 solo builder as operator).
- **Niche agent it makes useful:** the operator running 4–8 parallel coding agents across
  worktrees/branches and losing track of which run did what, for how much.
- **Extraction recipe sketch:** per agent run — task, repo, branch, harness, model, start/end,
  outcome (merged / abandoned / reverted), retries, tool-call failures, compute cost — from
  the harness's own session logs, PR/commit metadata, and CI results. Entities: repo, harness,
  task type. Episodes: one per run.
- **Seed entities:** nlqdb's own worktree runs (`.claude/worktrees/*`), the `/daily` run
  numbers, merged-PR history — a corpus we generate several times a day.
- **Golden queries:** *cost per merged PR by repo, last 30 days* (analytical) · *success rate
  by task type, week over week* (temporal) · *which repos have the most reverted agent
  commits* (analytical) · *how many runs are still open and since when* · *which tool call
  fails most often per harness*.
- **Distribution:** `agent-artifacts` (row 12 — the one live coding-agent channel, one-command
  `npx skills add`) + `github` (16); lands on `solve/analyze-agent-tool-call-logs`.
- **Evidence:** real and current — Cursor 3 runs up to 8 agents in parallel worktrees and
  Claude Code Agent Teams isolates agents per branch; a background-agent PR costs ~$4–5 in
  compute; the category's own framing of the pain is *"which agent is blocked, which one
  changed the wrong file, which branch is safe to merge"*
  ([nimbalyst](https://nimbalyst.com/blog/best-agent-management-tools-2026/),
  [ssojet](https://ssojet.com/blog/parallel-sub-agent-coding-tools)).
- **Effort:** ~2 daily runs. **Locked #5** (founder 2026-08-05, niche-quality lens): visibility for the niche rather
  than transformation of it. Its operational advantages stand — the only self-seeding corpus
  (feeds `SK-PIVOT-016` criterion 1 for free) and the one live coding-agent channel — and are
  the argument if sequencing ever needs a swap. (Formula had it #2 on exactly those.)


## 6. Per-tenant agent usage & cost ledger

- **Persona:** P2b.
- **Niche agent it makes useful:** the agent-SaaS operator whose provider invoice went up and
  cannot say which customer caused it.
- **Extraction recipe sketch:** per agent run — tenant, feature, model, tokens in/out/cached,
  latency, outcome — from the app's own run records. Entities: tenant, feature, model.
- **Seed entities:** tenant, feature, model, plan.
- **Golden queries:** *spend per tenant per month* (analytical + temporal) · *gross margin per
  account against plan price* (join) · *tokens per successful task by feature* (analytical) ·
  *which tenants crossed their quota this week* · *cost trend after the last model swap*.
- **Distribution:** organic search (1) via `solve/analytical-queries-over-agent-memory`; npm
  (17) / `agent-artifacts` (12) for the recipe itself.
- **Evidence:** real — the 2026 attribution playbook requires `customer_id` on every span
  *"including spans created inside the customer's agent runs"*, because *"the invoice can show
  that spending increased, but cannot explain which customer … caused it"*
  ([braintrust](https://www.braintrust.dev/articles/how-to-track-llm-costs-2026),
  [metacto](https://www.metacto.com/blogs/llm-cost-attribution-per-user-feature)).
- **Effort:** ~2 runs. **Locked #6** (founder 2026-08-05): real pain, crowded venue (Langfuse / Helicone /
  Portkey own the instrumentation story) — marginal quality contribution to a niche that
  already has tools; the honest angle stays *"aggregate the rows your agent already writes"*.
  (Formula #5.)


## 7. Incident / on-call agent memory

- **Persona:** P6 (SRE) with a P2b builder wrapping it.
- **Niche agent it makes useful:** the on-call triage agent that answers *"have we seen this
  before?"* with counts instead of a vibe.
- **Extraction recipe sketch:** per incident — service, trigger alert, severity, start/resolve
  times, runbook applied, outcome, postmortem link. Entities: service, alert, runbook.
- **Seed entities:** service, alert rule, runbook.
- **Golden queries:** *recurring incidents per service per quarter* (temporal) · *MTTR by
  runbook applied* (analytical) · *alerts that never became incidents, last 30 days*
  (temporal) · *which services page most outside business hours* · *incidents with no
  postmortem, by age*.
- **Distribution:** organic search (1); answer engines (11) later.
- **Evidence:** real but adjacent — PagerDuty shipped an SRE agent *with memory* and names the
  limit plainly: retrieval quality *"depends entirely on how well past incidents were
  documented"*
  ([pagerduty](https://www.pagerduty.com/blog/ai/we-built-an-sre-agent-with-memory-and-its-transforming-incident-response/),
  [augmentcode](https://www.augmentcode.com/guides/ai-sre-incident-management)).
- **Effort:** ~2 runs. **Locked #7** (founder 2026-08-05 — unchanged): deep pain, wrong product shape — P6's
  real ask is an NL skin over the ClickHouse they already run (`SK-MULTIENG-005`), so the pack
  serves only the *builder of* an SRE agent.


## 8. Eval / regression ledger for agent builders

- **Persona:** P2a → P2b.
- **Niche agent it makes useful:** the builder who changed a prompt or model and cannot say
  which cases regressed.
- **Extraction recipe sketch:** per eval run — suite, case id, prompt version, model, verdict,
  score, duration. Entities: suite, case, prompt version, model.
- **Seed entities:** nlqdb's own `SK-QUAL-023` / BIRD-Spider eval history.
- **Golden queries:** *pass rate per prompt version over time* (temporal) · *cases that
  regressed on the last model swap* (join + temporal) · *flaky cases: verdict changed ≥ 3
  times* (analytical) · *free-vs-frontier delta per suite* · *slowest cases by suite*.
- **Distribution:** dev.to (2) + `github` (16).
- **Evidence:** real, but the need is already served — 2026 eval platforms ship pass-rate
  dashboards across prompt versions; the residual complaint is that *"issue discovery is
  manual"* ([qaskills](https://qaskills.sh/blog/openai-agent-evals-complete-guide-2026),
  [confident-ai](https://www.confident-ai.com/blog/llm-agent-evaluation-complete-guide)).
- **Effort:** ~2 runs. **Locked #8** (founder 2026-08-05 — unchanged): the need is already served
  (Braintrust/MLflow lane); the one advantage is that we dogfood it.


## 9. Sales / pipeline agent memory

- **Persona:** P2b.
- **Niche agent it makes useful:** the SDR-agent builder whose bot remembers each prospect but
  can't roll the pipeline up.
- **Extraction recipe sketch:** per prospect — account, stage, stage-entry dates, touches by
  channel, objections raised, outcome. Entities: account, stage, objection, channel.
- **Seed entities:** account, stage, objection.
- **Golden queries:** *average deal size per stage for enterprise accounts* (analytical) ·
  *stage-to-stage conversion by month* (temporal) · *top objections by segment* (analytical) ·
  *accounts with no touch in 14 days* (temporal) · *touches per closed deal by channel*.
- **Distribution:** `vs/mem0`, `vs/letta` (organic search row 1) — it is the most legible
  head-to-head demo of the analytical gap.
- **Evidence:** **thin — largely hypothesis.** The analytical gap is real and documented
  (Letta can recall *"Alice has a $50k deal"* but cannot answer *"average deal size per stage"*
  — `competitors.md` §4), but that framing is **ours**; the AI-SDR vendor material found
  describes CRM sync and pipeline dashboards, not builders complaining they can't aggregate
  agent memory ([amplemarket](https://www.amplemarket.com/blog/best-ai-sales-agents)). No
  builder-voice quote found. Treat as demo material until a real ask arrives.
- **Effort:** ~1–2 runs. **Locked #9** (founder 2026-08-05 — unchanged): demos best, evidenced worst — hypothesis
  until a real ask arrives.
---

## Explicitly not proposed (so the next agent doesn't re-derive them)

- **A prose / RAG "ingest my Notion + docs" pack.** Chunked narrative prose has no analytical
  queries — it fails the admission test by construction, and `SK-PIVOT-017` already rejects
  arbitrary-prose ingestion as the vector-RAG trap. Every pack extracts *structure*.
- **A compliance-attested memory pack** (DPA, SOC 2, HIPAA-shaped audit trails). A1 is an
  anti-persona and we are not compliant; candidate #3 deliberately stops at queryable
  provenance and claims nothing about attestation.
- **A dashboards/charts pack over memory.** A4 anti-persona — that is Metabase/Hex. Packs ship
  golden *queries*; the only surface that renders is the `/agents` dashboard (D-06).
- **Any per-vertical pack that wants its own schema** (`agent_healthcare_memory_v1`, …). The
  rejected alternative inside `SK-PIVOT-018`; a pack that needs a column is in the engine
  track, not this one.
