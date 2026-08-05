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
Analyst notebooks, not PM chat. **Threat:** Low-medium. Canonical `/vs` pages exist; nlqdb owns+provisions the DB + embed, they layer a notebook on a warehouse.

---

## 4. Agent memory / MCP DB servers

P2's home territory. These solve "agent needs to remember things" but generally don't give the agent a real DB.

### DIY on your existing Postgres / Supabase — the #1 real alternative
Not a vendor — P2b's default ("why not a `memories` table?"). **Gap:** `CREATE TABLE` is easy; fail-closed multi-tenant RLS (`app.agent_id`, SK-PIVOT-009), canonical `agent_memory_v1`, swept TTL, and NL analytics with SQL shown are the expensive 80%. **Threat:** **Highest for P2b**. Reach (R-02) leads with honest DIY, then the one-command alternative.

### Agentic DB (Constructive) — [announcement](https://www.prnewswire.com/news-releases/constructive-open-sources-agentic-db-the-postgres-memory-layer-for-ai-agents-302755269.html) · `constructive-io` / `pgpm.io` (OSS, 2026-04-28)
Postgres schema + Agent Skills (Claude Code/Cursor/Codex/…) for memory, chat, skills, tasks, CRM/KG, hybrid retrieval — one-command install. **Gap:** schema+skills on a Postgres *you* operate; agent/SDK authors SQL. nlqdb hosts and server-builds every write (SK-PIVOT-008) + RLS + TTL + NL→SQL shown. **Threat:** **High and rising for P2** — same coding-agent onboarding axis as R-04/R-05/R-07.

### Mem0 — https://mem0.ai
Apache-2.0 OSS + hosted memory SDK. V3 search is hybrid retrieval (semantic + BM25 + entity) with filters + `expiration_date` — still add/search, not SQL. **Gap:** memory-shaped vs DB-shaped — "remember this" vs. "here's a DB." **Threat:** high for P2. *(Matrix re-verified 2026-08-01: docs.mem0.ai, mem0ai/mem0.)*

### Zep — https://getzep.com
Agent-memory platform on **Graphiti** (temporal knowledge graph; validity windows + entity resolution); OSS core + hosted cloud. `/vs/zep`.
- **Gap:** hybrid vector/BM25/graph *retrieval* — no query planner, so no `GROUP BY` / `JOIN` / aggregate; validity windows are point-in-time recall, not analytics.
- **Threat:** **High for P2** — benchmark-led; stops short of SQL. Graphiti Apache-2.0 self-hosts; Zep platform hosted (CE deprecated). *(Matrix re-verified 2026-08-01: getzep.com/platform/graphiti, getzep/graphiti.)*

### Letta (formerly MemGPT) — https://letta.com
Apache-2.0 agent runtime with OS-style memory tiers (core / recall / archival); self-host (App Server) or hosted. Out of the 2023 Berkeley MemGPT paper. `/vs/letta`.
- **Gap:** self-edited prose + searchable archive — can recall "Alice has a $50k deal" but not "average deal size per stage" (no relational layer). Composes: Letta runtime, nlqdb analytical store.
- **Threat:** Medium — wants to be the runtime, not the store. *(Matrix re-verified 2026-08-01: docs.letta.com, letta-ai/letta.)*

### LangMem (LangChain) — https://langchain.com
OSS Python SDK adding long-term memory (semantic/episodic/procedural) to LangGraph agents — extract, consolidate, dedup; storage-backend-agnostic. (Full architecture in `/vs/langmem`.)
- **Gap nlqdb exploits:** extraction-and-recall over a key-value store, not a database — no SQL, no aggregation. Its win is *distribution* (ships where LangGraph is), not the analytical shape.
- **Threat vector:** **High for P2 on distribution** — LangChain's adoption makes LangMem the default a builder meets first; low on the analytical wedge.

### Supermemory — https://supermemory.ai
"The memory + context API for the AI era" — fact extraction, hybrid recall, user profiles, connectors (Drive/Gmail/Notion/GitHub) over a custom vector-graph engine; MIT, one-binary local mode + MCP server. Benchmark leader (LongMemEval / LoCoMo / ConvoMem, sub-300ms recall). **Gap:** ranks and returns memories — no SQL over what the agent stored. **Threat:** high for P2 — recall-only. `/vs/supermemory`.

### Hindsight (Vectorize) — https://hindsight.vectorize.io · `vectorize-io/hindsight` (MIT)
`retain` / `recall` / `reflect`; TEMPR multi-strategy retrieval (semantic + BM25 + graph + temporal); MCP-first; self-host or cloud; strong LongMemEval claims. **Gap:** retrieval + reflection — no query planner / `GROUP BY`. **Threat:** **High and rising for P2** — recall mindshare, not the analytical wedge. *(Added 2026-08-01.)*

