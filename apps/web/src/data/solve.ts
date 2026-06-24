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
      "No connecting to a database you already run — nlqdb provisions and owns the Postgres it queries; bring-your-own-Postgres is roadmap, not shipped. To query an existing DB over MCP, a Postgres-MCP server is the right shape.",
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
        a: "Today, yes — nlqdb provisions and owns the Postgres it queries (Phase 2 adds ClickHouse). Bring-your-own-Postgres is tracked in the roadmap; for an existing DB today, Vanna AI is the right shape.",
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
      "MCP `nlqdb_query` provisions Postgres from the agent's first English goal (no `db` set → creates one when the agent has none) and answers in English — plus `nlqdb_list_databases` / `nlqdb_describe`, no human in the loop.",
      "Memory is typed rows in real Postgres, so the agent can `GROUP BY`, rank top-N, and aggregate per-period over what it stored — not just recall a single fact by similarity.",
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
      "The agent's memory is typed rows in real Postgres, so `GROUP BY`, top-N, and per-period rollups run as actual SQL — not arithmetic over a list of search hits.",
      "Ask the report in English via MCP `nlqdb_query`; the answer returns as rows plus the compiled SQL under a trace toggle, so you audit the grain before trusting it.",
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
      "No support today for bring-your-own-Postgres — nlqdb owns the Postgres it queries; existing databases are not yet a supported input.",
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
      "Conversation turns live as typed rows in real Postgres, so 'messages per day', 'most active users', and 'average turns per session' run as actual SQL GROUP BY — not arithmetic over a list of search hits.",
      "Ask the engagement question in English via MCP `nlqdb_query` or the `@nlqdb/sdk`; every answer returns rows plus the compiled SQL under a trace toggle so you can audit the grain.",
      "Write turns with the deterministic `nlqdb_remember` tool (or a `POST /v1/run` parameterised INSERT) and report over the same database — no second analytics store, no ETL.",
      'Schema evolves in English: `"add a sentiment column to messages"` migrates the table; the diff is shown before apply (`SK-ONBOARD-004`).',
    ],
    whatItDoesnt: [
      "No semantic search over message text — finding the most similar past message is a vector store's job (Mem0, pgvector); nlqdb answers the counting questions, not the similarity ones.",
      "No connecting to your existing logging store — nlqdb provisions and owns the Postgres it queries; bring-your-own-Postgres is roadmap, not shipped.",
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
      "Log each call as a typed row — user, model, prompt/completion tokens, cost, timestamp — so cost-per-user and tokens-per-model run as real SQL GROUP BY, not log math.",
      "Ask the cost question in English via the `<nlq-data>` element, the `@nlqdb/sdk`, or MCP `nlqdb_query`; every answer returns rows plus the compiled SQL under a trace toggle.",
      "Write usage rows with the deterministic `nlqdb_remember` tool or a `POST /v1/run` parameterised INSERT, and report over the same database — no separate analytics store, no ETL.",
      "Plans are content-addressed on `(goal-fingerprint, schema-hash)` (`GLOBAL-006`), so a repeated weekly cost rollup hits the cache and returns in single-digit ms.",
    ],
    whatItDoesnt: [
      "No automatic token metering — nlqdb stores and aggregates the usage rows you write; counting tokens and computing cost per call is your app's job (or your provider SDK's).",
      "No connecting to your existing logging or billing store — nlqdb provisions and owns the Postgres it queries; bring-your-own-Postgres is roadmap, not shipped.",
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
      "Log each tool call as a typed row — tool name, session id, status, latency_ms, timestamp — so error-rate-per-tool and p95-latency run as real SQL GROUP BY.",
      "Ask the reliability question in English via `<nlq-data>`, the `@nlqdb/sdk`, or MCP `nlqdb_query`; every answer returns rows plus the compiled SQL.",
      "Write call records with the deterministic `nlqdb_remember` tool or a `POST /v1/run` parameterised INSERT, then report over the same database — no separate analytics store.",
      "Plans are content-addressed on `(goal-fingerprint, schema-hash)` (`GLOBAL-006`), so a repeated weekly reliability rollup hits the cache and returns in single-digit ms.",
    ],
    whatItDoesnt: [
      "No automatic tracing — nlqdb stores and aggregates the call rows you write; capturing each tool invocation, its status, and its latency is your agent framework's job (or an OTel/tracing SDK's).",
      "No nested trace-tree UI — nlqdb answers tabular 'per tool / per session' aggregations, not the multi-step span waterfall a dedicated agent-observability tool draws.",
      "No connecting to your existing log store — nlqdb provisions and owns the Postgres it queries; bring-your-own-Postgres is roadmap, not shipped.",
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
      "Log each retrieval as a typed row — query id, source document, relevance score, timestamp — so retrievals-per-source and avg-score run as real SQL GROUP BY.",
      "Ask the retrieval-quality question in English via `<nlq-data>`, the `@nlqdb/sdk`, or MCP `nlqdb_query`; every answer returns rows plus the compiled SQL.",
      "Write retrieval records with the deterministic `nlqdb_remember` tool or a `POST /v1/run` parameterised INSERT, then report over the same database — no separate analytics store.",
      "Plans are content-addressed on `(goal-fingerprint, schema-hash)` (`GLOBAL-006`), so a repeated weekly retrieval rollup hits the cache and returns in single-digit ms.",
    ],
    whatItDoesnt: [
      "No vector search or embedding — nlqdb stores and aggregates the retrieval rows you write; the similarity search that picks the chunks stays in your vector store (Pinecone, pgvector, Chroma).",
      "No automatic capture — logging each retrieval, its source, and its relevance score is your RAG pipeline's job (or your framework's callback hook).",
      "No connecting to your existing log or vector store — nlqdb provisions and owns the Postgres it queries; bring-your-own-Postgres is roadmap, not shipped.",
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
        label: 'r/LLMDevs — "RAG evaluation / which chunks get retrieved" recurring discussion hub.',
      },
      {
        url: "https://hn.algolia.com/?q=rag+retrieval",
        label: 'HN search: "rag retrieval" — discussion on measuring and analyzing what RAG pipelines retrieve.',
      },
    ],
  },
];

export function solveBySlug(slug: string): SolveEntry | undefined {
  return SOLVE_ENTRIES.find((s) => s.slug === slug);
}
