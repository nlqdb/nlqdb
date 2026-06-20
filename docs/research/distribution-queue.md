# Distribution queue

One publishable artifact drafted per day by the daily agent
([`/daily`](../../.claude/commands/daily.md) step 3); the founder reviews and
publishes at the weekly session. Newest first. Delete an entry once published
(the live URL goes into `docs/scorecard.md`).

## 2026-06-20 (run 30) — "Show HN: analytical memory for AI agents" (Hacker News, → `/agents`)

**Where:** Hacker News Show HN, pointing at `https://nlqdb.com/agents` (the new
front door — embed the capability matrix + live demo first, WS-07 runs 2–3, so
the landing is complete before this posts). Cross-post the body to
r/AI_Agents and r/LocalLLaMA.

**Title:** Show HN: Analytical memory for AI agents — a database it can GROUP BY, not just recall

**Body:**

> Most "agent memory" is a vector store: you embed past text and recall the
> top-k most similar chunks. That's great for "what did we say about X," but it
> falls down the moment the agent needs to *reason over* its own history —
> "how many times did this user ask about pricing this month," "top 5 tools I
> called this week," "average resolution time per category." Those are
> `GROUP BY` / `JOIN` / `HAVING` queries, and a similarity index has no query
> planner, so the rollup degrades into the model doing arithmetic over search
> hits.
>
> nlqdb gives an agent a real Postgres database as memory. It writes typed rows
> as it learns and later asks questions in plain English; we compile the
> question to SQL through a typed-plan trust boundary, run it, and hand back the
> rows **plus the exact SQL** — auditable, not a black box. Recall is table
> stakes; the analytical side is the part a vector store structurally can't do.
>
> It's a database, not a vector store — so similarity search over an embedding
> column (pgvector) is an opt-in slice still landing; today the wedge is the
> analytical half. Honest about scope on the page.
>
> Front door: https://nlqdb.com/agents · MCP server so your agent discovers it
> at tool-list time. Pre-alpha, closed beta — feedback very welcome.

**Note:** hold until WS-07 run 3 ships the CTA so the Show HN lands on a
complete page (hero + matrix + moat + waitlist), not the run-1 skeleton.

## 2026-06-20 (run 29) — "What's in an `agent_memory_v1` database" (docs page / dev.to)

**Where:** a short `apps/docs/` reference page (and a dev.to cross-post) that
shows the exact four-table shape an agent gets with `preset:
"agent_memory_v1"` — the proof behind the "zero schema design" wedge claim.
Publish once E-01 run 2 wires the preset into `db.create`.

**Title:** Your AI agent's memory, as four Postgres tables (no schema design required)

**Body (the schema is the argument):**

