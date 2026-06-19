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
        feature: "MCP server with provisioning verbs",
        us: "shipped",
        them: "partial",
        note: "Supabase MCP queries an existing DB; nlqdb's MCP can also create the DB.",
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
        a: "Supabase's MCP server queries an existing project but doesn't provision one. nlqdb's MCP exposes `create_database` so an autonomous agent can stand up its own data layer end-to-end.",
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
        a: "nlqdb ships an MCP server with `create_database`, `ask`, and `run` verbs. Vanna doesn't ship an MCP server today, so an agent has to wrap the Python SDK itself.",
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
        a: "Yes — they're complementary. Mem0 handles 'remember the user prefers Celsius', nlqdb handles 'list the user's orders this month'. Both can sit behind one MCP-aware agent; nlqdb's MCP server exposes `create_database` so the structured side is self-provisioned.",
      },
      {
        q: "Is nlqdb a vector database?",
        a: "No. nlqdb is Postgres-first (ClickHouse for analytical engines in Phase 2). For vector recall over unstructured strings, Mem0, Pinecone, or pgvector are the right shape.",
      },
      {
        q: "How does my agent provision an nlqdb database autonomously?",
        a: "The MCP server exposes `create_database` — your agent calls it with a goal in English, the server materialises Postgres + schema in one call, and returns connection metadata bound to the agent's tenant.",
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
      "An AI agent needs to provision its own database via MCP — `create_database` is the verb Outerbase doesn't ship.",
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
        feature: "MCP server with provisioning verbs",
        us: "shipped",
        them: "no",
        note: "Outerbase has no public MCP server today; nlqdb ships `create_database`, `ask`, `run`.",
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
        a: "Outerbase is admin-UI shaped — it doesn't expose a `create_database` primitive an autonomous agent can call. nlqdb's MCP server (`mcp.nlqdb.com`) exposes `create_database`, `ask`, and `run` so a Claude / Cursor / Cline agent stands up its own data layer end-to-end.",
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
      "You need an agent calling MCP `create_database` — Wren AI's skills query an existing warehouse.",
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
        feature: "MCP server with provisioning verbs",
        us: "shipped",
        them: "no",
        note: "Wren AI ships a Python SDK, LangChain/LangGraph bindings, and skill bundles for Claude Code; no public MCP primitive for `create_database`.",
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
        a: "Wren AI is a context layer plus agent toolkit — its Python SDK and LangChain bindings let an agent issue NL queries against an MDL-modelled data source, but the warehouse itself must already exist. nlqdb's MCP server (`mcp.nlqdb.com`) exposes `create_database`, `ask`, and `run`, so a Claude / Cursor / Cline agent stands up its own Postgres plus schema end-to-end without a human in the loop.",
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
];

export function competitorBySlug(slug: string): Competitor | undefined {
  return COMPETITORS.find((c) => c.slug === slug);
}
