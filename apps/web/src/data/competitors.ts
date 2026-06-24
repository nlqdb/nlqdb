// Comparison-page source of truth. One object per competitor; the
// `/vs/[slug].astro` template renders from this, the sitemap reads
// the slugs, and `llms.txt` links each entry — single edit per add.
//
// AEO best-practice anchor (2026): honest trade-offs convert at ≈13.8%
// vs ≈2–5% for generic feature-checklist comparison pages
// (Grow & Convert, Unbounce 2026 SaaS benchmarks). "When to choose
// them" is mandatory, not decoration; pages that hide weaknesses get
// demoted by Perplexity / ChatGPT cited-source heuristics. Verified
// claims only — no parity rows we can't ship today.

export type ComparisonClaim = "shipped" | "partial" | "no";

export type ComparisonRow = {
  feature: string;
  us: ComparisonClaim;
  them: ComparisonClaim;
  // One-sentence honest gloss; omit when the row is self-evident.
  note?: string;
};

export type ComparisonFaq = {
  q: string;
  a: string;
};

export type ComparisonDemo = {
  // Plain-English goal piped into the `<nlq-data>` embed on the page.
  goal: string;
  // One-sentence "why this demo speaks to the comparison".
  why: string;
};

export type Competitor = {
  slug: string;
  // Display name; goes into H1 + JSON-LD + browser tab.
  name: string;
  // Canonical product URL — rendered as `<link rel="canonical">` on the
  // competitor's own pain-quote citation (we credit them, don't outrank
  // them on their own brand keyword).
  url: string;
  // One-sentence pitch of the competitor (their own positioning, paraphrased).
  tagline: string;
  // The persona this comparison serves (from `docs/research/personas.md`).
  persona: "P1 solo builder" | "P2 agent builder" | "P3 analyst" | "P4 backend engineer";
  // Direct-answer capsule for AEO crawlers — under 60 words, capsule shape
  // ("If you need X, pick A. If you need Y, pick B.").
  oneLiner: string;
  // Bullets — "When to choose nlqdb" and "When to choose them". Each ≤16
  // words. Order: highest-decisive first.
  whenChooseUs: string[];
  whenChooseThem: string[];
  // Feature parity rows. ~6–10 rows is the sweet spot — beyond that,
  // visitors stop reading (Tripledart 2026 SaaS comparison data).
  features: ComparisonRow[];
  // 4–6 Q&As. LLMs lift FAQ Q&A pairs verbatim — keep answers 2–3
  // sentences, declarative, and use the named-competitor in at least one
  // question (HubSpot AEO playbook 2026).
  faqs: ComparisonFaq[];
  // The demo embedded on the page. Goals chosen to highlight a dimension
  // the competitor doesn't ship.
  demo: ComparisonDemo;
};