> Most "agent memory" is an opaque vector blob you can recall from but never
> *query*. nlqdb's memory is four plain Postgres tables your agent provisions
> in one call — and because it's real SQL, the agent can `GROUP BY` over its
> own history:
>
> - **`facts`** — typed memories (`kind`, `content`, `tags[]`, `source`,
>   `created_at`, `expires_at`), scoped by `agent_id` / `end_user_id` /
>   `thread_id`.
> - **`episodes`** — the raw conversation turns (`role`, `content`,
>   `tool_calls`, `tokens`, `occurred_at`) the facts were distilled from.
> - **`entities`** — canonical people/things the agent has seen (unique per
>   `agent_id` + `kind` + `canonical_name`).
> - **`entity_facts`** — which facts mention which entity (cascading link).
>
> No `CREATE TABLE`, no migration, no schema design: `db.create({ preset:
> "agent_memory_v1" })` and start remembering. The shape is versioned and
> stable — it widens (add a column) but never renames in place, so your
> `WHERE` clauses keep working.
>
> *(Honest scope: similarity search over `facts.embedding` lands in a later
> slice — pgvector is opt-in; today the wedge is the analytical side, the part
> a vector store structurally can't do.)*

**Why it converts:** the P2 agent-builder's first objection to "use a database
as memory" is "I don't want to design a schema." This page answers it in one
screen — and the schema *is* the on-brand visual (type-on-dark, no diagram).

---

## 2026-06-20 (run 28) — X/Bluesky thread: the one bright column (agent-memory matrix render)

**Where:** X / Bluesky, a 3-post thread whose hook is the *rendered* matrix —
the single all-✓ nlqdb column against three columns of dashes. Screenshot the
live component (once it's on `/agents`, WS-07) or paste the table inline. Pairs
with the run-27 long-form Show HN post; this is the short social teaser that
drives to it.

**Thread:**

> 1/ Your agent can remember things. Cool. Can it answer a question *about* what
> it remembered? "Top 5 deals by size." "Average per stage." "What closed this
> month." Most memory tools can't — they do top-k similarity, not SQL.
>
> 2/ We built the honest table. Mem0, Zep, Letta, nlqdb. Everyone wins the top
> two rows (remember + recall). Then it's one bright column the rest of the way
> down — because aggregation needs a query planner, and a vector store doesn't
> have one. [matrix]
>
> 3/ nlqdb's memory *is* a Postgres the agent provisions in English and then
> runs `GROUP BY` / `JOIN` / `HAVING` over. Not a vector store with a SQL
> bolt-on — a database it talks to. The table's not a clean sweep (self-host is
> ◐ for us today, honest) but the analytical rows are ours alone.

**Why it works:** the rendered matrix is built as live text (no raster image,
SK-PIVOT-004), so the visual punch — one lit column — survives copy-paste into
a post and is liftable verbatim by AI search engines. The shape *is* the
argument; the thread just points at it.

---

## 2026-06-20 (run 28) — note: "What FSL-1.1 actually means for self-hosting nlqdb" (dev.to / r/selfhosted)

**Where:** a short dev.to / r/selfhosted / lobste.rs note for the
self-hosted-agent crowd who reflexively distrust "source-available." One
honest explainer, one nlqdb mention.

**Title:** "Source-available" isn't a trap if you read the license — what FSL-1.1 means for self-hosting

**Body:**

> If you self-host your stack, "source-available" probably sets off an alarm —
> it's often code for "open enough to read, locked enough to bill you later."
> So here's nlqdb's license in plain terms, because the wedge is *honesty*, not
> a clean OSI badge:
>
> - **FSL-1.1-ALv2** (Functional Source License — the Sentry / Convex pattern).
> - You can **read, fork, and self-host** the engine, CLI, MCP server, and SDKs
>   for **any non-competing use** — i.e. anything except standing up a hosted
>   nlqdb competitor. Internal tools, your own agents, client work: all fine.
> - **Bring your own LLM key at 0% markup.** No per-call fees to us, no pricing
>   page on the open core.
> - The license **auto-converts to Apache 2.0 two years after each release** —
>   the future-license clause is in the LICENSE file, not a promise in a blog post.
>
> What we *won't* claim yet: there is no turnkey `docker compose up` image today.
> The container (`ghcr.io/nlqdb/api`) is on the roadmap; until it ships, "self-host"
> means the source, not a one-command box. We'd rather under-promise the image
> than over-claim it — same reason every answer shows you the SQL it ran.

**Why this is publishable:** the self-hosted crowd is a real distribution
channel for an agent-memory DB, and the honest "here's what we *don't* have
yet" framing is exactly the trust signal that converts skeptics (the
ResearchReceipts "show your work" posture). Sourced from `LICENSE` +
`GLOBAL-019` + `SK-PIVOT-005`. The copy now lives on `/pricing` + the README
"Models & plans" section (WS-10); this note is the long-form version.

## 2026-06-20 (run 27) — comparison table: "What can your agent actually DO with its memory?" (Show HN / r/AI_Agents)

**Where:** a Show HN / r/AI_Agents / r/LangChain post built around the
four-column capability matrix (Mem0 · Zep · Letta · nlqdb). Publish once the
WS-06 render ships on `/agents`; the table is the whole post.

