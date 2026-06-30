// `/solve/<slug>` source of truth. One object per page; `[slug].astro`,
// `solve/index.astro`, `sitemap.xml.ts`, and `llms.txt.ts` all read
// from this file — adding a `/solve/<slug>` is a one-file edit.
//
// AEO best-practice (Tripledart, HubSpot 2026): direct-answer capsule
// (≤60 words) above the fold, named pain in <h1>, FAQPage + HowTo
// JSON-LD, honest "what nlqdb doesn't do" section. Pages that hide
// limits get demoted by Perplexity / ChatGPT cited-source heuristics.
//
// h1 shape: a natural-language search query — NOT a fabricated
// "verbatim" user quote. Once the ICP-mining cluster pipeline
// (docs/features/icp-mining) ships its first evidence file
// (2026-05-26), follow-up entries can quote the verbatim cluster
// label; until then, an honest paraphrased search-intent question
// outperforms a quote that would have to be invented.

export type SolvePersona =
  | "P1 solo builder"
  | "P2 agent builder"
  | "P3 analyst"
  | "P4 backend engineer";

// User-facing label + description per persona. The internal `P1..P4`
// codes match docs/research/personas.md and are used for grouping /
// telemetry only — they never appear in user-facing copy because the
// code means nothing to a reader landing on the page from search.
export type SolvePersonaInfo = {
  label: string;
  description: string;
};

export const SOLVE_PERSONAS: Record<SolvePersona, SolvePersonaInfo> = {
  "P1 solo builder": {
    label: "Solo builders",
    description:
      "Founders and single engineers shipping side-projects on weekends. Spend day one of every project wiring up Postgres, ORMs, and migrations before the app does anything useful — they'd rather skip that step and ship.",
  },
  "P2 agent builder": {
    label: "Agent builders",
    description:
      "Engineers building LLM-powered agents that need to remember things across sessions. Structured memory has had no opinionated primitive — most teams stitch together a connection string, an ORM, and a hand-rolled migration loop before the agent's first tool call.",
  },
  "P3 analyst": {
    label: "Analysts and PMs",
    description:
      "PMs, ops, and customer-success leads who can write SQL but resent it. Live in Metabase, Retool, and Excel — want one-off questions answered without filing a data ticket, and want internal dashboards that don't charge per viewer.",
  },
  "P4 backend engineer": {
    label: "Backend engineers",
    description:
      "Engineers at small startups running their own Postgres. Want a natural-language admin layer over the database they already own — not a replacement for the data store underneath.",
  },
};

// Canonical render order — matches the priority in docs/research/personas.md.
export const SOLVE_PERSONA_ORDER: SolvePersona[] = [
  "P1 solo builder",
  "P2 agent builder",
  "P3 analyst",
  "P4 backend engineer",
];

export type SolveSource = {
  // Enduring URL (a search-result page, a subreddit, a pricing page, a
  // GitHub label) — not a single-thread URL that may rot. The reader
  // can verify the theme is observable in public discussion at click
  // time, not at our publish time.
  url: string;
  label: string;
};

export type SolveFaq = {
  q: string;
  a: string;
};

export type SolveEntry = {
  // URL-safe lower-kebab; appears in the canonical URL.
  slug: string;
  // The persona this page primarily serves (from docs/research/personas.md).
  persona: SolvePersona;
  // <h1> — written as the natural-language search query the buyer
  // types. Under 80 chars so it doesn't wrap awkwardly in LLM
  // citation panels.
  searchTitle: string;
  // Direct-answer capsule for AEO crawlers — under 60 words, capsule
  // shape ("If you need X, do Y."). Lifted verbatim by Perplexity /
  // ChatGPT into "direct answer" boxes.
  oneLiner: string;
  // 1-2 sentences of pain context that name the trade-off honestly.
  // Avoid superlatives; cite the persona's situation.
  painContext: string;
  // Plain-English goal piped into `<nlq-data goal="...">` on the page.
  // Picked so the rendered snippet directly answers the search query.
  demoGoal: string;
  // One-sentence "why this demo speaks to the question" — appears as
  // the lede above the snippet card.
  demoWhy: string;
  // 3-4 bullets — "What nlqdb actually does for this query". Each ≤25
  // words. No marketing fluff; describe shipped behaviour only.
  howNlqdbAnswers: string[];
  // 2-3 honest "what nlqdb does NOT do here" bullets. Mandatory per
  // SK-SOLVE-002 (AEO honest-trade-off rule); pages that hide limits
  // get demoted by cited-source heuristics.
  whatItDoesnt: string[];
  // 3-5 Q&As. LLMs lift FAQ Q&A pairs verbatim — keep answers 2-3
  // sentences, declarative, name the search topic in at least one
  // question.
  faqs: SolveFaq[];
  // ≥2 enduring discussion-hub URLs where the pain is observable.
  // SK-SOLVE-003: this is the page's evidence trail — the reader can
  // confirm the theme is real without trusting our framing.
  sources: SolveSource[];
};