export const COMPETITORS: Competitor[] = [
  {
    slug: "supabase",
    name: "Supabase",
    url: "https://supabase.com",
    tagline: "Open-source Firebase alternative — Postgres, auth, storage, edge functions.",
    persona: "P1 solo builder",
    oneLiner:
      "Pick Supabase if you want a full BaaS — auth, storage, edge functions, and a SQL Studio you'll write queries in yourself. Pick nlqdb if you want to ship data features by writing English, with the schema, engine, and indexes invisible.",
    whenChooseUs: [
      "Your product is data-feature heavy and you don't want to write SQL or migrations.",
      "You want one HTML element (`<nlq-data>`) that answers questions over your data.",
      "An AI agent or LLM needs to query a database it can also provision.",
      "You want destructive operations diff-previewed before they apply.",
    ],
    whenChooseThem: [
      "You need auth, storage, realtime, and edge functions in one product.",
      "Your team is fluent in SQL and prefers a Studio over a chat box.",
      "You're already on the Supabase free tier and don't want to migrate.",
      "Row-level security policies are central to your data model.",
    ],
    features: [
      { feature: "Managed Postgres", us: "shipped", them: "shipped" },
      {
        feature: "Natural-language queries",
        us: "shipped",
        them: "no",
        note: "Studio is a SQL IDE; English queries aren't part of the product.",
      },
      {
        feature: "Auto-migration via NL ('add a column for tags')",
        us: "shipped",
        them: "no",
      },
      {
        feature: "Destructive-op diff preview before apply",
        us: "shipped",
        them: "no",
        note: "Supabase has SQL Editor + RLS; the diff/preview before destructive NL is unique to nlqdb.",
      },
      {
        feature: "MCP server (agent-callable)",
        us: "shipped",
        them: "partial",
        note: "Supabase MCP queries an existing DB; nlqdb's `nlqdb_query` materialises Postgres on first reference.",
      },
      { feature: "HTML embed element", us: "shipped", them: "no" },
      { feature: "Anonymous mode (try before sign-in)", us: "shipped", them: "no" },
      { feature: "Auth (email, OAuth, SSO)", us: "partial", them: "shipped" },
      { feature: "File / blob storage", us: "no", them: "shipped" },
      { feature: "Edge functions", us: "no", them: "shipped" },
      { feature: "Realtime websockets", us: "no", them: "shipped" },
    ],
    faqs: [
      {
        q: "Can I keep my Supabase database and use nlqdb just for the NL queries?",
        a: "Not yet — nlqdb provisions and owns the database it queries. Bring-your-own-Postgres is on the roadmap but not shipped. For NL-over-existing-Supabase, see Vanna AI or AskYourDatabase.",
      },
      {
        q: "Does nlqdb support row-level security like Supabase?",
        a: "Per-DB API keys (`pk_live_*`) scope reads to a single database, and writes require a session bearer. Postgres RLS policies aren't surfaced yet; if you need policy-level control, Supabase wins today.",
      },
      {
        q: "Is nlqdb open source like Supabase?",
        a: "The source is private during pre-alpha. The SDKs, CLI, framework wrappers, and the `<nlq-data>` web component will be open source at general availability; the platform itself is hosted-only for now.",
      },
      {
        q: "What's the pricing model vs Supabase's $25/mo Pro?",
        a: "Free chain forever (BYO-LLM at 0% markup); hosted premium adds a flat sub with an included request allowance and soft-meter overage. Exact tiers ship with monetization; until then everything is free.",
      },
      {
        q: "Can my AI agent create a Supabase project the way it can create an nlqdb database?",
        a: "Supabase's MCP server queries an existing project but doesn't provision one. nlqdb's MCP exposes `nlqdb_query`, which materialises Postgres on first reference (no separate create-DB verb), so an autonomous agent can stand up its own data layer end-to-end.",
      },
    ],
    demo: {
      goal: "top 5 customers by revenue this month",
      why: "The query Supabase users write by hand in Studio is the one nlqdb answers from the English goal.",
    },
  },
  {
    slug: "vanna",
    name: "Vanna AI",
    url: "https://vanna.ai",
    tagline: "Open-source text-to-SQL trained on your schema and prior queries.",
    persona: "P3 analyst",
    oneLiner:
      "Pick Vanna if you have an existing database and want an OSS layer that translates English into SQL against it. Pick nlqdb if you also want the database itself — provisioned, schema-managed, and queryable via SDK / CLI / MCP from day one.",
    whenChooseUs: [
      "You don't have a database yet, or you want a fresh one for a new feature.",
      "You want the same engine to power a web embed, a CLI, and an MCP server.",
      "Destructive-op diff preview matters more than SQL training-data fidelity.",
      "You want anonymous-mode visitors to try queries before signing in.",
    ],
    whenChooseThem: [
      "You already have a production database with curated schema documentation.",
      "You want full control over the LLM stack and prompt engineering.",
      "OSS license matters for compliance or self-hosting.",
      "You need the translator-only shape and don't want a hosted product.",
    ],
    features: [
      { feature: "Owns the database (provisions + migrates)", us: "shipped", them: "no" },
      { feature: "Natural-language → SQL", us: "shipped", them: "shipped" },
      {
        feature: "Auto-migration via NL ('add a column for tags')",
        us: "shipped",
        them: "no",
      },
      {
        feature: "Trained on your prior queries (RAG over query history)",
        us: "partial",
        them: "shipped",
        note: "nlqdb caches plans per (goal-fingerprint, schema-hash); Vanna's training loop is more explicit.",
      },
      { feature: "HTML embed element", us: "shipped", them: "no" },
      { feature: "MCP server", us: "shipped", them: "no" },
      { feature: "Destructive-op diff preview", us: "shipped", them: "no" },
      {
        feature: "Multi-engine (Postgres + ClickHouse + …)",
        us: "partial",
        them: "shipped",
        note: "Vanna routes across many SQL dialects; nlqdb Phase 1 is Postgres, ClickHouse Phase 2.",
      },
      { feature: "Open source", us: "no", them: "shipped" },
      { feature: "Self-hostable", us: "no", them: "shipped" },
    ],
    faqs: [
      {
        q: "Can I point Vanna AI at an nlqdb database?",
        a: "Not directly. nlqdb's API speaks `/v1/ask` (English) and `/v1/run` (raw SQL with allow-list); Vanna expects a Postgres connection string. The right shape today is to use nlqdb for new data features and Vanna over a legacy DB you can't migrate.",
      },
      {
        q: "Is nlqdb's NL→SQL quality competitive with Vanna's?",
        a: "Both fine-tune the prompt against the live schema. nlqdb publishes BIRD Mini-Dev + Spider 2.0-lite scores to `docs/features/quality-eval/`; Vanna doesn't publish a single canonical benchmark, so the honest answer is 'measure yours on your schema.'",
      },
      {
        q: "Do I need to write training examples like in Vanna?",
        a: "No — nlqdb prompts directly from the schema fingerprint + recent-tables hint. Training examples are a Vanna-specific lift; nlqdb's equivalent is the per-tenant plan cache, which is automatic.",
      },
      {
        q: "Which one is better for an AI agent over MCP?",
        a: "nlqdb ships an MCP server with `nlqdb_query`, `nlqdb_list_databases`, and `nlqdb_describe` — `nlqdb_query` materialises Postgres on first reference, so the agent never calls a separate create-DB verb. Vanna doesn't ship an MCP server today, so an agent has to wrap the Python SDK itself.",
      },
      {
        q: "Can I migrate from Vanna to nlqdb without rewriting my queries?",
        a: "Your end-user query strings (English goals) port directly. The schema needs to be re-created in nlqdb (or imported from a SQL dump) because nlqdb owns the database. The integration code shrinks — one `<nlq-data>` tag or one SDK call replaces a translator-plus-DB-client pair.",
      },
    ],
    demo: {
      goal: "monthly revenue trend for the last 12 months",
      why: "A reporting question Vanna would translate; nlqdb both translates it and owns the data it answers from.",
    },
  },
  {
    slug: "mem0",
    name: "Mem0",
    url: "https://mem0.ai",
    tagline: "Purpose-built memory layer for AI agents.",
    persona: "P2 agent builder",
    oneLiner:
      "Pick Mem0 if you want an opinionated memory primitive — add / search / forget — tuned for LLM agent contexts. Pick nlqdb if your agent also needs to query structured data, run reports, and migrate its own schema.",
    whenChooseUs: [
      "Your agent stores structured rows ('user X bought Y on Z') the agent later queries.",
      "You want one MCP server that does provisioning, memory, and reporting.",
      "Multiple agents on multiple devices share one tenant-scoped database.",
      "The schema needs to evolve as the agent learns ('add a `priority` field').",
    ],
    whenChooseThem: [
      "Your memory is unstructured — chat-history snippets, user facts as free text.",
      "Vector recall over fuzzy strings matters more than typed SQL.",
      "You want a memory-only primitive; the agent is wired into another data layer.",
      "A managed memory tier with explicit forget semantics is on your shortlist.",
    ],
    features: [
      {
        feature: "Structured rows + typed columns",
        us: "shipped",
        them: "partial",
        note: "Mem0 stores facts as text + vectors; nlqdb stores typed rows in Postgres.",
      },
      { feature: "Natural-language queries", us: "shipped", them: "shipped" },
      { feature: "Vector search over chat history", us: "no", them: "shipped" },
      { feature: "MCP server", us: "shipped", them: "partial" },
      {
        feature: "Auto-migration via NL ('add a `priority` field')",
        us: "shipped",
        them: "no",
      },
      { feature: "Multi-agent / multi-device shared tenant", us: "shipped", them: "shipped" },
      { feature: "Explicit forget / TTL semantics", us: "partial", them: "shipped" },
      { feature: "Aggregations + reporting queries", us: "shipped", them: "no" },
      { feature: "Open source", us: "no", them: "shipped" },
    ],
    faqs: [
      {
        q: "Can I use Mem0 for fuzzy facts and nlqdb for structured data?",
        a: "Yes — they're complementary. Mem0 handles 'remember the user prefers Celsius', nlqdb handles 'list the user's orders this month'. Both can sit behind one MCP-aware agent; nlqdb's MCP server exposes `nlqdb_query`, which materialises Postgres on first reference, so the structured side is self-provisioned.",
      },
      {
        q: "Is nlqdb a vector database?",
        a: "No. nlqdb is Postgres-first (ClickHouse for analytical engines in Phase 2). For vector recall over unstructured strings, Mem0, Pinecone, or pgvector are the right shape.",
      },
      {
        q: "How does my agent provision an nlqdb database autonomously?",
        a: "The MCP server exposes `nlqdb_query` — your agent calls it with a goal in English, the server materialises Postgres + schema on first reference, and returns the answer bound to the agent's tenant. There's no separate create-DB verb to call first.",
      },
      {
        q: "Does nlqdb support forget / TTL like Mem0?",
        a: "Anonymous-mode databases auto-sweep after 72h; authenticated tables don't ship TTL semantics yet. If forget is core to your agent's memory model, Mem0 fits better today.",
      },
      {
        q: "Can multiple agents share the same nlqdb database?",
        a: "Yes — tenant-scoped `sk_live_*` keys give each agent access to the same data. Per-device tagging is supported via `sk_mcp_*` keys minted with `(mcp_host, device_id)` claims, so the dashboard shows 'Cursor on macbook-air ran 14 queries today'.",
      },
    ],
    demo: {
      goal: "users who logged in this week and viewed pricing",
      why: "The structured behavioural slice an agent extracts is nlqdb's lane; Mem0's lane is the unstructured fact recall.",
    },
  },
  {
    slug: "outerbase",
    name: "Outerbase",
    url: "https://www.outerbase.com",
    // Acquired by Cloudflare 2025-04-07 per https://www.cloudflare.com/press/press-releases/2025/cloudflare-acquires-outerbase-to-expand-developer-experience/ (full landscape entry in docs/competitors.md §3).
    tagline:
      "AI-assisted database interface (EZQL, spreadsheet editor, dashboards) for your existing Postgres / MySQL / SQLite / MongoDB / ClickHouse / Snowflake / BigQuery / Redshift / MSSQL.",
    persona: "P4 backend engineer",
    oneLiner:
      "Pick Outerbase if you already run a production database and want an AI-assisted admin UI — spreadsheet edits, EZQL natural-language queries, dashboards — sitting on top of it. Pick nlqdb if you want the database itself provisioned, schema evolved via English, and one HTML element rendering answers in your own app.",
    whenChooseUs: [
      "You want destructive operations and schema changes diff-previewed before they apply, even when an English request triggered them.",
      "You want to embed the answer inside your own product via one HTML element, not link out to a hosted admin UI.",
      "You're spinning up a new feature or service that needs its own database — nlqdb provisions Postgres on the first query.",
      "An AI agent needs to provision its own database via MCP — `nlqdb_query` materialises Postgres on first reference, the on-ramp Outerbase doesn't ship.",
    ],
    whenChooseThem: [
      "You already run a production Postgres / MySQL / Snowflake / BigQuery you can't migrate.",
      "You want a spreadsheet-style editor + dashboards + data catalog UI — admin-tool shape, not a chat box.",
      "Your engine isn't Postgres today (MySQL, MongoDB, Snowflake, BigQuery, ClickHouse, Redshift, MSSQL) — Outerbase ships across all of them now; nlqdb is Postgres-first (ClickHouse Phase 2).",
      "HIPAA or SOC 2 Type 2 certification is a hard requirement today — Outerbase's Enterprise tier carries both; nlqdb is pre-alpha and carries neither yet.",
    ],
    features: [
      { feature: "Owns the database (provisions + migrates)", us: "shipped", them: "no" },
      { feature: "Natural-language → SQL", us: "shipped", them: "shipped" },
      {
        feature: "Auto-migration via NL ('add a column for tags')",
        us: "shipped",
        them: "no",
        note: "Outerbase's editor edits rows + runs queries; schema-evolve via NL is not part of EZQL.",
      },
      {
        feature: "Destructive-op diff preview before apply",
        us: "shipped",
        them: "partial",
        note: "Outerbase's spreadsheet editor confirms row edits inline; the NL-side diff preview is unique to nlqdb.",
      },
      {
        feature: "MCP server (agent-callable)",
        us: "shipped",
        them: "no",
        note: "Outerbase has no public MCP server today; nlqdb ships `nlqdb_query`, `nlqdb_list_databases`, `nlqdb_describe` — `nlqdb_query` materialises Postgres on first reference.",
      },
      {
        feature: "HTML embed element (in-product render)",
        us: "shipped",
        them: "partial",
        note: "Outerbase ships embeddable charts + an API; nlqdb's `<nlq-data>` is a vanilla web component for arbitrary HTML.",
      },
      {
        feature: "Spreadsheet-style row editor / admin browse UI",
        us: "no",
        them: "shipped",
      },
      {
        feature: "Dashboards + data catalog UI",
        us: "no",
        them: "shipped",
      },
      {
        feature: "Multi-engine support beyond Postgres",
        us: "partial",
        them: "shipped",
        note: "Outerbase: Postgres / MySQL / SQLite / MongoDB / ClickHouse / Snowflake / BigQuery / Redshift / MSSQL. nlqdb: Postgres in Phase 1; ClickHouse on the workload-analyser path.",
      },
      {
        feature: "HIPAA + SOC 2 Type 2 compliance",
        us: "no",
        them: "partial",
        note: "Outerbase's Enterprise tier carries both certifications; lower tiers don't surface them. nlqdb is pre-alpha and carries neither.",
      },
      {
        feature: "Unlimited free-tier natural-language queries",
        us: "shipped",
        them: "no",
        note: "Outerbase's Free tier ships documented per-month usage caps; nlqdb's free chain (Groq → Gemini) is rate-limited per principal, not per question/month.",
      },
    ],
    faqs: [
      {
        q: "Outerbase was acquired by Cloudflare in 2025 — is nlqdb still relevant?",
        a: "Different shape, same infra: both run on Cloudflare Workers, but Outerbase remains the admin-UI-on-your-existing-DB product, while nlqdb owns the database and ships an `<nlq-data>` element + MCP server for in-product render and agent provisioning. The acquisition signals demand for the category; it doesn't collapse Outerbase and nlqdb onto the same answer.",
      },
      {
        q: "Can I point Outerbase at an nlqdb database, or nlqdb at an Outerbase-managed DB?",
        a: "Not today. nlqdb's API speaks `/v1/ask` (English) and `/v1/run` (raw SQL with allow-list); Outerbase expects a connection string to a database it doesn't own. Bring-your-own-Postgres is on nlqdb's roadmap but isn't shipped — for an existing production DB today, Outerbase is the right shape.",
      },
      {
        q: "How does nlqdb's NL→SQL compare to Outerbase's EZQL?",
        a: "Both translate English into SQL; the differentiator isn't the translation, it's what surrounds it. nlqdb prompts directly from the live schema fingerprint plus a recent-tables hint and surfaces the compiled SQL under a `Cmd+/` trace toggle. nlqdb also publishes BIRD Mini-Dev + Spider 2.0-lite accuracy to `docs/features/quality-eval/`; Outerbase doesn't publish a single canonical benchmark.",
      },
      {
        q: "Does nlqdb support MySQL, Snowflake, or BigQuery like Outerbase does?",
        a: "Not today. nlqdb is Postgres-first in Phase 1; ClickHouse lands on the workload-analyser path. If your stack is MySQL / Snowflake / BigQuery / Redshift / MSSQL / MongoDB, Outerbase covers it natively and nlqdb does not.",
      },
      {
        q: "Can my AI agent provision an Outerbase-managed DB the way it provisions an nlqdb database?",
        a: "Outerbase is admin-UI shaped — it doesn't expose a provisioning primitive an autonomous agent can call. nlqdb's MCP server (`mcp.nlqdb.com`) exposes `nlqdb_query`, `nlqdb_list_databases`, and `nlqdb_describe` — `nlqdb_query` materialises Postgres on first reference (no separate create-DB verb) — so a Claude / Cursor / Cline agent stands up its own data layer end-to-end.",
      },
      {
        q: "Is nlqdb HIPAA or SOC 2 compliant like Outerbase?",
        a: "No. nlqdb is pre-alpha; neither certification is in place yet. If you're shipping a regulated product today, Outerbase's Enterprise tier (HIPAA + SOC 2 Type 2) is the honest pick; nlqdb's compliance roadmap is downstream of GA.",
      },
    ],
    demo: {
      goal: "today's failed background jobs grouped by service in the last 24 hours",
      why: "The ops query a backend engineer runs from an internal dashboard — Outerbase renders it through a spreadsheet view on your existing DB; nlqdb mints the DB and answers the English goal in one element.",
    },
  },
  {
    slug: "wrenai",
    name: "Wren AI",
    // Commercial homepage; OSS at github.com/Canner/WrenAI (see docs/competitors.md §2).
    url: "https://getwren.ai",
    tagline:
      "Open-source context layer for AI agents — Modeling Definition Language (MDL) semantic model plus row- and column-level access controls over your existing warehouse.",
    persona: "P3 analyst",
    oneLiner:
      "Pick Wren AI if you already run a warehouse (BigQuery, Snowflake, PostgreSQL, DuckDB) and want a semantic model — models, metrics, cubes, RLAC/CLAC — governing every English question an AI agent asks. Pick nlqdb if you want the database itself provisioned, schema evolved via English, and answers rendered inside your app from one HTML element.",
    whenChooseUs: [
      "You need a new database — nlqdb provisions Postgres on the first query.",
      "You want destructive operations and schema changes diff-previewed before they apply, even when triggered by English.",
      "You want one HTML element rendering the answer in-product, not a hosted analytics surface.",
      "An agent provisions its DB via MCP `nlqdb_query` — Wren AI queries an existing warehouse.",
    ],
    whenChooseThem: [
      "You already run a production warehouse (BigQuery, Snowflake, PostgreSQL, DuckDB, …) you can't migrate.",
      "Your team needs a defined semantic model — metrics, cubes, relationships — governing every NL question.",
      "Row- or column-level access controls must apply before any AI agent reads a row.",
      "SOC 2 Type II is required — Wren AI carries it on paid plans only.",
    ],
    features: [
      { feature: "Owns the database (provisions + migrates)", us: "shipped", them: "no" },
      { feature: "Natural-language → SQL", us: "shipped", them: "shipped" },
      {
        feature: "Auto-migration via NL ('add a column for tags')",
        us: "shipped",
        them: "no",
        note: "Wren AI sits on warehouses owned elsewhere; schema migration is not in its lane.",
      },
      {
        feature: "Semantic model / MDL with metrics + cubes",
        us: "no",
        them: "shipped",
        note: "Wren AI's MDL (models, columns, relationships, views, cubes, metrics) is the differentiator over translator-only tools; nlqdb's contract is 'the live schema is the semantic layer'.",
      },
      {
        feature: "Row- and column-level access controls",
        us: "no",
        them: "shipped",
        note: "Wren AI's RLAC/CLAC are part of the MDL primitive; nlqdb's per-DB `sk_live_*` keys scope by database, not by row or column.",
      },
      {
        feature: "Multi-engine support beyond Postgres",
        us: "partial",
        them: "shipped",
        note: "Wren AI's Apache DataFusion engine documents 22+ data sources including PostgreSQL, BigQuery, Snowflake, and DuckDB. nlqdb is Postgres-first in Phase 1; ClickHouse lands on the workload-analyser path.",
      },
      {
        feature: "MCP server (agent-callable)",
        us: "shipped",
        them: "no",
        note: "Wren AI ships a Python SDK, LangChain/LangGraph bindings, and skill bundles for Claude Code; no public MCP server. nlqdb's `nlqdb_query` materialises Postgres on first reference.",
      },
      {
        feature: "Destructive-op diff preview before apply",
        us: "shipped",
        them: "no",
        note: "Wren AI is a context layer over existing warehouses and does not perform DDL; diff preview before write/DDL apply is unique to nlqdb.",
      },
      { feature: "HTML embed element (in-product render)", us: "shipped", them: "no" },
      {
        feature: "SOC 2 Type II certification",
        us: "no",
        them: "partial",
        note: "Wren AI's public pricing page lists SOC 2 Type II on the Essential and Enterprise plans only; the Free plan lists no compliance bullets. nlqdb is pre-alpha and carries neither SOC 2 nor HIPAA yet.",
      },
      {
        feature: "Unlimited free-tier natural-language queries",
        us: "shipped",
        them: "partial",
        note: "Wren AI's Free plan documents a 20-monthly-credit allowance (plus 80 credits for the first 14 days). nlqdb's free chain (Groq → Gemini) is rate-limited per principal, not per question/month.",
      },
      {
        feature: "Open source / self-hostable",
        us: "partial",
        them: "shipped",
        note: "Wren AI is multi-licensed: Apache 2.0 covers `core/`, `sdk/`, `skills/`, `examples/`, and root files; `docs/` is CC-BY-4.0; future modules may land under AGPL-3.0-only per the LICENSE file. nlqdb is source-available on Functional Source License 1.1-ALv2 today; the LICENSE auto-converts to Apache 2.0 after two years (FSL 'ALv2 Future License' clause).",
      },
    ],
    faqs: [
      {
        q: "How does nlqdb's NL→SQL compare to Wren AI's MDL-driven approach?",
        a: "Wren AI requires you to author a Modeling Definition Language file — models, metrics, cubes, relationships — that the LLM consults before writing SQL; the result is governed and reproducible but takes upfront semantic-modelling work. nlqdb prompts directly from the live Postgres schema fingerprint plus a recent-tables hint, with no MDL step. nlqdb publishes BIRD Mini-Dev + Spider 2.0-lite scores to `docs/features/quality-eval/`; as of May 2026, Wren AI does not publish a single canonical accuracy benchmark.",
      },
      {
        q: "Can I point Wren AI at an nlqdb database?",
        a: "Yes — nlqdb provisions Postgres, and Wren AI lists PostgreSQL as one of its 22+ supported sources, so the connection string nlqdb returns slots in as a Wren AI data source. The reverse (nlqdb querying a Wren-AI-managed warehouse) is not supported today: nlqdb owns the database it queries, and bring-your-own-Postgres is on the roadmap rather than shipped.",
      },
      {
        q: "Does nlqdb ship a semantic layer like Wren AI's MDL?",
        a: "No. nlqdb's contract is 'the live schema is the semantic layer' — the schema fingerprint plus recent-tables hint is what the LLM sees, and `<nlq-data>` answers are written against that directly. If your team needs cubes, metrics, or row- and column-level access controls on top of the warehouse, Wren AI's MDL is the right shape and nlqdb does not replicate it today.",
      },
      {
        q: "Is nlqdb SOC 2 certified like Wren AI?",
        a: "No. nlqdb is pre-alpha; SOC 2 Type II is not in place yet. As of May 2026, Wren AI's public pricing page lists SOC 2 Type II on the Essential and Enterprise plans only — the Free plan does not carry it. If you're shipping a regulated product on a Wren AI paid tier today, that compliance posture is honest; nlqdb's compliance roadmap is downstream of GA.",
      },
      {
        q: "Can my AI agent provision a Wren-AI-managed warehouse the way it provisions an nlqdb database?",
        a: "Wren AI is a context layer plus agent toolkit — its Python SDK and LangChain bindings let an agent issue NL queries against an MDL-modelled data source, but the warehouse itself must already exist. nlqdb's MCP server (`mcp.nlqdb.com`) exposes `nlqdb_query`, `nlqdb_list_databases`, and `nlqdb_describe` — `nlqdb_query` materialises Postgres plus schema on first reference — so a Claude / Cursor / Cline agent stands up its own data layer end-to-end without a human in the loop.",
      },
      {
        q: "Wren AI is open source — why not just self-host that?",
        a: "Pick Wren AI's OSS distribution if you want to self-host, audit, and modify the context layer against your own warehouse. The Canner/WrenAI repo is multi-licensed: Apache 2.0 covers `core/`, `sdk/`, `skills/`, `examples/`, and root files; `docs/` is CC-BY-4.0; future modules may land under AGPL-3.0-only per the LICENSE file. Pick nlqdb if you want the database, schema migrations, MCP-driven agent provisioning, and the HTML embed shipped as one product. nlqdb is source-available on Functional Source License 1.1-ALv2 today; the LICENSE auto-converts to Apache 2.0 after two years per the FSL 'ALv2 Future License' clause.",
      },
    ],
    demo: {
      goal: "current month's signups grouped by acquisition channel",
      why: "An analyst question Wren AI's MDL would resolve via a `signups` model and a `channel` dimension on your existing warehouse; nlqdb mints the Postgres database and answers the same English goal against the live schema in one element.",
    },
  },
  {
    slug: "askyourdatabase",
    name: "AskYourDatabase",
    url: "https://askyourdatabase.com",
    tagline:
      "Chat-style AI Data Analyst over an existing database — Desktop App for internal-tool use and an embeddable Website Chatbot for customer-facing BI, across BigQuery, MSSQL, MySQL, PostgreSQL, and Snowflake.",
    persona: "P3 analyst",
    oneLiner:
      "Pick AskYourDatabase if you already run BigQuery, MSSQL, MySQL, PostgreSQL, or Snowflake and want a chat assistant — desktop or embedded — answering English questions over that warehouse with charts and a dashboard builder. Pick nlqdb if you want the database itself provisioned, schema evolved via English, and answers rendered inside your product from one HTML element.",
    whenChooseUs: [
      "You need the database itself — nlqdb provisions Postgres on the first query.",
      "An AI agent should provision and migrate its own database via MCP.",
      "You want destructive operations diff-previewed in plain English before they apply.",
      "You want one HTML element rendering the answer in-product, not a chatbot widget.",
    ],
    whenChooseThem: [
      "You already run BigQuery, MSSQL, MySQL, PostgreSQL, or Snowflake and can't migrate.",
      "Credentials must stay on a local machine — their Desktop App never uploads them.",
      "Your team needs a customer-facing BI chatbot with built-in dashboard builder and embedding.",
      "On-premise deployment is required — their Enterprise plan ships that today.",
    ],
    features: [
      {
        feature: "Owns the database (provisions + migrates)",
        us: "shipped",
        them: "no",
        note: "AskYourDatabase connects to an already-existing warehouse; provisioning is out of scope by design.",
      },
      { feature: "Natural-language → SQL", us: "shipped", them: "shipped" },
      {
        feature: "Auto-migration via NL ('add a column for tags')",
        us: "shipped",
        them: "no",
        note: "AskYourDatabase is read-focused with optional CRUD on the Dashboard Builder; English-driven schema changes are not part of the product.",
      },
      {
        feature: "Destructive-op diff preview before apply",
        us: "shipped",
        them: "no",
        note: "AskYourDatabase sanitises AI-generated SQL and recommends a read-only DB user for SELECT-only workloads; a per-operation diff preview the user confirms is unique to nlqdb.",
      },
      {
        feature: "MCP server (agent-callable)",
        us: "shipped",
        them: "no",
        note: "nlqdb's MCP server exposes `nlqdb_query`, `nlqdb_list_databases`, `nlqdb_describe` — `nlqdb_query` materialises Postgres on first reference, no separate create-DB tool needed. AskYourDatabase ships REST APIs (Ask, Messages, New Chat); no MCP surface today.",
      },
      {
        feature: "Embeddable HTML in product",
        us: "shipped",
        them: "partial",
        note: "AskYourDatabase's Website Chatbot embeds a chat widget on any page; nlqdb's `<nlq-data>` is a goal-shaped element answering inline in the product layout, not a chat surface.",
      },
      {
        feature: "Customer-facing BI chatbot + dashboard builder",
        us: "partial",
        them: "shipped",
        note: "AskYourDatabase ships a real-time Dashboard Builder plus chatbot embed targeted at customer-facing BI; nlqdb today renders one in-product answer per `<nlq-data>` element rather than a hosted chatbot.",
      },
      {
        feature: "Multi-engine support beyond Postgres",
        us: "partial",
        them: "shipped",
        note: "AskYourDatabase documents BigQuery, MSSQL, MySQL, PostgreSQL, and Snowflake as supported engines. nlqdb is Postgres-first in Phase 1; ClickHouse lands on the workload-analyser path.",
      },
      { feature: "Anonymous mode (try before sign-in)", us: "shipped", them: "no" },
      {
        feature: "SOC 2 Type 2 certification",
        us: "no",
        them: "partial",
        note: "AskYourDatabase's public security portal documents an in-progress SOC 2 Type 2 audit, originally anticipated to complete December 2025 — check their current security page for the live status. nlqdb is pre-alpha and carries neither SOC 2 nor HIPAA today.",
      },
      {
        feature: "On-premise / self-hosted deployment",
        us: "no",
        them: "shipped",
        note: "AskYourDatabase ships an Enterprise on-premise deployment option; nlqdb is Cloudflare-Workers-hosted in Phase 1.",
      },
    ],
    faqs: [
      {
        q: "Can I keep my existing Postgres or MySQL database and use AskYourDatabase the way I'd use nlqdb?",
        a: "AskYourDatabase is built for that case — you point the Desktop App or Website Chatbot at an existing warehouse (BigQuery, MSSQL, MySQL, PostgreSQL, Snowflake) and the product does not provision anything new. nlqdb today owns the database it queries; bring-your-own-Postgres is on the roadmap, not shipped. If your data already lives in BigQuery or Snowflake, AskYourDatabase is the right shape; if you're starting from zero or want an AI agent to stand the database up, nlqdb is.",
      },
      {
        q: "How does AskYourDatabase's chatbot embed compare to nlqdb's `<nlq-data>` element?",
        a: "AskYourDatabase's Website Chatbot embeds a chat widget — your users open a conversation, ask questions, and the widget renders answers, charts, and follow-up turns. nlqdb's `<nlq-data>` is a goal-shaped HTML element: it takes one English question via attribute and renders the answer inline in your product layout, with a trace toggle revealing the compiled SQL. Pick the chatbot if the shape your customer expects is conversation; pick the element if the shape is in-product UI.",
      },
      {
        q: "Is AskYourDatabase SOC 2 certified?",
        a: "AskYourDatabase's public security portal (verified June 2026) documents an in-progress SOC 2 Type 2 audit, originally anticipated to complete December 2025 — the certification is not yet attested on the free product, and the live security page is the source of truth for the current status. nlqdb is pre-alpha and carries neither SOC 2 nor HIPAA today. If a documented compliance posture is required, their Enterprise on-premise deployment may also be relevant — it keeps the data inside your network perimeter.",
      },
      {
        q: "Can an AI agent provision its own database with AskYourDatabase the way it can with nlqdb's MCP server?",
        a: "AskYourDatabase exposes REST APIs (Ask API, Messages API, New Chat API) over an already-connected database — an agent can drive the chatbot but cannot stand up the underlying warehouse. nlqdb's MCP server (`mcp.nlqdb.com`) exposes `nlqdb_query`, `nlqdb_list_databases`, and `nlqdb_describe`; `nlqdb_query` materialises Postgres plus schema on first reference (no separate create-DB verb the agent has to learn), so a Claude / Cursor / Cline agent stands up its own data layer end-to-end without a human in the loop.",
      },
      {
        q: "What about destructive SQL — does AskYourDatabase preview the operation before it runs?",
        a: "AskYourDatabase's security portal documents query sanitisation against the AI-generated SQL plus an explicit recommendation to whitelist their fixed IP and use a read-only DB user for SELECT-only workloads. nlqdb's contract is different — write and DDL operations trigger a diff preview the user must confirm before the operation applies, with the compiled SQL visible in the trace.",
      },
      {
        q: "Why pick nlqdb over AskYourDatabase if my data already lives in MySQL?",
        a: "If your data already lives in MySQL and the shape you need is 'embed a chat over the warehouse', AskYourDatabase is the right pick today — nlqdb is Postgres-first in Phase 1 and bring-your-own-MySQL is not shipped. nlqdb wins when you (a) need the database itself plus English-driven migrations, (b) want an AI agent to provision the warehouse end-to-end via MCP, or (c) want one HTML element answering a goal in-product rather than a chat widget.",
      },
    ],
    demo: {
      goal: "this month's signups grouped by acquisition channel, top 10 only",
      why: "An analyst question AskYourDatabase would answer via the Desktop App or embed-chat over your existing warehouse; nlqdb mints the Postgres database and renders the answer in one `<nlq-data>` element against the live schema.",
    },
  },
  {
    slug: "zep",
    name: "Zep",
    url: "https://www.getzep.com",
    // Agent-memory cluster anchored in docs/competitors.md §4 (verified 2026-06-19).
    // Built on Graphiti (OSS temporal knowledge-graph core); hosted platform is commercial.
    tagline:
      "Agent-memory platform built on Graphiti — a temporal knowledge graph storing facts as nodes with start/end validity windows plus entity resolution across conversation and business data.",
    persona: "P2 agent builder",
    oneLiner:
      "Pick Zep if your agent needs a temporal knowledge graph — point-in-time fact recall and entity resolution tuned for conversation. Pick nlqdb if your agent also needs to aggregate that memory: GROUP BY, JOIN, and HAVING over structured rows it provisions and migrates itself in plain English.",
    whenChooseUs: [
      "Your agent must aggregate its memory (GROUP BY, JOIN, HAVING), not just recall facts.",
      "You store structured rows the agent later reports over ('deals per stage this quarter').",
      "The schema should evolve as the agent learns ('add a `priority` field') via English.",
      "One MCP server should provision, query, and migrate the agent's data layer.",
    ],
    whenChooseThem: [
      "You need a temporal knowledge graph with point-in-time fact validity and entity resolution.",
      "Memory is conversational — relevant-fact retrieval matters more than typed SQL aggregation.",
      "You want published memory benchmarks (LongMemEval, Deep Memory Retrieval) and a proven recall engine.",
      "An OSS knowledge-graph core you can self-host (Graphiti) is on your shortlist.",
    ],
    features: [
      { feature: "Owns the database (provisions + migrates)", us: "shipped", them: "no" },
      {
        feature: "Natural-language → SQL",
        us: "shipped",
        them: "no",
        note: "Zep stores facts as knowledge-graph nodes; agents retrieve via graph search, not by compiling English to SQL.",
      },
      {
        feature: "Aggregations + reporting queries (GROUP BY / JOIN / HAVING over memory)",
        us: "shipped",
        them: "no",
        note: "Zep's graph returns the facts most relevant to a query; it has no query planner to aggregate across them.",
      },
      {
        feature: "Temporal knowledge graph (point-in-time fact validity)",
        us: "no",
        them: "shipped",
        note: "Graphiti's start/end validity windows are Zep's core primitive; nlqdb stores typed rows, not time-bounded graph edges.",
      },
      {
        feature: "Entity resolution across conversation + business data",
        us: "no",
        them: "shipped",
      },
      {
        feature: "Auto-migration via NL ('add a `priority` field')",
        us: "shipped",
        them: "no",
      },
      {
        feature: "MCP server (agent-callable)",
        us: "shipped",
        them: "partial",
        note: "Graphiti ships an experimental MCP server exposing graph add/search; nlqdb's MCP exposes `nlqdb_query` / `nlqdb_list_databases` / `nlqdb_describe`, and `nlqdb_query` materialises Postgres on first reference.",
      },
      {
        feature: "Vector / semantic recall over conversation history",
        us: "no",
        them: "shipped",
        note: "Recall is Zep's lane; nlqdb answers with structured SQL and ships no embedding-based recall today.",
      },
      {
        feature: "Published recall benchmarks (LongMemEval, DMR)",
        us: "no",
        them: "shipped",
        note: "Zep publishes memory-recall benchmarks; nlqdb publishes NL→SQL execution accuracy (BIRD Mini-Dev + Spider 2.0-lite) — different axes.",
      },
      {
        feature: "Open source / self-hostable",
        us: "partial",
        them: "partial",
        note: "Graphiti's knowledge-graph core is open source and self-hostable; the Zep platform is commercial. nlqdb is source-available on FSL 1.1-ALv2, auto-converting to Apache 2.0 after two years.",
      },
    ],
    faqs: [
      {
        q: "Can I use Zep for conversational recall and nlqdb for analytics over the same memory?",
        a: "Yes — they compose. Zep's temporal knowledge graph handles 'what does the agent remember about Kendra right now'; nlqdb handles 'average deal size per stage across everything the agent logged'. Run Zep as the recall layer and nlqdb as the analytical store the agent queries with SQL.",
      },
      {
        q: "Does nlqdb store a knowledge graph with temporal validity like Zep?",
        a: "No. nlqdb is Postgres-first — typed rows in tables, not graph nodes with start/end validity windows. If point-in-time fact validity and entity resolution across conversation are core to your agent, Zep (built on Graphiti) is the right shape; nlqdb's contract is relational SQL over the rows the agent provisions.",
      },
      {
        q: "Zep ships a Graphiti MCP server — how is nlqdb's MCP different?",
        a: "Graphiti's MCP server exposes graph operations — add an episode, search the graph for relevant facts. nlqdb's MCP server (`mcp.nlqdb.com`) exposes `nlqdb_query`, `nlqdb_list_databases`, and `nlqdb_describe`; `nlqdb_query` materialises Postgres plus schema on first reference and runs aggregating SQL, so the agent reports over its memory instead of only retrieving from it.",
      },
      {
        q: "How does nlqdb's accuracy compare to Zep's memory benchmarks?",
        a: "They measure different axes. Zep publishes memory-recall benchmarks (LongMemEval, Deep Memory Retrieval) — how well it returns the right fact. nlqdb publishes NL→SQL execution accuracy (BIRD Mini-Dev + Spider 2.0-lite) to `docs/features/quality-eval/` — how well it turns an English question into correct SQL. Pick the benchmark that matches the job.",
      },
      {
        q: "Can my AI agent provision its own store with Zep the way it can with nlqdb?",
        a: "Zep is a hosted memory service (with the OSS Graphiti core you can self-host) — an agent reads and writes facts but doesn't stand up its own isolated database. nlqdb's MCP `nlqdb_query` materialises a tenant-scoped Postgres plus schema on first reference, so a Claude / Cursor / Cline agent provisions and migrates its data layer end-to-end without a human in the loop.",
      },
    ],
    demo: {
      goal: "top 10 topics the agent logged this month, ranked by mention count",
      why: "The aggregation Zep's retrieval graph can't run — it returns relevant facts, not a GROUP BY / COUNT ranking; nlqdb answers it as SQL over the agent's own memory.",
    },
  },
  {
    slug: "letta",
    name: "Letta",
    url: "https://www.letta.com",
    // Agent-memory cluster anchored in docs/competitors.md §4 (verified 2026-06-19);
    // facts re-checked via web search 2026-06-19. Apache-2.0 agent runtime out of the
    // 2023 Berkeley MemGPT paper; OS-style memory tiers; self-host or hosted.
    tagline:
      "Open-source (Apache-2.0) agent runtime with persistent memory built in — OS-style tiers: core blocks the agent self-edits, searchable recall, and an archival store queried via tool calls.",
    persona: "P2 agent builder",
    oneLiner:
      "Pick Letta if you want a stateful agent runtime that manages its own memory like an OS — self-editing core blocks plus a searchable archive. Pick nlqdb if your agent also needs to aggregate that memory: GROUP BY, JOIN, and HAVING over structured rows it provisions and migrates itself in plain English.",
    whenChooseUs: [
      "Your agent must aggregate its memory (GROUP BY, JOIN, HAVING), not just recall facts.",
      "You store structured rows the agent later reports over ('deals per stage this quarter').",
      "The schema should evolve as the agent learns ('add a `priority` field') via English.",
      "You want a data layer that drops into any runtime, not a runtime itself.",
    ],
    whenChooseThem: [
      "You want a full stateful agent runtime, not just a store the agent queries.",
      "OS-style self-editing memory (core / recall / archival tiers) is the model you need.",
      "You want an Apache-2.0 core you can self-host with no source-available terms.",
      "Memory is prose the agent edits and searches — relevant-fact retrieval over typed SQL.",
    ],
    features: [
      { feature: "Owns the database (provisions + migrates)", us: "shipped", them: "no" },
      {
        feature: "Natural-language → SQL",
        us: "shipped",
        them: "no",
        note: "Letta's agent reads and writes memory through tool calls (core-block edits, recall/archival search); it has no NL→SQL compiler over a relational store.",
      },
      {
        feature: "Aggregations + reporting queries (GROUP BY / JOIN / HAVING over memory)",
        us: "shipped",
        them: "no",
        note: "Letta can recall 'Alice has a $50k deal' but can't answer 'average deal size per stage' — there is no relational query layer over the memory tiers.",
      },
      {
        feature: "OS-style self-editing memory tiers (core / recall / archival)",
        us: "no",
        them: "shipped",
        note: "Editable core blocks always in context, plus searchable recall and archival, are Letta's core primitive; nlqdb stores typed rows in Postgres tables, not self-edited memory blocks.",
      },
      {
        feature: "Stateful agent runtime (the agent loop itself)",
        us: "no",
        them: "shipped",
        note: "Letta runs the agent; nlqdb is the data layer that any runtime — Letta included — can provision and query. They compose: Letta the runtime, nlqdb the analytical store.",
      },
      {
        feature: "Auto-migration via NL ('add a `priority` field')",
        us: "shipped",
        them: "no",
      },
      {
        feature: "MCP server (agent-callable)",
        us: "shipped",
        them: "partial",
        note: "Letta supports MCP integration (it can consume MCP tools and exposes its agents over MCP); nlqdb's MCP exposes `nlqdb_query` / `nlqdb_list_databases` / `nlqdb_describe`, and `nlqdb_query` materialises Postgres on first reference.",
      },
      {
        feature: "Vector / semantic recall over archived memory",
        us: "no",
        them: "shipped",
        note: "Letta's archival tier indexes memory with embeddings for semantic search; nlqdb answers with structured SQL and ships no embedding-based recall today.",
      },
      {
        feature: "Open source / self-hostable",
        us: "partial",
        them: "shipped",
        note: "Letta is Apache-2.0 (self-host or hosted). nlqdb is source-available on FSL 1.1-ALv2, auto-converting to Apache 2.0 after two years.",
      },
    ],
    faqs: [
      {
        q: "Can I use Letta as the agent runtime and nlqdb as the store it queries?",
        a: "Yes — they compose. Letta runs the stateful agent and manages its OS-style memory tiers; nlqdb is the analytical store the agent provisions and queries with SQL. Use Letta for the agent loop and self-edited recall, nlqdb for 'average deal size per stage across everything the agent logged'.",
      },
      {
        q: "Does nlqdb give an agent self-editing memory tiers like Letta's core / recall / archival?",
        a: "No. nlqdb is Postgres-first — typed rows in tables, not self-edited prose blocks in a context window. If OS-style memory the agent rewrites itself is core to your design, Letta (out of the MemGPT paper) is the right shape; nlqdb's contract is relational SQL over the rows the agent provisions.",
      },
      {
        q: "Letta supports MCP — how is nlqdb's MCP different?",
        a: "Letta's MCP support lets its agent consume external tools and exposes Letta agents to MCP clients. nlqdb's MCP server (`mcp.nlqdb.com`) exposes `nlqdb_query`, `nlqdb_list_databases`, and `nlqdb_describe`; `nlqdb_query` materialises Postgres plus schema on first reference and runs aggregating SQL, so the agent reports over its memory instead of only retrieving from it.",
      },
      {
        q: "Can Letta aggregate an agent's memory the way nlqdb can?",
        a: "Not relationally. Letta's archival memory is searched semantically and recall is conversation history — both return relevant entries, not a GROUP BY / JOIN / HAVING result set. nlqdb compiles the English question to SQL and runs it over typed rows, so the agent gets a real aggregation, not a ranked list of matches.",
      },
      {
        q: "Can my AI agent provision its own store with Letta the way it can with nlqdb?",
        a: "Letta provisions an agent with memory tiers, but the archival store is backed by a database you configure — it doesn't stand up an isolated relational database the agent migrates. nlqdb's MCP `nlqdb_query` materialises a tenant-scoped Postgres plus schema on first reference, so a Claude / Cursor / Cline agent provisions and migrates its data layer end-to-end without a human in the loop.",
      },
    ],
    demo: {
      goal: "average deal size per stage across everything the agent logged this quarter",
      why: "The relational aggregation Letta's memory tiers can't run — recall and archival search return relevant entries, not a GROUP BY / AVG result; nlqdb answers it as SQL over the agent's own memory.",
    },
  },
  {
    slug: "langmem",
    name: "LangMem",
    url: "https://langchain-ai.github.io/langmem/",
    // Agent-memory cluster anchored in docs/competitors.md §4 (verified 2026-06-19);
    // facts re-checked via web search 2026-06-19. Open-source LangChain SDK (PyPI
    // `langmem`); semantic/episodic/procedural memory with an LLM-managed extractor,
    // tightly integrated with LangGraph's BaseStore / LangGraph Platform.
    tagline:
      "Open-source LangChain SDK for agent long-term memory — semantic, episodic, and procedural memory an LLM extracts and consolidates, persisted through LangGraph's BaseStore.",
    persona: "P2 agent builder",
    oneLiner:
      "Pick LangMem if you want long-term memory wired into a LangGraph agent — semantic, episodic, and procedural memory the LLM extracts and consolidates for you. Pick nlqdb if your agent also needs to aggregate that memory: GROUP BY, JOIN, and HAVING over structured rows it provisions and migrates itself in plain English.",
    whenChooseUs: [
      "Your agent must aggregate its memory (GROUP BY, JOIN, HAVING), not just recall facts.",
      "You store structured rows the agent later reports over ('deals per stage this quarter').",
      "The schema should evolve as the agent learns ('add a `priority` field') via English.",
      "You want a framework-agnostic data layer, not memory tools locked to LangGraph.",
    ],
    whenChooseThem: [
      "You're building on LangChain / LangGraph and want memory native to that stack.",
      "You need semantic, episodic, and procedural memory the LLM extracts and consolidates automatically.",
      "Memory is prose facts retrieved by similarity — relevant-fact recall over typed SQL aggregation.",
      "You want procedural memory: the agent refines its own prompts and behavior over time.",
    ],
    features: [
      { feature: "Owns the database (provisions + migrates)", us: "shipped", them: "no" },
      {
        feature: "Natural-language → SQL",
        us: "shipped",
        them: "no",
        note: "LangMem extracts and searches memories through its SDK; it has no NL→SQL compiler over a relational store.",
      },
      {
        feature: "Aggregations + reporting queries (GROUP BY / JOIN / HAVING over memory)",
        us: "shipped",
        them: "no",
        note: "LangMem returns the memories most similar to a query; it has no query planner to aggregate across them.",
      },
      {
        feature: "Semantic / episodic / procedural memory (LLM-managed)",
        us: "no",
        them: "shipped",
        note: "A unified API over fact, experience, and behavior memory is LangMem's core primitive; nlqdb stores typed rows, not LLM-extracted memory objects.",
      },
      {
        feature: "Background memory manager (auto extract / consolidate / update)",
        us: "no",
        them: "shipped",
        note: "LangMem's manager reviews conversations and decides what to store, update, or forget; nlqdb persists exactly the rows the agent writes.",
      },
      {
        feature: "Procedural memory / prompt self-optimization",
        us: "no",
        them: "shipped",
      },
      {
        feature: "Auto-migration via NL ('add a `priority` field')",
        us: "shipped",
        them: "no",
      },
      {
        feature: "MCP server (agent-callable)",
        us: "shipped",
        them: "no",
        note: "LangMem is an in-process Python SDK (memory tools the agent calls inside a LangGraph app), not an MCP server; nlqdb's MCP exposes `nlqdb_query` / `nlqdb_list_databases` / `nlqdb_describe`, and `nlqdb_query` materialises Postgres on first reference.",
      },
      {
        feature: "Vector / semantic recall over stored memory",
        us: "no",
        them: "shipped",
        note: "Similarity search over stored memories is LangMem's lane; nlqdb answers with structured SQL and ships no embedding-based recall today.",
      },
      {
        feature: "Open source / self-hostable",
        us: "partial",
        them: "shipped",
        note: "LangMem is an open-source LangChain SDK (PyPI `langmem`), self-hosted inside your app. nlqdb is source-available on FSL 1.1-ALv2, auto-converting to Apache 2.0 after two years.",
      },
    ],
    faqs: [
      {
        q: "Can I use LangMem for memory management and nlqdb for analytics over the same data?",
        a: "Yes — they compose. LangMem extracts and consolidates memories inside the LangGraph agent; nlqdb is the analytical store the agent queries with SQL. Use LangMem for 'what does the agent remember about Kendra' and nlqdb for 'average deal size per stage across everything the agent logged'.",
      },
      {
        q: "Does nlqdb extract and consolidate memories automatically like LangMem?",
        a: "No. nlqdb persists exactly the rows the agent writes; it has no LLM background manager deciding what to remember, update, or forget. If automatic semantic / episodic / procedural extraction is core to your design, LangMem is the right shape; nlqdb's contract is relational SQL over the rows the agent provisions.",
      },
      {
        q: "Is nlqdb tied to LangChain / LangGraph like LangMem?",
        a: "No. LangMem integrates most seamlessly with LangGraph's BaseStore and the LangGraph Platform. nlqdb is framework-agnostic — any runtime (Claude, Cursor, Cline, or a LangGraph agent) calls it over HTTP or MCP, so the data layer isn't coupled to one agent stack.",
      },
      {
        q: "Can LangMem aggregate an agent's memory the way nlqdb can?",
        a: "Not relationally. LangMem retrieves memories by similarity and its background manager consolidates them, but neither returns a GROUP BY / JOIN / HAVING result set. nlqdb compiles the English question to SQL and runs it over typed rows, so the agent gets a real aggregation, not a ranked list of matches.",
      },
      {
        q: "Can my AI agent provision its own store with LangMem the way it can with nlqdb?",
        a: "LangMem stores memories in a backend you configure through LangGraph's BaseStore (Postgres, a vector DB, or KV) — it doesn't stand up an isolated relational database the agent migrates. nlqdb's MCP `nlqdb_query` materialises a tenant-scoped Postgres plus schema on first reference, so a Claude / Cursor / Cline agent provisions and migrates its data layer end-to-end without a human in the loop.",
      },
    ],
    demo: {
      goal: "distinct users who asked about pricing each week this quarter",
      why: "The aggregation LangMem's similarity search can't run — it returns the memories most relevant to a query, not a COUNT(DISTINCT) per week; nlqdb answers it as SQL over the agent's own memory.",
    },
  },
  {
    slug: "pinecone",
    name: "Pinecone",
    url: "https://www.pinecone.io",
    // Agent-memory cluster (vector-store wing) anchored in docs/competitors.md
    // §Pinecone. Facts verified via web search 2026-06-22: serverless is the
    // 2026 default; Starter (free, 1 index / ~2GB) · Builder $20/mo · Standard
    // $50/mo min · Enterprise $500/mo min; billed on read units / write units /
    // storage. No SQL interface, no joins, no transactions, no aggregations —
    // nearest-neighbour + metadata filter only. Official Developer + Assistant
    // MCP servers ship (create-index / upsert / search-records).
    tagline:
      "Managed serverless vector database — nearest-neighbour similarity search over embeddings with metadata filtering, plus hosted embedding and reranking (Pinecone Inference).",
    persona: "P2 agent builder",
    oneLiner:
      "Pick Pinecone if your agent retrieves by semantic similarity — nearest-neighbour search over embeddings with metadata filters, plus hosted embedding and reranking. Pick nlqdb if your agent must aggregate what it stored: GROUP BY, JOIN, and HAVING over typed rows it provisions and migrates itself in plain English. Pinecone finds the similar; nlqdb counts, groups, and ranks.",
    whenChooseUs: [
      "Your agent must aggregate its memory (GROUP BY, JOIN, HAVING), not just find similar items.",
      "You store structured rows the agent later reports over ('deals per stage this quarter').",
      "You want exact filters and counts, not approximate nearest-neighbour ranking, over memory.",
      "The schema should evolve as the agent learns ('add a `priority` field') via English.",
    ],
    whenChooseThem: [
      "Your agent retrieves by semantic similarity — nearest-neighbour over text or image embeddings.",
      "Recall is the job: RAG context, related-document lookup, fuzzy 'find what's like this'.",
      "You want hosted embedding and reranking models in the pipeline (Pinecone Inference).",
      "You need proven large-scale vector search on a serverless pay-per-use model.",
    ],
    features: [
      { feature: "Owns the database (provisions + migrates)", us: "shipped", them: "no" },
      {
        feature: "Natural-language → SQL",
        us: "shipped",
        them: "no",
        note: "Pinecone takes a query vector plus a metadata filter; it has no English-to-SQL compiler.",
      },
      {
        feature: "Aggregations + reporting queries (GROUP BY / JOIN / HAVING over memory)",
        us: "shipped",
        them: "no",
        note: "Pinecone returns the top-k most similar vectors; it ships no SQL engine, no joins, and no transactions.",
      },
      {
        feature: "Vector / semantic similarity search over memory",
        us: "no",
        them: "shipped",
        note: "Nearest-neighbour over embeddings is Pinecone's core primitive; nlqdb stores typed rows and ships no embedding search today.",
      },
      {
        feature: "Hosted embedding + reranking models (Pinecone Inference)",
        us: "no",
        them: "shipped",
      },
      {
        feature: "Filtering on retrieval",
        us: "partial",
        them: "shipped",
        note: "nlqdb filters with exact SQL WHERE over typed columns; Pinecone filters vectors by metadata around the ANN search.",
      },
      {
        feature: "Auto-migration via NL ('add a `priority` field')",
        us: "shipped",
        them: "no",
      },
      {
        feature: "MCP server (agent-callable)",
        us: "shipped",
        them: "shipped",
        note: "Pinecone's Developer MCP creates a vector index and upserts/searches records; nlqdb's `nlqdb_query` materialises Postgres on first reference and runs aggregating SQL.",
      },
      {
        feature: "Open source / self-hostable",
        us: "partial",
        them: "no",
        note: "Pinecone is hosted-only and proprietary; nlqdb is source-available on FSL 1.1-ALv2, auto-converting to Apache 2.0 after two years.",
      },
    ],
    faqs: [
      {
        q: "Can I use Pinecone for semantic recall and nlqdb for analytics over the same agent memory?",
        a: "Yes — they compose. Pinecone handles 'find the memories most similar to this question' via nearest-neighbour search; nlqdb handles 'how many tools did the agent call per category this week' via SQL. Run Pinecone as the recall layer and nlqdb as the analytical store the agent queries with GROUP BY / JOIN / HAVING.",
      },
      {
        q: "Does nlqdb do vector / similarity search like Pinecone?",
        a: "No. nlqdb is Postgres-first — typed rows queried with exact SQL, not embeddings ranked by cosine distance. If approximate nearest-neighbour search over text or image vectors is the job, Pinecone is the right shape; nlqdb's contract is relational SQL over the rows the agent provisions.",
      },
      {
        q: "Pinecone has metadata filtering — isn't that the same as nlqdb's SQL WHERE?",
        a: "Not quite. Pinecone's metadata filter narrows candidates around an approximate nearest-neighbour search, so the result is still a similarity ranking. nlqdb runs exact SQL — WHERE, GROUP BY, COUNT, JOIN — and returns a precise result set, not the top-k closest vectors. Different jobs: one finds similar, the other computes answers.",
      },
      {
        q: "How does pricing compare to Pinecone's serverless model?",
        a: "Pinecone serverless bills on read units, write units, and storage above a free Starter index (Builder is $20/mo, Standard $50/mo minimum). nlqdb's free chain is forever (BYO-LLM at 0% markup); hosted premium adds a flat sub with an included allowance and soft-meter overage. Until monetization ships, everything is free.",
      },
      {
        q: "Can my AI agent provision its own store with Pinecone the way it can with nlqdb?",
        a: "Pinecone's MCP server can create a vector index and upsert records, but the agent gets a similarity store, not a relational database it can aggregate or migrate. nlqdb's MCP `nlqdb_query` materialises a tenant-scoped Postgres plus schema on first reference, so a Claude / Cursor / Cline agent stands up and reports over its data layer end-to-end without a human in the loop.",
      },
    ],
    demo: {
      goal: "the 10 tools the agent called most this week, ranked by call count",
      why: "The aggregation Pinecone's similarity search can't run — it returns the vectors nearest a query, not a GROUP BY / COUNT ranking; nlqdb answers it as SQL over the agent's own memory.",
    },
  },
  {
    slug: "chroma",
    name: "Chroma",
    url: "https://www.trychroma.com",
    // Agent-memory cluster (vector-store wing, OSS-first) anchored in
    // docs/competitors.md §Chroma. Facts verified via web search + the
    // official pricing page 2026-06-22: Apache-2.0 open-source, runs
    // embedded/in-memory or self-hosted, plus serverless Chroma Cloud —
    // Starter $0/mo + usage ($5 free credits) · Team $250/mo + usage
    // ($100 credits) · Enterprise custom; usage billed on write ($2.50/GiB),
    // storage ($0.33/GiB-mo), query ($0.0075/TiB), egress ($0.09/GiB).
    // Primitives: vector similarity + full-text + metadata filtering. No SQL,
    // no joins, no transactions, no aggregations. Official `chroma-mcp` server
    // ships (create-collection / add / query / metadata filter).
    tagline:
      "Open-source embedding database — vector similarity, full-text, and metadata search over documents; runs embedded, self-hosted, or on serverless Chroma Cloud.",
    persona: "P2 agent builder",
    oneLiner:
      "Pick Chroma if your agent recalls by similarity and you want an open-source store you can run embedded or self-hosted — nearest-neighbour plus full-text and metadata filtering. Pick nlqdb if your agent must aggregate what it stored: GROUP BY, JOIN, and HAVING over typed rows it provisions in plain English. Chroma finds the similar; nlqdb counts, groups, and ranks.",
    whenChooseUs: [
      "Your agent must aggregate its memory (GROUP BY, JOIN, HAVING), not just find similar items.",
      "You store structured rows the agent later reports over ('deals per stage this quarter').",
      "You want exact filters and counts, not approximate nearest-neighbour ranking, over memory.",
      "The schema should evolve as the agent learns ('add a `priority` field') via English.",
    ],
    whenChooseThem: [
      "Your agent recalls by semantic similarity — nearest-neighbour over text or document embeddings.",
      "RAG context or related-document lookup is the job, often with full-text search alongside.",
      "You want an open-source store you can run embedded in-process or self-host yourself.",
      "You're prototyping locally and want a zero-config vector store before any cloud.",
    ],
    features: [
      { feature: "Owns the database (provisions + migrates)", us: "shipped", them: "no" },
      {
        feature: "Natural-language → SQL",
        us: "shipped",
        them: "no",
        note: "Chroma takes a query embedding (or text) plus a metadata filter; it has no English-to-SQL compiler.",
      },
      {
        feature: "Aggregations + reporting queries (GROUP BY / JOIN / HAVING over memory)",
        us: "shipped",
        them: "no",
        note: "Chroma returns the top-k most similar documents; it ships no SQL engine, no joins, and no transactions.",
      },
      {
        feature: "Vector / semantic similarity search over memory",
        us: "no",
        them: "shipped",
        note: "Nearest-neighbour over embeddings is Chroma's core primitive; nlqdb stores typed rows and ships no embedding search today.",
      },
      {
        feature: "Full-text search over stored documents",
        us: "partial",
        them: "shipped",
        note: "Chroma indexes documents for full-text + vector search; nlqdb matches text with SQL LIKE / pattern predicates, not a ranked text index.",
      },
      {
        feature: "Filtering on retrieval",
        us: "partial",
        them: "shipped",
        note: "nlqdb filters with exact SQL WHERE over typed columns; Chroma filters by metadata around the nearest-neighbour search.",
      },
      {
        feature: "Auto-migration via NL ('add a `priority` field')",
        us: "shipped",
        them: "no",
      },
      {
        feature: "MCP server (agent-callable)",
        us: "shipped",
        them: "shipped",
        note: "Chroma's `chroma-mcp` creates collections and adds/queries documents by similarity; nlqdb's `nlqdb_query` materialises Postgres on first reference and runs aggregating SQL.",
      },
      {
        feature: "Open source / self-hostable",
        us: "partial",
        them: "shipped",
        note: "Chroma is Apache-2.0 and runs embedded or self-hosted; nlqdb is source-available on FSL 1.1-ALv2, auto-converting to Apache 2.0 after two years.",
      },
    ],
    faqs: [
      {
        q: "Can I use Chroma for semantic recall and nlqdb for analytics over the same agent memory?",
        a: "Yes — they compose. Chroma handles 'find the documents most similar to this question' via nearest-neighbour and full-text search; nlqdb handles 'how many tools did the agent call per category this week' via SQL. Run Chroma as the recall layer and nlqdb as the analytical store the agent queries with GROUP BY / JOIN / HAVING.",
      },
      {
        q: "Does nlqdb do vector / similarity search like Chroma?",
        a: "No. nlqdb is Postgres-first — typed rows queried with exact SQL, not embeddings ranked by distance. If approximate nearest-neighbour search over text or document vectors is the job, Chroma is the right shape; nlqdb's contract is relational SQL over the rows the agent provisions.",
      },
      {
        q: "Chroma is open source and self-hostable — is nlqdb?",
        a: "nlqdb is source-available under FSL 1.1 (Functional Source License), which auto-converts to Apache 2.0 two years after each release; Chroma is Apache 2.0 today and runs embedded in-process or self-hosted. Both let you keep your data; they differ on the query model, not on lock-in — Chroma does vector + full-text recall, nlqdb does relational SQL.",
      },
      {
        q: "Chroma has metadata filtering — isn't that the same as nlqdb's SQL WHERE?",
        a: "Not quite. Chroma's metadata filter narrows candidates around a nearest-neighbour search, so the result is still a similarity ranking. nlqdb runs exact SQL — WHERE, GROUP BY, COUNT, JOIN — and returns a precise result set, not the top-k closest documents. Different jobs: one finds similar, the other computes answers.",
      },
      {
        q: "Can my AI agent provision its own store with Chroma the way it can with nlqdb?",
        a: "Chroma's `chroma-mcp` server can create a collection and add documents, but the agent gets a similarity store, not a relational database it can aggregate or migrate. nlqdb's MCP `nlqdb_query` materialises a tenant-scoped Postgres plus schema on first reference, so a Claude / Cursor / Cline agent stands up and reports over its data layer end-to-end without a human in the loop.",
      },
    ],
    demo: {
      goal: "the 10 tools the agent called most this week, ranked by call count",
      why: "The aggregation Chroma's similarity search can't run — it returns the documents nearest a query, not a GROUP BY / COUNT ranking; nlqdb answers it as SQL over the agent's own memory.",
    },
  },
  {
    slug: "weaviate",
    name: "Weaviate",
    url: "https://weaviate.io",
    // Agent-memory cluster (vector-store wing, enterprise/hybrid-search) anchored
    // in docs/competitors.md §Weaviate. Facts verified via web search + the
    // official GitHub + pricing page 2026-06-22: BSD-3-Clause open source
    // (self-host is full-featured and free), plus Weaviate Cloud — Sandbox
    // (14-day, auto-expires) · Flex ($45/mo min, shared GCP, 99.5% SLA) · Plus
    // ($280/mo annual, 99.9% SLA, SOC 2) · Premium (custom, BYOC, HIPAA);
    // vector-dimension billing ($0.01668 / M dims-mo from Oct 2025).
    // Primitives: vector similarity + BM25 keyword + first-class hybrid search,
    // metadata filtering, RAG/generative, reranking, multimodal. Enterprise:
    // built-in multi-tenancy, replication, RBAC. No SQL, no joins, no GROUP BY
    // aggregations, no transactions. Official `mcp-server-weaviate` ships
    // (insert objects + hybrid search).
    tagline:
      "Open-source, cloud-native vector database — first-class hybrid search (BM25 + vector), metadata filtering, multi-tenancy, and replication; self-host on BSD-3 or run on Weaviate Cloud.",
    persona: "P2 agent builder",
    oneLiner:
      "Pick Weaviate if your agent recalls by hybrid search — BM25 keyword fused with vector similarity — at enterprise scale with multi-tenancy, replication, and RBAC. Pick nlqdb if your agent must aggregate what it stored: GROUP BY, JOIN, and HAVING over typed rows it provisions in plain English. Weaviate ranks the relevant; nlqdb counts, groups, and reports.",
    whenChooseUs: [
      "Your agent must aggregate its memory (GROUP BY, JOIN, HAVING), not just rank relevant items.",
      "You store structured rows the agent later reports over ('calls per tool this week').",
      "You want exact filters and counts, not a fused similarity + keyword ranking, over memory.",
      "The schema should evolve as the agent learns ('add a `priority` field') via English.",
    ],
    whenChooseThem: [
      "Your agent recalls by hybrid search — BM25 keyword fused with vector similarity over text.",
      "You need enterprise scale: built-in multi-tenancy, replication, and RBAC across many namespaces.",
      "RAG context, reranking, or multimodal retrieval is the job, not relational reporting.",
      "You want an open-source store you can self-host full-featured under BSD-3.",
    ],
    features: [
      { feature: "Owns the database (provisions + migrates)", us: "shipped", them: "no" },
      {
        feature: "Natural-language → SQL",
        us: "shipped",
        them: "no",
        note: "Weaviate takes a vector, a BM25 query, or a hybrid blend plus a metadata filter; it has no English-to-SQL compiler.",
      },
      {
        feature: "Aggregations + reporting queries (GROUP BY / JOIN / HAVING over memory)",
        us: "shipped",
        them: "no",
        note: "Weaviate returns ranked nearest objects; it ships no SQL engine, no joins, and no transactions across collections.",
      },
      {
        feature: "Vector / semantic similarity search over memory",
        us: "no",
        them: "shipped",
        note: "Nearest-neighbour over embeddings is core to Weaviate; nlqdb stores typed rows and ships no embedding search today.",
      },
      {
        feature: "Hybrid search (BM25 keyword + vector) over stored documents",
        us: "partial",
        them: "shipped",
        note: "First-class fused BM25 + dense ranking is Weaviate's headline; nlqdb matches text with SQL LIKE / pattern predicates, not a fused-rank index.",
      },
      {
        feature: "Filtering on retrieval",
        us: "partial",
        them: "shipped",
        note: "nlqdb filters with exact SQL WHERE over typed columns; Weaviate filters by metadata around the hybrid / nearest-neighbour search.",
      },
      {
        feature: "Auto-migration via NL ('add a `priority` field')",
        us: "shipped",
        them: "no",
      },
      {
        feature: "MCP server (agent-callable)",
        us: "shipped",
        them: "shipped",
        note: "Weaviate's `mcp-server-weaviate` inserts objects and runs hybrid search; nlqdb's `nlqdb_query` materialises Postgres on first reference and runs aggregating SQL.",
      },
      {
        feature: "Open source / self-hostable",
        us: "partial",
        them: "shipped",
        note: "Weaviate is BSD-3 and self-hosts full-featured; nlqdb is source-available on FSL 1.1-ALv2, auto-converting to Apache 2.0 after two years.",
      },
    ],
    faqs: [
      {
        q: "Can I use Weaviate for hybrid recall and nlqdb for analytics over the same agent memory?",
        a: "Yes — they compose. Weaviate handles 'find the passages most relevant to this question' via fused BM25 + vector ranking; nlqdb handles 'how many tools did the agent call per category this week' via SQL. Run Weaviate as the recall layer and nlqdb as the analytical store the agent queries with GROUP BY / JOIN / HAVING.",
      },
      {
        q: "Does nlqdb do vector or hybrid search like Weaviate?",
        a: "No. nlqdb is Postgres-first — typed rows queried with exact SQL, not embeddings fused with BM25 and ranked by relevance. If hybrid keyword-plus-semantic search over text is the job, Weaviate is the right shape; nlqdb's contract is relational SQL over the rows the agent provisions.",
      },
      {
        q: "Weaviate is open source and self-hostable — is nlqdb?",
        a: "nlqdb is source-available under FSL 1.1 (Functional Source License), which auto-converts to Apache 2.0 two years after each release; Weaviate is BSD-3 today and self-hosts full-featured. Both let you keep your data; they differ on the query model, not on lock-in — Weaviate does hybrid recall, nlqdb does relational SQL.",
      },
      {
        q: "Weaviate has metadata filtering — isn't that the same as nlqdb's SQL WHERE?",
        a: "Not quite. Weaviate's metadata filter narrows candidates around a hybrid or nearest-neighbour search, so the result is still a relevance ranking. nlqdb runs exact SQL — WHERE, GROUP BY, COUNT, JOIN — and returns a precise result set, not the top-k most relevant objects. Different jobs: one ranks the relevant, the other computes answers.",
      },
      {
        q: "Can my AI agent provision its own store with Weaviate the way it can with nlqdb?",
        a: "Weaviate's `mcp-server-weaviate` can insert objects and run hybrid search, but the agent gets a vector store, not a relational database it can aggregate or migrate. nlqdb's MCP `nlqdb_query` materialises a tenant-scoped Postgres plus schema on first reference, so a Claude / Cursor / Cline agent stands up and reports over its data layer end-to-end without a human in the loop.",
      },
    ],
    demo: {
      goal: "calls per tool category this week, only categories above 20 calls",
      why: "The HAVING-filtered aggregation Weaviate's hybrid search can't run — it ranks the most relevant objects, not a GROUP BY / COUNT with a threshold; nlqdb answers it as SQL over the agent's own memory.",
    },
  },
  {
    slug: "qdrant",
    name: "Qdrant",
    url: "https://qdrant.tech",
    // Agent-memory cluster (vector-store wing, Rust/performance + permissive
    // license) anchored in docs/competitors.md §Qdrant. Facts verified via web
    // search + the official pricing page + the qdrant/mcp-server-qdrant repo
    // 2026-06-23: Apache-2.0 open source (self-host full-featured and free —
    // the most permissive licence of the vector cluster), plus Qdrant Cloud —
    // Free (0.5 vCPU / 1GB RAM / 4GB disk, single node, free forever) ·
    // Standard (usage-based hourly, dedicated, 99.5% SLA) · Premium (min spend,
    // SSO, private VPC, 99.9% SLA) · Hybrid Cloud (managed on your infra) ·
    // Private Cloud (air-gapped). Written in Rust. Primitives: HNSW vector
    // search, scalar/binary/product quantization (memory-efficient recall),
    // native hybrid search (dense + sparse fused via the Query API), metadata
    // filtering, REST + gRPC. No SQL, no joins, no GROUP BY aggregations, no
    // transactions across collections. Official `mcp-server-qdrant` ships
    // (`qdrant-store` + `qdrant-find` semantic-memory tools).
    tagline:
      "High-performance, Rust-built open-source vector database — HNSW search, scalar/binary/product quantization, native hybrid (dense + sparse) search; self-host on Apache-2.0 or run on Qdrant Cloud.",
    persona: "P2 agent builder",
    oneLiner:
      "Pick Qdrant if your agent recalls by fast, memory-efficient vector search — quantized HNSW with dense-plus-sparse hybrid ranking, self-hostable on Apache-2.0. Pick nlqdb if your agent must aggregate what it stored: GROUP BY, JOIN, and HAVING over typed rows it provisions in plain English. Qdrant ranks the relevant cheaply; nlqdb counts, groups, and reports.",
    whenChooseUs: [
      "Your agent must aggregate its memory (GROUP BY, JOIN, HAVING), not just rank relevant items.",
      "You store structured rows the agent later reports over ('calls per tool this week').",
      "You want exact filters and counts, not a quantized similarity ranking, over memory.",
      "The schema should evolve as the agent learns ('add a `priority` field') via English.",
    ],
    whenChooseThem: [
      "Your agent recalls by vector search and you want quantization to cut RAM and cost.",
      "You need native hybrid search — dense plus sparse vectors fused in one Query API call.",
      "Raw recall throughput and self-hosting on a permissive Apache-2.0 licence matter most.",
      "RAG context or semantic retrieval is the job, not relational reporting over rows.",
    ],
    features: [
      { feature: "Owns the database (provisions + migrates)", us: "shipped", them: "no" },
      {
        feature: "Natural-language → SQL",
        us: "shipped",
        them: "no",
        note: "Qdrant takes a dense vector, a sparse vector, or a hybrid blend plus a metadata filter; it has no English-to-SQL compiler.",
      },
      {
        feature: "Aggregations + reporting queries (GROUP BY / JOIN / HAVING over memory)",
        us: "shipped",
        them: "no",
        note: "Qdrant returns ranked nearest points; it ships no SQL engine, no joins, and no transactions across collections. Quantization makes recall cheaper, not relational.",
      },
      {
        feature: "Vector / semantic similarity search over memory",
        us: "no",
        them: "shipped",
        note: "Quantized HNSW nearest-neighbour over embeddings is core to Qdrant; nlqdb stores typed rows and ships no embedding search today.",
      },
      {
        feature: "Hybrid search (dense + sparse vectors) over stored documents",
        us: "partial",
        them: "shipped",
        note: "Native dense + sparse fusion via the Query API is Qdrant's headline; nlqdb matches text with SQL LIKE / pattern predicates, not a fused-rank index.",
      },
      {
        feature: "Filtering on retrieval",
        us: "partial",
        them: "shipped",
        note: "nlqdb filters with exact SQL WHERE over typed columns; Qdrant filters by payload metadata around the nearest-neighbour search.",
      },
      {
        feature: "Auto-migration via NL ('add a `priority` field')",
        us: "shipped",
        them: "no",
      },
      {
        feature: "MCP server (agent-callable)",
        us: "shipped",
        them: "shipped",
        note: "Qdrant's `mcp-server-qdrant` stores and finds memories by vector (`qdrant-store` / `qdrant-find`); nlqdb's `nlqdb_query` materialises Postgres on first reference and runs aggregating SQL.",
      },
      {
        feature: "Open source / self-hostable",
        us: "partial",
        them: "shipped",
        note: "Qdrant is Apache-2.0 and self-hosts full-featured; nlqdb is source-available on FSL 1.1-ALv2, auto-converting to Apache 2.0 after two years.",
      },
    ],
    faqs: [
      {
        q: "Can I use Qdrant for vector recall and nlqdb for analytics over the same agent memory?",
        a: "Yes — they compose. Qdrant handles 'find the points most relevant to this question' via quantized HNSW with dense-plus-sparse ranking; nlqdb handles 'how many tools did the agent call per category this week' via SQL. Run Qdrant as the recall layer and nlqdb as the analytical store the agent queries with GROUP BY / JOIN / HAVING.",
      },
      {
        q: "Does nlqdb do vector or hybrid search like Qdrant?",
        a: "No. nlqdb is Postgres-first — typed rows queried with exact SQL, not quantized embeddings fused with sparse vectors and ranked by relevance. If fast, memory-efficient semantic search over text is the job, Qdrant is the right shape; nlqdb's contract is relational SQL over the rows the agent provisions.",
      },
      {
        q: "Qdrant is Apache-2.0 and self-hostable — is nlqdb open source too?",
        a: "nlqdb is source-available under FSL 1.1 (Functional Source License), which auto-converts to Apache 2.0 two years after each release; Qdrant is Apache-2.0 today and self-hosts full-featured. Both let you keep your data; they differ on the query model, not on lock-in — Qdrant does quantized vector recall, nlqdb does relational SQL.",
      },
      {
        q: "Qdrant has payload filtering — isn't that the same as nlqdb's SQL WHERE?",
        a: "Not quite. Qdrant's payload filter narrows candidates around a nearest-neighbour search, so the result is still a relevance ranking. nlqdb runs exact SQL — WHERE, GROUP BY, COUNT, JOIN — and returns a precise result set, not the top-k most relevant points. Different jobs: one ranks the relevant, the other computes answers.",
      },
      {
        q: "Can my AI agent provision its own store with Qdrant the way it can with nlqdb?",
        a: "Qdrant's `mcp-server-qdrant` can store and find memories by vector, but the agent gets a vector collection, not a relational database it can aggregate or migrate. nlqdb's MCP `nlqdb_query` materialises a tenant-scoped Postgres plus schema on first reference, so a Claude / Cursor / Cline agent stands up and reports over its data layer end-to-end without a human in the loop.",
      },
    ],
    demo: {
      goal: "calls per tool category this week, only categories above 20 calls",
      why: "The HAVING-filtered aggregation Qdrant's quantized vector search can't run — it ranks the most relevant points, not a GROUP BY / COUNT with a threshold; nlqdb answers it as SQL over the agent's own memory.",
    },
  },
  {
    slug: "cognee",
    name: "Cognee",
    url: "https://www.cognee.ai",
    // Agent-memory cluster (knowledge-graph wing — the "not a vector store"
    // headline of the GLOBAL-036 pivot, distinct from the vector cluster
    // Pinecone/Chroma/Weaviate/Qdrant). Anchored in docs/competitors.md §Cognee.
    // Facts web-verified 2026-06-24 via github.com/topoteretes/cognee + cognee.ai
    // + docs.cognee.ai/cognee-mcp: open-source Apache-2.0 Python framework
    // (~20k GitHub stars, $7.5M seed); builds a self-hosted knowledge graph from
    // ingested data via the ECL pipeline (Extract → Cognify → Load) — the
    // `add()` → `cognify()` → `search()` API (~8 LOC to set up). Combines vector
    // embeddings + graph reasoning + cognitive-science ontology generation;
    // pluggable backends — graph (Neo4j, Kuzu, FalkorDB, NetworkX), vector
    // (pgvector, Qdrant, Weaviate, Redis), relational metadata (Postgres,
    // SQLite). Self-host (Docker / on-prem) or the managed Cognee Cloud. Ships
    // an official `cognee-mcp` server (14 tools — cognify / search / codify) for
    // Claude / Cursor / Cline. Retrieval is hybrid semantic + graph traversal
    // (14 search modes), NOT relational SQL: no GROUP BY / JOIN / HAVING
    // aggregation over typed rows.
    tagline:
      "Open-source AI memory framework — builds a self-hosted knowledge graph from your data (Extract → Cognify → Load), with hybrid vector + graph-traversal recall; Apache-2.0 Python package, self-host or Cognee Cloud.",
    persona: "P2 agent builder",
    oneLiner:
      "Pick Cognee if your agent recalls by reasoning over a knowledge graph — entities and relationships fused with vector similarity for context-rich semantic recall. Pick nlqdb if your agent must aggregate what it stored: GROUP BY, JOIN, and HAVING over typed rows it provisions in plain English. Cognee connects and recalls the relevant; nlqdb counts, groups, and reports.",
    whenChooseUs: [
      "Your agent must aggregate its memory (GROUP BY, JOIN, HAVING), not traverse a graph for context.",
      "You want a database provisioned and migrated from English, not a Python pipeline to host.",
      "You store typed rows the agent later reports over ('calls per tool this week').",
      "You want exact SQL counts and filters, not a semantic + graph relevance ranking.",
    ],
    whenChooseThem: [
      "Your agent recalls by meaning and relationships — a knowledge graph fused with vector similarity.",
      "You ingest unstructured documents and want an ontology built and evolved automatically.",
      "You want a self-hostable Apache-2.0 framework with pluggable graph and vector backends.",
      "Context-rich semantic recall for RAG is the job, not relational reporting over rows.",
    ],
    features: [
      { feature: "Owns the database (provisions + migrates)", us: "shipped", them: "no" },
      {
        feature: "Natural-language → SQL",
        us: "shipped",
        them: "no",
        note: "Cognee's `search()` runs hybrid vector + graph-traversal recall over a knowledge graph; it has no English-to-SQL compiler.",
      },
      {
        feature: "Aggregations + reporting queries (GROUP BY / JOIN / HAVING over memory)",
        us: "shipped",
        them: "no",
        note: "Cognee returns relevant, graph-connected context; it ships no SQL engine for GROUP BY / JOIN / HAVING over typed rows.",
      },
      {
        feature: "Knowledge-graph construction from unstructured data",
        us: "no",
        them: "shipped",
        note: "Cognee's `cognify()` builds entities + relationships + an ontology from ingested documents; nlqdb stores typed relational rows, not a graph.",
      },
      {
        feature: "Hybrid semantic + graph-traversal recall over memory",
        us: "no",
        them: "shipped",
        note: "Vector similarity fused with graph relationships (14 search modes) is Cognee's core; nlqdb stores typed rows and ships no embedding or graph recall today.",
      },
      {
        feature: "Auto-migration via NL ('add a `priority` field')",
        us: "shipped",
        them: "partial",
        note: "nlqdb migrates the schema from English with a diff-preview; Cognee's graph evolves as data is re-cognified, but there's no typed-column migration step.",
      },
      {
        feature: "MCP server (agent-callable)",
        us: "shipped",
        them: "shipped",
        note: "Cognee's `cognee-mcp` exposes cognify / search over the knowledge graph; nlqdb's `nlqdb_query` materialises Postgres on first reference and runs aggregating SQL.",
      },
      {
        feature: "Runs with no backend to host (embeddable element / hosted API)",
        us: "shipped",
        them: "no",
        note: "Cognee is a Python package you host and wire to LLM keys plus graph and vector backends; nlqdb is one `<nlq-data>` element or a hosted agent-callable API.",
      },
      {
        feature: "Open source / self-hostable",
        us: "partial",
        them: "shipped",
        note: "Cognee is Apache-2.0 and self-hosts full-featured; nlqdb is source-available on FSL 1.1, auto-converting to Apache 2.0 two years after each release.",
      },
    ],
    faqs: [
      {
        q: "Can I use Cognee for knowledge-graph recall and nlqdb for analytics over the same agent memory?",
        a: "Yes — they compose. Cognee handles 'pull the relevant, connected context for this question' via vector + graph traversal; nlqdb handles 'how many tools did the agent call per category this week' via SQL. Run Cognee as the semantic-recall layer and nlqdb as the analytical store the agent queries with GROUP BY / JOIN / HAVING.",
      },
      {
        q: "Does nlqdb build a knowledge graph like Cognee?",
        a: "No. nlqdb is Postgres-first — typed rows queried with exact SQL, not entities and relationships fused with embeddings into a graph. If reasoning over connected context and semantic recall is the job, Cognee is the right shape; nlqdb's contract is relational SQL over the rows the agent provisions in plain English.",
      },
      {
        q: "Cognee is Apache-2.0 and self-hostable — is nlqdb open source too?",
        a: "nlqdb is source-available under FSL 1.1 (Functional Source License), which auto-converts to Apache 2.0 two years after each release; Cognee is Apache-2.0 today and self-hosts full-featured. They differ on the query model, not on lock-in — Cognee does hybrid vector + graph recall, nlqdb does relational SQL.",
      },
      {
        q: "Cognee's search returns connected context — isn't that the same as nlqdb's SQL query?",
        a: "Not quite. Cognee's `search()` returns the entities and relationships most relevant to a query — a recall result. nlqdb runs exact SQL — WHERE, GROUP BY, COUNT, JOIN — and returns a precise result set, not the most relevant context. Different jobs: one recalls and connects, the other computes answers.",
      },
      {
        q: "Can my AI agent provision its own store with Cognee the way it can with nlqdb?",
        a: "Cognee's `cognee-mcp` lets an agent cognify data into and search a knowledge graph, but the agent gets a graph engine you've hosted and wired to backends — not a relational database it can aggregate or migrate. nlqdb's MCP `nlqdb_query` materialises a tenant-scoped Postgres plus schema on first reference, so a Claude / Cursor / Cline agent stands up and reports over its data layer end-to-end without a human in the loop.",
      },
    ],
    demo: {
      goal: "calls per tool category this week, only categories above 20 calls",
      why: "The HAVING-filtered aggregation Cognee's knowledge-graph search can't run — it recalls relevant, connected context, not a GROUP BY / COUNT with a threshold; nlqdb answers it as SQL over the agent's own memory.",
    },
  },
  {
    slug: "julius",
    name: "Julius AI",
    url: "https://julius.ai",
    // P3 analyst slot (the pre-pivot slate the comparison-pages FEATURE names
    // now the top-tier vector-DB cluster is closed; highest keyword volume +
    // most on-message of Retool AI / Julius AI / Basedash). Anchored in
    // docs/competitors.md §Julius AI ("analysis-only; no durable data layer").
    // Facts web-verified 2026-06-23 (julius.ai homepage + pricing + 2026
    // reviews): cloud-based conversational data-analysis web app — upload
    // Excel / CSV / Google Sheets, auto-generate charts (line/bar/pie/scatter/
    // heatmap) + presentation dashboards, generate + run Python you can
    // inspect, pre-built notebooks (sales/financial/HR/marketing/academic).
    // Pricing: Free (15 messages/mo) · Plus (~$29/mo annual) · Pro ($45/mo,
    // removes the message cap + adds live DB connectors: PostgreSQL, Snowflake,
    // BigQuery, Supabase, Google Drive, OneDrive, Google Ads, Stripe) ·
    // Business + Enterprise (custom). It is a destination chat app for
    // analysts — no embeddable element, no SDK/API to build on, no MCP server,
    // and it does not provision or own a database (it reads files or an
    // existing warehouse).
    tagline:
      "Conversational AI data analyst — upload a CSV, Excel, or Google Sheet (or connect a warehouse on Pro), then chat your way to charts, dashboards, and Python notebooks.",
    persona: "P3 analyst",
    oneLiner:
      "Pick Julius AI if you're an analyst who wants to upload a spreadsheet and chat your way to charts and a Python notebook. Pick nlqdb if you're building a product or agent that needs English-to-SQL over a database it provisions — embeddable, API-first, with every write diff-previewed.",
    whenChooseUs: [
      "You're building data features into your own product, not running ad-hoc analysis in a chat app.",
      "An AI agent must query — and provision — its own database, callable over MCP.",
      "You embed one HTML element (`<nlq-data>`) or call an API, not a destination web app.",
      "Writes and schema changes should be diff-previewed before they apply.",
    ],
    whenChooseThem: [
      "You're an analyst exploring uploaded CSVs, Excel, or Google Sheets ad hoc.",
      "You want presentation-ready charts and dashboards generated from a chat prompt.",
      "You need Python notebooks and generated data-science code you can inspect.",
      "You want a ready-to-use analysis app, not a backend to build on.",
    ],
    features: [
      {
        feature: "Owns the database (provisions + migrates)",
        us: "shipped",
        them: "no",
        note: "Julius reads uploaded files or connects to an existing warehouse; it doesn't provision or own a database your app writes to.",
      },
      {
        feature: "Natural-language data questions",
        us: "shipped",
        them: "shipped",
        note: "Both take English — Julius generates Python/analysis over your data, nlqdb compiles SQL against a Postgres it owns.",
      },
      {
        feature: "Embeddable in your product (HTML element / SDK / API)",
        us: "shipped",
        them: "no",
        note: "Julius is a standalone chat web app analysts log into; nlqdb ships `<nlq-data>`, an SDK, and an HTTP API to embed.",
      },
      {
        feature: "MCP server (agent-callable)",
        us: "shipped",
        them: "no",
        note: "nlqdb's `nlqdb_query` materialises Postgres on first reference for a Claude / Cursor agent; Julius has no MCP surface.",
      },
      {
        feature: "Charts + dashboards from a prompt",
        us: "no",
        them: "shipped",
        note: "Julius auto-generates line/bar/pie/scatter charts and dashboards; nlqdb returns typed result rows you render in your own UI.",
      },
      {
        feature: "CSV / Excel / Google Sheets file analysis",
        us: "no",
        them: "shipped",
        note: "Upload-and-analyse is Julius's home turf; nlqdb is database-backed, not ad-hoc file analysis.",
      },
      {
        feature: "Python / data-science code generation",
        us: "no",
        them: "shipped",
        note: "Julius writes and runs Python you can inspect; nlqdb's output contract is SQL plus rows.",
      },
      {
        feature: "Auto-migration via NL ('add a column for tags')",
        us: "shipped",
        them: "no",
      },
      {
        feature: "Destructive-op diff preview before apply",
        us: "shipped",
        them: "no",
        note: "Julius analyses; it doesn't manage your schema. nlqdb previews writes and DDL before applying.",
      },
      {
        feature: "Live database connectors",
        us: "partial",
        them: "shipped",
        note: "Julius (Pro) connects to Postgres/Snowflake/BigQuery/Supabase; nlqdb provisions and queries its own Postgres rather than reading many external warehouses.",
      },
    ],
    faqs: [
      {
        q: "Can I use Julius AI and nlqdb together?",
        a: "Yes — they serve different stages. Julius AI is where an analyst explores a dataset and produces charts; nlqdb is the database your product or agent queries in plain English at runtime. Use Julius for ad-hoc exploration, nlqdb for the data layer your app ships on.",
      },
      {
        q: "Does nlqdb make charts like Julius AI?",
        a: "No. nlqdb returns typed result rows from SQL it compiles; it doesn't generate charts or dashboards. If presentation-ready visualizations from a chat prompt are the goal, Julius is the right shape; nlqdb's contract is the data, which you render in your own UI.",
      },
      {
        q: "Can I upload a CSV to nlqdb the way I do with Julius AI?",
        a: "Not today — nlqdb is database-backed, not an ad-hoc file-analysis app. It provisions a Postgres you query in English (and an agent can provision via MCP). Julius's home turf is uploading a spreadsheet and chatting over it; nlqdb's is the durable data layer your product builds on.",
      },
      {
        q: "Is Julius AI embeddable in my own app like nlqdb?",
        a: "No. Julius is a standalone chat web app analysts log into; it has no embeddable element, SDK, or MCP server. nlqdb ships `<nlq-data>`, an SDK, an HTTP API, and an MCP server, so a product or AI agent queries the database in English without leaving your app.",
      },
      {
        q: "Julius AI can connect to my database — why provision a new one with nlqdb?",
        a: "Julius (on Pro) reads your existing Snowflake/Postgres/BigQuery for analysis. nlqdb owns the database your app writes to: it provisions Postgres, migrates the schema via English, and diff-previews destructive writes. Connecting-to-read and owning-the-write-path are different jobs.",
      },
    ],
    demo: {
      goal: "top 5 customers by total order value this quarter",
      why: "A grouped, ranked query nlqdb answers as SQL over the database your app owns — the live data layer your product queries, not a one-off chart from an uploaded spreadsheet.",
    },
  },
  {
    slug: "retool",
    name: "Retool",
    url: "https://retool.com",
    // P4 backend-engineer slot — the internal-tools incumbent with the
    // strongest distribution moat in docs/competitors.md §3 ("already
    // installed; distribution moat"), the natural next slice after Julius (P3)
    // per the comparison-pages FEATURE decision rule (persona-weighted threat ×
    // keyword volume — Retool's brand keyword dwarfs Basedash's). Facts
    // web-verified 2026-06-23 (retool.com/ai + retool.com/pricing + trust.retool.com):
    // low-code platform — drag-drop components + queries assemble internal
    // apps/dashboards over your *existing* production data (Postgres, Databricks,
    // Salesforce, …). AI layer: AppGen (describe an app → scaffold against your
    // schema), Ask AI (NL → SQL/JS/GraphQL while building), NL queries → dashboards,
    // and native AI Agents (plan/call-tools/query with guardrails + audit, billed
    // hourly, separate from the pooled AI credits). Pricing: Free ≤5 users · Team
    // (~€9/builder + €5/user) · Business (~€46/builder + €14/user) · Enterprise
    // (custom; SSO Enterprise-only). Self-host on all tiers (advanced on Enterprise).
    // Compliance: SOC 2 Type II + ISO 27001:2022 + GDPR; HIPAA via self-host (no BAA
    // by default). Custom model providers (OpenAI/Anthropic/Google/AWS/Azure). No
    // public MCP server; it connects to an existing DB and does not provision one.
    tagline:
      "Low-code platform for internal tools — drag-drop UI plus AI (AppGen, Ask AI, native agents) over your existing Postgres, Databricks, Salesforce, and more.",
    persona: "P4 backend engineer",
    oneLiner:
      "Pick Retool if you want to build internal admin tools and dashboards — visually, on top of a database you already run — with AI that scaffolds the app and writes the queries. Pick nlqdb if you want to skip building the UI entirely: provision the database, ask in English, and render the answer inline in your own product or agent.",
    whenChooseUs: [
      "Skip building an admin UI — one HTML element answers the English goal in-product.",
      "You need the database itself — nlqdb provisions Postgres on the first query.",
      "An AI agent must provision and migrate its own database over MCP, end-to-end.",
      "Writes and schema changes should be diff-previewed in plain English before they apply.",
    ],
    whenChooseThem: [
      "You already run a production database and want a polished internal-tools UI over it.",
      "Your team needs drag-drop apps, dashboards, and a deep connector ecosystem.",
      "You want native AI agents with guardrails, audit trails, and any model provider.",
      "Enterprise SSO, self-hosting, and SOC 2 / ISO 27001 / GDPR are hard requirements today.",
    ],
    features: [
      {
        feature: "Owns the database (provisions + migrates)",
        us: "shipped",
        them: "no",
        note: "Retool connects to an existing warehouse (Postgres, Databricks, Salesforce, …); provisioning the database is out of scope by design.",
      },
      { feature: "Natural-language → SQL", us: "shipped", them: "shipped" },
      {
        feature: "Build the UI yourself (drag-drop / low-code)",
        us: "no",
        them: "shipped",
        note: "Retool's core is assembling apps from components, even with AppGen scaffolding; nlqdb's contract is 'skip the UI — one element renders the answer'.",
      },
      {
        feature: "Embeddable answer in your own product (HTML element / SDK / API)",
        us: "shipped",
        them: "partial",
        note: "Retool apps are destination internal tools (embeddable via an Enterprise iframe); nlqdb's `<nlq-data>` is a vanilla web component answering inline in your product layout.",
      },
      {
        feature: "Auto-migration via NL ('add a column for tags')",
        us: "shipped",
        them: "no",
        note: "Ask AI writes queries against the existing schema; English-driven schema migration is not part of the product.",
      },
      {
        feature: "Destructive-op diff preview before apply",
        us: "shipped",
        them: "partial",
        note: "Retool gates writes behind buttons a human clicks; the per-operation diff preview on an NL-triggered write/DDL is unique to nlqdb.",
      },
      {
        feature: "MCP server (agent-callable)",
        us: "shipped",
        them: "no",
        note: "nlqdb exposes `nlqdb_query` / `nlqdb_list_databases` / `nlqdb_describe`; `nlqdb_query` materialises Postgres on first reference. Retool ships no public MCP server today.",
      },
      {
        feature: "Native AI agents (plan / call tools / query)",
        us: "partial",
        them: "shipped",
        note: "Retool ships production AI agents with guardrails + audit trails (billed hourly); nlqdb is the data layer an external agent calls, not an agent runtime.",
      },
      {
        feature: "Multi-engine connector ecosystem",
        us: "partial",
        them: "shipped",
        note: "Retool connects to dozens of databases and SaaS APIs; nlqdb is Postgres-first in Phase 1 (ClickHouse on the workload-analyser path).",
      },
      {
        feature: "SOC 2 Type II + ISO 27001 + enterprise SSO",
        us: "no",
        them: "shipped",
        note: "Retool carries SOC 2 Type II / ISO 27001:2022 / GDPR with SSO on Enterprise (HIPAA via self-host). nlqdb is pre-alpha and carries none yet.",
      },
      {
        feature: "Anonymous mode (try before sign-in)",
        us: "shipped",
        them: "no",
      },
    ],
    faqs: [
      {
        q: "Can I point Retool at an nlqdb database, or nlqdb at a Retool-connected DB?",
        a: "Retool connects to an existing database via a connection string, and nlqdb provisions Postgres, so the connection string nlqdb returns could slot in as a Retool resource. The reverse — nlqdb querying a database Retool manages — isn't supported today: nlqdb owns the database it queries, and bring-your-own-Postgres is on the roadmap, not shipped.",
      },
      {
        q: "How is nlqdb different from Retool's Ask AI and AppGen?",
        a: "Retool's AI scaffolds an internal app and writes queries against your existing schema, but a human still assembles and ships the UI. nlqdb skips the UI entirely: you embed one `<nlq-data>` element (or call the SDK / API), pass an English goal, and the answer renders inline. Retool is a builder for the people building tools; nlqdb is a backend primitive your product and agents call.",
      },
      {
        q: "Does nlqdb ship AI agents with guardrails like Retool?",
        a: "Not as a runtime. Retool ships native AI agents that plan, call tools, and query data with audit trails. nlqdb is the data layer those agents call — its MCP server exposes `nlqdb_query`, which materialises Postgres on first reference, so an external Claude / Cursor / Cline agent provisions and queries its own database. Compose them: the agent runtime on one side, nlqdb as the store it stands up.",
      },
      {
        q: "Is nlqdb SOC 2 or HIPAA compliant like Retool?",
        a: "No. nlqdb is pre-alpha and carries no certifications yet. Retool holds SOC 2 Type II, ISO 27001:2022, and GDPR, with enterprise SSO and HIPAA-capable self-hosting. If a documented compliance posture is required today, Retool is the honest pick; nlqdb's compliance roadmap is downstream of GA.",
      },
      {
        q: "Why pick nlqdb over Retool if I just need an internal dashboard?",
        a: "If the deliverable is a polished internal tool over a database you already run, Retool's builder and connector ecosystem are hard to beat. nlqdb wins when (a) you don't have the database yet and want it provisioned, (b) you want the answer embedded in your own product rather than a separate Retool app, or (c) an AI agent needs to provision and migrate its own data layer over MCP without a human in the loop.",
      },
    ],
    demo: {
      goal: "this week's failed background jobs grouped by service, top 10",
      why: "The ops question a backend engineer would build a Retool dashboard for — nlqdb mints the Postgres and answers the English goal in one element, no app to assemble first.",
    },
  },
  {
    slug: "basedash",
    name: "Basedash",
    url: "https://www.basedash.com",
    // P3 analyst slot — Basedash repositioned from "admin UI" (the stale
    // docs/competitors.md read) to an "AI-native Business Intelligence
    // platform": NL → dashboards, an AI data analyst with daily briefings
    // (Insights), a reusable-metrics semantic layer, chart embedding, and an
    // MCP server, federating 750+ data sources. So the honest persona is now
    // P3 analyst, not P4 admin. Facts web-verified 2026-06-23
    // (basedash.com + basedash.com/pricing): read-only analytics over data you
    // already store (Postgres, Snowflake, BigQuery, Salesforce, HubSpot,
    // Stripe, …) — no write/edit and no database provisioning. Pricing:
    // 14-day full-feature trial, then Startup $1,000/mo (≤25 seats, $100/mo AI
    // credits, + AI usage); Enterprise custom adds self-hosting, SSO
    // (SAML/OIDC), SCIM, audit logs, custom AI models. No permanent free tier.
    // Compliance: SOC 2 Type II, encryption in transit + at rest, customer
    // data never trains models.
    tagline:
      "AI-native BI platform — natural-language dashboards, a daily AI data analyst, and a semantic layer over 750+ data sources.",
    persona: "P3 analyst",
    oneLiner:
      "Pick Basedash if you want governed BI dashboards and daily AI briefings over data you already store across 750+ sources. Pick nlqdb if you want to own the database itself — provision Postgres, ask in English, write and migrate with diff-previews, and embed the answer inline in your product or agent.",
    whenChooseUs: [
      "You need the database itself — nlqdb provisions Postgres on the first query.",
      "You write and migrate data in English, with diff-previews before changes apply.",
      "You want an answer embedded inline in your product, not a BI dashboard.",
      "An AI agent must provision and query its own database over MCP, end-to-end.",
    ],
    whenChooseThem: [
      "You already store data across many sources and want governed BI dashboards over it.",
      "You need a semantic layer, daily AI briefings, and 750+ connectors today.",
      "SOC 2 Type II, SSO, and audit logs are hard requirements right now.",
      "Your team wants polished, shareable charts and reports, not a data-layer primitive.",
    ],
    features: [
      {
        feature: "Owns the database (provisions + migrates)",
        us: "shipped",
        them: "no",
        note: "Basedash connects to data you already store (Postgres, Snowflake, Salesforce, …); provisioning the database is out of scope by design.",
      },
      { feature: "Natural-language → SQL / charts", us: "shipped", them: "shipped" },
      {
        feature: "Write / edit data via NL (not read-only)",
        us: "shipped",
        them: "no",
        note: "Basedash is read-only analytics over connected data; nlqdb runs NL-driven writes and schema changes.",
      },
      {
        feature: "Destructive-op diff preview before apply",
        us: "shipped",
        them: "no",
        note: "Basedash has no NL write path to gate; the per-operation diff preview on an NL-triggered write/DDL is unique to nlqdb.",
      },
      {
        feature: "BI dashboards + reusable-metrics semantic layer",
        us: "no",
        them: "shipped",
        note: "Basedash builds governed dashboards with a semantic layer and daily AI briefings; nlqdb returns answers, not dashboards.",
      },
      {
        feature: "750+ data-source connectors",
        us: "partial",
        them: "shipped",
        note: "Basedash federates 750+ sources; nlqdb is Postgres-first in Phase 1 (ClickHouse on the workload-analyser path).",
      },
      {
        feature: "MCP server (agent-callable)",
        us: "shipped",
        them: "shipped",
        note: "Both ship MCP; Basedash connects an AI client to existing data, while nlqdb's `nlqdb_query` materialises Postgres on first reference.",
      },
      {
        feature: "Embeddable answer in your own product",
        us: "shipped",
        them: "partial",
        note: "Basedash embeds finished charts; nlqdb's `<nlq-data>` is a vanilla web component answering an English goal inline in your layout.",
      },
      {
        feature: "SOC 2 Type II + SSO + audit logs",
        us: "no",
        them: "shipped",
        note: "Basedash carries SOC 2 Type II with SSO / SCIM / audit logs on Enterprise; nlqdb is pre-alpha and carries none yet.",
      },
      {
        feature: "Free / anonymous tier (try before sign-in)",
        us: "shipped",
        them: "no",
        note: "Basedash is a 14-day trial then $1,000/mo (≤25 seats); nlqdb has anonymous mode and a free tier on the free LLM chain.",
      },
    ],
    faqs: [
      {
        q: "Is Basedash a database, or does it connect to one I already have?",
        a: "Basedash connects to data you already store — 750+ sources from Postgres and Snowflake to Salesforce and Stripe — and builds governed BI dashboards over it. It does not provision or own a database. nlqdb is the database: `nlqdb_query` materialises Postgres on first reference, so there's no existing warehouse to wire up first.",
      },
      {
        q: "Can Basedash write or edit my data, or only read it?",
        a: "Basedash is read-only analytics — dashboards, reports, and daily AI briefings over connected data, with no NL write or migration path. nlqdb runs natural-language writes and schema changes (e.g. 'add a column for tags'), and every destructive operation is diff-previewed in plain English before it applies.",
      },
      {
        q: "How is nlqdb's embedding different from Basedash embedding charts?",
        a: "Basedash embeds finished charts and dashboards into your product. nlqdb embeds an answer primitive: the `<nlq-data>` web component takes an English goal and renders the result inline in your own layout, and the same goal is callable from the SDK, API, or an MCP agent. One ships visualizations; the other ships a queryable data layer.",
      },
      {
        q: "Is nlqdb cheaper than Basedash for a small team?",
        a: "Basedash starts at $1,000/month for up to 25 seats (plus AI usage) after a 14-day trial, with no permanent free tier. nlqdb has an anonymous mode you can try without signing in and a free tier on the free LLM chain. For a small team that mainly needs to query and embed data, nlqdb removes the per-seat BI bill.",
      },
      {
        q: "Is nlqdb SOC 2 compliant like Basedash?",
        a: "No. Basedash carries SOC 2 Type II with encryption in transit and at rest, plus SSO, SCIM, and audit logs on Enterprise. nlqdb is pre-alpha and holds no certifications yet. If a documented compliance posture is required today, Basedash is the honest pick; nlqdb's compliance roadmap is downstream of GA.",
      },
    ],
    demo: {
      goal: "monthly active customers grouped by plan, last 6 months",
      why: "The dashboard question a team would open Basedash for — nlqdb mints the Postgres and answers the English goal in one element, no BI seat or connector setup first.",
    },
  },
  {
    slug: "metabase",
    name: "Metabase",
    url: "https://www.metabase.com",
    // P3 analyst/BI slot — the comparison-pages FEATURE names Metabase Metabot
    // as the next slice after Basedash by the persona-weighted threat ×
    // keyword-volume rule: it carries the strongest OSS-distribution moat in
    // the P3 BI cluster (docs/competitors.md §Metabase Metabot, threat-matrix
    // row "OSS distribution + familiar BI UX"). Facts web-verified 2026-06-23
    // (metabase.com/docs/latest/ai/metabot + metabase.com/pricing + 2026
    // pricing write-ups): Metabase is an OSS + cloud BI platform (AGPL
    // self-host; cloud Starter from ~$85/mo). Metabot is the AI layer inside
    // it — answers data questions in natural language, builds charts via the
    // query builder from a prompt, generates SQL in the native editor, fixes
    // SQL errors ("Have Metabot fix it"), summarises/analyses existing
    // visualizations, generates code for transforms, and answers in Slack.
    // The full Metabot needs a paid Cloud plan plus a $100/mo add-on (500
    // requests; included in Enterprise); the OSS edition includes only basic
    // single-shot SQL generation. It is a destination BI/dashboard app over
    // your existing warehouse — read-only analytics, no DB provisioning, no
    // NL writes/migrations, no embeddable answer element or agent API.
    tagline:
      "Open-source + cloud BI platform — dashboards, charts, and SQL over your existing data; Metabot adds an AI layer that answers questions and writes SQL in natural language.",
    persona: "P3 analyst",
    oneLiner:
      "Pick Metabase if you want an open-source BI tool to build dashboards and let analysts ask charts in chat over your existing warehouse. Pick nlqdb if you're building a product or agent that needs English-to-SQL over a database it provisions — embeddable, API-first, every write diff-previewed.",
    whenChooseUs: [
      "You're embedding data features into a product or agent, not building dashboards.",
      "You want one HTML element (`<nlq-data>`) or an API, not a BI app to log into.",
      "An AI agent must query — and provision — its own database, callable over MCP.",
      "Writes and schema changes should be diff-previewed before they apply.",
    ],
    whenChooseThem: [
      "You want a self-hostable open-source BI tool over an existing warehouse.",
      "Your team builds and shares dashboards, charts, and scheduled reports.",
      "Analysts want a familiar query builder with an AI assistant alongside.",
      "You need read-only analytics across many connected data sources.",
    ],
    features: [
      {
        feature: "Owns the database (provisions + migrates)",
        us: "shipped",
        them: "no",
        note: "Metabase connects to an existing warehouse to read it; it doesn't provision or own a database your app writes to.",
      },
      {
        feature: "Natural-language data questions",
        us: "shipped",
        them: "partial",
        note: "Metabot (paid add-on) answers in English and writes SQL; the OSS edition is basic single-shot SQL generation. nlqdb compiles SQL against a Postgres it owns on every plan.",
      },
      {
        feature: "Embeddable in your product (HTML element / SDK / API)",
        us: "shipped",
        them: "partial",
        note: "Metabase embeds finished dashboards/charts (iframe/SDK); nlqdb embeds an answer primitive — `<nlq-data>` takes an English goal and returns rows you render in your own layout.",
      },
      {
        feature: "MCP server (agent-callable)",
        us: "shipped",
        them: "no",
        note: "nlqdb's `nlqdb_query` materialises Postgres on first reference for a Claude / Cursor agent; Metabot answers inside Metabase (and Slack), not as an agent-callable database.",
      },
      {
        feature: "Dashboards, charts + scheduled reports",
        us: "no",
        them: "shipped",
        note: "Dashboards and visualizations are Metabase's home turf; nlqdb returns typed result rows you render in your own UI.",
      },
      {
        feature: "Open source / self-hostable",
        us: "no",
        them: "shipped",
        note: "Metabase ships an AGPL open-source edition you self-host; nlqdb is source-available on FSL 1.1-ALv2, auto-converting to Apache 2.0 after two years.",
      },
      {
        feature: "Auto-migration via NL ('add a column for tags')",
        us: "shipped",
        them: "no",
      },
      {
        feature: "Destructive-op diff preview before apply",
        us: "shipped",
        them: "no",
        note: "Metabase reads and visualizes; it doesn't manage your schema. nlqdb previews writes and DDL before applying.",
      },
      {
        feature: "Read across many connected sources",
        us: "partial",
        them: "shipped",
        note: "Metabase connects to many warehouses for read-only BI; nlqdb provisions and queries its own Postgres rather than federating external sources.",
      },
    ],
    faqs: [
      {
        q: "Can I use Metabase and nlqdb together?",
        a: "Yes — they serve different jobs. Metabase is where analysts build dashboards and explore an existing warehouse; nlqdb is the database your product or agent queries in plain English at runtime. Use Metabase for BI reporting, nlqdb for the embedded data layer your app ships on.",
      },
      {
        q: "How is Metabot different from nlqdb's natural-language querying?",
        a: "Metabot is an AI assistant inside the Metabase BI app — it answers questions, builds charts, and writes SQL for analysts working in Metabase. nlqdb is a backend: it compiles English to SQL over a Postgres it provisions and owns, and exposes that through an HTML element, SDK, API, and MCP server you build on.",
      },
      {
        q: "Does nlqdb build dashboards like Metabase?",
        a: "No. nlqdb returns typed result rows from SQL it compiles; it doesn't build dashboards, charts, or scheduled reports. If shareable BI dashboards over your warehouse are the goal, Metabase is the right shape; nlqdb's contract is the data, which you render in your own UI.",
      },
      {
        q: "Is Metabot free in the open-source Metabase?",
        a: "Only partly. The open-source Metabase edition includes basic single-shot SQL generation, but the full Metabot — natural-language questions, chart building, error fixing, chart analysis — requires a paid Cloud plan plus a $100/month add-on (500 requests), or an Enterprise contract. nlqdb's English-to-SQL works on every plan, including the free LLM chain.",
      },
      {
        q: "Can an AI agent call Metabase the way it calls nlqdb?",
        a: "Not as a database. Metabot answers inside Metabase and Slack for human analysts; it isn't an agent-callable data layer. nlqdb ships an MCP server, so a Claude or Cursor agent can provision a Postgres and query it in English — `nlqdb_query` materialises the database on first reference.",
      },
    ],
    demo: {
      goal: "top 10 products by revenue this quarter, with month-over-month growth",
      why: "The kind of question an analyst would build a Metabase dashboard for — nlqdb answers the English goal as SQL over a database it owns, returned as rows your product embeds, not a dashboard you log in to.",
    },
  },
  {
    slug: "milvus",
    name: "Milvus",
    url: "https://milvus.io",
    // Agent-memory cluster (open-source vector wing — the large-scale ANN
    // sibling of Pinecone/Chroma/Weaviate/Qdrant in the GLOBAL-036 "database,
    // not a vector store" pivot). Anchored in docs/competitors.md §Milvus.
    // Facts web-verified 2026-06-24 via github.com/milvus-io/milvus + milvus.io
    // + zilliz.com/pricing + github.com/zilliztech/mcp-server-milvus:
    // high-performance, cloud-native vector database built for scalable vector
    // ANN search (Go, Apache-2.0, ~45k GitHub stars, LF AI & Data graduated
    // project, Zilliz is the creator + major contributor). Indexes HNSW / IVF /
    // DiskANN / GPU; metric types L2 / IP / cosine. Capabilities: vector
    // similarity/ANN search, scalar/metadata filtering, hybrid search (dense +
    // sparse / BM25 full-text), multi-vector search. `query` supports boolean
    // filter expressions; scalar group-by aggregation (count(*)/sum/avg/min/max
    // via `group_by_fields`) is new in Milvus 3.0 (currently the v3.0-beta
    // pre-release, May 2026 — 2.6 GA has only vector-search GroupBy, not SQL-
    // style scalar aggregation), but there is NO relational JOIN and NO HAVING,
    // and aggregation is single-collection only. Deploy as Milvus Lite (embedded) / Standalone
    // (Docker) / Distributed (k8s), or the managed Zilliz Cloud (Serverless /
    // Dedicated / Enterprise; free tier 5 GB / 2.5M vCUs). Official
    // `zilliztech/mcp-server-milvus` (milvus_vector_search / milvus_text_search /
    // milvus_hybrid_search / milvus_query / milvus_list_collections; stdio + SSE)
    // for Claude / Cursor.
    tagline:
      "High-performance, cloud-native open-source vector database built for scalable vector ANN search — HNSW / IVF / DiskANN indexes, metadata filtering, and hybrid dense + sparse search at billion-vector scale; Apache-2.0, self-host or managed Zilliz Cloud.",
    persona: "P2 agent builder",
    oneLiner:
      "Pick Milvus if your agent recalls by similarity at scale — billions of embeddings, ANN search with metadata filters and hybrid dense + sparse ranking. Pick nlqdb if your agent must aggregate what it stored: GROUP BY, JOIN, and HAVING over typed rows it provisions in plain English. Milvus ranks the nearest vectors; nlqdb counts, groups, and reports over the rows.",
    whenChooseUs: [
      "Your agent must aggregate its memory (GROUP BY, JOIN, HAVING), not rank nearest vectors.",
      "You want a database provisioned and migrated from English, not a vector index to operate.",
      "You store typed rows the agent later reports over ('tool calls per category this week').",
      "You want exact SQL counts and filters, not an approximate-nearest-neighbour relevance ranking.",
    ],
    whenChooseThem: [
      "Your agent recalls by semantic similarity over millions-to-billions of embeddings.",
      "You need ANN indexes (HNSW / IVF / DiskANN / GPU) tuned for recall-vs-latency at scale.",
      "Hybrid dense + sparse / full-text search ranking is the retrieval job, not relational reporting.",
      "You want a self-hostable Apache-2.0 vector engine with a managed Zilliz Cloud option.",
    ],
    features: [
      { feature: "Owns the database (provisions + migrates)", us: "shipped", them: "no" },
      {
        feature: "Natural-language → SQL",
        us: "shipped",
        them: "no",
        note: "Milvus exposes a vector-search + scalar-filter API (SDKs / REST / gRPC); it has no English-to-SQL compiler.",
      },
      {
        feature: "Aggregations + reporting queries (GROUP BY / JOIN / HAVING over memory)",
        us: "shipped",
        them: "no",
        note: "Milvus `query` filters rows; single-collection scalar group-by aggregation (`count(*)` / sum / avg via `group_by_fields`) is new in Milvus 3.0 (the v3.0-beta pre-release); it ships no relational JOIN and no HAVING.",
      },
      {
        feature: "Vector similarity / ANN search over embeddings",
        us: "no",
        them: "shipped",
        note: "HNSW / IVF / DiskANN / GPU indexes at billion-vector scale are Milvus's core; nlqdb stores typed rows and ships no embedding or ANN search today.",
      },
      {
        feature: "Hybrid dense + sparse / full-text retrieval ranking",
        us: "no",
        them: "shipped",
        note: "Milvus fuses dense vectors with sparse / BM25 full-text into one ranked result; nlqdb has no similarity ranking — it returns exact SQL result sets.",
      },
      {
        feature: "Auto-migration via NL ('add a `priority` field')",
        us: "shipped",
        them: "no",
        note: "nlqdb migrates the schema from English with a diff-preview; Milvus collections have a fixed schema you alter via the SDK, not a typed-column NL migration.",
      },
      {
        feature: "MCP server (agent-callable)",
        us: "shipped",
        them: "shipped",
        note: "Milvus's `mcp-server-milvus` exposes vector / text / hybrid search + query over collections; nlqdb's `nlqdb_query` materialises Postgres on first reference and runs aggregating SQL.",
      },
      {
        feature: "Runs with no backend to host (embeddable element / hosted API)",
        us: "shipped",
        them: "partial",
        note: "Milvus Lite embeds in Python and Zilliz Cloud is managed, but there's no HTML element; nlqdb is one `<nlq-data>` element or a hosted agent-callable API.",
      },
      {
        feature: "Open source / self-hostable",
        us: "partial",
        them: "shipped",
        note: "Milvus is Apache-2.0 and self-hosts full-featured; nlqdb is source-available on FSL 1.1-ALv2, auto-converting to Apache 2.0 after two years.",
      },
    ],
    faqs: [
      {
        q: "Can I use Milvus for similarity recall and nlqdb for analytics over the same agent memory?",
        a: "Yes — they compose. Milvus handles 'find the most similar past facts to this query' via ANN search over embeddings; nlqdb handles 'how many facts did the agent log per category this month' via SQL. Run Milvus as the semantic-recall layer and nlqdb as the analytical store the agent queries with GROUP BY / JOIN / HAVING.",
      },
      {
        q: "Does nlqdb do vector / ANN search like Milvus?",
        a: "No. nlqdb is Postgres-first — typed rows queried with exact SQL, not embeddings ranked by approximate nearest neighbour. If billion-scale similarity recall is the job, Milvus is the right shape; nlqdb's contract is relational SQL over the rows the agent provisions in plain English.",
      },
      {
        q: "Milvus can filter and count rows — isn't that the same as nlqdb's SQL?",
        a: "Only partly. Milvus `query` applies a boolean filter, and single-collection scalar group-by aggregation (`count(*)`, sum, avg via `group_by_fields`) arrives in Milvus 3.0 (the v3.0-beta pre-release) — but it has no relational JOIN across collections and no HAVING. nlqdb compiles those to SQL and runs them in Postgres. Milvus answers 'which vectors are nearest, filtered'; nlqdb answers 'how many, grouped by what, joined across tables, above which threshold'.",
      },
      {
        q: "Milvus is Apache-2.0 and self-hostable — is nlqdb open source too?",
        a: "nlqdb is source-available under FSL 1.1 (Functional Source License), which auto-converts to Apache 2.0 two years after each release; Milvus is Apache-2.0 today and self-hosts full-featured (Milvus Lite, Standalone, or Distributed), with managed Zilliz Cloud as an option. They differ on the query model — Milvus does vector ANN search, nlqdb does relational SQL.",
      },
      {
        q: "Can my AI agent provision its own store with Milvus the way it can with nlqdb?",
        a: "Milvus's `mcp-server-milvus` lets an agent search and query collections you've created in a Milvus instance you operate (self-hosted or Zilliz Cloud) — the agent gets a vector index, not a relational database it can aggregate or migrate. nlqdb's MCP `nlqdb_query` materialises a tenant-scoped Postgres plus schema on first reference, so a Claude / Cursor / Cline agent stands up and reports over its data layer end-to-end without a human in the loop.",
      },
    ],
    demo: {
      goal: "tool calls per category this month, only categories with more than 50 calls",
      why: "The HAVING-filtered aggregation Milvus has no operator for — its vector search ranks the nearest embeddings with a metadata filter, and even its scalar group-by has no HAVING threshold; nlqdb answers it as SQL over the agent's own memory.",
    },
  },
];

export function competitorBySlug(slug: string): Competitor | undefined {
  return COMPETITORS.find((c) => c.slug === slug);
}
