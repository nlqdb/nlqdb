# Competitor Landscape

A scan of the products nlqdb competes with, directly or adjacently, by category (the summary table ranks threat vectors). Pricing/features are each vendor's public positioning and change often — treat as order-of-magnitude. nlqdb sits intentionally between four adjacent categories — managed Postgres, text-to-SQL, AI BI, and agent memory.

---

## 1. Managed Postgres / DB hosts

These are what a solo builder (P1) reaches for today. They solve provisioning and ops but leave the NL / admin-UI / agent layer as an exercise for the user.

### Neon — https://neon.com
Serverless Postgres with copy-on-write branching and scale-to-zero; generous free plan, pay-as-you-go launch tier. Ships an **official MCP server** (remote `mcp.neon.tech`, OAuth) that manages Postgres from a coding agent in English. Canonical: `/vs/neon` ([SK-CMP-002](../features/comparison-pages/decisions/SK-CMP-002-single-template-data-driven.md)).
- **Overlaps with:** P1 (the DB URL), P2 (per-agent branches as ephemeral DBs).
- **Gap nlqdb exploits:** Neon's NL/MCP is *dev-time database administration* (a coding agent creates projects, branches, migrations); no *runtime* answer element for end users — no `<nlq-data>` embed, no SQL shown to the asker, no fail-closed allow-list, no anonymous try. **Threat vector:** **High** — scariest direct P1 competitor alongside Supabase; brand + economics + a strong dev-time MCP make swapping friction for a dev already on Neon.

### Supabase — https://supabase.com
Postgres + auth + storage + edge functions + Studio UI. The default "batteries-included" pick for solo builders.
- **Overlaps with:** P1 (DB + admin UI in one), somewhat P3 (Studio as a query UI).
- **Gap nlqdb exploits:** Studio is a SQL IDE, not a chat interface; no NL auto-migration; MCP server is query-only against a pre-provisioned DB. **Threat vector:** The scariest direct P1 competitor — momentum + a full BaaS story nlqdb doesn't match.

### Railway, Xata, Turso, PlanetScale, Render, Fly, Aiven (low-threat hosts)
Commodity managed Postgres/DB hosts. All overlap on P1 hosting ergonomics; none has an NL / agent / MCP layer or conversational migrations. **Threat vector:** Low-to-medium — Xata is closest in mindshare but still infra-only; collectively they set the "cheap, boring Postgres" baseline nlqdb prices against.

---

## 2. Text-to-SQL / NL-over-DB tools

These translate natural language into SQL against *your existing database* — a translator, not the data layer. Owning the DB lets nlqdb do auto-migration and destructive-op diff preview a pure translator can't.

### Wren AI — https://getwren.ai (OSS: https://github.com/Canner/WrenAI)
Open-source context layer — an MDL semantic model + row/column access controls on an existing warehouse (22+ sources); cloud + self-host; SOC 2 Type II on paid plans only.
- **Overlaps with:** P3 (governed NL→SQL), P2 (Python SDK + LangChain bindings position it as agent infrastructure).
- **Gap nlqdb exploits:** Wren doesn't own the database — it sits on a warehouse you already run, so DB provisioning, NL-driven migration, and in-product `<nlq-data>` render aren't in its lane.
- **Threat vector:** **High for governed-analyst orgs on paid plans** — SOC 2 + RLAC/CLAC + 22 engines is a compliance-first answer nlqdb can't match in Phase 1; OSS core is a self-host moat.

### Vanna AI — https://vanna.ai
OSS + cloud text-to-SQL trained on your schema and prior queries.
- **Gap nlqdb exploits:** needs a DB to translate against; no provisioning/migration, trusts the user to pick the LLM, train, and curate examples. **Threat vector:** Medium for P4; low for P1/P2 (wrong shape).

### Defog.ai / SQLCoder — https://defog.ai
Fine-tuned open-weights SQL model + commercial layer. **Gap nlqdb exploits:** translator layer only (as Vanna). **Threat vector:** Medium — credible OSS baseline for self-hosters.