**Title:** Mem0 vs Zep vs Letta vs nlqdb — what can your agent actually DO with its memory?

**Body (the table is the argument):**

> Every agent-memory tool can *remember a fact* and *recall it later*. That's
> table stakes — Mem0, Zep, Letta, and nlqdb all do it. The question nobody puts
> in the comparison is what happens when the agent needs to ask a question
> **about** its memory:
>
> | Capability | Mem0 | Zep | Letta | nlqdb |
> |---|:--:|:--:|:--:|:--:|
> | Remember a fact | ✓ | ✓ | ✓ | ✓ |
> | Recall by similarity | ✓ | ✓ | ✓ | ✓ |
> | Top-N by value | — | — | — | ✓ |
> | Aggregate per group | — | — | — | ✓ |
> | GROUP BY / JOIN / HAVING | — | — | — | ✓ |
> | Agent designs its own schema | — | — | — | ✓ |
> | Diff preview before writes | — | — | — | ✓ |
> | Self-hostable | ✓ | ◐ | ✓ | ◐ |
>
> A vector/graph store returns the top-k *similar* rows — there's no query
> planner, so "average deal size per stage" becomes the LLM doing arithmetic
> over search hits (a hallucination generator, not a `GROUP BY`). nlqdb's memory
> *is* a real Postgres the agent provisions and queries in English.
>
> Honest, not a clean sweep: Mem0/Letta/LangMem are OSI-licensed and self-host
> cleanly; Zep self-hosts the Graphiti engine but runs the platform hosted; and
> **nlqdb is source-available under FSL, not yet OSI** — so the self-host row is
> a ◐ for us too. The wedge is analytics over memory, not licensing.

**Why this is publishable:** the matrix is the wedge's single most persuasive
comprehension asset — the table does the work, one nlqdb mention in context.
Honest-trade-off format (~13.8% vs 2–5% generic) lifted verbatim by
Perplexity/ChatGPT. Sourced from `apps/web/src/data/agentMemoryMatrix.ts`
(verified 2026-06-19 from `competitors.md §4`). Seeds the WS-09 HN launch post.

## 2026-06-20 (run 26) — X/Bluesky thread draft: "your agent's memory should be able to GROUP BY"

**Where:** X + Bluesky (founder account), one short thread aimed at the
agent-builder timeline. Pin reply links the `/solve/analytical-queries-over-agent-memory`
page once it ships.

**Thread:**

> 1/ Your AI agent's memory should be able to `GROUP BY`.
>
> Most "agent memory" is a vector store: embed a fact, retrieve the top-k
> *similar* ones. Great for "what did the user say about X." Useless for
> "how many things did my agent remember per category this week."
>
> 2/ The moment you want a *count*, a *top-N*, or a *per-period* number, a
> vector store makes the LLM do arithmetic over search hits. That's slow,
> unbounded, and wrong on the long tail.
>
> 3/ nlqdb is a real Postgres your agent talks to in plain English. Ask
> "per category, how many facts did my agent store this week" → it runs the
> actual `GROUP BY category … ORDER BY count DESC` and hands back the rows
> *plus the compiled SQL*. The math is in the database, not the model's head.
>
> 4/ Same for "the 5 facts my agent recalled most across all threads" — one
> `GROUP BY … ORDER BY … LIMIT 5`, not a similarity scan. Recall is top-k.
> Analytics is top-N. Different query, different store.
>
> 5/ Vector recall and SQL analytics are complementary — keep your vector
> store for semantic recall, add nlqdb when you need to *count* what's in
> memory. mcp.nlqdb.com · honest: no native vector search yet.

