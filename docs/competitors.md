# Competitor Landscape

A scan of the products nlqdb competes with, directly or adjacently, organized by category (the summary table at the bottom ranks threat vectors). Pricing/features are from each vendor's public positioning and change often; treat numbers as order-of-magnitude. nlqdb sits intentionally between four adjacent categories — managed Postgres, text-to-SQL, AI BI, and agent memory — each explained below.

---

## 1. Managed Postgres / DB hosts

These are what a solo builder (P1) reaches for today. They solve provisioning and ops but leave the NL / admin-UI / agent layer as an exercise for the user.

### Neon — https://neon.com
Serverless Postgres with instant copy-on-write branching and scale-to-zero. Free plan: 100 compute-hours/mo, 0.5 GB/project (5 GB aggregate across up to 10 projects), no card. Launch tier is pay-as-you-go with no minimum (the $5 min was removed). Strong developer brand; ships an **official MCP server** (remote `mcp.neon.tech`, OAuth, ~20 tools) that manages Postgres from an AI coding agent in English. The `/vs/neon` page ([SK-CMP-002](../features/comparison-pages/decisions/SK-CMP-002-single-template-data-driven.md)) is canonical.
- **Overlaps with:** P1 (the DB URL), P2 (per-agent branches as ephemeral DBs).
- **Gap nlqdb exploits:** Neon's NL/MCP is *dev-time database administration* — a coding agent creates projects, branches, and prepares/verifies/completes migrations against the DB. It ships no *runtime* answer element for end users: no `<nlq-data>` embed, no compiled SQL shown to the asker, no fail-closed allow-list on every query, no anonymous try. **Threat vector:** **High** — the scariest direct P1 competitor alongside Supabase; brand + serverless economics + a genuinely strong dev-time MCP mean swapping is friction for a dev already on Neon.

### Supabase — https://supabase.com
Postgres + auth + storage + edge functions + a Studio UI. Free tier + Pro at $25/mo. The default "batteries-included" pick for solo builders.
- **Overlaps with:** P1 (DB + admin UI in one), somewhat P3 (Studio is a reasonable query UI).
- **Gap nlqdb exploits:** Studio is a SQL IDE, not a chat interface; no NL auto-migration; MCP server is query-only against a pre-provisioned DB. **Threat vector:** The scariest direct P1 competitor — momentum + a full BaaS story nlqdb doesn't match.

### Railway, Xata, Turso, PlanetScale, Render, Fly, Aiven (low-threat hosts)
Commodity managed Postgres/DB hosts (Railway PaaS, Xata + branching, Turso libSQL/SQLite, PlanetScale Vitess/MySQL, Render/Fly/Aiven). All overlap on P1 hosting ergonomics; none has an NL / agent / MCP layer or conversational migrations. **Threat vector:** Low-to-medium — Xata is closest in mindshare but still infra-only; collectively they set the "cheap, boring Postgres" baseline nlqdb prices against.

---

## 2. Text-to-SQL / NL-over-DB tools

These translate natural language into SQL against *your existing database* — a translator, not the data layer. Owning the DB lets nlqdb do auto-migration and destructive-op diff preview a pure translator can't.

### Wren AI — https://getwren.ai (OSS: https://github.com/Canner/WrenAI)
Open-source context layer — an MDL semantic model + row/column access controls on an existing warehouse (22+ sources). 15k+ stars; cloud + self-host; SOC 2 Type II on paid plans only.
- **Overlaps with:** P3 (governed NL→SQL for analyst orgs), P2 (Python SDK + LangChain bindings position it as agent infrastructure).
- **Gap nlqdb exploits:** Wren AI doesn't own the database — it sits on a warehouse you already run, so DB provisioning, NL-driven schema migration, and in-product `<nlq-data>` render are not in its lane.
- **Threat vector:** **High for governed-analyst orgs on paid plans.** Paid-plan SOC 2 + RLAC/CLAC + 22 engines is a compliance-first answer nlqdb cannot match in Phase 1; OSS core + 15k stars gives it a self-host moat.