### GBrain — https://github.com/garrytan/gbrain (MIT; Garry Tan / YC, OSS 2026-04)
Markdown-in-git personal brain + Postgres/pgvector hybrid search + MCP/CLI (OpenClaw/Hermes). **Gap:** single-operator knowledge brain, not hosted multi-tenant NL→SQL memory with fail-closed isolation. **Threat:** Medium–high mindshare / DIY; low on the analytical wedge. *(Added 2026-08-01.)*

### Pinecone Nexus — https://www.pinecone.io (public preview 2026-07)
"Manifests" convert raw enterprise documents into "organized, queryable knowledge artifacts" **curated at setup time**, not retrieved at query time; vendor benchmark ~90% accuracy vs ~65% RAG baseline. The first big-vendor move from recall toward structured knowledge. **Gap:** distills documents an engineering team already has — no NL→SQL, no `GROUP BY`/`JOIN` over what an agent *remembered*, no hosted memory write path, no non-technical authoring. **Threat:** **High and rising for P2** — narrows the "structure beats prose" messaging gap even though the workload differs. *(Added 2026-08-05; receipts in [`research/expert-knowledge-platform.md`](research/expert-knowledge-platform.md) §5.)*

**Vector / graph recall (P2).** Same gap: rank nearest matches, no relational analytics. Pinecone, Weaviate, Chroma, Qdrant, Milvus — `/vs/*`. **Cognee** (`/vs/cognee`) — OSS knowledge-graph memory (Extract→Cognify→Load); high P2 threat as "not just a vector store," still no SQL.

### MindsDB — https://mindsdb.com · `/vs/mindsdb`
Federates 200+ sources behind a Postgres-wire / MCP endpoint (+ in-DB ML). **Gap:** connects to data you already have; nlqdb provisions and owns Postgres from English. **Threat:** High for P2 MCP mindshare.

### Postgres MCP servers — e.g. `@modelcontextprotocol/server-postgres`, Supabase MCP
Read/write SQL against a *pre-provisioned* Postgres. **Gap:** human provisions first; `nlqdb_query` materialises tenant Postgres + schema on first reference (SK-MCP-002). **Threat:** Medium, rising.

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
| Supermemory | Agent memory | P2 | Benchmark-leading recall API (MIT); recall-only, no SQL |
| Hindsight (Vectorize) | Agent memory | P2 | Multi-strategy recall + reflect (MIT, MCP-first); LongMemEval leader; still no SQL |
| GBrain | Agent memory (personal) | P2 | YC-CEO halo; markdown+pgvector brain for OpenClaw/Hermes; single-operator |
| Pinecone Nexus | Agent knowledge (structured) | P2 | First big-vendor setup-time-curated structured knowledge layer; no NL→SQL/aggregation |
| Agentic DB (Constructive) | Agent memory (Postgres) | P2 | OSS Postgres memory + Agent Skills; same coding-agent onboarding axis |
| DIY on your Postgres/Supabase | Agent memory (build) | P2b | Free + in-stack default — loses on isolation/TTL/analytics correctness at scale |
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

Nobody occupies nlqdb's intersection:

1. **"Agent provisions its own DB"** — MCP Postgres / Vanna / Retool assume a human already stood the DB up.
2. **DB + NL chat + auto-migration in one product** — Supabase / Outerbase / Defog each own a slice, not the stitch.
3. **Conversational destructive-op preview** — rare; Retool gates UI clicks, not NL. Trust differentiator for P1/P4.
4. **Analytical memory for agents** (§4 / GLOBAL-036) — Mem0 / Zep / Letta / LangMem / Hindsight / Supermemory *retrieve* (or reflect); only nlqdb `GROUP BY` / `JOIN` / `HAVING` over memory. DIY / Agentic DB / GBrain are SQL-or-markdown-capable but not hosted NL-queryable memory with fail-closed isolation out of the box.
5. **Cross-persona with one product** — most rivals aim at one persona; one chat+DB primitive for a dev, an agent, and a PM is unoccupied.

Scariest threats within ~12 months: (a) Supabase NL + agent story; (b) MCP Postgres adding provisioning; (c) Agentic DB / Hindsight matching coding-agent onboarding or recall mindshare (§4). Cross-persona + NL-migration are harder to copy.

---

*Last verified: 2026-08-05 (§4 Pinecone Nexus added); 2026-08-01 (§4 Mem0/Zep/Letta matrix re-verify + Hindsight/GBrain added); 2026-07-18 (§4 DIY + Agentic DB); 2026-07-01 (§1 Neon, §6 LlamaIndex). Re-check quarterly.*