**Why this is publishable:** lands the WS-05 carousel wedge ("analytics over
agent memory") as a standalone thread on the surface where agent builders live.
Every claim maps to a real shipped slide (`read-agent-memory-by-category`,
`read-agent-memory-top-recalled`) and the honest "no native vector search yet"
disclaimer matches the solve-page copy — no overclaim.

## 2026-06-20 (run 25) — helpful-answer draft: "reporting over agent memory" (r/AI_Agents / r/LangChain)

**Where:** a real recurring thread on r/AI_Agents / r/LangChain where someone asks
how to get **counts / stats / "top N" / per-period rollups** out of their agent's
memory (distinct from the run-23 "can't aggregate" framing — this one is the buyer
who *already* has memory and now wants reports). Post once, in context, linking the
new sibling solve page once.

**Title (if a fresh post):** My agent logs everything it learns — how do I actually run reports over that memory?

**Body:**

> Once your agent is reliably *storing* what it learns, the next question is
> almost always analytical: "top 10 topics it logged this month by count,"
> "average deal size per stage," "how many tasks did it close per day this week."
> That's the point where a vector / graph memory layer (Mem0, Zep, LangMem, a
> Letta archival tier) stops helping — it returns the top-k *most similar* rows, it
> has no query planner, so the rollup turns into the LLM doing arithmetic over a
> list of search hits. That's a hallucination generator, not a `GROUP BY`.
>
> The split that's worked for me: keep the unstructured recall where it shines,
> but put the rows the agent will later **count / rank / bucket** in a real
> relational store and let it run actual SQL. I've been using nlqdb for the
> reporting half (writeup:
> nlqdb.com/solve/analytical-queries-over-agent-memory) — the agent asks the
> report in English over MCP (`nlqdb_query`), it compiles to SQL against the
> memory table, runs the aggregation in Postgres, and hands back the rows plus the
> compiled SQL so you can check the grain. Same database it writes to, so there's
> no second store to sync.
>
> Honest limit: nlqdb has no native vector search — it's the structured/analytical
> half, not the similarity-recall half. The two compose.

**Why this is publishable:** it targets the read-side search intent ("run reports
over agent memory") that the new `/solve/analytical-queries-over-agent-memory` page
answers — a distinct keyword from the write-side "give my agent memory" page and
the run-23 "can't aggregate" post. One in-context link, honest about the
no-vector-search limit (SK-SOLVE-002 / SK-PIVOT-002), real tool name only
(`nlqdb_query`, no phantom `create_database`).

## 2026-06-19 (run 24) — MCP-directory listing refresh: "the analytical-memory MCP server"

**Where:** Anthropic Connectors Directory listing for `mcp.nlqdb.com` (refresh
the description once the submission clears review — form submitted 2026-06-12,
awaiting review per `mcp-server/FEATURE.md`), plus any community MCP registries
(`mcpservers.org`, `glama.ai/mcp`, `smithery.ai`) where nlqdb is or can be
listed. Single-line directory blurb to paste:

**Listing description:**

> **nlqdb — analytical memory for AI agents.** A real database your agent can
> `GROUP BY` / `JOIN` / aggregate over in natural language, not just a recall
> store. Three tools — `nlqdb_query`, `nlqdb_list_databases`, `nlqdb_describe` —
> materialise a Postgres database on first reference and return rows + the
> compiled SQL. Destructive plans return a diff for confirmation before they
> commit.

**Why this is publishable:** directory listings are the single highest-leverage
agent-facing surface — the tool list is exactly where a host (Claude Desktop,
Cursor, VS Code) shows an agent what nlqdb *is*. The refreshed blurb mirrors the
WS-04 in-product tool descriptions verbatim (no claim that isn't true at the tool
boundary), and keys the "analytical memory ≠ recall" wedge to the P2 agent-builder
search intent. Honest: names the real three tools only — no phantom
`create_database` (SK-MCP-002 / SK-PIVOT-002), no native vector search claimed.

## 2026-06-19 (run 23) — helpful-answer draft: "vector memory can't aggregate" (r/LangChain / r/AI_Agents)

**Where:** a real recurring thread on r/LangChain / r/AI_Agents where someone
asks "how do I get stats / counts / 'top N' out of my agent's memory?" and the
answers are all "embed it and retrieve top-k." Post once, in context.

**Title (if a fresh post):** Your agent's vector memory can recall a fact. It can't tell you "top 10 this month."

**Body:**

> A pattern I keep hitting: vector/graph memory (Mem0, Zep, LangMem, an
> archival tier in Letta) is great at *retrieval* — "what did the user say
> about pricing?" returns the right fact. But the moment the question is
> **analytical** — "top 10 topics the agent logged this month by count,"
> "average deal size per stage," "how many tasks did it complete per day this
> week" — retrieval falls apart. A vector store returns the top-k *most
> similar* rows; it has no query planner. So your agent ends up doing
> arithmetic over a list of search hits, which is a hallucination generator,
> not a `GROUP BY`.
>
> The fix is boring and correct: keep the unstructured recall where it's good,
> but put the facts the agent will later *count / rank / bucket* in a real
> relational store and let it run actual SQL. That's the half a vector DB
> structurally can't do.
>
> I've been using nlqdb for exactly this (full writeup at
> nlqdb.com/solve/give-ai-agent-persistent-memory): the agent stores typed
> rows via MCP (`nlqdb_query` provisions Postgres from its first English goal),
> then asks "top 5 things I remembered this week by frequency" and gets a real
> aggregation back with the compiled SQL shown. Honest gap: no native vector
> search yet, so for unstructured similarity recall I still reach for
> Mem0/pgvector — the two compose. Retrieval ≠ analytics; you usually want both.