### Vanna AI — https://vanna.ai
OSS + cloud text-to-SQL trained on your schema and prior queries. Free OSS, commercial tiers above.
- **Gap nlqdb exploits:** Vanna needs a DB to translate against; it doesn't provision or migrate, and trusts the user to pick the LLM, train, and curate examples. **Threat vector:** Medium for P4; low for P1/P2 (wrong shape).

### Defog.ai / SQLCoder — https://defog.ai
Fine-tuned open-weights SQL model + commercial product layer.
- **Gap nlqdb exploits:** Same as Vanna — translator layer only. **Threat vector:** Medium — credible OSS baseline tech for self-hosters.

### AskYourDatabase — https://askyourdatabase.com
Chat-style AI Data Analyst over your existing DB, in two products: a local-creds Desktop App and a cloud Website Chatbot (embeddable, with a Dashboard Builder). Engines: BigQuery, MSSQL, MySQL, PostgreSQL, Snowflake. Paid from ~$49/mo (Desktop) / ~$149/mo (Chatbot) + Enterprise on-prem. (Plans/models/SOC 2 in [`comparison-pages/FEATURE.md`](../features/comparison-pages/FEATURE.md).)
- **Gap nlqdb exploits:** Connects to an already-existing warehouse — no provisioning verb, no English-driven DDL, no in-product `<nlq-data>` element (chat widget is the only embed shape).
- **Threat vector:** Medium for P3 — the "one-off question" vector; the Dashboard Builder + embeddable chatbot extends into customer-facing BI nlqdb doesn't target. `/vs/askyourdatabase` ([SK-CMP-002](../features/comparison-pages/decisions/SK-CMP-002-single-template-data-driven.md)) is canonical.

### Julius AI — https://julius.ai
NL data analysis over uploaded CSVs and connected DBs. ~$20/mo individual plans.
- **Overlaps with:** **Direct** for P3 — the CSV + NL-join use case is their home turf.
- **Gap nlqdb exploits:** Analysis-only; no durable data layer, no app-backing DB. **Threat vector:** **High for P3** if our CSV-upload story isn't tight.

### SQLChat / AI2SQL / Text2SQL.ai / Seek AI / ThoughtSpot Sage
The low-threat tail: OSS web chat and one-shot consumer generators (~$10/mo) with no persistence or DB; Seek AI / ThoughtSpot Sage are enterprise NL analytics with the wrong GTM for our personas. **Threat vector:** Low — utilities or enterprise-only, not in nlqdb's lane.

---

## 3. AI-native admin / BI with NL

These layer NL on top of admin or BI UIs. The ones with strong distribution (Retool, Metabase) are the hardest to displace.

### Outerbase — https://outerbase.com
AI-assisted database interface: EZQL natural-language queries, spreadsheet-like editor, dashboards, data catalog. Multi-engine (Postgres / MySQL / SQLite / MongoDB / ClickHouse / Snowflake / BigQuery / Redshift / MSSQL). Acquired by **Cloudflare** 2025-04-07.
- **Overlaps with:** P1 admin-chat, P3, P4 NL-over-existing-DB.
- **Gap nlqdb exploits:** Outerbase sits on top of *your* DB; nlqdb is the DB + chat + MCP-provisioning in one. The `/vs/outerbase` page ([SK-CMP-002](../features/comparison-pages/decisions/SK-CMP-002-single-template-data-driven.md)) is canonical.
- **Threat vector:** **High.** The single product most in nlqdb's lane today; the Cloudflare acquisition puts it on the same infra (Workers / D1), narrowing the infra-differentiation lane.

### Basedash — https://www.basedash.com
Repositioned from "admin UI with AI" to an **AI-native BI platform**: NL → dashboards, an AI data analyst, a semantic layer, chart embedding, MCP server, 750+ read-only sources. No write/edit, no DB provisioning. 14-day trial → $1,000/mo; SOC 2 Type II. (Detail in `/vs/basedash`.)
- **Gap nlqdb exploits:** read-only BI over *your existing* data (P3); nlqdb owns the DB (provisions Postgres + NL writes/migrations with diff-preview) and embeds an answer element, not a dashboard.
- **Threat vector:** Medium for P3; the $1,000/mo floor (no free tier) cedes the small-team / anonymous-mode lane.

