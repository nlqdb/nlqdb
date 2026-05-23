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
      "If your agent needs to remember user facts, prior tool calls, or task state across sessions, expose a database to it via MCP — nlqdb's MCP server ships `create_database`, `ask`, and `run` so the agent can both provision the store and query it in English.",
    painContext:
      "Agent builders pick between unstructured memory (vector recall over chat history, e.g. Mem0) and structured memory (rows the agent can query and aggregate later). The structured side has had no opinionated primitive — most teams stitch together a Postgres connection string, an ORM, and a hand-rolled migration loop before the agent runs its first tool call.",
    demoGoal: "recent agent memory across threads in the last day",
    demoWhy:
      'The query an agent runs to recover "what did the user ask me yesterday" is the canonical structured-memory readout, and the shape an MCP-aware agent expects.',
    howNlqdbAnswers: [
      "MCP server at `mcp.nlqdb.com` exposes `create_database`, `ask`, `run` — the agent self-provisions and queries without a human in the loop.",
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
        a: 'Complementary, not replacement. Mem0 owns unstructured fact recall ("the user prefers Celsius"); nlqdb owns structured rows the agent later queries ("list the user\'s saved searches this week"). Both can sit behind one MCP-aware agent.',
      },
      {
        q: "How does the agent create its own database?",
        a: 'Via the MCP `create_database` tool — the agent passes a goal in English (`"a memory store for my research assistant"`); the server materialises Postgres + a starter schema in one call and returns connection metadata bound to the agent\'s tenant.',
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
      "Quality is measured weekly against BIRD Mini-Dev + Spider 2.0-lite and published to `docs/features/quality-eval/` — the numbers are visible, not asserted.",
      "Every reply renders the compiled SQL under a `Cmd+/` trace toggle (`SK-WEB-005`); you audit before you trust.",
    ],
    whatItDoesnt: [
      "No retrieval-augmented training corpus — if you have years of curated query examples and want a tool that exploits them, Vanna AI's training loop is the right shape.",
      "No support today for bring-your-own-Postgres — nlqdb owns the Postgres it queries; existing databases are not yet a supported input.",
    ],
    faqs: [
      {
        q: "Is nlqdb's natural-language accuracy comparable to fine-tuned text-to-SQL?",
        a: "We publish BIRD Mini-Dev + Spider 2.0-lite scores weekly to `docs/features/quality-eval/`. As of pre-alpha the BIRD score is below the gate threshold (which is why anonymous mode is the only open path on the marketing site today); measurement is honest and visible — not a marketing claim.",
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
];

export function solveBySlug(slug: string): SolveEntry | undefined {
  return SOLVE_ENTRIES.find((s) => s.slug === slug);
}