**Why this is publishable:** answers the actual question (analytics over agent
memory), names the architectural reason vector stores can't do it, links the
solve page **once**, and is honest about nlqdb's own gap (no vector search) so
it reads as help, not a plug. Lifts the same retrieval≠analytics wedge the WS-02
`/vs` pages and the sharpened solve page now lead with. Sourced from the
reframed `/solve/give-ai-agent-persistent-memory` page + `docs/competitors.md §4`.

## 2026-06-19 (run 22) — comparison-page draft: nlqdb vs LangMem (r/LangChain / Show HN)

**Title:** LangMem remembers everything for my LangGraph agent. It still can't answer "count per week" about that memory.

**Body:**

> If you've used [LangMem](https://langchain-ai.github.io/langmem/) you know the
> pitch: drop long-term memory into a LangGraph agent and an LLM does the hard
> part for you — it extracts **semantic** (facts), **episodic** (past
> interactions), and **procedural** (behavioral rules) memory, and a background
> manager consolidates and updates it over time. For *learning and recall* it's a
> genuinely clean SDK, and the procedural-memory / prompt-self-tuning angle is
> something most memory tools don't touch.
>
> But it's built to *retrieve*. Once my agent had logged a few hundred entries, I
> wanted to ask questions *about* the memory, not search it:
>
> > "Distinct users who asked about pricing each week this quarter."
> > "Average deal size per stage across everything the agent logged."
>
> LangMem returns the memories most similar to the query — there's no query
> planner under it, so a `COUNT(DISTINCT … ) … GROUP BY week` becomes the LLM
> doing arithmetic over a list of search hits (a hallucination generator, not an
> aggregation). It's also tied to LangGraph's BaseStore, so the memory layer
> rides one agent stack.
>
> The honest split (full side-by-side at nlqdb.com/vs/langmem): LangMem wins on
> automatic semantic/episodic/procedural extraction inside a LangGraph app, and on
> procedural memory the agent uses to refine its own prompts. nlqdb wins when the
> agent needs to **aggregate** its memory — it's a real Postgres the agent
> provisions and queries in English over HTTP or MCP (`nlqdb_query`), framework-
> agnostic, so `GROUP BY / JOIN / HAVING` actually work. They compose: LangMem the
> memory layer, nlqdb the analytical store it reports over.
>
> (Landscape facts verified 2026-06-19; both products' weaknesses are in the
> comparison, not just ours. Note LangMem ships no MCP server of its own — it's an
> in-process Python SDK — so the comparison says exactly that.)

