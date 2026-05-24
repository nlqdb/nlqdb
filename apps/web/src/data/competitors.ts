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
        a: "Both fine-tune the prompt against the live schema. nlqdb publishes BIRD Mini-Dev + Spider 2.0-lite scores weekly to `docs/features/quality-eval/`; Vanna doesn't publish a single canonical benchmark, so the honest answer is 'measure yours on your schema.'",
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
    // Acquired by Cloudflare 2025-04 per https://www.cloudflare.com/press/press-releases/2025/cloudflare-acquires-outerbase-to-expand-developer-experience/.
    tagline:
      "AI-assisted database interface (EZQL, spreadsheet editor, dashboards) for your existing Postgres / MySQL / SQLite / MongoDB / ClickHouse / Snowflake / BigQuery / Redshift / MSSQL.",
    persona: "P4 backend engineer",
    oneLiner:
      "Pick Outerbase if you already run a production database and want an AI-assisted admin UI — spreadsheet edits, EZQL natural-language queries, dashboards — sitting on top of it. Pick nlqdb if you want the database itself provisioned, schema evolved via English, and one HTML element rendering answers in your own app.",
    whenChooseUs: [
      "You don't have a database yet — nlqdb provisions Postgres on the first query (`SK-ANON-001`).",
      "You want to embed the answer in your product via one HTML element, not link a hosted admin UI.",
      "An AI agent needs to provision its own database via MCP — `create_database` is the verb Outerbase doesn't ship.",
      'Schema evolves via English (`"add a `priority` column"`) with a diff-before-apply preview (`SK-ONBOARD-004`).',
    ],
    whenChooseThem: [
      "You already run a production Postgres / MySQL / Snowflake / BigQuery you can't migrate.",
      "You want a spreadsheet-style editor + dashboards + data catalog UI — admin-tool shape, not a chat box.",
      "Your engine isn't Postgres today (MySQL, MongoDB, Snowflake, BigQuery, ClickHouse, Redshift, MSSQL) — Outerbase ships across all of them now; nlqdb is Postgres-first (ClickHouse Phase 2).",
      "HIPAA or SOC 2 Type 2 certification is a hard requirement today — nlqdb is pre-alpha and doesn't carry either yet.",
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
        them: "shipped",
      },
      {
        feature: "Unlimited free-tier natural-language queries",
        us: "shipped",
        them: "no",
        note: "Outerbase Explorer caps at 10 EZQL questions/month; nlqdb free chain (Groq → Gemini) is rate-limited per principal, not per question/month.",
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
        a: "Both translate English into SQL; the differentiator isn't the translation, it's what surrounds it. nlqdb prompts directly from the live schema fingerprint plus a recent-tables hint and surfaces the compiled SQL under a `Cmd+/` trace toggle (`SK-WEB-005`). nlqdb also publishes BIRD Mini-Dev + Spider 2.0-lite accuracy weekly to `docs/features/quality-eval/`; Outerbase doesn't publish a single canonical benchmark.",
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
        a: "No. nlqdb is pre-alpha; neither certification is in place yet. If you're shipping a regulated product today, Outerbase (HIPAA + SOC 2 Type 2) is the honest pick; nlqdb's compliance roadmap is downstream of GA.",
      },
    ],
    demo: {
      goal: "today's failed background jobs grouped by service in the last 24 hours",
      why: "The ops query a backend engineer runs from an internal dashboard — Outerbase renders it through a spreadsheet view on your existing DB; nlqdb mints the DB and answers the English goal in one element.",
    },
  },
];

export function competitorBySlug(slug: string): Competitor | undefined {
  return COMPETITORS.find((c) => c.slug === slug);
}