### AskYourDatabase — https://askyourdatabase.com
Chat-style AI Data Analyst over your existing DB — a local-creds Desktop App and an embeddable cloud Chatbot (with a Dashboard Builder); paid + Enterprise on-prem. (Plans/models/SOC 2 in [`comparison-pages/FEATURE.md`](../features/comparison-pages/FEATURE.md).)
- **Gap nlqdb exploits:** Connects to an existing warehouse — no provisioning verb, no English-driven DDL, no in-product `<nlq-data>` element (chat widget is the only embed).
- **Threat vector:** Medium for P3 — the "one-off question" vector; the Dashboard Builder extends into customer-facing BI nlqdb doesn't target. Canonical `/vs/askyourdatabase`.

### Julius AI — https://julius.ai
NL data analysis over uploaded CSVs and connected DBs. **Overlaps with:** **Direct** for P3 — the CSV + NL-join use case. **Gap nlqdb exploits:** analysis-only; no durable data layer, no app-backing DB. **Threat vector:** **High for P3** if our CSV-upload story isn't tight.

### SQLChat / AI2SQL / Text2SQL.ai / Seek AI / ThoughtSpot Sage
The low-threat tail: OSS web chat and one-shot consumer generators with no persistence or DB; Seek AI / ThoughtSpot Sage are enterprise NL analytics with the wrong GTM. **Threat vector:** Low — utilities or enterprise-only, not in nlqdb's lane.

---

## 3. AI-native admin / BI with NL

These layer NL on top of admin or BI UIs. The ones with strong distribution (Retool, Metabase) are the hardest to displace.

### Outerbase — https://outerbase.com
AI-assisted database interface: EZQL NL queries, spreadsheet-like editor, dashboards, data catalog; multi-engine. Acquired by **Cloudflare** 2025-04-07. Canonical `/vs/outerbase`.
- **Overlaps with:** P1 admin-chat, P3, P4 NL-over-existing-DB.
- **Gap nlqdb exploits:** Outerbase sits on top of *your* DB; nlqdb is the DB + chat + MCP-provisioning in one.
- **Threat vector:** **High** — the product most in nlqdb's lane today; the Cloudflare acquisition puts it on the same infra (Workers / D1), narrowing the infra lane.

### Basedash — https://www.basedash.com
Repositioned to an **AI-native BI platform**: NL → dashboards, an AI data analyst, semantic layer, MCP server, 750+ read-only sources. No write/edit, no provisioning; $1,000/mo floor. (Detail in `/vs/basedash`.)
- **Gap nlqdb exploits:** read-only BI over *your existing* data (P3); nlqdb owns the DB (provisions Postgres + NL writes/migrations with diff-preview) and embeds an answer element, not a dashboard.
- **Threat vector:** Medium for P3; the $1,000/mo floor (no free tier) cedes the small-team / anonymous lane.

### Retool AI — https://retool.com
Retool's NL query + app-generation add-ons. **Gap nlqdb exploits:** Retool is a low-code builder; nlqdb's "skip building the admin UI entirely" is stronger for small teams. **Threat vector:** **Very high for P4** — distribution + inertia.

### Metabase Metabot — https://www.metabase.com
OSS (AGPL) + cloud BI; Metabot is the AI layer (NL questions, chart-building, SQL gen + "fix it", Slack answers), full version paid-only. (Detail in `/vs/metabase`.)
- **Gap nlqdb exploits:** BI-dashboard shaped, read-only over an existing warehouse; no provisioning, no NL writes/migrations with diff-preview, no embeddable answer element or agent-callable API.
- **Threat vector:** Medium for P3 — strong OSS distribution, but Metabase users want dashboards, not an embedded queryable data layer.