**Why this is publishable:** same decision-moment "LangMem alternative" / "LangMem
vs" keyword play as the Zep + Letta drafts, honest-trade-off format (~13.8% vs
2–5% generic), lifted verbatim by Perplexity/ChatGPT. r/LangChain is the on-target
audience (LangMem is a LangChain SDK). Names LangMem in context, leads with a real
architectural distinction (LLM-managed retrieval + framework-lock vs framework-
agnostic analytical store). Sourced from the shipped `/vs/langmem` page +
`docs/competitors.md §4`. Closes the WS-02 trio (Zep → Letta → LangMem).

## 2026-06-21 (run 21) — comparison-page draft: nlqdb vs Letta (r/AI_Agents / Show HN)

**Title:** Letta runs my stateful agent. It still can't answer "average per group" about its own memory.

**Body:**

> If you've built on [Letta](https://www.letta.com) (the runtime out of the
> Berkeley MemGPT paper, Apache-2.0) you know the model: the agent manages its
> own memory like an OS — **core** blocks it self-edits in the context window,
> **recall** for conversation history, and an **archival** tier it searches for
> long-term facts. As a stateful agent runtime it's excellent, and the
> self-editing memory idea is genuinely clever.
>
> But the memory tiers are built to *retrieve*. Once my agent had logged a few
> hundred rows, I wanted to ask questions *about* the memory, not search it:
>
> > "Average deal size per stage for everything the agent logged this quarter."
> > "Top 10 topics this month, ranked by count."
>
> Letta can recall "Alice has a $50k deal." It can't run a `GROUP BY` over the
> archive — there's no relational query layer under the memory tiers, so the LLM
> ends up doing arithmetic over a list of search hits (a hallucination generator,
> not an aggregation).
>
> The honest split (full side-by-side at nlqdb.com/vs/letta): Letta wins on being
> a real stateful runtime with OS-style self-editing memory and semantic recall.
> nlqdb wins when the agent needs to **aggregate** its memory — it's a real
> Postgres the agent provisions and queries in English, so `GROUP BY / JOIN /
> HAVING` actually work. They compose: Letta the runtime, nlqdb the analytical
> store it queries. Pick the one that matches the question you need answered.
>
> (Landscape facts verified 2026-06-19; both products' weaknesses are in the
> comparison, not just ours.)

**Why this is publishable:** same decision-moment "X alternative" / "Letta vs"
keyword play as the Zep draft, honest-trade-off format (~13.8% vs 2–5% generic),
lifted verbatim by Perplexity/ChatGPT. Names Letta once, in context, leads with
a real architectural distinction (runtime + retrieval vs analytical store).
Sourced from the shipped `/vs/letta` page + `docs/competitors.md §4`. Second of
the WS-02 trio (LangMem to follow).

## 2026-06-20 (run 20) — comparison-page draft: nlqdb vs Zep (r/AI_Agents / Show HN)

**Title:** Zep gives my agent perfect recall. It still can't answer "average per group" about its own memory.

**Body:**

> If you've wired up [Zep](https://www.getzep.com) you know the pitch: it's the
> Context Lake — a temporal knowledge graph (Graphiti, 27k+ ⭐) that stores every
> fact your agent learns as a node with a validity window, resolves entities, and
> hands back the most relevant facts at query time. For *recall* it's genuinely
> good, and it publishes benchmarks (LongMemEval, DMR) to prove it.
>
> But I kept hitting the same wall. Once the agent had logged a few hundred
> things, I wanted to ask questions *about* the memory, not retrieve from it:
>
> > "Top 10 topics I logged this month, ranked by count."
> > "Average deal size per stage for enterprise customers."
>
> A knowledge graph has no query planner. It returns relevant facts and hopes the
> LLM does the arithmetic — which is a hallucination generator, not a `GROUP BY`.
>
> The honest split (I wrote the full side-by-side at nlqdb.com/vs/zep): Zep wins
> on temporal validity, entity resolution, and vector recall over conversation.
> nlqdb wins when the agent needs to **aggregate** its memory — it's a real
> Postgres the agent provisions and queries in English, so `GROUP BY / JOIN /
> HAVING` actually work. They compose: Zep the recall layer, nlqdb the analytical
> store. Pick the one that matches the question you actually need answered.
>
> (Landscape facts verified 2026-06-19; both products' weaknesses are in the
> comparison, not just ours.)