export const SOLVE_ENTRIES: SolveEntry[] = [
  {
    slug: "database-claude-cursor-can-query",
    persona: "P2 agent builder",
    searchTitle: "How do I give Claude or Cursor a SQL database it can create and query?",
    oneLiner:
      "If you want Claude Desktop, Cursor, or any MCP host to have a SQL database — not just a connection to one you configured yourself — point it at nlqdb's hosted MCP server. The `nlqdb_query` tool provisions Postgres from the agent's first English goal (no connection string, no schema) and answers in English with the SQL shown.",
    painContext:
      "Every database MCP server (Postgres, SQL Server, SQLite) assumes you've already provisioned the database, designed the schema, and pasted a connection string into the host config. That's the right shape when an existing warehouse is the source of truth. But an agent that needs a scratch database to write to and query — a place to log what it does and answer 'how many' over it — has nowhere to put one without a human doing the DBA work first.",
    demoGoal: "tasks grouped by status with a count of each",
    demoWhy:
      "The first thing an MCP host does with a fresh database — provision it, then ask an aggregate over it — is one English goal here, not a connection string plus a CREATE TABLE.",
    howNlqdbAnswers: [
      "Point Claude Desktop, Cursor, Cline, or Claude Code at `mcp.nlqdb.com` — the `nlqdb_query` tool needs no connection string and no schema setup.",
      "Calling `nlqdb_query` with no `db` set provisions Postgres from the agent's first English goal — create and query are one call, no separate create tool.",
      "`nlqdb_list_databases` and `nlqdb_describe` let the host enumerate and inspect schemas; every answer returns rows plus the compiled SQL to audit.",
      "Per-`(mcp_host, device_id)` `sk_mcp_*` keys scope access per agent and device; revocation is per-device and shown in the dashboard.",
    ],
    whatItDoesnt: [
      "This page is about nlqdb provisioning a fresh database for the agent — no connection string. To point nlqdb at a Postgres you already run instead, use the signed-in BYO connect verb (`SK-DBCONN-001`; see /solve/query-existing-postgres-in-natural-language), not the zero-config provisioning path shown here.",
      "No native vector search — nlqdb is Postgres-first; unstructured similarity recall over text strings is Mem0 or pgvector's job.",
      "No public `nlqdb_create_database` verb — provisioning is implicit in `nlqdb_query` by design (`SK-MCP-002`, trust boundary).",
    ],
    faqs: [
      {
        q: "How is this different from a Postgres or SQL Server MCP server?",
        a: "Those connect an MCP host to a database you already provisioned, configured, and supplied a connection string for. nlqdb provisions the Postgres itself from the agent's first English goal — no connection string, no schema authored by hand. The trade-off is honest: nlqdb owns its database, so it can't query one you already run.",
      },
      {
        q: "Which MCP hosts can use the nlqdb database?",
        a: "Any host that speaks MCP — Claude Desktop, Cursor, Cline, Claude Code. Point it at the hosted server `mcp.nlqdb.com` (no local install), or run the `@nlqdb/mcp` npm binary for local stdio. The `@nlqdb/sdk` TypeScript client is the typed fallback for non-MCP integrations.",
      },
      {
        q: "How does the agent create the database — is there a create tool?",
        a: "No separate create tool. The agent calls `nlqdb_query` with no `db` set and an English goal; when it has no database, nlqdb provisions Postgres from the goal and answers in the same call. Keeping create implicit in query is a deliberate trust-boundary choice (`SK-MCP-002`).",
      },
      {
        q: "Can the agent see the SQL it ran?",
        a: "Yes — every `nlqdb_query` answer returns the result rows plus the compiled SQL, so the host (and you) can audit the grain before trusting it. nlqdb never hides the SQL behind the answer.",
      },
    ],
    sources: [
      {
        url: "https://github.com/modelcontextprotocol/servers",
        label:
          "MCP server registry — the recurring 'database MCP server' demand hub (many DB connectors, all assuming an existing DB).",
      },
      {
        url: "https://www.reddit.com/r/mcp/search/?q=database",
        label: "r/mcp — recurring 'database for my MCP agent' threads.",
      },
      {
        url: "https://hn.algolia.com/?q=mcp+database",
        label: 'HN search: "mcp database" — discussion on giving AI assistants a queryable store.',
      },
    ],
  },
  {
    slug: "cheap-internal-dashboard",
    persona: "P3 analyst",
    searchTitle: "How do I build an internal dashboard without per-seat pricing?",
    oneLiner:
      "If you need an internal view over your data and per-seat tooling is out of budget, drop an `<nlq-data>` tag in any HTML page and ask for the report in English — no SQL, no schema setup, no per-viewer fee.",
    painContext:
      "Operations and ops-adjacent teams that want one dashboard for a handful of business questions end up evaluating Retool, Metabase, or a bespoke React build. Per-seat licensing punishes occasional viewers; self-hosted OSS shifts the cost from money to ops burden — neither fits a five-person team that wants to read three numbers a day.",
    demoGoal: "today's orders aggregated by drink with revenue",
    demoWhy:
      "The query a small team would otherwise write by hand (or pay per viewer to render) is the one nlqdb answers from a single English goal.",
    howNlqdbAnswers: [
      'One HTML element (`<nlq-data goal="...">`) renders the answer with the compiled SQL toggle-revealed underneath.',
      "Anonymous mode (`SK-ANON-001`) provisions an ephemeral Postgres database in seconds — no signup before first answer.",
      "Pricing is free forever for the free LLM chain; paid tiers add a flat sub with included requests, never per-viewer.",
    ],
    whatItDoesnt: [
      "No drag-and-drop chart builder — nlqdb returns tables and one-sentence summaries; charting is the consumer's choice.",
      "No role-based row-level security on shared dashboards yet — per-DB API keys scope by database, not by row.",
    ],
    faqs: [
      {
        q: "How does this compare to Retool's per-user pricing?",
        a: "Retool charges per seat across paid tiers; nlqdb's free chain is free forever and the paid tier is a flat sub with included requests + soft-meter overage. For a comparison page see nlqdb vs Supabase — Retool-specific is on the roadmap; in the meantime the persona overlap with Supabase is the closest published shape.",
      },
      {
        q: "Can a non-engineer read the dashboard?",
        a: "Yes — the page only needs an HTML host (or `/app/new` for the hosted chat). The query stays in English; the compiled SQL is collapsed under a `Show trace` toggle so curious viewers can audit it without it cluttering the answer.",
      },
      {
        q: "Do I have to migrate my existing database?",
        a: "No — you have two paths. nlqdb can provision a fresh Postgres for the dashboard (no migration), or you can connect a Postgres you already run with the signed-in BYO connect verb (`nlq db connect`; see /solve/query-existing-postgres-in-natural-language) and query it in place. Either way there's no ETL into a separate store.",
      },
      {
        q: "What happens when the dashboard hits a paid LLM?",
        a: "Free chain (Groq → Gemini) handles the free tier indefinitely; BYO-LLM at 0% markup lets you point any provider key at the same request shape. Hosted-premium adds a soft-meter overage — no surprise bills, no auto-upgrade (GLOBAL-013).",
      },
    ],
    sources: [
      {
        url: "https://retool.com/pricing",
        label: "Retool pricing — per-user tier ladder (industry context for the pain).",
      },
      {
        url: "https://hn.algolia.com/?q=retool+pricing",
        label: 'HN search: "retool pricing" — recurring threads on per-seat cost in small teams.',
      },
      {
        url: "https://www.reddit.com/r/SaaS/search/?q=retool+alternative",
        label: 'r/SaaS — "retool alternative" threads (active discussion hub).',
      },
    ],
  },
  {
    slug: "give-ai-agent-persistent-memory",
    persona: "P2 agent builder",
    searchTitle: "How do I give my AI agent persistent memory across sessions?",
    oneLiner:
      "If your agent needs to remember facts across sessions and later *aggregate* them, give it a real database via MCP — nlqdb's `nlqdb_query` tool provisions Postgres from the agent's first English goal and answers `GROUP BY` / top-N / per-period questions over what it stored. Retrieval gets you one fact; analytics gets you the report.",
    painContext:
      "Agent builders pick between unstructured memory (vector recall over chat history, e.g. Mem0) and structured memory (typed rows the agent can aggregate later). Vector recall returns the top-k similar facts — but it has no query planner, so the moment the agent needs `average per group` or `top 10 this month` it ends up doing arithmetic over a list of search hits. Retrieval ≠ analytics.",
    demoGoal: "top 5 things the agent remembered this week by frequency",
    demoWhy:
      "The query an agent runs to summarise its own memory — `GROUP BY` + count + top-N — is exactly what a vector store can't answer and a real database can.",
    howNlqdbAnswers: [
      "MCP `nlqdb_query` provisions Postgres from the agent's first English goal and answers in English — plus `nlqdb_list_databases` / `nlqdb_describe`, no human in the loop.",
      "Memory is typed rows in Postgres, so the agent can `GROUP BY`, rank top-N, and aggregate over what it stored — not just similarity recall.",
      'Schema evolves via English: `"add a priority column"` migrates the table; the diff is shown before apply (`SK-ONBOARD-004`).',
      "Per-(mcp_host, device_id) keys (`sk_mcp_*`) let one tenant share memory across an agent fleet without leaking other tenants' rows.",
    ],
    whatItDoesnt: [
      "No native vector search yet — nlqdb is Postgres-first; for unstructured fact recall over chat-text strings, Mem0 or pgvector are the right shape.",
      "No explicit per-row TTL / forget primitive yet — anonymous DBs auto-sweep at 72h, but authed rows persist until deleted.",
    ],
    faqs: [
      {
        q: "Is nlqdb a replacement for Mem0 for AI agent memory?",
        a: 'It\'s the structured, analytical half — and the only half that can answer analytical questions. Mem0 owns unstructured similarity recall ("the user prefers Celsius"); nlqdb owns typed rows the agent later aggregates ("top 10 topics this month by count"). Both can sit behind one MCP-aware agent.',
      },
      {
        q: 'Why can\'t a vector store answer "average per group" about agent memory?',
        a: "A vector store returns the top-k most similar facts; it has no query planner. So an aggregation becomes the LLM doing arithmetic over a list of search hits — a hallucination generator, not a `GROUP BY`. nlqdb runs the actual aggregation in Postgres and shows the SQL.",
      },
      {
        q: "How does the agent create its own database?",
        a: 'Via `nlqdb_query` with no `db` set — the agent sends an English goal (`"a memory store for my research assistant"`); when it has no database, nlqdb provisions Postgres from the goal and answers in one call. There is no separate `create_database` tool — provisioning and querying are the same call.',
      },
      {
        q: "What about agent frameworks like LangChain or AutoGen?",
        a: "Any framework that speaks MCP can connect; the `@nlqdb/sdk` (TypeScript) is the typed fallback for non-MCP integrations. The `mcp` surface is the no-glue path — point the host (Claude Desktop, Cursor, Cline) at `mcp.nlqdb.com`.",
      },
      {
        q: "Does the agent need its own credentials?",
        a: "Yes — agents authenticate with `sk_mcp_*` keys minted with `(mcp_host, device_id)` claims. Per-device tagging means the dashboard shows `Cursor on macbook-air ran 14 queries today`; revocation is per-device, not per-user.",
      },
    ],
    sources: [
      {
        url: "https://www.reddit.com/r/LocalLLaMA/search/?q=agent+memory",
        label: 'r/LocalLLaMA — "agent memory" threads (recurring discussion hub).',
      },
      {
        url: "https://www.reddit.com/r/LangChain/search/?q=memory",
        label: "r/LangChain — memory-pattern recurring threads.",
      },
      {
        url: "https://hn.algolia.com/?q=agent+memory",
        label: 'HN search: "agent memory" — recent posts on the structured-vs-vector split.',
      },
    ],
  },
  {
    slug: "analytical-queries-over-agent-memory",
    persona: "P2 agent builder",
    searchTitle: "How do I run reports over what my AI agent remembered?",
    oneLiner:
      "If your agent stores what it learns and you now need *reports* over that memory — counts, top-N, averages per group — point an MCP-aware agent at nlqdb and ask in English. It runs the `GROUP BY` in Postgres and returns rows plus the SQL. A vector store recalls one fact; a database answers 'top 10 this month.'",
    painContext:
      "An agent that already logs what it learns hits a wall the moment the question turns analytical: 'top 10 topics this month by count', 'average deal size per stage', 'tasks completed per day this week'. Vector / graph memory (Mem0, Zep, LangMem, a Letta archival tier) returns the top-k similar rows — it has no query planner — so the rollup becomes the LLM doing arithmetic over search hits. Retrieval is the wrong tool for aggregation.",
    demoGoal: "count of facts the agent logged per category this month, highest first",
    demoWhy:
      "The query an agent runs to summarise its own memory — `GROUP BY` category + count + order — is exactly what retrieval can't do and a real database can.",
    howNlqdbAnswers: [
      "The agent's memory is typed rows in Postgres, so `GROUP BY`, top-N, and per-period rollups run as actual SQL — not arithmetic over search hits.",
      "Ask the report in English via MCP `nlqdb_query`; the answer returns rows plus the compiled SQL under a trace toggle, so you audit the grain.",
      "Plans are content-addressed on `(goal-fingerprint, schema-hash)` (`GLOBAL-006`) — a repeated weekly rollup hits the cache and returns in single-digit ms.",
      "Same database the agent writes to and reports over — no ETL into a separate analytics store, no second connection string to keep in sync.",
    ],
    whatItDoesnt: [
      "No native vector / similarity search — the analytical half assumes the agent already chose what to store as rows; unstructured recall over chat-text is Mem0 or pgvector's job.",
      "No prebuilt charting — nlqdb returns the aggregated table + a one-sentence summary; rendering it as a chart is the consumer's choice.",
    ],
    faqs: [
      {
        q: "How is this different from giving my agent persistent memory?",
        a: "Persistent memory is the write side — the agent storing facts so it can recall them later (see /solve/give-ai-agent-persistent-memory). This page is the read side: running analytical reports — counts, top-N, averages per group — over what it stored. nlqdb is the same Postgres for both, so there's no second store to sync.",
      },
      {
        q: 'Why can\'t my vector memory just answer "top 10 topics this month"?',
        a: "A vector store returns the top-k most similar rows; it has no query planner. An aggregation then becomes the LLM doing arithmetic over a list of search hits — a hallucination generator, not a `GROUP BY`. nlqdb runs the aggregation in Postgres and shows you the SQL it ran.",
      },
      {
        q: "What does the report query actually look like?",
        a: "You write the goal in English — 'count of facts the agent logged per category this month, highest first' — and nlqdb compiles it to SQL over the memory table, runs it, and returns the ranked rows. The compiled SQL shows under the trace toggle (`SK-WEB-005`) so you can verify the grain.",
      },
      {
        q: "Do I need a separate analytics database for this?",
        a: "No. The agent writes its memory rows to nlqdb's Postgres and reports over the same database — no ETL pipeline, no second connection string. Phase 2's workload analyser proposes a ClickHouse migration automatically if scan volume ever crosses the threshold, without an app-side rewrite.",
      },
    ],
    sources: [
      {
        url: "https://www.reddit.com/r/AI_Agents/search/?q=memory",
        label: "r/AI_Agents — recurring threads on analytics / stats over agent memory.",
      },
      {
        url: "https://hn.algolia.com/?q=agent+memory",
        label: 'HN search: "agent memory" — discussion on the retrieval-vs-aggregation split.',
      },
      {
        url: "https://www.reddit.com/r/LangChain/search/?q=memory",
        label: 'r/LangChain — "aggregate / GROUP BY over memory" recurring questions.',
      },
    ],
  },
  {
    slug: "skip-postgres-setup-side-project",
    persona: "P1 solo builder",
    searchTitle: "How do I add a database to a side project without setting up Postgres?",
    oneLiner:
      "If your side project needs a database but you don't want to provision Postgres, choose an engine, or wire migrations, drop one `<nlq-data>` tag in any HTML page — nlqdb mints the database, infers the schema from your first English query, and exposes the same data via SDK / CLI / MCP.",
    painContext:
      "Indie builders shipping a side project frequently bail at the database step: choosing Postgres vs SQLite, picking a hosting tier, wiring an ORM, writing the first migration. Most weekend ideas die between `npm create` and `CREATE TABLE`. The right shape for a side project is the one that fits inside an HTML file — but the existing tooling assumes you'll write SQL first.",
    demoGoal: "show recent customer contacts sorted by last touch",
    demoWhy:
      'The CRM-style table is the most common "my side project needs to remember things" shape — nlqdb mints it from one English goal with no schema authored by hand.',
    howNlqdbAnswers: [
      "One HTML element on any page provisions a Postgres database on the first query; subsequent queries reuse it via a per-device anonymous identity (`SK-ANON-001`).",
      'Schema is inferred from the query intent — no `CREATE TABLE` written by hand; subsequent fields are added via English (`"add a status column"`).',
      "Adopt the anonymous database into your account with one click within 72 hours (`SK-ANON-002`); no data loss, no re-import.",
    ],
    whatItDoesnt: [
      "Anonymous databases sweep after 72h unless adopted — designed for trial, not for storing the next year of your data without an account.",
      "No SQLite, no in-browser-only mode — the engine is always a real Postgres on Cloudflare-region infrastructure (Phase 2 adds ClickHouse).",
    ],
    faqs: [
      {
        q: "Can I keep a database from a side project after the 72-hour anonymous window?",
        a: 'Yes — sign in inside the 72h window and click "Adopt this database" (`SK-ANON-002`). The DB is re-keyed to your account, all rows persist, and the original anonymous device key keeps working until you rotate it.',
      },
      {
        q: "Does this work without a build step or a framework?",
        a: "Yes — `<nlq-data>` is a vanilla web component; drop the script tag, drop the element. It also ships as `@nlqdb/react`, `@nlqdb/vue`, `@nlqdb/svelte`, `@nlqdb/solid`, `@nlqdb/astro`, `@nlqdb/next`, and `@nlqdb/sveltekit` if you prefer the typed wrapper.",
      },
      {
        q: "What about hosting — do I need Cloudflare?",
        a: "No — the embedded element calls `app.nlqdb.com` from any origin (CORS-permissive on the public endpoints). Your side project can be on Vercel, Netlify, GitHub Pages, or a single static HTML file.",
      },
      {
        q: "How do I migrate later if the project takes off?",
        a: "The SDK's `runSql` (`POST /v1/run` raw-SQL escape hatch — `GLOBAL-015`) lets you stream out an arbitrary `SELECT` of your data for a parameterised migration. Phase 2 adds engine migration (Postgres → ClickHouse) without an app-side rewrite — the workload analyser proposes it; you approve.",
      },
    ],
    sources: [
      {
        url: "https://www.reddit.com/r/sideproject/search/?q=database",
        label: 'r/sideproject — recurring "how do I add a DB" threads.',
      },
      {
        url: "https://hn.algolia.com/?q=side+project+database",
        label: 'HN search: "side project database" — repeated yak-shaving complaints.',
      },
      {
        url: "https://www.reddit.com/r/webdev/search/?q=database+setup",
        label: 'r/webdev — "database setup" recurring discussion.',
      },
    ],
  },
  {
    slug: "natural-language-sql-without-training-data",
    persona: "P3 analyst",
    searchTitle:
      "How do I run natural-language queries on a database without training a model on my schema?",
    oneLiner:
      "If you want English → SQL on your data but don't want to maintain a training corpus or RAG layer, point `<nlq-data>` at your goal — nlqdb prompts directly from the live schema fingerprint, caches the plan, and shows the compiled SQL so you can verify before trusting it.",
    painContext:
      'Text-to-SQL tools commonly assume you\'ll curate training examples, embed schema docs, or fine-tune on prior queries. That\'s the right shape for a long-lived analytical estate, but it\'s overhead for a small team that wants "who are my top customers this week?" answered now and "what changed?" answered next month — without keeping a training loop alive.',
    demoGoal: "feedback from the last 24 hours grouped by channel",
    demoWhy:
      "The query an ad-hoc analyst would run from a fresh schema is the no-training-data sweet spot — schema fingerprint + recent-tables hint is enough.",
    howNlqdbAnswers: [
      "Plans are content-addressed on `(goal-fingerprint, schema-hash)` (`GLOBAL-006`); a cache hit returns in single-digit ms and avoids a model call entirely.",
      "Quality is measured against BIRD Mini-Dev + Spider 2.0-lite and published to `docs/features/quality-eval/` — the numbers are visible, not asserted.",
      "Every reply renders the compiled SQL under a `Cmd+/` trace toggle (`SK-WEB-005`); you audit before you trust.",
    ],
    whatItDoesnt: [
      "No retrieval-augmented training corpus — if you have years of curated query examples and want a tool that exploits them, Vanna AI's training loop is the right shape.",
      "Connecting an existing database is a signed-in account verb (SDK / CLI / MCP), not the public `<nlq-data>` embed — the embed holds a read-scoped key, never a connection credential. To query a Postgres you already own, use the BYO connect path (see /solve/query-existing-postgres-in-natural-language), not the zero-config embed shown here.",
    ],
    faqs: [
      {
        q: "Is nlqdb's natural-language accuracy comparable to fine-tuned text-to-SQL?",
        a: "We publish BIRD Mini-Dev + Spider 2.0-lite scores to `docs/features/quality-eval/`. They are still climbing toward our public target and the numbers are visible rather than asserted — measurement is honest, not a marketing claim.",
      },
      {
        q: "Do I need to write training examples like Vanna AI requires?",
        a: "No. nlqdb prompts directly from the live schema fingerprint plus a recent-tables hint — there is no per-tenant training corpus you maintain. The equivalent of training is the plan cache, which is automatic.",
      },
      {
        q: "How does the system avoid wrong SQL on a complex schema?",
        a: "Three guardrails: (1) the SQL validator allowlists the verbs the orchestrator may emit (`docs/features/sql-allowlist/FEATURE.md`); (2) destructive operations show a row-count diff and require second confirmation (`SK-ONBOARD-004`); (3) the trace toggle surfaces the SQL so the analyst can audit before applying.",
      },
      {
        q: "Can I see the SQL nlqdb generated?",
        a: "Always — every chat reply and every `<nlq-data>` render includes a collapsible trace block (`SK-WEB-005`). The SQL is the audit surface; we never hide it behind the answer.",
      },
    ],
    sources: [
      {
        url: "https://hn.algolia.com/?q=text+to+sql",
        label: 'HN search: "text to sql" — recurring threads on accuracy + training overhead.',
      },
      {
        url: "https://www.reddit.com/r/dataengineering/search/?q=text+to+sql",
        label: "r/dataengineering — practitioner threads on text-to-SQL trade-offs.",
      },
      {
        url: "https://hn.algolia.com/?q=natural+language+database",
        label: 'HN search: "natural language database" — adjacent discussion hub.',
      },
    ],
  },
  {
    slug: "ship-leaderboard-no-sql",
    persona: "P1 solo builder",
    searchTitle: "How do I add a leaderboard to a small product without writing SQL?",
    oneLiner:
      'If your product needs a leaderboard, a top-N table, or a ranked list and you don\'t want to author SQL or wire a ranking ORM call, write the goal in English in one `<nlq-data goal="top players by score">` tag — the database, the schema, and the index decisions are all behind the element.',
    painContext:
      'Leaderboards are the canonical "I just need one table and a `ORDER BY DESC LIMIT N`" feature — but indie builders still spend the weekend wiring Postgres, picking an ORM, deciding whether to denormalise, and then making it render. The persona overlap with side projects and hackathon demos is high; the SQL is trivial — the yak-shave isn\'t.',
    demoGoal: "leaderboard scores by region top 5",
    demoWhy:
      "The most common indie-product ranking query — `ORDER BY score DESC LIMIT N` — written as the English goal that ships it without an ORM.",
    howNlqdbAnswers: [
      "One element renders the ranked table; the engine indexes the sort column automatically based on the workload analyser's observations (`docs/features/engine-migration/FEATURE.md`).",
      'Adding the next dimension is an English edit — `"now by region"`, `"now this month only"` — not an ORM rewrite.',
      "Anonymous mode ships the leaderboard inside 72h on the free chain; adopt the database to keep it past the window.",
    ],
    whatItDoesnt: [
      "No realtime websocket push of rank changes today — the leaderboard refreshes on poll / on user action. Realtime is open in the roadmap; not shipped.",
      "No drag-rearrange UI — the element renders a typed table + summary, not a styled leaderboard card. Style it in your own CSS.",
    ],
    faqs: [
      {
        q: "Can the leaderboard span multiple regions or shards?",
        a: "Yes for region-bucketed leaderboards — the demo above shows region as a column. Multi-region replicated writes are not in Phase 1; the database is single-region per tenant (Cloudflare-region of provisioning).",
      },
      {
        q: "How do I add a new field — say, a player's badge?",
        a: 'Ask in English: `"add a badge column to players"`. The diff (and migration plan) shows under the `SK-ONBOARD-004` confirmation; press Enter to apply. No `ALTER TABLE` written by hand.',
      },
      {
        q: "Does it scale beyond a hackathon-sized leaderboard?",
        a: "The Phase 1 engine is Postgres on Neon Free tier (`docs/features/hosted-db-create/FEATURE.md`); single-tenant scales to small-product traffic. The Phase 2 workload analyser proposes a ClickHouse migration when row-count + scan patterns cross the threshold — without an app-side rewrite.",
      },
      {
        q: "Can my game client write scores via the API?",
        a: "Yes — `@nlqdb/sdk` (TypeScript), the Go `nlq` CLI, and the Swift Package all speak the same `/v1` wire contract today (Ruby + Rust are placeholders). The `POST /v1/ask` endpoint accepts an English goal; the `POST /v1/run` raw-SQL escape hatch (`GLOBAL-015`) is available when you want to send a parameterised `INSERT` instead.",
      },
    ],
    sources: [
      {
        url: "https://www.reddit.com/r/sideproject/search/?q=leaderboard",
        label: 'r/sideproject — "leaderboard" recurring threads.',
      },
      {
        url: "https://hn.algolia.com/?q=leaderboard+postgres",
        label: 'HN search: "leaderboard postgres" — recurring discussion hub.',
      },
    ],
  },
  {
    slug: "store-query-chatbot-conversation-history",
    persona: "P2 agent builder",
    searchTitle: "How do I store and query my chatbot's conversation history?",
    oneLiner:
      "If your chatbot needs to keep its conversation history and answer questions like 'messages per day' or 'most active users this week', give it a real database. nlqdb provisions Postgres from your first English goal and runs the GROUP BY in SQL — a vector store recalls one message, a database counts them all.",
    painContext:
      "Teams building a chatbot or support assistant log every turn somewhere — but the moment a PM asks 'how many conversations did we have this week?' or 'which users send the most messages?', a transcript dumped in a JSON column or a vector store is the wrong shape. Vector memory (Mem0, Zep) recalls the most similar past message; it has no query planner, so an engagement rollup becomes the LLM doing arithmetic over search hits instead of a real GROUP BY.",
    demoGoal: "conversations grouped by day with a message count for each",
    demoWhy:
      "The first engagement question a chatbot team asks — volume over time — is one English goal here, not a hand-written GROUP BY over a transcript table.",
    howNlqdbAnswers: [
      "Conversation turns are typed rows in Postgres, so 'messages per day' and 'average turns per session' run as SQL GROUP BY — not log math.",
      "Ask the engagement question in English via MCP `nlqdb_query` or the `@nlqdb/sdk`; every answer returns rows plus the compiled SQL to audit.",
      "Write turns with the deterministic `nlqdb_remember` tool (or a `POST /v1/run` INSERT) and report over the same database — no second store, no ETL.",
      'Schema evolves in English: `"add a sentiment column to messages"` migrates the table; the diff is shown before apply (`SK-ONBOARD-004`).',
    ],
    whatItDoesnt: [
      "No semantic search over message text — finding the most similar past message is a vector store's job (Mem0, pgvector); nlqdb answers the counting questions, not the similarity ones.",
      "No ingesting your existing logging pipeline — nlqdb stores the conversation rows you write to it. If your transcripts already live in a Postgres or ClickHouse you run, connect it with the signed-in BYO connect verb (`SK-DBCONN-001`) and query it in place.",
      "No built-in PII redaction or retention policy on message text — you choose what to write; anonymous DBs auto-sweep at 72h, authed rows persist until deleted.",
    ],
    faqs: [
      {
        q: "How is this different from giving my agent persistent memory?",
        a: "Persistent memory stores the facts an agent learns so it can recall them later (see /solve/give-ai-agent-persistent-memory). This page is the raw conversation transcript plus engagement analytics over it — messages per day, most active users, turns per session. nlqdb is the same Postgres for both, so there's no second store to keep in sync.",
      },
      {
        q: "Why can't a vector store answer 'how many conversations this week'?",
        a: "A vector store returns the top-k most similar messages; it has no query planner. A count or a per-day rollup then becomes the LLM doing arithmetic over a list of search hits — a hallucination generator, not a GROUP BY. nlqdb runs the aggregation in Postgres and shows you the SQL it ran.",
      },
      {
        q: "How do I get conversation turns into the database?",
        a: "Write each turn with the deterministic `nlqdb_remember` MCP tool, or send a parameterised INSERT through `POST /v1/run` (`GLOBAL-015`). Then ask engagement questions in English over the same table. The remember path builds the INSERT server-side, so the row shape stays a trust boundary, not LLM-guessed.",
      },
      {
        q: "Can I see the SQL behind the engagement numbers?",
        a: "Always — every answer returns the result rows plus the compiled SQL under a trace toggle (`SK-WEB-005`), so you can verify the grain (per message vs per conversation) before trusting a dashboard number. nlqdb never hides the SQL behind the answer.",
      },
    ],
    sources: [
      {
        url: "https://www.reddit.com/r/LangChain/search/?q=conversation+history",
        label: 'r/LangChain — recurring "store / query conversation history" threads.',
      },
      {
        url: "https://www.reddit.com/r/LLMDevs/search/?q=chat+history",
        label: "r/LLMDevs — recurring threads on storing and analysing chat history.",
      },
      {
        url: "https://hn.algolia.com/?q=chatbot+conversation+history",
        label: 'HN search: "chatbot conversation history" — logging + analytics over chat logs.',
      },
    ],
  },
  {
    slug: "track-ai-token-usage-and-cost",
    persona: "P2 agent builder",
    searchTitle: "How do I track and query my AI app's token usage and cost per user?",
    oneLiner:
      "If your LLM app needs to track token usage and cost — per user, per model, per day — log each call as a row and ask in English. nlqdb provisions Postgres from your first goal and runs the GROUP BY in SQL, so 'spend per user this month' is a real query, not arithmetic over a JSON log.",
    painContext:
      "Teams shipping LLM features need to answer 'how much are we spending per customer?' and 'which model cost the most this week?' — but token counts and dollar costs usually land in application logs or a JSON column. Pulling those back to total them in app code (or asking the LLM to add them up) is fragile and doesn't scale; these questions are aggregations, and aggregations want a query planner, not a log scan.",
    demoGoal: "total tokens and cost grouped by model this month, highest cost first",
    demoWhy:
      "The first cost question an LLM team asks — spend broken down by model — is one English goal here, not a hand-written GROUP BY over a usage log.",
    howNlqdbAnswers: [
      "Log each call as a row — user, model, tokens, cost, timestamp — so cost-per-user and tokens-per-model run as SQL GROUP BY, not log math.",
      "Ask the cost question in English via the `<nlq-data>` element, the `@nlqdb/sdk`, or MCP `nlqdb_query`; every answer returns rows plus the compiled SQL.",
      "Write usage rows with the deterministic `nlqdb_remember` tool or a `POST /v1/run` INSERT, and report over the same database — no separate store, no ETL.",
      "Plans are content-addressed on `(goal-fingerprint, schema-hash)` (`GLOBAL-006`), so a repeated weekly cost rollup hits the cache and returns in single-digit ms.",
    ],
    whatItDoesnt: [
      "No automatic token metering — nlqdb stores and aggregates the usage rows you write; counting tokens and computing cost per call is your app's job (or your provider SDK's).",
      "No ingesting your existing logging or billing pipeline — nlqdb stores the usage rows you write to it. If those rows already live in a Postgres or ClickHouse you run, connect it with the signed-in BYO connect verb (`SK-DBCONN-001`) and query it in place.",
      "No live streaming cost meter — the table refreshes on query, not via websocket push; realtime dashboards are roadmap, not shipped.",
    ],
    faqs: [
      {
        q: "Why not just total token usage in my application code?",
        a: "Because the questions are aggregations — spend per user, tokens per model, cost per day — and pulling rows back to sum them in app code is fragile and slow as volume grows. Asking the LLM to add them up is worse: arithmetic over a list is a hallucination generator. nlqdb runs the GROUP BY in Postgres and shows you the SQL it ran.",
      },
      {
        q: "How do the token and cost numbers get into the database?",
        a: "Write one row per LLM call — user, model, prompt and completion tokens, computed cost, timestamp — with the deterministic `nlqdb_remember` MCP tool or a parameterised INSERT through `POST /v1/run` (`GLOBAL-015`). The row shape stays a trust boundary, built server-side, not LLM-guessed. Then ask the cost questions in English over the same table.",
      },
      {
        q: "Can I see the SQL behind the cost numbers?",
        a: "Always — every answer returns the result rows plus the compiled SQL under a trace toggle (`SK-WEB-005`), so you can verify the grain (per call vs per user) before trusting a spend figure. nlqdb never hides the SQL behind the answer.",
      },
      {
        q: "Is this a replacement for an LLM observability tool like Langfuse or Helicone?",
        a: "No — those proxy or instrument your calls and capture token and cost automatically, with tracing UIs built for it. nlqdb is the database half: you decide what to log, and you get a SQL query planner over it for ad-hoc 'spend per X' questions without a per-seat dashboard tool. They compose; nlqdb doesn't proxy your traffic.",
      },
    ],
    sources: [
      {
        url: "https://www.reddit.com/r/LLMDevs/search/?q=token+cost",
        label: "r/LLMDevs — recurring threads on tracking token usage and cost per user.",
      },
      {
        url: "https://hn.algolia.com/?q=llm+token+cost",
        label: 'HN search: "llm token cost" — discussion on metering and attributing LLM spend.',
      },
      {
        url: "https://www.reddit.com/r/LocalLLaMA/search/?q=token+usage",
        label: 'r/LocalLLaMA — "token usage / cost tracking" recurring discussion hub.',
      },
    ],
  },
  {
    slug: "analyze-agent-tool-call-logs",
    persona: "P2 agent builder",
    searchTitle: "How do I log my AI agent's tool calls and query which tool fails most?",
    oneLiner:
      "If your agent calls tools and you need to know which tool fails most and how slow each one is — log every tool call as a row and ask in English. nlqdb provisions Postgres from your first goal and runs the GROUP BY in SQL, so 'error rate per tool' is a real query, not a grep over traces.",
    painContext:
      "Agents fail across steps — a tool returns the wrong shape, a call times out, a retrieval step finds the wrong doc — and the questions that matter are aggregations: which tool fails most, p95 latency per tool, calls per session, success rate this week. Those answers live in flat trace logs or a JSON column, where you grep instead of GROUP BY. Counting failures by hand (or asking the LLM to tally a log) doesn't scale; these are queries, and queries want a planner.",
    demoGoal: "error rate and average latency grouped by tool name this week, worst first",
    demoWhy:
      "The first reliability question an agent team asks — which tool is failing and how slow — is one English goal here, not a hand-written GROUP BY over a trace log.",
    howNlqdbAnswers: [
      "Log each tool call as a typed row — tool, session id, status, latency_ms, timestamp — so error-rate-per-tool and p95-latency run as SQL GROUP BY.",
      "Ask the reliability question in English via `<nlq-data>`, the `@nlqdb/sdk`, or MCP `nlqdb_query`; every answer returns rows plus the compiled SQL.",
      "Write call records with the deterministic `nlqdb_remember` tool or a `POST /v1/run` parameterised INSERT, then report over the same database — no separate analytics store.",
      "Plans are content-addressed on `(goal-fingerprint, schema-hash)` (`GLOBAL-006`), so a repeated weekly reliability rollup hits the cache and returns in single-digit ms.",
    ],
    whatItDoesnt: [
      "No automatic tracing — nlqdb stores and aggregates the call rows you write; capturing each tool invocation, its status, and its latency is your agent framework's job (or an OTel/tracing SDK's).",
      "No nested trace-tree UI — nlqdb answers tabular 'per tool / per session' aggregations, not the multi-step span waterfall a dedicated agent-observability tool draws.",
      "No ingesting your existing tracing pipeline — nlqdb stores the call rows you write to it. If those rows already live in a Postgres or ClickHouse you run, connect it with the signed-in BYO connect verb (`SK-DBCONN-001`) and query it in place.",
    ],
    faqs: [
      {
        q: "Why not just count tool failures in my application code?",
        a: "Because the questions are aggregations — failures per tool, p95 latency, calls per session — and pulling rows back to tally them in app code is fragile and slow as call volume grows. Asking the LLM to count a log is worse: arithmetic over a list hallucinates. nlqdb runs the GROUP BY in Postgres and shows you the SQL it ran, so you can trust the grain.",
      },
      {
        q: "How do the tool-call records get into the database?",
        a: "Write one row per tool call — tool name, session id, status, latency, timestamp — with the deterministic `nlqdb_remember` MCP tool or a parameterised INSERT through `POST /v1/run` (`GLOBAL-015`). The row shape stays a trust boundary, built server-side, not LLM-guessed. Then ask the reliability questions in English over the same table.",
      },
      {
        q: "Can I see the SQL behind the error rates?",
        a: "Always — every answer returns the result rows plus the compiled SQL under a trace toggle (`SK-WEB-005`), so you can check the grain (per call vs per session) before trusting a failure rate. nlqdb never hides the SQL behind the answer.",
      },
      {
        q: "Is this a replacement for an agent-observability tool like Langfuse or AgentOps?",
        a: "No — those instrument your agent and capture every span automatically, with nested trace-tree UIs built for debugging one run. nlqdb is the database half: you decide what to log, and you get a SQL query planner over it for ad-hoc 'per tool / per week' questions without a per-seat dashboard. They compose; nlqdb doesn't trace your runs.",
      },
    ],
    sources: [
      {
        url: "https://www.reddit.com/r/LLMDevs/search/?q=agent+tool+call+logging",
        label: "r/LLMDevs — recurring threads on logging and debugging agent tool calls.",
      },
      {
        url: "https://hn.algolia.com/?q=agent+observability",
        label:
          'HN search: "agent observability" — discussion on tracing and analyzing agent tool calls.',
      },
      {
        url: "https://www.reddit.com/r/LangChain/search/?q=tool+call+errors",
        label: 'r/LangChain — "tool call errors / reliability" recurring discussion hub.',
      },
    ],
  },
  {
    slug: "analyze-rag-retrieval-logs",
    persona: "P2 agent builder",
    searchTitle: "How do I log my RAG retrievals and query which sources get used most?",
    oneLiner:
      "If your RAG agent retrieves chunks and you need to know which sources get used most — log each retrieval as a row and ask in English. nlqdb provisions Postgres from your first goal and runs the GROUP BY in SQL, so 'retrievals per source this week' is a real query, not a scan over a vector-store log.",
    painContext:
      "RAG agents retrieve chunks from a vector store on every query, and the questions that tell you whether retrieval is healthy are aggregations: which source documents get retrieved most, which ones never surface, average relevance score per source, retrievals per session. Those answers live in flat retrieval logs or scattered across vector-store query traces, where you scan instead of GROUP BY. Tallying by hand — or asking the LLM to count a log — doesn't scale; these are queries, and queries want a planner.",
    demoGoal:
      "retrieval count and average relevance score grouped by source document this week, most retrieved first",
    demoWhy:
      "The first retrieval-quality question a RAG team asks — which sources get pulled most and how relevant they score — is one English goal here, not a hand-written GROUP BY over a retrieval log.",
    howNlqdbAnswers: [
      "Log each retrieval as a typed row — query id, source doc, relevance score, timestamp — so retrievals-per-source and avg-score run as SQL GROUP BY.",
      "Ask the retrieval-quality question in English via `<nlq-data>`, the `@nlqdb/sdk`, or MCP `nlqdb_query`; every answer returns rows plus the compiled SQL.",
      "Write retrieval records with the deterministic `nlqdb_remember` tool or a `POST /v1/run` parameterised INSERT, then report over the same database — no separate analytics store.",
      "Plans are content-addressed on `(goal-fingerprint, schema-hash)` (`GLOBAL-006`), so a repeated weekly retrieval rollup hits the cache and returns in single-digit ms.",
    ],
    whatItDoesnt: [
      "No vector search or embedding — nlqdb stores and aggregates the retrieval rows you write; the similarity search that picks the chunks stays in your vector store (Pinecone, pgvector, Chroma).",
      "No automatic capture — logging each retrieval, its source, and its relevance score is your RAG pipeline's job (or your framework's callback hook).",
      "No ingesting your existing log or vector store — nlqdb stores the retrieval rows you write to it. If those rows already live in a Postgres or ClickHouse you run, connect it with the signed-in BYO connect verb (`SK-DBCONN-001`); the vector similarity search stays in your vector store regardless.",
    ],
    faqs: [
      {
        q: "Why not just count RAG retrievals in my application code?",
        a: "Because the questions are aggregations — retrievals per source, average relevance, sources that never surface — and pulling rows back to tally them in app code is fragile and slow as your corpus grows. Asking the LLM to count a log is worse: arithmetic over a list hallucinates. nlqdb runs the GROUP BY in Postgres and shows you the SQL it ran.",
      },
      {
        q: "How do the retrieval records get into the database?",
        a: "Write one row per retrieval — query id, source document, chunk id, relevance score, timestamp — with the deterministic `nlqdb_remember` MCP tool or a parameterised INSERT through `POST /v1/run` (`GLOBAL-015`). The row shape stays a trust boundary, built server-side, not LLM-guessed. Then ask the retrieval-quality questions in English over the same table.",
      },
      {
        q: "Does nlqdb do the vector search or retrieval itself?",
        a: "No — the embedding and similarity search that picks which chunks to retrieve stays in your vector store (Pinecone, pgvector, Chroma, Weaviate). nlqdb is the database half: you log what got retrieved, and you get a SQL query planner over that log for 'per source / per week' questions. They compose; nlqdb doesn't embed or rank your documents.",
      },
      {
        q: "Can I see the SQL behind the retrieval numbers?",
        a: "Always — every answer returns the result rows plus the compiled SQL under a trace toggle (`SK-WEB-005`), so you can check the grain (per retrieval vs per query) before trusting a usage figure. nlqdb never hides the SQL behind the answer.",
      },
    ],
    sources: [
      {
        url: "https://www.reddit.com/r/LangChain/search/?q=rag+retrieval+evaluation",
        label: "r/LangChain — recurring threads on evaluating and debugging RAG retrieval quality.",
      },
      {
        url: "https://www.reddit.com/r/LLMDevs/search/?q=rag+evaluation",
        label:
          'r/LLMDevs — "RAG evaluation / which chunks get retrieved" recurring discussion hub.',
      },
      {
        url: "https://hn.algolia.com/?q=rag+retrieval",
        label:
          'HN search: "rag retrieval" — discussion on measuring and analyzing what RAG pipelines retrieve.',
      },
    ],
  },
  {
    slug: "track-llm-eval-scores-across-prompt-versions",
    persona: "P2 agent builder",
    searchTitle: "How do I track and query my LLM eval scores across prompt versions?",
    oneLiner:
      "If you run LLM evals and need to know which prompt version regressed — log each scored case as a row and ask in English. nlqdb provisions Postgres from your first goal and runs the GROUP BY in SQL, so 'pass rate per prompt version this month' is a real query, not a spreadsheet pivot.",
    painContext:
      "Teams shipping LLM features run evals on every prompt change — a set of test cases scored pass/fail or 0-1 — and the questions that tell you whether a change helped are aggregations: pass rate per prompt version, average score per model, which test cases regressed between v3 and v4, score trend over the last month. Those answers live in eval-tool exports, JSON run logs, or spreadsheets, where you pivot by hand instead of GROUP BY. Asking the LLM to tally a run log doesn't scale and miscounts; these are queries, and queries want a planner.",
    demoGoal:
      "pass rate and average score grouped by prompt version this month, newest version first",
    demoWhy:
      "The first eval-tracking question a team asks — did pass rate go up or down across prompt versions — is one English goal here, not a hand-built pivot over a run log.",
    howNlqdbAnswers: [
      "Log each scored eval case as a typed row — prompt version, test case, model, score, pass/fail — so pass-rate-per-version runs as SQL GROUP BY.",
      "Ask the regression question in English via `<nlq-data>`, the `@nlqdb/sdk`, or MCP `nlqdb_query`; every answer returns rows plus the compiled SQL.",
      "Write eval records with the deterministic `nlqdb_remember` tool or a `POST /v1/run` parameterised INSERT, then trend over the same database — no separate analytics store.",
      "Plans are content-addressed on `(goal-fingerprint, schema-hash)` (`GLOBAL-006`), so a repeated weekly pass-rate rollup hits the cache and returns in single-digit ms.",
    ],
    whatItDoesnt: [
      "No running the evals or scoring outputs — your eval harness (promptfoo, Braintrust, LangSmith, or a custom judge) produces the scores; nlqdb stores and aggregates them.",
      "No LLM-as-judge built in — you bring the score per case; nlqdb is the query planner over the scored results, not the grader.",
      "No ingesting your existing eval store or LangSmith project — nlqdb stores the scored rows you write to it. If those scores already live in a Postgres or ClickHouse you run, connect it with the signed-in BYO connect verb (`SK-DBCONN-001`) and query it in place.",
    ],
    faqs: [
      {
        q: "Why not track LLM eval results in a spreadsheet?",
        a: "Because a spreadsheet can't answer 'which test cases regressed between v3 and v4' or 'pass rate per model this month' without manual pivoting, and it breaks as runs pile up. Those are GROUP BY and trend queries. Log each scored case as a row and nlqdb runs the aggregation in Postgres, showing the SQL it ran.",
      },
      {
        q: "How do the eval results get into the database?",
        a: "Write one row per scored case — prompt version, test case id, model, score, pass/fail, timestamp — with the deterministic `nlqdb_remember` MCP tool or a parameterised INSERT through `POST /v1/run` (`GLOBAL-015`). The row shape stays a trust boundary, built server-side, not LLM-guessed. Then ask the trend questions in English over the same table.",
      },
      {
        q: "Does nlqdb run the evals or score the outputs itself?",
        a: "No — your eval harness (promptfoo, Braintrust, LangSmith, or a custom LLM-as-judge) runs the cases and produces the scores. nlqdb is the database half: you log the scored results and get a SQL query planner over them for 'per version / over time' questions. They compose; nlqdb doesn't grade your outputs.",
      },
      {
        q: "Can I see the SQL behind a regression number?",
        a: "Always — every answer returns the result rows plus the compiled SQL under a trace toggle (`SK-WEB-005`), so you can check the grain (per case vs per run) before trusting a pass-rate figure. nlqdb never hides the SQL behind the answer.",
      },
    ],
    sources: [
      {
        url: "https://www.reddit.com/r/LLMDevs/search/?q=eval",
        label: "r/LLMDevs — recurring threads on tracking and comparing LLM eval results.",
      },
      {
        url: "https://www.reddit.com/r/LangChain/search/?q=evaluation",
        label:
          'r/LangChain — "how do you track eval scores across prompt versions" recurring discussion hub.',
      },
      {
        url: "https://hn.algolia.com/?q=llm+eval",
        label: 'HN search: "llm eval" — discussion on measuring and tracking LLM output quality.',
      },
    ],
  },
  {
    slug: "safely-give-ai-agent-database-access",
    persona: "P2 agent builder",
    searchTitle:
      "How do I safely give an AI agent database access without it running dangerous SQL?",
    oneLiner:
      "If you want an AI agent to use a database without handing it a connection string and hoping it never emits a DROP, nlqdb keeps the agent on the data side of a trust boundary: writes are server-built parameterised inserts, read SQL passes a fail-closed three-stage validator, Postgres RLS isolates every row, and the compiled SQL is always shown.",
    painContext:
      "Teams wiring an agent to SQL reach for the obvious shape — a read-only database role and a connection string in the tool config — then find it's leaky. A 'read-only' check enforced in app code is one SQL-comment trick away from a DELETE, a perfectly valid join can expose an oauth_tokens column, a single heavy query can exhaust the connection pool, and prompt-injected text sitting in a stored row can steer the next query. The risk is the agent holding credentials and authoring the SQL.",
    demoGoal: "things the agent logged grouped by type with a count of each",
    demoWhy:
      "The agent asks in English; nlqdb compiles and shows the exact SELECT, so you audit the grain — and the validator would have rejected anything that wasn't a read before it ran.",
    howNlqdbAnswers: [
      "Agent writes go through `nlqdb_remember`: the server builds a parameterised INSERT from a fixed column allow-list, so the agent supplies data, never SQL (`SK-PIVOT-008`).",
      "Read SQL passes a three-stage validator — leading-verb gate, `node-sql-parser` AST parse, embedded-verb walk — that fails closed, so a CTE-hidden DROP is rejected (`SK-SQLAL-001`).",
      "Postgres row-level security isolates tenant rows at the engine, enforced on reads and writes regardless of SQL shape — not a guard in app code.",
      "Every answer returns the compiled SQL under a trace toggle, and destructive operations show a row-count diff that needs a second confirmation before applying (`SK-ONBOARD-004`).",
    ],
    whatItDoesnt: [
      "nlqdb can connect to a Postgres you already run (the signed-in BYO connect verb), but connecting one does not import these guardrails onto it — the server-built-write boundary and per-tenant RLS apply to databases nlqdb provisions, so the safe-store model on this page is the provisioned database, not a connected prod DB. On a connected database, scope safety with a least-privilege role.",
      "No per-query statement-timeout or cost cap yet — a heavy SELECT can still run long; resource-exhaustion guards are tracked in the db-adapter, not wired.",
      "No per-agent (sub-tenant) row scoping yet — `app.agent_id` RLS is roadmap (E-03); today isolation is per-tenant / per-database, not per-agent-within-a-tenant.",
    ],
    faqs: [
      {
        q: "Is a read-only Postgres role enough to let an AI agent query my database safely?",
        a: "It's a start, but on its own it's leaky: a 'read-only' check enforced in app code is one SQL-comment trick from a write, a valid join can still expose a credentials column, and one heavy query can exhaust your connection pool. nlqdb layers engine-level guards — a fail-closed three-stage SQL validator plus Postgres row-level security — instead of trusting a single role or a single regex.",
      },
      {
        q: "How does nlqdb stop an agent from running a destructive or injected query?",
        a: "Writes never use agent-authored SQL — `nlqdb_remember` builds a parameterised INSERT server-side from a fixed column allow-list. Read SQL passes three independent stages (a leading-verb gate, a `node-sql-parser` AST parse, and an embedded-verb/function walk) and fails closed, so a CTE-hidden DROP, a `pg_sleep`, or an unparseable statement is rejected before it runs (`SK-SQLAL-001`).",
      },
      {
        q: "Can I see exactly what SQL the agent ran?",
        a: "Always — every answer returns the result rows plus the compiled SQL under a trace toggle (`SK-WEB-005`), and any destructive operation shows a row-count diff that needs a second confirmation before it applies (`SK-ONBOARD-004`). The SQL is the audit surface; nlqdb never hides it behind the answer.",
      },
      {
        q: "Can I point nlqdb at my existing production database to make it agent-safe?",
        a: "You can connect an existing database (the signed-in BYO connect verb), but that doesn't make it agent-safe — the server-built writes and per-tenant RLS on this page apply to databases nlqdb provisions, not one you connect. On a connected prod DB, scope a least-privilege role; for hard isolation, a read replica plus the validated read path is the safer shape.",
      },
    ],
    sources: [
      {
        url: "https://hn.algolia.com/?q=ai+agent+database",
        label:
          'HN search: "ai agent database" — recurring threads on giving agents safe DB access.',
      },
      {
        url: "https://www.reddit.com/r/LLMDevs/search/?q=agent+database+access",
        label:
          "r/LLMDevs — recurring threads on safe agent/LLM database access and SQL guardrails.",
      },
      {
        url: "https://www.reddit.com/r/AI_Agents/search/?q=database",
        label: 'r/AI_Agents — "let my agent query a database safely" recurring discussion hub.',
      },
    ],
  },
  {
    slug: "share-memory-across-multiple-ai-agents",
    persona: "P2 agent builder",
    searchTitle: "How do I give multiple AI agents shared, persistent memory?",
    oneLiner:
      "If you want a crew of agents to share one memory instead of each keeping its own, nlqdb gives them a single Postgres they all write to with `nlqdb_remember` and recall in English — every row tagged with the agent that wrote it, so you can roll the team's memory up per agent.",
    painContext:
      "Teams running multi-agent systems (CrewAI, LangGraph, AutoGen) hit the same wall: each agent keeps its own context, so they duplicate work, contradict each other, and lose decisions between steps. The usual fix is a shared vector store, but embeddings can't answer 'what did the research agent decide?' or 'how many tasks did each agent close?' — those are structured-query questions, not similarity ones.",
    demoGoal: "memories grouped by the agent that wrote them with a count of each",
    demoWhy:
      "Each agent's writes carry an `agent_id`, so one English question rolls the shared memory up per agent — the cross-team view a per-agent store can't give you.",
    howNlqdbAnswers: [
      "Every agent writes to one shared Postgres via `nlqdb_remember`: the server builds a parameterised insert, so each agent supplies data, never SQL (`SK-PIVOT-008`).",
      "Every row carries `agent_id`; facts and episodes also carry `end_user_id` and `thread_id`, so you attribute shared memory by which agent, user, or thread wrote it.",
      "Any agent recalls in English via `nlqdb_query` — nlqdb compiles NL→SQL over shared tables, so one agent reads what another wrote, with the SQL shown.",
      "It's one Postgres, so the engine handles concurrent writes; entities upsert on `(agent_id, kind, canonical_name)` so two agents recording the same thing don't duplicate.",
    ],
    whatItDoesnt: [
      "No per-agent access control yet — every agent sharing one nlqdb database sees the same rows. Engine-enforced private-vs-shared scoping (`app.agent_id` RLS) is roadmap (E-03), not shipped; today the boundary is per-database / per-tenant.",
      "No semantic / vector recall — recall is structured SQL (filter, `GROUP BY`, aggregate), not embedding similarity. Keep embeddings in your vector store; nlqdb is the structured shared memory beside it, not a replacement for it.",
      "This shared memory is a database nlqdb provisions for the crew — not a layer over a store you already run. You can connect an existing Postgres with the signed-in BYO connect verb instead, but the shared-memory model here assumes nlqdb owns the database all agents write to.",
    ],
    faqs: [
      {
        q: "How do multiple AI agents share memory in nlqdb?",
        a: "All agents write to and read from one shared Postgres database. Writes go through `nlqdb_remember` (a server-built parameterised insert); reads go through `nlqdb_query` (English compiled to SQL). Every row is tagged with the `agent_id` that wrote it, so one agent can recall another's memory and you can roll the whole crew's memory up per agent.",
      },
      {
        q: "Do I need a vector database for shared multi-agent memory?",
        a: "Only if your recall is similarity search. A lot of multi-agent memory is structured — 'what did each agent decide', 'count tasks per agent', 'the latest fact about this project' — which is a SQL question, not an embedding one. nlqdb covers that structured half; keep a vector store alongside it for semantic recall (that stays in your vector store, it's not shipped here).",
      },
      {
        q: "Can one agent read what another agent remembered?",
        a: "Yes — all agents sharing an nlqdb database query the same tables, so the research agent's facts are visible to the writer agent via `nlqdb_query`. The honest limit: there's no per-agent access control yet (`app.agent_id` RLS is roadmap, E-03), so today it's shared-by-default — every agent on that database sees every row.",
      },
      {
        q: "How does nlqdb handle concurrent writes from many agents at once?",
        a: "It's one Postgres, so concurrent inserts from multiple agents are handled by the database, not a hand-rolled merge loop. Entities upsert on `(agent_id, kind, canonical_name)`, so two agents recording the same project don't create duplicate rows — the conflict resolves to a single updated entity.",
      },
    ],
    sources: [
      {
        url: "https://hn.algolia.com/?q=multi-agent%20memory",
        label:
          'HN search: "multi-agent memory" — recurring threads on sharing state/memory across a crew of agents.',
      },
      {
        url: "https://www.reddit.com/r/LLMDevs/search/?q=shared%20memory%20agents",
        label: "r/LLMDevs — recurring threads on shared/persistent memory across multiple agents.",
      },
      {
        url: "https://www.reddit.com/r/AI_Agents/search/?q=shared%20memory",
        label: 'r/AI_Agents — "how do my agents share memory" recurring discussion hub.',
      },
    ],
  },
  {
    slug: "isolate-ai-agent-memory-per-tenant",
    persona: "P2 agent builder",
    searchTitle: "How do I isolate AI agent memory per tenant so accounts can't read each other?",
    oneLiner:
      "If your agent stores memory for many customers and one tenant's rows must stay invisible to another, nlqdb enforces it in the database: every provisioned Postgres carries a row-level-security policy keyed on the tenant, set per request, and fails closed — a missing scope returns no rows, never someone else's.",
    painContext:
      "The moment agent memory goes multi-tenant in production, the fear is a cross-tenant leak: one customer's facts surfacing in another's answer. The usual defence is a `WHERE tenant_id = ?` filter in application code, but it lives in the same layer that writes the query — one forgotten predicate, one LLM-generated statement that drops it, and every tenant's memory is exposed at once. Scope you can forget isn't isolation.",
    demoGoal: "memories grouped by user with a count of each",
    demoWhy:
      "The per-user breakdown an agent runs over its own memory — group by user, count each — is the same grain the engine isolates at the row level, below whatever SQL the model writes.",
    howNlqdbAnswers: [
      "Every Postgres gets a `tenant_isolation` RLS policy keyed on `app.tenant_id`, set per request — the engine filters reads and writes, whatever SQL the LLM emits.",
      "RLS fails closed: if tenant id is unset, the policy blocks all rows — a missing scope returns nothing, not another tenant's data.",
      "Per-`(mcp_host, device_id)` `sk_mcp_*` keys scope access per agent and device, so one tenant can share memory across an agent fleet without exposing another tenant's rows.",
      "Want hard physical isolation? Give each customer their own database — `nlqdb_query` with no `db` set provisions a fresh Postgres from the first English goal.",
    ],
    whatItDoesnt: [
      "No per-end-user row scoping *within one shared database* yet — agent-scope RLS keyed on `app.agent_id` is in progress (E-03, `SK-PIVOT-009`); today sub-tenant isolation is one key or one database per agent, not a single-DB row policy.",
      "No role hierarchy or app-level RBAC — isolation is tenant-grained RLS plus per-device keys, not a permissions matrix; model roles and grants in your own app.",
      "No applying this RLS isolation onto a database you already run — the tenant-isolation policy is set up on databases nlqdb provisions. You can connect an existing Postgres with the signed-in BYO connect verb, but nlqdb does not add its row-level-security policy to a database you bring; isolation there stays your schema's responsibility.",
    ],
    faqs: [
      {
        q: "How does nlqdb isolate AI agent memory between tenants?",
        a: "Every table in a provisioned database has a `tenant_isolation` row-level-security policy keyed on `current_setting('app.tenant_id')`, and the read/write path sets that value transaction-locally on every request. Postgres applies the predicate to each statement, so isolation lives in the engine, not in application code you have to remember to write.",
      },
      {
        q: "What stops the LLM's SQL from reading another tenant's rows?",
        a: "Row-level security runs below the SQL. The policy predicate is enforced on every read regardless of the CTEs, JOINs, or aliases the model writes — the compiled SQL can't widen its own scope. Even a query with no tenant filter at all only sees the current tenant's rows, because the engine adds the boundary, not the query.",
      },
      {
        q: "Can I isolate AI agent memory per end-user, not just per account?",
        a: "Within a single shared database, per-user / per-agent row scoping (`app.agent_id`) is in progress (E-03, `SK-PIVOT-009`) — not shipped yet. Today the shipped boundaries are per-tenant RLS and per-device API keys; for hard per-user isolation now, give each end-user their own provisioned database.",
      },
      {
        q: "How is this multi-tenant isolation different from a WHERE clause?",
        a: "A `WHERE tenant_id = ?` filter lives in application code, so one forgotten predicate — or one LLM-generated query that omits it — leaks every tenant. RLS lives in the database and applies to every statement, and it fails closed: a missing scope returns no rows instead of someone else's. The blast radius of a mistake is nothing, not everything.",
      },
    ],
    sources: [
      {
        url: "https://www.postgresql.org/docs/current/ddl-rowsecurity.html",
        label:
          "Postgres Row Security Policies — the engine-level mechanism nlqdb's tenant isolation is built on.",
      },
      {
        url: "https://hn.algolia.com/?q=multi-tenant%20row%20level%20security",
        label:
          'HN search: "multi-tenant row level security" — recurring threads on isolating tenants in one Postgres.',
      },
      {
        url: "https://www.reddit.com/r/LLMDevs/search/?q=multi-tenant%20memory",
        label:
          "r/LLMDevs — recurring threads on multi-tenant / per-user isolation for agent memory.",
      },
    ],
  },
  {
    slug: "query-existing-postgres-in-natural-language",
    persona: "P4 backend engineer",
    searchTitle: "How do I add a natural-language query layer over my existing Postgres?",
    oneLiner:
      "If you already run Postgres and want to ask it questions in English — without building or training a text-to-SQL stack — connect it to nlqdb with `nlq db connect` (or `POST /v1/db/connect`). nlqdb introspects your live schema, compiles English to SQL, runs it on your own database, and shows the SQL every time. Your data never leaves your Postgres.",
    painContext:
      "Backend engineers at small startups already own a Postgres and don't want a second store — they want a natural-language admin layer over the one they run, so a teammate (or an agent) can ask 'how many signups per plan this month?' without filing a SQL ticket. Most text-to-SQL tooling assumes you'll curate a training corpus, embed schema docs, or stand up a RAG layer first. The simple want — point it at the database I already have and let me ask — has had no clean shape.",
    demoGoal: "users grouped by signup month with a count of each",
    demoWhy:
      "The kind of ad-hoc admin question you'd otherwise hand-write SQL for — a grouped count over your own schema — answered from one English goal.",
    howNlqdbAnswers: [
      "Connect your database once with `POST /v1/db/connect` (or `nlq db connect`, the SDK, or `nlqdb_connect_database`, `SK-DBCONN-001`); nlqdb introspects the live schema — no training corpus.",
      "Your connection URL is sealed at rest (AES-256-GCM, `GLOBAL-031`); the host is egress-guarded and re-checked before every query (`GLOBAL-035`); only a redacted pill stays unsealed.",
      "English compiles to SQL and runs on your own Postgres — every answer returns rows plus the compiled SQL (`SK-WEB-005`) to audit.",
      "The data never moves — nlqdb queries your database in place over its own connection; no copy, no ETL, no second store to sync.",
    ],
    whatItDoesnt: [
      "No anonymous connect — pointing nlqdb at a database you run is a signed-in account verb on the SDK, CLI, and MCP; the public `<nlq-data>` embed holds a read-scoped key, never a connection credential, so the connect step isn't an embed (`GLOBAL-003`).",
      "No engine-side guardrails imported onto your database — the per-tenant RLS and server-built-write trust boundary nlqdb applies to databases it provisions are not added to a database you already run; nlqdb executes the compiled SQL with whatever privileges your connection role has, so scope it with a least-privilege (read-only) role.",
      "ClickHouse can be connected too, but the planner emits Postgres-flavored SQL and the validator is Postgres-dialect today (a known correctness gap, not a security one) — Postgres is the smooth path; ClickHouse-only syntax may mis-compile until the engine-aware planner lands.",
    ],
    faqs: [
      {
        q: "How do I connect my existing Postgres to nlqdb?",
        a: 'Once, with the connect verb: `POST /v1/db/connect { engine: "postgres", connection_url }`, or `nlq db connect`, the SDK `client.databases.connect`, or the MCP `nlqdb_connect_database` tool. nlqdb validates the connection, introspects your schema, seals the URL at rest, and mints a per-database key. After that you ask in English over your own database.',
      },
      {
        q: "Does my data leave my database when I use natural-language queries?",
        a: "No. nlqdb queries your Postgres in place over its own connection — there's no copy, no ETL, no analytics mirror. Your connection URL is sealed with AES-256-GCM at rest (`GLOBAL-031`); only a redacted connection pill is stored unsealed for the dashboard. The rows stay in your database.",
      },
      {
        q: "How is this different from Vanna AI or training a text-to-SQL model on my schema?",
        a: "There's no training corpus or per-tenant fine-tune to maintain. nlqdb prompts directly from your live schema fingerprint plus a recent-tables hint, caches the plan on `(goal-fingerprint, schema-hash)` (`GLOBAL-006`), and shows the compiled SQL every time. The equivalent of training is the automatic plan cache, not a curated example set you keep alive.",
      },
      {
        q: "Can I limit what nlqdb is allowed to do on my database?",
        a: "Yes — connect with a least-privilege role. nlqdb runs the compiled SQL with exactly the privileges your connection URL's role has, so a read-only role keeps it read-only at the engine. On top of that, the SQL validator allowlists verbs and the trace toggle shows every statement before you trust the answer.",
      },
    ],
    sources: [
      {
        url: "https://www.reddit.com/r/PostgreSQL/search/?q=natural+language",
        label:
          "r/PostgreSQL — recurring threads on natural-language / English querying over an existing Postgres.",
      },
      {
        url: "https://hn.algolia.com/?q=text+to+sql",
        label:
          'HN search: "text to sql" — discussion on querying your own database in English without a training loop.',
      },
      {
        url: "https://www.reddit.com/r/dataengineering/search/?q=text+to+sql",
        label: "r/dataengineering — practitioner threads on text-to-SQL over production databases.",
      },
    ],
  },
  {
    slug: "store-form-submissions-without-backend",
    persona: "P1 solo builder",
    searchTitle: "How do I store and query form submissions without a backend?",
    oneLiner:
      "If your landing page needs to capture form submissions — a waitlist, contact form, or survey — without running a backend, give nlqdb a database: write each submission with the SDK or a `POST /v1/run` insert, then ask 'signups per day' or 'replies by source' in plain English.",
    painContext:
      "Indie builders shipping a landing page or static site need somewhere to put form submissions — waitlist emails, contact-form messages, early-access signups — and the options all feel heavy: stand up a server and a database, pay a form SaaS that charges per submission, or glue a spreadsheet to a webhook. Then the moment you want 'how many signups this week?' or 'which referrer drove the most?', a pile of rows in a spreadsheet is the wrong shape for the question.",
    demoGoal: "signups grouped by day with a count of each",
    demoWhy:
      "The first question you ask after a launch — how many signups came in and when — is one English goal here, not a hand-written GROUP BY over a submissions table.",
    howNlqdbAnswers: [
      "Write each submission as a row with the `@nlqdb/sdk` or a `POST /v1/run` parameterised insert (`GLOBAL-015`) — no server of your own to run.",
      "Anonymous mode provisions a Postgres in seconds on the free chain — no signup before your first submission lands (`SK-ANON-001`).",
      "Ask 'signups per day' or 'submissions by source' in English via `<nlq-data>` or the SDK; every answer shows the compiled SQL.",
      "Adopt the anonymous database into your account within 72 hours to keep submissions past the trial window — no re-import (`SK-ANON-002`).",
    ],
    whatItDoesnt: [
      "The public `<nlq-data>` embed is read-scoped — it renders answers, it is not a write endpoint. Submissions go in through the SDK or `POST /v1/run`, run from your page's own fetch or a tiny serverless function, never from a write key exposed in client HTML.",
      "No email sending, double-opt-in, or autoresponders — nlqdb stores and queries the rows; delivering the welcome email is your ESP's job (Resend, Postmark, Mailchimp).",
      "No built-in spam or CAPTCHA protection — nlqdb stores whatever you write to it; bot-filtering the form is your front-end's responsibility (honeypot, Turnstile, rate-limit).",
    ],
    faqs: [
      {
        q: "Can I collect form submissions without running a backend server?",
        a: "Yes — provision an nlqdb database (anonymous mode mints one in seconds) and write each submission as a row with the `@nlqdb/sdk` or a `POST /v1/run` parameterised insert (`GLOBAL-015`). The insert call runs from your page's fetch or a small serverless function, so there's no server of your own to maintain. Then query the submissions in English. The honest limit: the public `<nlq-data>` embed reads, it doesn't write.",
      },
      {
        q: "How do I see how many signups I got per day or per source?",
        a: "Ask in English — 'signups grouped by day with a count' or 'submissions by referrer this week'. nlqdb compiles it to SQL over your submissions table, runs it, and returns the ranked rows with the compiled SQL under a trace toggle (`SK-WEB-005`) so you can verify the grain before trusting the number.",
      },
      {
        q: "Is this a replacement for a form service like Formspree or Tally?",
        a: "No — those render the form, capture the POST, and email you the entry, with spam filtering built in. nlqdb is the database half: you decide what to store and you get a SQL query planner over it for ad-hoc 'how many / by source' questions, without a per-submission fee or a spreadsheet pivot. They compose — point your form's handler at an nlqdb insert.",
      },
      {
        q: "How do I keep the data if I started in anonymous mode?",
        a: "Sign in within the 72-hour anonymous window and click 'Adopt this database' (`SK-ANON-002`). The database is re-keyed to your account, every submission row persists, and there's no re-import. Anonymous databases that aren't adopted sweep at 72h, so adopt before launch traffic piles up if you want to keep it.",
      },
    ],
    sources: [
      {
        url: "https://www.reddit.com/r/webdev/search/?q=form%20without%20backend",
        label: 'r/webdev — recurring "store form submissions without a backend" threads.',
      },
      {
        url: "https://www.reddit.com/r/sideproject/search/?q=waitlist",
        label: 'r/sideproject — "waitlist / signup collection" recurring discussion hub.',
      },
      {
        url: "https://hn.algolia.com/?q=form%20backend",
        label: 'HN search: "form backend" — discussion on capturing form data without a server.',
      },
    ],
  },
  {
    slug: "answer-data-questions-without-the-data-team",
    persona: "P3 analyst",
    searchTitle: "How do I answer ad-hoc data questions without waiting on the data team?",
    oneLiner:
      "If a simple number means filing a data ticket and waiting days, ask the question in English instead — drop an `<nlq-data>` tag in any page or open the chat, and nlqdb compiles the SQL, runs it, and returns the rows plus the query to audit. No ticket, no analyst in the loop.",
    painContext:
      "PMs, ops, and customer-success leads who can write SQL but resent it live in a data-ticket queue: every one-off 'what's the count by status this week' becomes a request that sits behind the data team's backlog for days. Self-service BI (Metabase, Looker, ThoughtSpot) helps, but only after someone models the data and builds the dashboard — the modelling step is itself a ticket. The question is simple; the wait is the problem.",
    demoGoal: "open tickets grouped by status this week, highest first",
    demoWhy:
      "The exact 'how many by status this week' rollup that would otherwise be a data-ticket is answered here from one English goal — no analyst, no dashboard build.",
    howNlqdbAnswers: [
      'Ask in plain English — an `<nlq-data goal="...">` tag in any page, or the hosted chat — and the answer returns with the SQL shown.',
      "Point it at a Postgres you already run via the signed-in BYO connect verb, or let nlqdb provision a fresh one — no ETL.",
      "Every answer shows the compiled SQL under a `Show trace` toggle, so a curious teammate can audit the grain before trusting the number.",
      "Free chain (Groq → Gemini) is free forever and never per-seat; occasional viewers cost nothing, unlike per-viewer BI licensing.",
    ],
    whatItDoesnt: [
      "No governed semantic layer or certified-metric catalog — nlqdb answers from the schema as it is; centrally curated metric definitions stay your data team's job.",
      "No drag-and-drop charts or dashboard builder — answers come back as tables plus a one-sentence summary; visualisation is the consumer's choice.",
      "BYO connect to a Postgres you already run is signed-in only (not the public embed), and the ClickHouse dialect isn't covered yet (`SK-DBCONN-001`).",
    ],
    faqs: [
      {
        q: "How is this different from self-service BI like Metabase or Looker?",
        a: "Those still need someone to model the data, define metrics, and build the dashboard before a non-analyst can self-serve — and that modelling is itself a ticket. nlqdb skips it: you ask in English and it compiles SQL against the live schema. The honest trade-off is there's no governed semantic layer, so certified company-wide metric definitions still belong with your data team.",
      },
      {
        q: "Can a non-technical teammate answer a data question without writing SQL?",
        a: "Yes — that's the point. The question stays in English; the compiled SQL is collapsed under a `Show trace` toggle so it's there to audit but never required. A PM or ops lead reads three numbers a day without filing a data ticket or learning the schema.",
      },
      {
        q: "Do I have to move our data into nlqdb first?",
        a: "No. Connect a Postgres you already run with the signed-in BYO connect verb (`nlq db connect`; see /solve/query-existing-postgres-in-natural-language) and query it in place — no ETL, no separate store. If you don't have a database yet, nlqdb can provision a fresh Postgres instead. Either path answers the same English question.",
      },
      {
        q: "Does this replace our data team?",
        a: "No — it removes the data-ticket queue for routine one-off questions, not the data team. Complex modelling, governed metrics, and pipeline work still belong with them. nlqdb handles the 'what's the count by status this week' asks that would otherwise sit in a backlog for days.",
      },
    ],
    sources: [
      {
        url: "https://www.reddit.com/r/analytics/search/?q=data%20team%20backlog",
        label: 'r/analytics — recurring "waiting on the data team / ticket backlog" threads.',
      },
      {
        url: "https://www.reddit.com/r/BusinessIntelligence/search/?q=self-service",
        label: "r/BusinessIntelligence — self-service-analytics discussion hub.",
      },
      {
        url: "https://hn.algolia.com/?q=self-serve%20analytics",
        label:
          'HN search: "self-serve analytics" — recurring threads on the data-ticket bottleneck.',
      },
    ],
  },
  {
    slug: "add-ask-your-data-feature-without-building-text-to-sql",
    persona: "P4 backend engineer",
    searchTitle: "How do I add an ask-your-data feature to my app without building text-to-SQL?",
    oneLiner:
      "If you want to ship an 'ask your data' feature in your app but don't want to build and maintain a text-to-SQL pipeline, embed nlqdb: drop the `<nlq-data>` element (or call `POST /v1/ask` from your backend), and it compiles English to SQL, runs it, and returns rows plus the SQL — buy the pipeline, don't build it.",
    painContext:
      "Backend engineers at small SaaS teams keep getting the same request: let our users ask questions of their own data in plain English — a search box, a reporting tab, an in-app assistant. Building it yourself means owning a text-to-SQL stack: prompt construction, schema injection, a SQL validator so the model can't drop a table, a plan cache, and an eval harness to keep accuracy from regressing. That's a quarter of work to maintain forever for a feature that isn't your core product. The build-vs-buy question has had no obvious buy answer.",
    demoGoal: "orders grouped by month with total revenue for each",
    demoWhy:
      "The kind of in-app report your users would ask for — a grouped revenue rollup — answered from one English goal, no SQL pipeline of your own.",
    howNlqdbAnswers: [
      'Embed `<nlq-data goal="...">` in your UI, or call `POST /v1/ask` from your backend — the text-to-SQL pipeline is the API, not your code.',
      "The SQL validator allowlists the verbs the model may emit, so a generated query can't drop a table or escape its scope.",
      "Every answer returns rows plus the compiled SQL (`SK-WEB-005`) for users to audit; plans cache on `(goal, schema-hash)` (`GLOBAL-006`).",
      "Quality is measured against BIRD Mini-Dev + Spider 2.0-lite and published — the accuracy is visible, not a marketing claim.",
    ],
    whatItDoesnt: [
      "It's a hosted pipeline you embed, not a library you vendor into your codebase — there's no self-hosted text-to-SQL container yet (roadmap, infra-gated). If the SQL generation must run inside your own infrastructure, nlqdb isn't that today.",
      "Serving many end-users each over their own data means a database (or per-tenant RLS scope) per tenant — per-user/agent row scoping within one shared database is in progress (E-03, `SK-PIVOT-009`), not shipped. Today isolation is one database or one key per tenant.",
      "The public `<nlq-data>` embed holds a read-scoped key — it reads, it doesn't write, and a write or connection credential must never sit in client HTML. Writes go through the SDK or `POST /v1/run` from your backend.",
    ],
    faqs: [
      {
        q: "Should I build or buy a text-to-SQL feature for my app?",
        a: "Building it means owning the whole stack — prompt construction, schema injection, a SQL validator so the model can't mutate data, a plan cache, and an eval harness to keep accuracy from regressing — forever, for a non-core feature. nlqdb is the buy answer: embed `<nlq-data>` or call `POST /v1/ask` and the pipeline is the API. The honest trade-off: it's hosted, not a library you vendor in.",
      },
      {
        q: "How do I add a natural-language query feature without writing the SQL generation myself?",
        a: "Embed the `<nlq-data goal=\"...\">` web component in your UI, or call `POST /v1/ask` from your backend with the user's English question. nlqdb introspects the schema, compiles the goal to SQL, runs it, and returns the rows plus the SQL it ran. You write no prompt, no schema-injection glue, and no validator — that's all behind the endpoint.",
      },
      {
        q: "What stops the LLM from generating SQL that drops or corrupts a table?",
        a: "Two guardrails. The SQL validator allowlists the verbs the orchestrator may emit (`docs/features/sql-allowlist`), so destructive statements are rejected before execution; and every answer surfaces the compiled SQL under a trace toggle (`SK-WEB-005`) so you and your users can audit the grain before trusting it. Destructive DDL also requires a row-count diff and second confirmation (`SK-ONBOARD-004`).",
      },
      {
        q: "Can my users each query only their own data?",
        a: "For a handful of tenants, give each its own provisioned database — clean physical isolation. For many users in one shared database, per-user/agent row scoping (`app.agent_id` RLS) is in progress (E-03), not shipped; per-tenant RLS keyed on `app.tenant_id` is the shipped boundary today. So plan on a database or an RLS-scoped key per tenant, not one open database for everyone.",
      },
    ],
    sources: [
      {
        url: "https://hn.algolia.com/?q=natural%20language%20query",
        label:
          'HN search: "natural language query" — recurring threads on adding an English-query feature to a product.',
      },
      {
        url: "https://www.reddit.com/r/SaaS/search/?q=text%20to%20sql",
        label: 'r/SaaS — "text to sql / ask your data" build-vs-buy discussion hub.',
      },
      {
        url: "https://www.reddit.com/r/dataengineering/search/?q=text+to+sql",
        label:
          "r/dataengineering — practitioner threads on building vs buying a text-to-SQL layer.",
      },
    ],
  },
  {
    slug: "store-and-query-webhook-events",
    persona: "P4 backend engineer",
    searchTitle: "How do I store webhook events in a database I can query in plain English?",
    oneLiner:
      "If you receive webhooks from Stripe, GitHub, or Twilio and want to ask 'how many events per type this week' without standing up a database first, write each verified payload to an nlqdb-provisioned Postgres and ask the report in English — the compiled SQL is shown underneath.",
    painContext:
      "A webhook receiver is easy; the database behind it is the part nobody wants to own. You wire up a tiny endpoint to accept the POST, and then you need somewhere to put the payloads and a way to ask 'how many checkout events failed yesterday' later. Standing up Postgres, designing a schema for an evolving payload, and writing the reporting queries is a side-quest for what should be an afternoon's plumbing.",
    demoGoal: "webhook events grouped by event type with a count of each",
    demoWhy:
      "The first question you ask of a webhook log — how many of each event type arrived — is one English goal here, not a schema design plus a GROUP BY you hand-write.",
    howNlqdbAnswers: [
      "Provision a Postgres in seconds, then write each webhook payload from your receiver via the `@nlqdb/sdk` client or `POST /v1/run`.",
      "Ask 'how many events per type this week' in English — nlqdb compiles the `GROUP BY` and shows the SQL it ran.",
      "Postgres JSONB stores the raw payload, so you query nested fields later without designing every column up front.",
      "Mutating writes accept an `Idempotency-Key` (`GLOBAL-005`), so a retried delivery isn't processed twice into your store.",
    ],
    whatItDoesnt: [
      "nlqdb is not the webhook receiver — you still need a tiny endpoint (a Cloudflare Worker or serverless function) to accept the provider's POST and verify its signature. nlqdb is where you store and query, not the HTTP listener.",
      "The public `<nlq-data>` embed reads; writes go through the authenticated SDK or `POST /v1/run` with an API key the browser never sees.",
      "No built-in signature verification or dead-letter queue — that stays in your receiver; nlqdb stores the verified payloads and answers questions over them.",
    ],
    faqs: [
      {
        q: "How do I store webhook events without standing up my own Postgres?",
        a: "Point your webhook receiver at nlqdb: it provisions a Postgres for you, and each verified payload is written via the `@nlqdb/sdk` client or `POST /v1/run`. There's no connection string to manage or migration to run before the first event lands. The trade-off is honest — nlqdb owns the database it provisions, so it isn't a connector over a warehouse you already run.",
      },
      {
        q: "Can I query the stored webhook events in plain English?",
        a: "Yes. Ask 'how many checkout events this week, grouped by day' and nlqdb compiles the SQL, runs it, and shows the query alongside the rows so you can audit the grain. The raw payload is kept as JSONB, so you can also filter on nested fields you never promoted to columns.",
      },
      {
        q: "Does nlqdb receive the webhook and verify the signature for me?",
        a: "No — you keep a small receiver (a serverless function or Worker) that accepts the provider's POST and verifies its signature, then writes the payload to nlqdb. nlqdb is the queryable store and natural-language reporting layer, not the HTTP listener. Mutating writes accept an `Idempotency-Key` so a retried delivery isn't double-processed.",
      },
      {
        q: "How is this different from storing form submissions without a backend?",
        a: "Form capture is browser-side — the page's own `fetch` writes a submission behind a key. Webhooks are server-to-server: a provider like Stripe or GitHub POSTs to your endpoint, you verify, then write. Both end at the same place — a Postgres you ask 'how many' over in English — but the write path differs. See /solve/store-form-submissions-without-backend for the form case.",
      },
    ],
    sources: [
      {
        url: "https://hn.algolia.com/?q=webhook+database",
        label:
          'HN search: "webhook database" — recurring threads on where to store and query incoming webhook events.',
      },
      {
        url: "https://www.reddit.com/r/webdev/search/?q=store%20webhooks",
        label: "r/webdev — recurring 'where do I store webhook payloads' threads.",
      },
      {
        url: "https://stackoverflow.com/questions/tagged/webhooks",
        label:
          "Stack Overflow [webhooks] tag — the enduring Q&A hub for receiving and persisting webhook events.",
      },
    ],
  },
  {
    slug: "track-product-usage-without-a-data-warehouse",
    persona: "P1 solo builder",
    searchTitle: "How do I track product usage events and query them without a data warehouse?",
    oneLiner:
      "If you want to track product usage — signups, feature clicks, retention — and ask 'active users this week' without standing up Snowflake or paying Mixpanel per event, give nlqdb a database: emit each event with the SDK or a `POST /v1/run` insert, then ask the rollup in plain English with the SQL shown.",
    painContext:
      "Indie builders and small teams who want to know what their product is doing — daily active users, which feature got used, how a funnel converts — face two heavy options: pay Mixpanel/Amplitude per event and outgrow the free tier fast, or run a warehouse (Snowflake, BigQuery) plus an ingestion pipeline and learn SQL to query it. The recurring fallback on Indie Hackers and HN is 'just store events in Postgres and query them' — which is right, but then every 'active users this week' is a hand-written GROUP BY you'd rather not own.",
    demoGoal: "active users grouped by day this week, with an event count for each",
    demoWhy:
      "The first question after wiring up event tracking — how many active users per day — is one English goal here, not a windowed GROUP BY over an events table.",
    howNlqdbAnswers: [
      "Emit each event as a row with the `@nlqdb/sdk` or a `POST /v1/run` parameterised insert (`GLOBAL-015`) — no warehouse or pipeline to run.",
      "Anonymous mode provisions a Postgres in seconds on the free chain — start logging events before you sign up (`SK-ANON-001`).",
      "Ask 'active users per day' or 'top features this week' in English via `<nlq-data>` or the SDK; every answer shows the compiled SQL.",
      "Free chain (Groq → Gemini) is free forever and never priced per event, so growing event volume never pushes you off a billing tier.",
    ],
    whatItDoesnt: [
      "No autocapture SDK, no session replay, no funnel/retention UI — nlqdb stores the events you write and answers SQL questions over them; product-analytics dashboards (PostHog, Mixpanel, Amplitude) are a different shape.",
      "You emit the events yourself — nlqdb doesn't instrument your app or pick which events matter; it's the queryable store and the English-to-SQL layer, not a tracking client.",
      "The public `<nlq-data>` embed is read-scoped — it renders answers, it isn't a write endpoint. Events go in through the SDK or `POST /v1/run`, run from your backend or a serverless function, never a write key in client HTML.",
    ],
    faqs: [
      {
        q: "Can I track product usage events without a data warehouse?",
        a: "Yes — provision an nlqdb database (anonymous mode mints one in seconds) and write each usage event as a row with the `@nlqdb/sdk` or a `POST /v1/run` parameterised insert (`GLOBAL-015`). There's no Snowflake/BigQuery to stand up and no ingestion pipeline to run. Then ask 'active users this week' in English. The honest limit: you emit the events; nlqdb stores and queries them, it doesn't autocapture.",
      },
      {
        q: "How do I query product analytics events in plain English instead of SQL?",
        a: "Ask the question — 'active users grouped by day this week' or 'top 10 features by event count'. nlqdb compiles it to SQL over your events table, runs it, and returns the ranked rows plus the compiled SQL under a `Show trace` toggle (`SK-WEB-005`) so you can audit the grain before trusting the number.",
      },
      {
        q: "Is this a replacement for Mixpanel, Amplitude, or PostHog?",
        a: "No — those autocapture events, render funnel/retention dashboards, and do session replay. nlqdb is the database-plus-English-query half: you choose what to log and get a SQL planner over it for ad-hoc 'how many / by feature' questions, without per-event billing or a warehouse. They compose — point your tracking client's sink at an nlqdb insert.",
      },
      {
        q: "How do I keep the events if I started in anonymous mode?",
        a: "Sign in within the 72-hour anonymous window and click 'Adopt this database' (`SK-ANON-002`). The database is re-keyed to your account, every event row persists, and there's no re-import. Anonymous databases that aren't adopted sweep at 72h, so adopt before real traffic piles up if you want to keep the history.",
      },
    ],
    sources: [
      {
        url: "https://www.indiehackers.com/search?q=product%20analytics",
        label:
          "Indie Hackers — recurring 'what do you use for product analytics' threads where 'just store events in Postgres' is the standing fallback.",
      },
      {
        url: "https://www.reddit.com/r/SaaS/search/?q=product%20analytics",
        label: "r/SaaS — recurring 'product analytics without paying per event' discussion hub.",
      },
      {
        url: "https://hn.algolia.com/?q=product%20analytics%20self-hosted",
        label:
          'HN search: "product analytics self-hosted" — discussion on querying usage events without a warehouse.',
      },
    ],
  },
  {
    slug: "track-background-job-run-history",
    persona: "P4 backend engineer",
    searchTitle: "How do I log my background jobs and query which one fails most?",
    oneLiner:
      "If your cron and background jobs fail silently and you need to know which one fails most — log every run as a row and ask in English. nlqdb provisions Postgres from your first goal and runs the GROUP BY in SQL, so 'failure rate per job this week' is a real query, not a grep over scheduler logs.",
    painContext:
      "Teams running scheduled work — nightly cron, queue workers, ETL tasks, cleanup scripts — usually find out a job broke only when something downstream is already wrong. The run history lives in scattered scheduler logs, a JSON column, or stdout nobody reads, so the questions that matter — which job fails most, how long each takes, how many ran today — mean grepping log files instead of a GROUP BY. Counting failures by hand doesn't scale; these are queries, and queries want a planner.",
    demoGoal:
      "job runs grouped by job name this week with a failure count and average duration for each",
    demoWhy:
      "The first reliability question after a job breaks — which job fails most and how slow it runs — is one English goal here, not a grep over scheduler logs.",
    howNlqdbAnswers: [
      "Log each run as a typed row — job name, status, duration_ms, started_at — so failures-per-job and average-duration run as SQL GROUP BY.",
      "Ask the reliability question in English via `<nlq-data>`, the `@nlqdb/sdk`, or MCP `nlqdb_query`; every answer returns rows plus the compiled SQL.",
      "Write run records with a `POST /v1/run` parameterised insert (`GLOBAL-015`) from your job's exit hook, then report over the same database.",
      "Plans are content-addressed on `(goal-fingerprint, schema-hash)` (`GLOBAL-006`), so a repeated weekly reliability rollup hits the cache and returns in single-digit ms.",
    ],
    whatItDoesnt: [
      "nlqdb is not a scheduler or cron runner — it doesn't run your jobs or trigger them on a schedule; it stores and queries the run records you write after each job finishes.",
      "No dead-man's-switch alerting — nlqdb won't notice a job that never ran and page you; heartbeat monitoring is Healthchecks.io or Cronitor's job. nlqdb answers questions over the runs you did record.",
      "The public `<nlq-data>` embed is read-scoped — it renders answers, it isn't a write endpoint. Run records go in through the SDK or `POST /v1/run` from your job, never a write key in client HTML.",
    ],
    faqs: [
      {
        q: "How do I track which background job fails most without a monitoring service?",
        a: "Log one row per run — job name, status, duration, timestamp — with a `POST /v1/run` parameterised insert (`GLOBAL-015`) from your job's exit hook, then ask 'failure rate per job this week' in English. nlqdb compiles the GROUP BY, runs it in Postgres, and shows the SQL. The honest limit: you write the run records; nlqdb stores and queries them, it doesn't run or watch your jobs.",
      },
      {
        q: "Why not just grep my scheduler or cron logs?",
        a: "Because the questions are aggregations — failures per job, p95 duration, runs per day — and grepping flat logs to tally them by hand is fragile and slow as run volume grows. Asking an LLM to count a log hallucinates. nlqdb runs the GROUP BY in Postgres and shows you the SQL it ran, so you can trust the grain.",
      },
      {
        q: "Is this a replacement for a cron-monitoring tool like Healthchecks.io or Cronitor?",
        a: "No — those ping a heartbeat URL and alert you when a job *doesn't* run, with dead-man's-switch logic built for it. nlqdb is the database half: you log each run that did happen and get a SQL query planner over it for 'per job / per week' reliability questions. They compose; nlqdb doesn't watch for missing runs or page you.",
      },
      {
        q: "Can I see the SQL behind a job's failure rate?",
        a: "Always — every answer returns the result rows plus the compiled SQL under a trace toggle (`SK-WEB-005`), so you can check the grain (per run vs per job) before trusting a failure rate. nlqdb never hides the SQL behind the answer.",
      },
    ],
    sources: [
      {
        url: "https://www.reddit.com/r/devops/search/?q=cron+monitoring",
        label: "r/devops — recurring 'how do you monitor cron / scheduled jobs' threads.",
      },
      {
        url: "https://hn.algolia.com/?q=cron+monitoring",
        label:
          'HN search: "cron monitoring" — discussion on tracking scheduled-job failures and run history.',
      },
      {
        url: "https://www.reddit.com/r/sysadmin/search/?q=cron+job+failures",
        label: "r/sysadmin — 'cron job failures / run history' recurring discussion hub.",
      },
    ],
  },
  {
    slug: "find-duplicate-rows-in-my-data",
    persona: "P3 analyst",
    searchTitle: "How do I find duplicate rows in my data without writing SQL?",
    oneLiner:
      "If you need to find duplicate rows — the same email twice, an import that ran twice, a customer entered three times — ask in plain English instead of hand-writing GROUP BY ... HAVING. nlqdb compiles the dedup query, runs it in Postgres, and shows the SQL, so you see exactly which rows repeat and how many times.",
    painContext:
      "Analysts, ops, and support leads hit duplicate data constantly — a customer signed up twice, an import ran twice, a join fanned out and doubled every row. The canonical fix is `GROUP BY` the suspect columns and `HAVING COUNT(*) > 1`, but if you don't write SQL every day that's exactly the kind of query you re-Google each time, get subtly wrong (counting the wrong grain), or file a data ticket for. The pain isn't that it's hard SQL — it's that it's recurring, fiddly SQL for a yes/no question.",
    demoGoal:
      "customers that appear more than once by email address, showing how many times each one appears",
    demoWhy:
      "The exact query you'd otherwise hand-write — GROUP BY the column, HAVING count greater than one — is one English goal here, with the SQL shown so you can trust the grain.",
    howNlqdbAnswers: [
      "Ask 'which rows are duplicated by email?' in plain English; nlqdb compiles the `GROUP BY ... HAVING COUNT(*) > 1` and runs it in Postgres.",
      "Every answer returns the duplicate rows plus the compiled SQL under a trace toggle (`SK-WEB-005`) — check the grain before trusting a count.",
      "Works no-code over a provisioned demo, or connect a Postgres you already run (BYO connect, `SK-DBCONN-001`) to dedupe your real data.",
      "Repeated checks hit the plan cache — content-addressed on `(goal-fingerprint, schema-hash)` (`GLOBAL-006`) — so the same dedup question returns in single-digit ms.",
    ],
    whatItDoesnt: [
      "nlqdb finds and reports duplicates with a read-only SELECT — it doesn't delete or merge them for you. Which row to keep and how to merge stays a deliberate write you run yourself.",
      "The public `<nlq-data>` embed is read-scoped — it surfaces duplicates, it isn't a data-cleaning pipeline. Bulk fixes go through the SDK or `POST /v1/run`, never a write key in client HTML.",
      "No fuzzy / approximate matching out of the box — 'duplicate' means exact equality on the columns you name. Near-duplicates ('Jon' vs 'John', trailing spaces) need a normalising expression you specify in the question.",
    ],
    faqs: [
      {
        q: "How do I find duplicate rows in my data without writing SQL?",
        a: "Ask in plain English — 'which customers appear more than once by email?' nlqdb compiles the canonical `GROUP BY email HAVING COUNT(*) > 1`, runs it in Postgres, and returns the repeated rows plus the SQL it ran. You see which values duplicate and how many times, without hand-writing the query or filing a data ticket. The honest limit: it reports duplicates; it doesn't delete or merge them.",
      },
      {
        q: "What SQL does nlqdb use to find duplicates?",
        a: "The standard pattern: `GROUP BY` the columns you're checking and `HAVING COUNT(*) > 1` to keep only the groups that repeat. nlqdb writes and runs that query for you and shows it under a trace toggle, so you can confirm it grouped by the right columns. If you need the full duplicate rows (not just the duplicated keys), ask for the rows and it wraps that in a window-function or self-join.",
      },
      {
        q: "Can I dedupe a Postgres database I already run?",
        a: "Yes — connect it with the signed-in BYO connect verb (`nlq db connect`, `SK-DBCONN-001`; see /solve/query-existing-postgres-in-natural-language) and ask the duplicate question in place, no ETL into a separate store. The honest limits: BYO connect is signed-in only (not the public embed), and nlqdb reports the duplicates with a read-only query — deleting or merging them is a write you run deliberately.",
      },
      {
        q: "Why not just ask ChatGPT to find the duplicates in my data?",
        a: "A chat model can write you a `GROUP BY ... HAVING` query, but it can't run it against your data — and if you paste rows in and ask it to count, it hallucinates the tally. nlqdb runs the actual SQL in Postgres and returns real rows plus the query it ran, so the duplicate count is computed, not guessed.",
      },
    ],
    sources: [
      {
        url: "https://stackoverflow.com/questions/tagged/sql+duplicates",
        label:
          "Stack Overflow — the 'sql + duplicates' tag intersection, a perennial 'how do I find duplicate rows' hub.",
      },
      {
        url: "https://www.reddit.com/r/SQL/search/?q=duplicates",
        label: "r/SQL — recurring 'find / remove duplicate rows' threads.",
      },
      {
        url: "https://learnsql.com/blog/how-to-find-duplicate-values-in-sql/",
        label:
          "LearnSQL — evergreen 'How to Find Duplicate Values in SQL' guide (the GROUP BY ... HAVING canonical method).",
      },
    ],
  },
  {
    slug: "find-top-n-rows-per-group",
    persona: "P3 analyst",
    searchTitle: "How do I get the top N rows per category without window-function SQL?",
    oneLiner:
      "If you need the top N rows in each group — the 3 best-selling products per category, or the latest order per customer — ask in plain English instead of hand-writing a window function. nlqdb compiles the ranked query, runs it in Postgres, and shows the SQL so you trust the partition and tiebreak.",
    painContext:
      "Analysts and PMs hit this constantly — top 3 products per region, the most recent order per customer, the highest-scoring attempt per user. It's the classic 'greatest-n-per-group' problem, and the correct answer is a window function (`ROW_NUMBER() OVER (PARTITION BY ...)`) or a lateral join — exactly the SQL that trips people up, gets re-Googled every time, or turns into a data ticket. A plain `GROUP BY` gives you the max value but loses the rest of the row; the pain is getting the whole top-N rows, per group, right.",
    demoGoal: "the top 3 best-selling products in each category, by total revenue",
    demoWhy:
      "The exact query you'd otherwise reach for a window function or lateral join — ranked within each group — is one English goal here, with the SQL shown so you can check the partition and the tiebreak.",
    howNlqdbAnswers: [
      "Ask 'top 3 products per category by revenue'; nlqdb compiles the `ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...)` and runs it in Postgres.",
      "Every answer returns the ranked rows plus the compiled SQL under a trace toggle (`SK-WEB-005`) — confirm the partition and tiebreak before trusting it.",
      "Works no-code over a provisioned demo, or connect a Postgres you already run (BYO connect, `SK-DBCONN-001`) to rank your real data.",
      "Repeated rankings hit the plan cache — content-addressed on `(goal-fingerprint, schema-hash)` (`GLOBAL-006`) — so the same top-N question returns in single-digit ms.",
    ],
    whatItDoesnt: [
      "nlqdb answers the top-N question with a read-only SELECT — it's not a BI tool that maintains a live 'top sellers' dashboard or alerts you when the ranking shifts. That's a scheduled job's work.",
      "The public `<nlq-data>` embed is read-scoped — it ranks and surfaces rows, it doesn't write. No write key belongs in client HTML; bulk changes go through the SDK or `POST /v1/run`.",
      "Ranking is exact SQL ordering on the columns you name — ties break by those columns (or `RANK()` / `DENSE_RANK()` if you ask). There's no fuzzy or learned relevance ranking.",
    ],
    faqs: [
      {
        q: "How do I get the top N rows per group without writing window-function SQL?",
        a: "Ask in plain English — 'top 3 products per category by revenue.' nlqdb compiles the canonical `ROW_NUMBER() OVER (PARTITION BY category ORDER BY revenue DESC)` filtered to rank ≤ 3, runs it in Postgres, and returns the ranked rows plus the SQL it ran. You get the per-group top-N without hand-writing a window function or a correlated subquery. The honest limit: it's a one-off ranked answer, not a saved dashboard.",
      },
      {
        q: "What SQL does nlqdb use to rank rows within each group?",
        a: "The modern pattern: a window function — `ROW_NUMBER() OVER (PARTITION BY <group> ORDER BY <metric> DESC)` in a subquery, then keep rows where the rank is ≤ N. nlqdb writes and runs that for you and shows it under a trace toggle, so you can confirm it partitioned by the right column. Ask for ties-included ranking and it switches `ROW_NUMBER` to `RANK` or `DENSE_RANK`.",
      },
      {
        q: "Can I rank rows in a Postgres database I already run?",
        a: "Yes — connect it with the signed-in BYO connect verb (`nlq db connect`, `SK-DBCONN-001`; see /solve/query-existing-postgres-in-natural-language) and ask the top-N question in place, no ETL into a separate store. The honest limits: BYO connect is signed-in only (not the public embed), and nlqdb returns the ranking with a read-only query — it doesn't persist a materialized leaderboard for you.",
      },
      {
        q: "Why not just ask ChatGPT for the top N per group?",
        a: "A chat model can write you a window-function query, but it can't run it against your data — and if you paste rows in and ask it to rank, it miscounts or invents rows. nlqdb runs the actual SQL in Postgres and returns the real ranked rows plus the query it ran, so the top-N is computed, not guessed.",
      },
    ],
    sources: [
      {
        url: "https://stackoverflow.com/questions/tagged/greatest-n-per-group",
        label:
          "Stack Overflow — the canonical `greatest-n-per-group` tag, the perennial 'top N rows per group' hub.",
      },
      {
        url: "https://en.wikibooks.org/wiki/Structured_Query_Language/Retrieve_Top_N_Rows_per_Group",
        label:
          "Wikibooks SQL — evergreen 'Retrieve Top N Rows per Group' chapter (window-function + join methods).",
      },
      {
        url: "https://blogs.oracle.com/sql/how-to-select-the-top-n-rows-per-group-with-sql-in-oracle-database",
        label:
          "Oracle SQL blog — 'How to select the top-N rows per group with SQL' (window functions as the method of choice).",
      },
    ],
  },
  {
    slug: "pivot-rows-into-columns",
    persona: "P3 analyst",
    searchTitle: "How do I pivot rows into columns in SQL without writing a crosstab query?",
    oneLiner:
      "If you need a pivot table — rows turned into columns, like revenue per product with one column per month — ask in plain English instead of hand-writing a crosstab. nlqdb compiles the conditional aggregation, runs it in Postgres, and shows the SQL so you can verify the buckets.",
    painContext:
      "PMs, ops, and analysts hit this every reporting cycle — revenue per product with months across the top, signups per plan by week, counts per status as columns. It's the pivot / crosstab problem, and the SQL is fiddly: Postgres has no `PIVOT` keyword, so the answer is conditional aggregation (`SUM(...) FILTER (WHERE ...)` or `SUM(CASE WHEN ... THEN ...)`) — one expression per output column — or the `crosstab()` function from the `tablefunc` extension. Either way it gets re-Googled every time or filed as a data ticket, and a plain `GROUP BY` gives you tall rows, not the wide table the spreadsheet wants.",
    demoGoal: "total revenue per product with one column for each month this year",
    demoWhy:
      "The exact wide report you'd otherwise hand-write with one CASE expression per month is one English goal here, with the SQL shown so you can check each bucket.",
    howNlqdbAnswers: [
      "Ask 'revenue per product, one column per month'; nlqdb compiles the conditional aggregation (`SUM(...) FILTER (WHERE month = ...)`) and runs it in Postgres.",
      "Every answer returns the pivoted table plus the compiled SQL under a trace toggle (`SK-WEB-005`) — confirm each column's bucket before trusting it.",
      "Works no-code over a provisioned demo, or connect a Postgres you already run (BYO connect, `SK-DBCONN-001`) to pivot your real data.",
      "Repeated pivots hit the plan cache — content-addressed on `(goal-fingerprint, schema-hash)` (`GLOBAL-006`) — so the same wide report returns in single-digit ms.",
    ],
    whatItDoesnt: [
      "The pivot columns must be ones you can name — 'months this year', 'these three statuses'. A fully dynamic crosstab over a category set unknown until query time needs that list resolved first; nlqdb doesn't generate columns from values it hasn't seen.",
      "nlqdb returns the pivoted table with a read-only SELECT — it's not a BI tool maintaining a live crosstab dashboard or refreshing the wide report on a schedule. That's a scheduled job's work.",
      "The public `<nlq-data>` embed is read-scoped — it reshapes and surfaces rows, it doesn't write. No write key belongs in client HTML; loading the data goes through the SDK or `POST /v1/run`.",
    ],
    faqs: [
      {
        q: "How do I pivot rows into columns without writing a crosstab query?",
        a: "Ask in plain English — 'revenue per product, one column per month.' nlqdb compiles the conditional aggregation (one `SUM(...) FILTER (WHERE ...)` per output column), runs it in Postgres, and returns the wide table plus the SQL it ran. You get the pivot without hand-writing a CASE expression per column or wiring the `tablefunc` extension. The honest limit: the columns must be ones you can name.",
      },
      {
        q: "Does nlqdb use SQL Server's PIVOT keyword or Postgres crosstab?",
        a: "Neither by default — nlqdb is Postgres-first, and the portable pivot pattern there is conditional aggregation: `SUM(amount) FILTER (WHERE month = 'Jan')` as one column, repeated per bucket. That needs no `PIVOT` keyword (Postgres has none) and no `tablefunc` extension. The compiled SQL shows under the trace toggle so you can confirm each column maps to the bucket you meant.",
      },
      {
        q: "Can I pivot a Postgres database I already run?",
        a: "Yes — connect it with the signed-in BYO connect verb (`nlq db connect`, `SK-DBCONN-001`; see /solve/query-existing-postgres-in-natural-language) and ask for the wide report in place, no ETL into a separate store. The honest limits: BYO connect is signed-in only (not the public embed), and nlqdb returns the pivot with a read-only query — it doesn't persist a materialized crosstab for you.",
      },
      {
        q: "Why not just pivot in Excel or a spreadsheet?",
        a: "A spreadsheet pivot table works once you've exported the rows — but it's a manual copy each refresh, capped by row count, and detached from the live data. Asking nlqdb runs the aggregation in the database against current rows and shows the SQL, so the wide report is reproducible and auditable rather than a stale paste. Export the result to a sheet afterward if you like.",
      },
    ],
    sources: [
      {
        url: "https://stackoverflow.com/questions/tagged/pivot",
        label:
          "Stack Overflow — the `pivot` tag, the perennial 'turn rows into columns' hub across SQL dialects.",
      },
      {
        url: "https://wiki.postgresql.org/wiki/Pivot_Tables",
        label:
          "PostgreSQL Wiki — evergreen 'Pivot Tables' page (conditional aggregation + `crosstab()` methods).",
      },
      {
        url: "https://www.postgresql.org/docs/current/tablefunc.html",
        label:
          "PostgreSQL docs — the `tablefunc` extension `crosstab()` reference, the canonical Postgres pivot primitive.",
      },
    ],
  },
];

export function solveBySlug(slug: string): SolveEntry | undefined {
  return SOLVE_ENTRIES.find((s) => s.slug === slug);
}
