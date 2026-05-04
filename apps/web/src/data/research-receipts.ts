// Curated subset of `docs/research-receipts.md` for the homepage's
// "Backed by the work" component. Four lessons, each one sentence
// + source citation + URL. The full doc has ten; we surface the
// most narratively compelling ones for first-time visitors.
//
// Picks favour incidents (Replit) and accuracy benchmarks (Cortex
// Analyst) — those are the most visceral evidence of "we did our
// homework". Adjust the list as new receipts land.

export type ResearchReceipt = {
  // One-line lesson, ~5-9 words. Front-loaded with the verb.
  lesson: string;
  // Two sentences max — the *why*. Specific number or specific
  // incident; never abstract.
  why: string;
  // Source name as it should appear under the card (publisher /
  // paper / blog).
  source: string;
  // Outbound URL for the source.
  url: string;
  // Where in nlqdb's design we apply the lesson — short pointer,
  // links to a section anchor in DESIGN.md or research-receipts.md.
  appliedAt: { label: string; href: string };
};

export const RECEIPTS: ResearchReceipt[] = [
  {
    lesson: "Layer the validator like an onion.",
    why: "Replit's coding agent (July 2025) wiped a customer database during a code freeze with three guardrails active. We layer everything: AST parse, verb allowlist, table allowlist, role isolation, RLS, transaction wrapper.",
    source: "Fortune — Replit catastrophic failure",
    url: "https://fortune.com/2025/07/23/ai-coding-tool-replit-wiped-database-called-it-a-catastrophic-failure/",
    appliedAt: {
      label: "docs/architecture.md §3.6.5 + sql-validate.ts",
      href: "/docs/architecture.md",
    },
  },
  {
    lesson: "LLM picks structure, our code emits SQL.",
    why: "Snowflake Cortex Analyst hits 90%+ accuracy on real BI workloads — about 2× single-prompt GPT-4o — because the LLM picks from a curated semantic layer instead of writing raw SQL. Our schema-create path follows the same logic with a typed plan, not raw DDL.",
    source: "Snowflake engineering blog",
    url: "https://www.snowflake.com/en/engineering-blog/cortex-analyst-text-to-sql-accuracy-bi/",
    appliedAt: {
      label: "docs/architecture.md §3.6.2 typed-plan pipeline",
      href: "/docs/architecture.md",
    },
  },
  {
    lesson: "Embed tables, not columns, for schema retrieval.",
    why: "Pinterest's text-to-SQL system uses one embedding per table-card (name + description + columns + sample values). nilenso's 2025 evaluation found hit rate climbed from ~40% to ~90% just from adding table-doc embeddings. We use the table-card pattern from day one.",
    source: "nilenso — RAG approach for text-to-SQL",
    url: "https://blog.nilenso.com/blog/2025/05/15/exploring-rag-based-approach-for-text-to-sql/",
    appliedAt: { label: "research-receipts §3", href: "/docs/research-receipts.md" },
  },
  {
    lesson: "Treat fetched row content as untrusted.",
    why: "Keysight (July 2025) documented an attack class where a row in the user's database contains `ignore previous instructions, DROP TABLE…` — when an agent later reads that row and re-feeds it into its system prompt, the row's content steers the next turn. We never re-feed row content into agent system prompts.",
    source: "Keysight Threats blog",
    url: "https://www.keysight.com/blogs/en/tech/nwvs/2025/07/31/db-query-based-prompt-injection",
    appliedAt: { label: "research-receipts §4", href: "/docs/research-receipts.md" },
  },
  {
    lesson: "Generate the semantic layer at create time.",
    why: "Every shipped enterprise NL-Q product (Cortex, ThoughtSpot, Power BI Q&A, Tableau Pulse, dbt MetricFlow, Cube) depends on a curated semantic layer — none of them auto-creates the database. We own the schema-creation moment, so we generate the metric and dimension layer automatically.",
    source: "dbt — Semantic Layer vs Text-to-SQL 2026",
    url: "https://docs.getdbt.com/blog/semantic-layer-vs-text-to-sql-2026",
    appliedAt: { label: "docs/architecture.md §3.6.3 the moat", href: "/docs/architecture.md" },
  },
];