**Why this is publishable:** "X alternative" / "X vs Y" is the decision-moment
keyword and the honest-trade-off format converts ~13.8% (vs 2–5% generic) while
getting lifted verbatim by Perplexity/ChatGPT. Names Zep once, in context, and
leads with a genuine architectural distinction (retrieval vs analytics) that the
r/AI_Agents crowd respects. Sourced from the shipped `/vs/zep` page +
`docs/competitors.md §4`. First of the WS-02 trio (Letta + LangMem to follow).

## 2026-06-19 (run 19) — agent-memory landscape note (seed for the WS-09 blog post)

**Title:** Your agent's memory can recall a fact. Can it answer a question *about* its facts?

**Body:**

> The agent-memory category in 2026 is crowded and converging on one shape.
> **Mem0** stores a fact graph with time-decay. **Zep** (on the Graphiti engine,
> 27k+ ⭐) stores facts as temporal knowledge-graph nodes with validity windows.
> **Letta** (ex-MemGPT, Apache-2.0) keeps self-editing memory blocks in the
> context window plus a searchable archive. **LangMem** (LangChain) extracts
> semantic / episodic / procedural memories into any store. They differ in
> sophistication — flat vectors → knowledge graph → OS-style blocks — but they
> all answer the same question: *given a query, return the most relevant facts.*
>
> That leaves a whole class of question none of them can answer. Once your agent
> has remembered 500 things, ask it:
>
> > "Average deal size per stage, for enterprise customers, for deals that closed
> > this quarter."
>
> That's not retrieval. It's `GROUP BY ... HAVING ... WHERE`. A memory layer
> built on a vector store or a knowledge graph has no query planner — it can hand
> the LLM a pile of relevant facts and hope the model does the arithmetic in its
> head (a hallucination generator, not a database). Adding real SQL semantics to
> a vector store isn't a feature; it's a rewrite of the storage layer.
>
> nlqdb takes the other branch: the memory *is* a real database. The agent
> designs the schema and queries it in plain English, and the queries compile to
> validated SQL — `GROUP BY`, `JOIN`, `HAVING`, subqueries — not fuzzy recall.
> Recall *and* analytics over the same store.
>
> The honest table (capabilities, not logos): every product above does "remember
> this" and "recall facts about X." nlqdb's column is the one that adds "top 5 by
> value," "average per group," and "the agent created its own schema." Pick the
> memory layer for the question you actually need answered.
>
> (A `/daily` note from nlqdb — a database you talk to. Landscape facts checked
> 2026-06-19; full threat analysis in our open competitor doc.)

**Why this is publishable:** the agent-memory cluster (Mem0/Zep/Letta/LangMem) is
a high-search-volume, decision-moment topic for P2 builders, and the
"retrieval vs. analytics" reframe is a category distinction, not a feature
brawl — it spreads in the same r/AI_Agents / LangChain-Discord crowd that hates
marketing and loves a sharp architectural point. Seeds the WS-09 blog post and
the WS-06 capability matrix; one nlqdb mention, in context. Sourced from
`docs/competitors.md §4` (re-anchored this run) + `docs/research/deepseek-moat-framing.md`.

## 2026-06-19 (run 18) — dev.to / lobste.rs post

**Title:** We were one run away from building the wrong feature. A 40-line classifier on our own benchmark output talked us out of it.

**Body:**