### Retool AI — https://retool.com
Retool's NL query + app-generation add-ons on the Retool platform. Team from $10/user/mo + AI usage.
- **Gap nlqdb exploits:** Retool is a low-code builder; nlqdb's "skip building the admin UI entirely" is stronger for small teams. **Threat vector:** **Very high for P4** — distribution + inertia.

### Metabase Metabot — https://www.metabase.com
OSS (AGPL self-host) + cloud BI (Starter ~$85/mo). Metabot is the AI layer: NL questions, chart-building, SQL gen + "fix it" repair, Slack answers. Full Metabot = paid Cloud + $100/mo add-on; OSS is single-shot SQL gen only. (Detail in `/vs/metabase`.)
- **Gap nlqdb exploits:** BI-dashboard shaped, read-only over an existing warehouse; doesn't provision/own the DB, no NL writes/migrations with diff-preview, no embeddable answer element or agent-callable API.
- **Threat vector:** Medium for P3 — strong OSS-distribution moat, but Metabase users want dashboards/charts, not an embedded queryable data layer.

### Hex Magic / Mode AI / Fabi.ai / Count — notebook-first AI BI
AI inside collaborative analyst notebooks (Hex from ~$24/user/mo; others similar). Different DNA — analyst notebooks, not PM chat. **Threat vector:** Low-medium — adjacent to P3, not head-to-head. **Cluster complete** — all four have canonical `/vs` pages (per-tool facts + landing dates in `competitors.ts`). Wedge: nlqdb owns+provisions the DB and embeds an answer element/agent-callable API; they layer a notebook/canvas over a warehouse you already run.

---

## 4. Agent memory / MCP DB servers

P2's home territory. These solve "agent needs to remember things" but generally don't give the agent a real DB.

### Mem0 — https://mem0.ai
"Long-term memory" SDK for agents (OSS + hosted, memory-graph shaped). **Gap nlqdb exploits:** memory-shaped (facts, entities, time decay) vs. DB-shaped (full tables + SQL + agent-designed schema) — "remember this" vs. "here's a DB, do what you want." **Threat:** high for P2 — lighter-weight if the builder just wants memory.

### Zep — https://getzep.com
Agent-memory platform built on **Graphiti**, a temporal knowledge-graph engine (facts as graph nodes with validity windows + entity resolution). Positions as "the Context Lake for AI agents"; Graphiti is OSS (27k+ stars, Q2 2026) with a hosted cloud — free tier, paid from ~$125/mo. (Full architecture in `/vs/zep`.)
- **Gap nlqdb exploits:** Zep is a *retrieval* graph — it returns the facts most relevant to a query, but it has no query planner: an agent can't `GROUP BY` / `JOIN` / `HAVING` / aggregate over its own memory. The temporal validity windows are point-in-time fact recall, not analytics. nlqdb is a real database the agent designs and aggregates over in NL.
- **Threat vector:** **High for P2** — well-funded, benchmark-led, same lane as Mem0; the knowledge-graph framing is more structured than a flat vector store, but it stops short of SQL semantics.

### Letta (formerly MemGPT) — https://letta.com
Open-source (Apache-2.0) agent runtime with persistent memory built in — out of the 2023 Berkeley MemGPT paper. OS-style memory tiers (core/recall/archival); self-host or hosted. (Full architecture in `/vs/letta`.)
- **Gap nlqdb exploits:** Letta is an agent *framework* whose memory is self-edited prose blocks + a searchable archive; nlqdb is a DB primitive that framework can use. Letta can recall "Alice has a $50k deal"; it can't answer "average deal size per stage for enterprise customers" — there is no relational query layer over the memory. The two compose: Letta the runtime, nlqdb the analytical store.
- **Threat vector:** Medium — they want to be the runtime, not the storage layer, so the overlap is the default built-in memory rather than a head-to-head store.

### LangMem (LangChain) — https://langchain.com
Open-source Python SDK that adds long-term memory (semantic / episodic / procedural) to LangGraph agents — extract, consolidate, dedup from live interactions; storage-backend-agnostic. (Full architecture in `/vs/langmem`.)
- **Gap nlqdb exploits:** Extraction-and-recall logic over a key-value store, not a database — no SQL, no aggregation, no analytically-queryable schema. Its win is *distribution* (ships where LangGraph already is), not the analytical shape.
- **Threat vector:** **High for P2 on distribution** — LangChain's mass adoption makes LangMem the default a builder meets first; low on capability for the analytical wedge.