### Hex Magic / Mode AI / Fabi.ai / Count — notebook-first AI BI
AI inside collaborative analyst notebooks. Different DNA — analyst notebooks, not PM chat. **Threat vector:** Low-medium — adjacent to P3, not head-to-head. Cluster complete: all four have canonical `/vs` pages (facts + dates in `competitors.ts`). Wedge: nlqdb owns+provisions the DB and embeds an answer element; they layer a notebook over a warehouse you already run.

---

## 4. Agent memory / MCP DB servers

P2's home territory. These solve "agent needs to remember things" but generally don't give the agent a real DB.

### DIY on your existing Postgres / Supabase — the #1 real alternative
Not a vendor — the build path, and the honest baseline every reach page must beat rather than dodge. The agent-SaaS builder (P2b) already runs Postgres/Supabase, so their default "buy" decision is really "why not just add a `memories` table?"
- **Gap nlqdb exploits (in the reader's order):** the `CREATE TABLE` is the easy 20%; the expensive 80% is (a) **multi-tenant isolation that fails closed** — hand-rolled `WHERE agent_id = $1` filters don't, RLS keyed on `app.agent_id` does (SK-PIVOT-009); (b) **zero schema design** — the proven `agent_memory_v1` shape vs. re-deriving it per project; (c) **TTL** as a swept `DELETE`, not a forgotten cron; (d) **NL analytics** — `GROUP BY`/`JOIN`/`HAVING` over memory in English with the SQL shown, which a raw table gives you only if you also build the text-to-SQL trust boundary. DIY wins on control and zero new vendor; it loses once isolation, retention, and analytics must be *correct* at scale.
- **Threat vector:** **Highest for P2b** — free, in-stack, already trusted. The reach track's job is to be the first actionable answer at the moment the builder is about to hand-roll this: honest DIY steps first, one-command alternative after the reader feels where DIY bites (R-02 solve page).

### Agentic DB (Constructive) — [announcement](https://www.prnewswire.com/news-releases/constructive-open-sources-agentic-db-the-postgres-memory-layer-for-ai-agents-302755269.html) · org `constructive-io`, `pgpm.io` (OSS, 2026-04-28)
Direct entrant. A purpose-built Postgres schema giving agents long-term memory, conversation history, a skill/tool registry, task orchestration, a CRM + knowledge graph, and hybrid retrieval — one-command install. Ships **Agent Skills** (instruction files that install into the agent's workspace) for Claude Code, Cursor, Codex, Devin, Copilot, Windsurf + 40 more, plus a generated CLI and type-safe SDK from one schema.
- **Gap nlqdb exploits:** the most direct overlap here — its Agent Skills target the same coding-agent-injection moment as nlqdb's R-07 artifacts. But it's a **schema + skills bundle on a Postgres you stand up and operate**: the agent/SDK authors the SQL, so the trust boundary is the caller's. nlqdb is the **hosted** DB where the server builds every write as a parameterised `INSERT` — the agent controls *data*, never *SQL* (SK-PIVOT-008) — with per-agent RLS, a swept TTL, and NL→SQL analytics with the SQL shown.
- **Threat vector:** **High and rising for P2** — competes on the coding-agent-onboarding axis directly, so the reach artifacts (R-04/R-05/R-07) must be at least as machine-followable as its Agent Skills.

### Mem0 — https://mem0.ai
"Long-term memory" SDK for agents (OSS + hosted, memory-graph shaped). **Gap nlqdb exploits:** memory-shaped (facts, entities, decay) vs. DB-shaped (tables + SQL + agent-designed schema) — "remember this" vs. "here's a DB." **Threat:** high for P2 — lighter-weight if the builder just wants recall.

### Zep — https://getzep.com
Agent-memory platform built on **Graphiti**, a temporal knowledge-graph engine (facts as graph nodes with validity windows + entity resolution); "the Context Lake for AI agents", OSS core + hosted cloud. (Full architecture in `/vs/zep`.)
- **Gap nlqdb exploits:** Zep is a *retrieval* graph — no query planner, so an agent can't `GROUP BY` / `JOIN` / aggregate over its own memory; the validity windows are point-in-time recall, not analytics. nlqdb is a real database the agent aggregates over in NL.
- **Threat vector:** **High for P2** — well-funded, benchmark-led; the knowledge-graph framing is more structured than a flat vector store, but stops short of SQL semantics.

### Letta (formerly MemGPT) — https://letta.com
Open-source (Apache-2.0) agent runtime with persistent memory built in (out of the 2023 Berkeley MemGPT paper); OS-style memory tiers, self-host or hosted. (Full architecture in `/vs/letta`.)
- **Gap nlqdb exploits:** Letta's memory is self-edited prose blocks + a searchable archive — it can recall "Alice has a $50k deal" but can't answer "average deal size per stage for enterprise" (no relational query layer). The two compose: Letta the runtime, nlqdb the analytical store.
- **Threat vector:** Medium — they want to be the runtime, not the storage layer, so the overlap is the default built-in memory, not a head-to-head store.

### LangMem (LangChain) — https://langchain.com
OSS Python SDK adding long-term memory (semantic/episodic/procedural) to LangGraph agents — extract, consolidate, dedup; storage-backend-agnostic. (Full architecture in `/vs/langmem`.)
- **Gap nlqdb exploits:** extraction-and-recall over a key-value store, not a database — no SQL, no aggregation. Its win is *distribution* (ships where LangGraph is), not the analytical shape.
- **Threat vector:** **High for P2 on distribution** — LangChain's adoption makes LangMem the default a builder meets first; low on the analytical wedge.

### Supermemory — https://supermemory.ai
"The memory + context API for the AI era" — fact extraction, hybrid recall, user profiles, connectors (Drive/Gmail/Notion/GitHub) over a custom vector-graph engine; MIT, one-binary local mode + MCP server. Benchmark leader (LongMemEval / LoCoMo / ConvoMem, sub-300ms recall). **Gap nlqdb exploits:** it ranks and returns memories — no SQL over what the agent stored; nlqdb is the analytical store the agent aggregates. **Threat:** high for P2 — strongest recall benchmarks today, but recall-only. `/vs/supermemory`.

**Vector stores (P2 retrieval).** All share one gap: they rank nearest embeddings but have no SQL layer — an agent can't `GROUP BY` / `JOIN` / `HAVING` over what it stored (the "database, not a vector store" wedge, §4). Each has a canonical `/vs` page; distinctives below.

### Pinecone — https://pinecone.io
Managed serverless vector DB. **Threat:** medium — shifting toward pgvector-in-Postgres. `/vs/pinecone`.

### Weaviate — https://weaviate.io · Chroma — https://trychroma.com
OSS + managed vector DBs (Weaviate; Chroma OSS-first with a managed cloud). **Threat:** medium — same shape as Pinecone. `/vs/weaviate`, `/vs/chroma`.

### Qdrant — https://qdrant.tech
High-performance Rust vector DB, Apache-2.0; quantization + hybrid search, official `mcp-server-qdrant`. Cheaper recall, no aggregation. `/vs/qdrant`.

### Milvus — https://milvus.io
Cloud-native OSS vector DB for scalable ANN (Go, Apache-2.0, Zilliz-created); managed Zilliz Cloud, official `zilliztech/mcp-server-milvus`. Single-collection scalar group-by is new in 3.0-beta — still no cross-collection JOIN or HAVING. `/vs/milvus`.

### Cognee — https://www.cognee.ai
OSS AI memory framework (Apache-2.0) — a self-hosted **knowledge graph** (Extract → Cognify → Load) fusing vector embeddings + graph reasoning + ontology; official `cognee-mcp`. A *recall* engine via hybrid vector + graph traversal. **Threat:** high for P2 — the most credible "not just a vector store" framing; stops short of relational analytics. `/vs/cognee`.

### MindsDB — https://mindsdb.com (OSS: https://github.com/mindsdb/mindsdb)
The open-source **"Federated Query Engine for AI"** — federates 200+ data sources behind one PostgreSQL-wire endpoint, positioned as a universal MCP server ("the only MCP Server you'll ever need"); also ships knowledge bases, in-DB ML models, and agents. Self-host or cloud. (Full table in `/vs/mindsdb`.)
- **Gap nlqdb exploits:** MindsDB *connects to* data you already have and adds federation + ML; nlqdb *provisions and owns* a Postgres from English, compiles NL → SQL (shown), and diff-previews writes. No sources to connect, no ML training.
- **Threat vector:** **High for P2** — the most prominent "MCP server for your data" play; but federation assumes the sources already exist, which is what nlqdb removes.

### Postgres MCP servers (community + vendor) — e.g. `@modelcontextprotocol/server-postgres`, Supabase MCP
Let an agent run read (and sometimes write) SQL against a *pre-provisioned* Postgres.
- **Gap nlqdb exploits:** they need the human to provision, credential, and schema-design first; nlqdb's `nlqdb_query` materialises a tenant-scoped Postgres + schema on first reference (no create verb — SK-MCP-002).
- **Threat vector:** Medium, rising — narrows if the MCP ecosystem adds provisioning primitives.

---

## 5. Internal tools / low-code admin

The tools P4 is paying for today. Displacement is a distribution fight, not a feature fight.

### Retool — https://retool.com
The canonical internal-tools platform. $10–$50/user/mo depending on tier.
- **Gap nlqdb exploits:** Retool requires a human to build forms; nlqdb's pitch is "skip the form, just ask."
- **Threat vector:** **Very high** for P4.

### Internal.io / Appsmith / Budibase / ToolJet
Cheaper (Internal.io) and OSS (Appsmith, Budibase, ToolJet) Retool alternatives. **Threat vector:** Medium for Internal.io, Low for the OSS trio — different buyer (cost-conscious/self-hosted).

---

## 6. Open-source text2sql frameworks

The build-it-yourself alternative for P2 and technically-inclined P4s.

### LangChain SQL agent — https://python.langchain.com
Part of the LangChain ecosystem; the "I'll just build it myself" route for P2. Canonical `/vs` page: **langchain-sql-agent** (landed 2026-06-30; page persona **P4** build-vs-buy, not P2 — rationale + facts in `competitors.ts`).
- **Gap nlqdb exploits:** Framework, not a product — requires gluing a DB, a model, retries, and a deployment, all of which nlqdb replaces.
- **Threat vector:** Medium — free and flexible.

### LlamaIndex query engine / sqlcoder / PremSQL
Adjacent DIY components. LlamaIndex (MIT) ships `NLSQLTableQueryEngine` (synthesise + run SQL over a `SQLDatabase` you already run) and `SQLTableRetrieverQueryEngine` (query-time schema retrieval); its docs warn that running arbitrary generated SQL is a security risk. Canonical `/vs/llamaindex` (landed 2026-07-01, persona **P4** build-vs-buy — facts in `competitors.ts`).
- **Gap nlqdb exploits:** a framework component you wire over a DB you run — no provisioning, no SQL-shown, no fail-closed validation, no diff-previewed writes, no embed element.
- **Threat vector:** Low–medium — commodity components, not products.

---

## Summary table — threat matrix

| Competitor | Category | Closest nlqdb persona | Primary threat vector |
|---|---|---|---|
| Supabase | Managed PG | P1 | Full BaaS with Studio UI + brand inertia |
| Neon | Managed PG | P1, P2 | Serverless scale + branching + official dev-time MCP; scariest P1 alongside Supabase |
| Outerbase | AI admin | P1, P4 | AI-native admin UI on Cloudflare's stack (2025-04-07 acquisition) |
| Retool (+ Retool AI) | Internal tools | P4 | Already installed; distribution moat |
| Mem0 | Agent memory | P2 | Purpose-built agent memory; lighter weight |
| Zep | Agent memory | P2 | Graphiti temporal knowledge graph; benchmark-led, well-funded |
| Letta | Agent memory | P2 | Self-editing OS-style memory inside an agent runtime (Apache-2.0) |
| LangMem | Agent memory | P2 | LangChain-ecosystem distribution; default memory for LangGraph agents |
| Supermemory | Agent memory | P2 | Benchmark-leading recall API (MIT, self-hostable); recall-only, no SQL |
| Agentic DB (Constructive) | Agent memory (Postgres) | P2 | OSS one-command Postgres memory + Agent Skills for Claude Code/Cursor/Codex; same coding-agent-onboarding axis |
| DIY on your Postgres/Supabase | Agent memory (build) | P2b | Free + in-stack; the real default — loses on isolation/TTL/analytics correctness at scale |
| Julius AI | NL analytics | P3 | Cheap, consumer-grade CSV + NL workflow |
| Vanna AI | Text-to-SQL | P3, P4 | OSS + flexible layer on existing DB |
| Wren AI | Text-to-SQL (semantic-layer) | P3, P2 | MDL semantic model + RLAC/CLAC + SOC 2 (paid) + 22 engines; OSS-core self-host moat |
| AskYourDatabase | Text-to-SQL | P3, P4 | Low-friction "chat with my DB" + Dashboard Builder + embeddable chatbot; Enterprise on-prem |
| MindsDB | Federated query engine / MCP | P4, P2 | OSS federation over 200+ sources + in-DB ML; "only MCP server you'll need" |
| MCP Postgres servers | Agent tooling | P2 | Free + standard; gap narrows if they add provisioning |
| Basedash | AI-native BI | P3 | NL dashboards + semantic layer over 750+ sources; $1,000/mo floor |
| Metabase Metabot | BI + NL | P3 | OSS distribution + familiar BI UX |
| Turso | Managed DB | P1, P5 | Cheap + edge-distributed |
| LangChain SQL agent | OSS framework | P2 | Free DIY path |
| LlamaIndex | OSS framework | P4 | Free DIY text-to-SQL component; runs generated SQL by default |

---

## Gap analysis — where nlqdb actually wins

The competitive set is crowded but fragmented; nobody fully occupies the intersection nlqdb targets:

1. **"Agent provisions its own DB" is whitespace** — every MCP Postgres server, Vanna/Defog, and Retool assumes a human already stood the database up.
2. **DB + NL chat + auto-migration in one product** — Supabase has the DB, Outerbase the chat, Defog the SQL; nobody stitches all three into one install.
3. **Conversational destructive-op preview** (diff-before-apply) is rare — Retool gates human button-clicks, nothing gates NL requests. A trust differentiator for P1/P4.
4. **Analytical memory for agents** (§4) — Mem0 / Zep / Letta / LangMem *retrieve* facts; only nlqdb lets the agent `GROUP BY` / `JOIN` / `HAVING` over its own memory. Adding SQL semantics to a vector store is a storage-layer rewrite, not a feature (the GLOBAL-036 wedge). A DIY `memories` table *is* SQL-capable, but not multi-tenant-isolated, retention-swept, or NL-queryable out of the box.
5. **Cross-persona coverage with one product** — most rivals aim at one persona; nlqdb's bet that one chat+DB primitive serves a dev, an agent, and a PM is unoccupied (moat or focus risk).

Scariest threats: (a) Supabase adding a first-class NL + agent story; (b) the MCP Postgres ecosystem closing the provisioning gap; (c) a direct entrant like Agentic DB matching the coding-agent onboarding (§4) — all plausible within 12 months. The cross-persona and NL-migration planks are harder to copy.

---

*Last verified: 2026-07-18 (§4 DIY-on-Postgres baseline + Agentic DB / Constructive, OSS announced 2026-04-28, R-02); 2026-07-01 (§1 Neon — pricing + official MCP server; §6 LlamaIndex; §4 MindsDB 2026-06-30). Pricing, URLs, and acquisitions change — re-check quarterly, especially §1/§3/§4 where consolidation and funding move fastest.*