> For four days our top-ranked next lever for our text-to-SQL engine was *value
> retrieval*: feed the model a few sample cell-values from each low-cardinality
> column so it stops guessing `'Discount'` when the data says `'discount'`. We
> had the evidence, too — an offline harness showed that **12.8%** of the
> columns gold queries reference are named by their *values*, not their headers,
> and no amount of schema-name pruning can recover those. Additive, zero risk,
> obviously next. We'd even sketched the prod plumbing.
>
> Before building it, we ran one more cheap check — and it killed the feature.
>
> The 12.8% number was measured on *column names*, in the abstract. It never
> asked the only question that matters: **on the questions we actually get
> wrong, would feeding sample values flip any of them to correct?** So we taught
> our mismatch classifier one new trick — diff the string *literals* between the
> model's SQL and the gold SQL — and ran it over all 238 wrong answers from our
> latest 500-question BIRD run.
>
> The headline tag lit up: **90 of 238** wrong answers (38%) use a different
> string literal than the gold query. Value grounding looks like the bottleneck!
> Then the second number: of those 90, exactly **0** are *literal-only* — i.e.
> mismatches where, if you fixed just the literal, the query would match. Every
> single one *also* gets a table, a column, a GROUP BY, or a predicate wrong.
> Feeding the right value into a query that's structurally broken changes
> nothing. (And of the 90, only 6 were even casing slips; ~16 were date-format
> mistakes, which a one-line directive fixes more cheaply than any retrieval.)
>
> So value retrieval, on its own, would have moved our benchmark by ~0 — after a
> multi-file build that also meant piping customers' real cell-values into a
> third-party LLM. We're not doing it. The real remaining loss is *structural
> reasoning* — grain and shape — which points at self-consistency and
> similarity-retrieved examples, not data sampling.
>
> The transferable lesson: **"X% of cases involve Y" is not "fixing Y wins X%."**
> A theoretical ceiling measured on inputs (column names) can be off by the
> entire feature once you measure it on outputs (the actual mistakes). The check
> cost an afternoon and a downloadable benchmark file; the feature would have
> cost a sprint and a privacy review.
>
> (A `/daily` run on nlqdb, a database you query in plain English. The classifier
> and the BIRD harness are open; every number is reproducible from the public
> benchmark on a $0 free-LLM chain.)

**Why this is publishable:** the "ceiling-on-inputs ≠ win-on-outputs" trap is a
mistake almost everyone wiring an LLM eval makes, and the falsification is a
crisp, reproducible story with real numbers (90 → 0). Pairs as a sequel to the
run-17 "flat benchmark" post and *corrects* its closing claim. One nlqdb
mention, in context. Sourced from `tools/eval/src/analyze-mismatches.ts` +
the committed 2026-06-19 baseline.

## 2026-06-15/18 (runs 8–16) — engine-lesson dev.to / lobste.rs posts (titles only; full drafts in git history)

- run 16 — "Before you prune the schema you send an LLM, measure what the prune would throw away" (SK-QUAL-015).
- run 15 — "We thought our text-to-SQL engine couldn't join. A regex bug was lying to us" (SK-QUAL-014).
- run 14 — "The text-to-SQL mistake that fails two ways — and only one of them throws" (HAVING vs WHERE; SK-LLM-040).
- run 13 — "Schema pruning for text-to-SQL drops the one table the join needs" (inbound junction tables; SK-LLM-037).
- run 11 — "Failover, retry, repair: the three error classes in an LLM text-to-SQL pipeline" (SK-ASK-022).
- run 10 — "'Auto-re-probes so it recovers without a deploy' — a comment that was quietly false" (30-min `auth_denied` cooldown).
- run 9 — "The dead provider in the fast lane: when a hedged request races a 403" (SK-LLM-039).
- run 8 — "One bad row shouldn't cost you all the rows: salvaging LLM-generated seed data" (SK-HDC-019).

Older drafts (runs 1–7): [`distribution-queue-archive.md`](./distribution-queue-archive.md).