### Supermemory — https://supermemory.ai
"The memory + context API for the AI era" — fact extraction, hybrid recall (RAG + personalised memory), user profiles, and connectors (Drive / Gmail / Notion / GitHub) over a custom vector-graph engine; MIT-licensed with a one-binary local mode plus an MCP server. Benchmark leader (#1 on LongMemEval / LoCoMo / ConvoMem, sub-300ms recall). **Gap nlqdb exploits:** it ranks and returns memories — no SQL, no `GROUP BY` / `JOIN` / `HAVING` over what the agent stored; nlqdb is the analytical store the agent aggregates. **Threat:** high for P2 — strongest recall benchmarks today, but recall-only. `/vs/supermemory`.

**Vector stores (P2 retrieval).** All share one gap: they rank the nearest embeddings but have no SQL layer — an agent can't `GROUP BY` / `JOIN` / `HAVING` over what it stored. This is the "database, not a vector store" wedge (Gap analysis §4). Each has a canonical `/vs` page ([SK-CMP-002](../features/comparison-pages/decisions/SK-CMP-002-single-template-data-driven.md)); per-vendor distinctives below.

### Pinecone — https://pinecone.io
Managed serverless vector DB (detail in `competitors.ts`). **Threat:** medium — shifting toward pgvector-in-Postgres. `/vs/pinecone`.

### Weaviate — https://weaviate.io
OSS + managed vector DB. **Threat:** medium — same shape as Pinecone.

### Chroma — https://trychroma.com
OSS-first vector DB with a new managed cloud. **Threat:** medium — OSS-first devs.

### Qdrant — https://qdrant.tech
High-performance Rust vector DB, Apache-2.0; managed Qdrant Cloud. Quantization + native hybrid search, official `mcp-server-qdrant`. Cheaper recall, but adds no aggregation. `/vs/qdrant`.

### Milvus — https://milvus.io
Cloud-native open-source vector DB for scalable ANN (Go, Apache-2.0, ~45k stars, LF AI & Data graduated; Zilliz is creator). Billion-vector scale; managed Zilliz Cloud (free 5 GB), official `zilliztech/mcp-server-milvus`. Single-collection scalar group-by is new in Milvus 3.0-beta — still no cross-collection JOIN or HAVING. `/vs/milvus`.

### Cognee — https://www.cognee.ai
Open-source AI memory framework (Apache-2.0, ~20k stars) — builds a self-hosted **knowledge graph** (Extract → Cognify → Load) fusing vector embeddings + graph reasoning + ontology generation; pluggable backends, official `cognee-mcp`. A *recall* engine via hybrid vector + graph traversal (graph wing of the wedge). **Threat:** high for P2 — well-funded, MCP-native, the most credible "not just a vector store" framing; stops short of relational analytics. `/vs/cognee`.

### MindsDB — https://mindsdb.com (OSS: https://github.com/mindsdb/mindsdb)
The open-source **"Federated Query Engine for AI"** — federates 200+ existing data sources (Postgres, Snowflake, Slack, Gmail, files, …) behind one endpoint speaking the PostgreSQL wire protocol, positioned as a universal MCP server ("the only MCP Server you'll ever need"). Also ships knowledge bases (RAG over unstructured data), in-database ML models (`CREATE MODEL` / predictions — the original "AI Tables"), and agents (v26.0.0 rebuilt on Pydantic AI). Self-host or cloud. (Full table in `/vs/mindsdb`.)
- **Gap nlqdb exploits:** MindsDB *connects to* data you already have and adds federation + ML on top; nlqdb *provisions and owns* a Postgres from English, compiles NL → SQL with the SQL shown, and diff-previews writes. No sources to connect, no ML training, no unstructured RAG.
- **Threat vector:** **High for P2** — the most prominent "MCP server for your data" play, open-source and broadly connected; but federation assumes the sources (and modelling) already exist, which is exactly the setup nlqdb removes.

### Postgres MCP servers (community + vendor) — e.g. `@modelcontextprotocol/server-postgres`, Supabase MCP
Let an agent run read (and sometimes write) SQL against a *pre-provisioned* Postgres.
- **Gap nlqdb exploits:** existing MCP Postgres servers need the human to provision, credential, and schema-design first; nlqdb's `nlqdb_query` materialises a tenant-scoped Postgres + schema on first reference (no create verb — SK-MCP-002).
- **Threat vector:** Medium, rising — if the MCP ecosystem adds provisioning primitives, this gap narrows.

---

## 5. Internal tools / low-code admin

The tools P4 is paying for today. Displacement is a distribution fight, not a feature fight.

### Retool — https://retool.com
The canonical internal-tools platform. $10–$50/user/mo depending on tier.
- **Gap nlqdb exploits:** Retool requires a human to build forms; nlqdb's pitch is "skip the form, just ask."
- **Threat vector:** **Very high** for P4.

### Internal.io — https://internal.io
Cheaper Retool alternative.
- **Threat vector:** Medium for P4.

### Appsmith — https://appsmith.com
OSS Retool alternative.
- **Threat vector:** Low — different buyer (cost-conscious/self-hosted).

### Budibase — https://budibase.com / ToolJet — https://tooljet.com
OSS low-code platforms.
- **Threat vector:** Low.

---

## 6. Open-source text2sql frameworks

The build-it-yourself alternative for P2 and technically-inclined P4s.

### LangChain SQL agent — https://python.langchain.com
Part of the LangChain ecosystem; the "I'll just build it myself" route for P2. Canonical `/vs` page: **langchain-sql-agent** (landed 2026-06-30; page persona **P4** build-vs-buy, not P2 — rationale + facts in `competitors.ts`).
- **Gap nlqdb exploits:** Framework, not a product — requires gluing a DB, a model, retries, and a deployment, all of which nlqdb replaces.
- **Threat vector:** Medium — free and flexible.

### LlamaIndex query engine / sqlcoder / PremSQL
Adjacent DIY components: LlamaIndex's SQL query engine (like LangChain's), Defog's `sqlcoder` fine-tuned weights, and the OSS PremSQL toolkit. LlamaIndex (MIT) ships `NLSQLTableQueryEngine` (synthesise + run SQL over a `SQLDatabase` wrapping a SQLAlchemy engine you already run) and `SQLTableRetrieverQueryEngine` (a `TableIndex` for query-time schema retrieval when the schema overflows context); the docs explicitly warn that running arbitrary generated SQL is a security risk. Canonical `/vs` page: **llamaindex** (landed 2026-07-01; persona **P4** build-vs-buy, matching langchain-sql-agent — web-verified facts in `competitors.ts`).
- **Gap nlqdb exploits:** A framework component you wire over a DB you run — no provisioning, no SQL-shown, no fail-closed validation, no diff-previewed writes, no embed element.
- **Threat vector:** Low–medium — commodity components anyone can embed, not products.

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
3. **Conversational destructive-op preview** (diff-before-apply for updates/deletes/migrations) is rare — Retool gates human button-clicks, nothing gates NL requests. A trust differentiator for P1/P4.
4. **Analytical memory for agents** (§4) — Mem0 / Zep / Letta / LangMem *retrieve* facts; only nlqdb lets the agent `GROUP BY` / `JOIN` / `HAVING` over its own memory. Adding SQL semantics to a vector store is a storage-layer rewrite, not a feature (the GLOBAL-036 wedge).
5. **Cross-persona coverage with one product** — most rivals aim at one persona (Mem0 → P2, Retool → P4, Julius → P3); nlqdb's bet that one chat+DB primitive serves a dev, an agent, and a PM is unoccupied territory (moat or focus risk).

The scariest threats: (a) Supabase adding a first-class NL + agent story, and (b) the MCP Postgres ecosystem closing the provisioning gap — both plausible within 12 months. The cross-persona and NL-migration planks are harder to copy (product bets, not features).

---

*Last verified: 2026-07-01 (§1 Neon — pricing + official MCP server; §6 LlamaIndex; §4 MindsDB 2026-06-30). Pricing, URLs, and acquisitions change — re-check quarterly, especially §1/§3/§4 where consolidation and funding move fastest.*
