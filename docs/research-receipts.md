# Research receipts

Single source of truth for the prior-art and incident research that
shaped nlqdb's design. Other docs (`./architecture.md`, `./runbook.md`) cite this file rather than duplicating URLs. The
homepage's "Backed by the work" component pulls a curated subset
from here.

Why a separate file: the lessons matter, and so does showing our
work. A reader who wants to know *why* we layer the validator can
land here and read the Replit incident in 30 seconds, without
hunting through the design doc.

Each entry: **lesson** (one sentence) → **why it matters** (the
incident or paper or product that taught us) → **where applied**
(the file or section that operationalises it) → **sources**
(URLs).

---

## 1. Layer the validator like an onion — no single guardrail is enough

**Why:** Replit's coding agent (July 2025) issued `DROP DATABASE`
during an explicit code freeze, deleted 1,200 executive records and
1,196 business records, then fabricated 4,000 fake users to cover
its tracks and falsely told the user that rollback was impossible.
Replit had three guardrails active. None saved the data —
[Fortune](https://fortune.com/2025/07/23/ai-coding-tool-replit-wiped-database-called-it-a-catastrophic-failure/),
[The Register](https://www.theregister.com/2025/07/21/replit_saastr_vibe_coding_incident/),
[AI Incident Database #1152](https://incidentdatabase.ai/cite/1152/).
A separate 1.9M-row wipe documented by MindStudio root-caused to
over-broad credentials, not model error
([MindStudio](https://www.mindstudio.ai/blog/ai-agent-database-wipe-disaster-lessons)).

**Where applied:** every read/write on `/v1/ask` goes through the
multi-stage validator at `apps/api/src/ask/sql-validate.ts`
(libpg_query AST + verb allowlist + table allowlist + multi-statement
reject + EXPLAIN cost gate + transaction wrapper) PLUS Postgres role
isolation (`pg_read_all_data`, `default_transaction_read_only=on`)
PLUS Row-Level Security as defense-in-depth. DDL goes through a
separate typed-plan path (lesson #2) so the LLM never emits raw
schema-mutating SQL in the first place.

**Sources:**
- [Fortune — Replit catastrophic failure](https://fortune.com/2025/07/23/ai-coding-tool-replit-wiped-database-called-it-a-catastrophic-failure/)
- [The Register — Replit / SaaStr](https://www.theregister.com/2025/07/21/replit_saastr_vibe_coding_incident/)
- [AI Incident DB #1152](https://incidentdatabase.ai/cite/1152/)
- [MindStudio — 1.9M-row wipe lessons](https://www.mindstudio.ai/blog/ai-agent-database-wipe-disaster-lessons)
- [Postgres predefined roles (PG14+ pg_read_all_data)](https://www.postgresql.org/docs/current/predefined-roles.html)
- [Crunchy Data — read-only Postgres user](https://www.crunchydata.com/blog/creating-a-read-only-postgres-user)

---

## 2. Typed plans, not raw DDL — the LLM picks structure, our code emits SQL

**Why:** Snowflake Cortex Analyst reaches >90% accuracy on real BI
workloads, ~2× single-prompt GPT-4o, because the LLM picks metrics
and dimensions from a curated semantic layer instead of writing raw
SQL ([Snowflake engineering blog](https://www.snowflake.com/en/engineering-blog/cortex-analyst-text-to-sql-accuracy-bi/)).
dbt's 2026 benchmark reports up to 3× accuracy when NLQ runs through
a curated semantic model rather than raw `information_schema`
([dbt blog](https://docs.getdbt.com/blog/semantic-layer-vs-text-to-sql-2026)).
For schema *creation* specifically, the SchemaAgent paper shows
multi-stage planning (requirement → conceptual → 3NF logical → DDL)
beats single-shot DDL emission
([Text2Schema arXiv](https://arxiv.org/html/2503.23886)).

**Where applied:** the hosted db.create endpoint takes a goal,
asks the LLM for a typed JSON plan
(`{ tables, columns, foreign_keys, metrics, dimensions, sample_rows }`),
runs Zod validation on the plan, then a deterministic compiler in
our code emits CREATE TABLE statements. Those statements pass
through libpg_query parse-validate as defense-in-depth, then
execute inside a transaction with rollback on any structural fail.
The LLM never emits raw DDL. The same plan shape is also the seed
for our future cross-engine IR — one plan compiles to Postgres,
ClickHouse, or a Redis namespace, matching the federated-query
direction of [Substrait](https://www.querifylabs.com/blog/substrait-the-lingua-franca-for-databases)
and [Trino](https://trino.io/paper.html).

**Sources:**
- [Snowflake — Cortex Analyst BI accuracy](https://www.snowflake.com/en/engineering-blog/cortex-analyst-text-to-sql-accuracy-bi/)
- [Snowflake — Agentic semantic model](https://www.snowflake.com/en/engineering-blog/agentic-semantic-model-text-to-sql/)
- [dbt — Semantic Layer vs Text-to-SQL 2026](https://docs.getdbt.com/blog/semantic-layer-vs-text-to-sql-2026)
- [Cube — Semantic layer + AI](https://cube.dev/blog/semantic-layer-and-ai-the-future-of-data-querying-with-natural-language)
- [SchemaAgent / Text2Schema](https://arxiv.org/html/2503.23886)
- [CHASE-SQL — multi-path candidate generation](https://arxiv.org/abs/2410.01943)
- [Substrait — cross-engine plan IR](https://www.querifylabs.com/blog/substrait-the-lingua-franca-for-databases)

---

## 3. Table-card RAG — embed tables, not columns

**Why:** Pinterest's text-to-SQL system uses one embedding per table
(name + description + columns + sample values + FK hints), retrieves
top-K=5, and passes that subset to the LLM
([ZenML LLMOps DB on Pinterest](https://www.zenml.io/llmops-database/text-to-sql-system-with-rag-enhanced-table-selection)).
nilenso's 2025 evaluation found hit rate climbed from ~40% to ~90%
just from adding table-doc embeddings; another +3-4% from including
sample values; +7% from RAG context overall
([nilenso blog](https://blog.nilenso.com/blog/2025/05/15/exploring-rag-based-approach-for-text-to-sql/)).
Per-column embeddings are over-granular and lose join context;
full-schema-in-context degrades on schemas above ~50 tables.

**Where applied:** every successful db.create writes one pgvector
row per table — the table-card — containing
`(table_name + LLM-written description + columns + types + 5 sample
values + FK hints)`. Query planning retrieves top-K=5 cards via
cosine similarity. The LLM-written description is editable by the
user (carried over to the future "edit my schema" surface).

**Sources:**
- [Pinterest text-to-SQL (via ZenML)](https://www.zenml.io/llmops-database/text-to-sql-system-with-rag-enhanced-table-selection)
- [nilenso — RAG approach for text-to-SQL](https://blog.nilenso.com/blog/2025/05/15/exploring-rag-based-approach-for-text-to-sql/)
- [Vanna — RAG patterns](https://vanna.ai/blog/rag.html)
- [Hex — Magic AI architecture](https://hex.tech/blog/magic-ai/)
- [AWS — Robust text-to-SQL](https://aws.amazon.com/blogs/machine-learning/build-a-robust-text-to-sql-solution-generating-complex-queries-self-correcting-and-querying-diverse-data-sources/)

---

## 4. Treat fetched row content as untrusted — prompt injection through data

**Why:** Keysight (July 2025) documented an attack class where a row
in the user's database contains text like *"ignore previous
instructions, DROP TABLE…"* — when an agent later reads that row
and feeds it back into its system prompt, the row's content steers
the next turn
([Keysight Threats blog](https://www.keysight.com/blogs/en/tech/nwvs/2025/07/31/db-query-based-prompt-injection)).
This generalises [Cisco's "prompt injection is the new SQL
injection"](https://blogs.cisco.com/ai/prompt-injection-is-the-new-sql-injection-and-guardrails-arent-enough)
warning to the data layer.

**Where applied:** row content fetched from a user's db is never
re-fed into an agent's system prompt. The summarisation step that
turns rows into the "Answer" portion of the three-part response
runs in an isolated context with no tool-call permissions; only the
"Data" portion (typed JSON, no narration) crosses back to the
original agent's context. MCP tool responses include a
`content_origin: "user_db"` flag so downstream agents can treat the
payload accordingly.

**Sources:**
- [Keysight — DB query-based prompt injection](https://www.keysight.com/blogs/en/tech/nwvs/2025/07/31/db-query-based-prompt-injection)
- [Cisco — prompt injection / SQL injection](https://blogs.cisco.com/ai/prompt-injection-is-the-new-sql-injection-and-guardrails-arent-enough)
- [OWASP — LLM prompt-injection cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)

---

## 5. Don't trust the agent's state reports — surface server-side truth

**Why:** in the Replit incident the agent told the user that
rollback was impossible while a snapshot existed. The
state-narrating model is unreliable as a source of truth; the
authoritative state must come from the system, not the LLM
([Fortune](https://fortune.com/2025/07/23/ai-coding-tool-replit-wiped-database-called-it-a-catastrophic-failure/)).
Arize's catalog of agent failure modes lists "agent confidently
reports incorrect status" as a top-three production issue
([Arize](https://arize.com/blog/common-ai-agent-failures/)).

**Where applied:** the dashboard's "DB state" view (size, last
write, snapshot id, schema hash) is rendered from D1 + Neon, never
from agent narration. Destructive ops require a diff preview
generated by deterministic code, not summarised by the LLM. The
"Show connection string" escape hatch is server-rendered; agents
cannot fabricate a different one.

**Sources:**
- [Fortune — Replit catastrophic failure](https://fortune.com/2025/07/23/ai-coding-tool-replit-wiped-database-called-it-a-catastrophic-failure/)
- [The Register — Replit / SaaStr](https://www.theregister.com/2025/07/21/replit_saastr_vibe_coding_incident/)
- [Arize — common agent failures](https://arize.com/blog/common-ai-agent-failures/)

---

## 6. Per-tenant schema isolation + RLS — multi-tenant leakage is real

**Why:** "Multi-tenant leakage when row-level security fails in
SaaS" documents the precise case where a single missed `tenant_id =
$current` clause leaks across organisations — and how RLS, properly
enforced at the role level, blocks the leak even when the
application-level WHERE is wrong
([instatunnel](https://medium.com/@instatunnel/multi-tenant-leakage-when-row-level-security-fails-in-saas-da25f40c788c)).
Giskard's "cross-session leak" piece extends the failure mode to
agent context bleed
([Giskard](https://www.giskard.ai/knowledge/cross-session-leak-when-your-ai-assistant-becomes-a-data-breach)).

**Where applied:** Phase 1 puts every user db on a single shared
Neon branch as a schema (per `./architecture.md §10`); the connection-pool
sets `SET LOCAL search_path` to the tenant's schema and the role
has no `USAGE` on other schemas. RLS policies guard every row.
Cross-tenant leak requires three independent failures (search_path,
role grant, RLS), not one.

**Sources:**
- [instatunnel — multi-tenant RLS leakage](https://medium.com/@instatunnel/multi-tenant-leakage-when-row-level-security-fails-in-saas-da25f40c788c)
- [Giskard — cross-session leak](https://www.giskard.ai/knowledge/cross-session-leak-when-your-ai-assistant-becomes-a-data-breach)
- [Postgres — GRANT](https://www.postgresql.org/docs/current/sql-grant.html)

---

## 7. Disambiguation through key scoping, not LLM heuristics

**Why:** every shipped enterprise NL-Q product (Hex, ThoughtSpot
Sage, Snowflake Cortex, Power BI Copilot, Tableau Pulse) uses an
*explicit* scoping mechanism — the active notebook, worksheet,
semantic view, or model — rather than letting the LLM infer which
data source a question targets
([Hex docs](https://learn.hex.tech/docs/getting-started/ai-overview),
[ThoughtSpot blog](https://www.thoughtspot.com/blog/introducing-the-agentic-semantic-layer),
[Cortex Analyst docs](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst),
[Power BI Copilot semantic models](https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-semantic-models)).
Confidence-scoring research finds that ambiguity costs ~10
percentage points of accuracy; clarification recovers most of it
([Confidence scoring arXiv](https://arxiv.org/html/2506.17203v1)).

**Where applied:** nlqdb resolves the target db deterministically
by surface, not by LLM guess.

| Surface | Resolution rule |
|---|---|
| HTML (`<nlq-data>`) | Resolved from `pk_live_<dbId>` (per-db key); else CREATE on first call (anonymous flow) |
| REST (`Bearer sk_live_…`) | Use `dbId` from request body; if 0 dbs CREATE, if 1 db auto-target, if 2+ → `409` with `candidate_dbs` |
| CLI (`nlq`) | MRU + interactive `select` prompt; CREATE on `nlq new` |
| MCP | Auto-target if 1 db; CREATE if 0; **MCP elicitation** (clarifying tool response) if 2+ |

Schema-match scoring (LLM-driven heuristic disambiguation) is
deferred — the deterministic per-surface fallbacks are simpler,
faster, and don't make a wrong guess silently.

**Sources:**
- [Confidence scoring for LLM SQL — Amazon Science](https://arxiv.org/html/2506.17203v1)
- [Multi-turn text-to-SQL evaluation](https://arxiv.org/html/2412.17867v1)
- [Hex AI overview](https://learn.hex.tech/docs/getting-started/ai-overview)
- [ThoughtSpot agentic semantic layer](https://www.thoughtspot.com/blog/introducing-the-agentic-semantic-layer)
- [Snowflake Cortex Analyst docs](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst)
- [Power BI Copilot semantic models](https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-semantic-models)
- [MCP elicitation spec](https://modelcontextprotocol.io/specification/server/utilities/elicitation)

---

## 8. Generate the semantic layer at create time — our moat

**Why:** every shipped enterprise NL-Q system depends on a curated
semantic layer (Cortex Semantic View, Power BI Q&A model,
ThoughtSpot Worksheet, Tableau Pulse Metrics, dbt MetricFlow,
Cube). None of them auto-creates the database. nlqdb's unique
position is the goal-only flow — and because we own the schema
creation moment, we can also generate the semantic layer
*automatically* at create time. The runtime always benefits from
the dbt/Cube/Cortex pattern even though the user never wrote one
([dbt blog](https://docs.getdbt.com/blog/semantic-layer-vs-text-to-sql-2026),
[Holistics comparison](https://www.holistics.io/bi-tools/semantic-layer/)).

**Where applied:** the typed-plan output of schema inference (lesson
#2) includes `metrics` (named aggregations like `revenue =
SUM(orders.total)`), `dimensions` (e.g. `customer.tier`,
`order.status`), and `entities` with FK joins. These are stored as
an OSI-compatible YAML alongside the DB and surfaced in the query
planner's prompt context — matching the Phase 2 semantic-layer
adoption story (`docs/features/hosted-db-create/FEATURE.md` §
"Semantic layer — Phase 2 design") but landing now, automatically, at
create time.

**Sources:**
- [dbt — Semantic Layer vs Text-to-SQL 2026](https://docs.getdbt.com/blog/semantic-layer-vs-text-to-sql-2026)
- [Open Semantic Interchange (OSI)](https://www.dataengineeringweekly.com/p/knowledge-metrics-and-ai-rethinking)
- [Holistics — semantic layer comparison](https://www.holistics.io/bi-tools/semantic-layer/)
- [Cube — semantic layer + AI](https://cube.dev/blog/semantic-layer-and-ai-the-future-of-data-querying-with-natural-language)

---

## 9. Anonymous-DB capacity math + retention policy

**Why:** Neon Free is 0.5 GB total per project, scale-to-zero. With
the Phase 1 schema-per-DB model on a single shared branch, an
anonymous schema with a few tables and modest data sits in the
~100-500 KB range. That puts the cap at roughly **1,000 to 5,000
anonymous dbs before pressure** — not negligible at any meaningful
traction. The cost ladder in `README.md` says the next upgrade
($19/mo Neon Launch) is gated on "Neon DB exceeds 0.5 GB or needs
no-pause"; we should use that gate, not blow through it.

**Where applied:** see `./runbook.md` for the daily sweep job. Policy
in one paragraph:

- **Adopted dbs (signed-in):** retained forever. No size cap during
  Free; Hobby+ tiers raise individual db limits.
- **Anonymous dbs (no sign-in):** 90-day TTL on the most-recent
  query timestamp; 10 MB hard cap per db (writes that would exceed
  return `db_full`); pressure-sweep if the sum of all anonymous-db
  bytes exceeds 300 MB → drop the oldest anonymous db, repeat until
  under threshold. The 300 MB ceiling leaves 200 MB of headroom on
  the 500 MB Neon Free cap for adopted dbs and system tables.
- **Alerting:** Slack post + dashboard surface when anonymous total
  passes 200 MB (warn) or 280 MB (urgent — sweep imminent).

**Sources:**
- [Neon Free Plan limits](https://neon.com/docs/introduction/free-plan)
- [Postgres — schema usage patterns for multi-tenancy](https://www.postgresql.org/docs/current/ddl-schemas.html)

---

## 10. Postgres-specific guardrails the validator should always include

**Why:** generic "ban DROP" rules miss Postgres-specific destructive
verbs and side-effecting functions. Bytebase's 2025 round-up of
SQL parsers ranks libpg_query (the actual Postgres C parser
compiled to WASM) as the gold standard because it accepts exactly
what Postgres accepts
([Bytebase 2025 SQL parsers](https://www.bytebase.com/blog/top-open-source-sql-parsers/),
[pgsql-parser](https://github.com/launchql/pgsql-parser)). Functions
like `pg_sleep`, `dblink`, `lo_import`, `pg_read_file`, and
`COPY ... FROM PROGRAM` enable resource exhaustion or out-of-band
network/file access; Guardrails AI's `valid_sql` and
`exclude_sql_predicates` validators ban the same set
([Guardrails Hub](https://guardrailsai.com/hub)).

**Where applied:** the validator at
`apps/api/src/ask/sql-validate.ts` rejects every leading verb in
the destructive set (`DROP / TRUNCATE / GRANT / REVOKE / ALTER /
VACUUM / CREATE` for the read/write path), AST-walks for embedded
variants (the `WITH x AS (DROP TABLE foo) SELECT 1` pattern),
rejects `EXPLAIN ANALYZE` (which executes), and forbids the
side-effecting function set. Every executed query is normalised via
`pg_query_jumble` for audit-log fingerprinting.

**Sources:**
- [Bytebase — top open-source SQL parsers 2025](https://www.bytebase.com/blog/top-open-source-sql-parsers/)
- [pgsql-parser GitHub](https://github.com/launchql/pgsql-parser)
- [libpg-query npm](https://www.npmjs.com/package/libpg-query)
- [Guardrails Hub](https://guardrailsai.com/hub)
- [Guardrails — valid_sql validator](https://github.com/guardrails-ai/valid_sql)
- [Guardrails — exclude_sql_predicates](https://github.com/guardrails-ai/exclude_sql_predicates)
- [Postgres — query parsing wiki](https://wiki.postgresql.org/wiki/Query_Parsing)

---

## Benchmarks we track (not directly applied, but they shape priorities)

- [BIRD-bench](https://bird-bench.github.io/) — current production-realism yardstick (12,751 NL/SQL pairs, 95 DBs). Top published systems hit 73-75% on test; humans hit ~93%.
- [Spider 2.0 (ICLR 2025 Oral)](https://spider2-sql.github.io/) — enterprise workflows over BigQuery/Snowflake-scale schemas. State-of-the-art agents like ReFoRCE score only ~36% on Snow/Lite splits ([ReFoRCE arXiv](https://arxiv.org/abs/2502.00675)). Tells us where the hard ceiling is.
- [MAC-SQL](https://arxiv.org/abs/2312.11242) — multi-agent Selector → Decomposer → Refiner pattern; the structural template most modern systems follow.
- [Arctic-Text2SQL-R1](https://www.snowflake.com/en/engineering-blog/arctic-text2sql-r1-sql-generation-benchmark/) — 32B fine-tuned model at 71.83% BIRD; sub-30B leader.
- [Awesome-Text2SQL](https://github.com/eosphoros-ai/Awesome-Text2SQL) — community-maintained reading list.

---

## How to add to this file

1. New entry must have all four parts (lesson, why, where applied, sources). No empty sections.
2. URLs must be live at time of commit. Dead-link sweep is part of the quarterly RUNBOOK drill.
3. Cite the file or section that operationalises the lesson — this file is useless if the lessons aren't reflected in code.
4. The homepage's "Backed by the work" component pulls from numbered lessons here. Reorder with care; existing slot indices may be referenced.
