import type { APIRoute } from "astro";
import { BLOG_POSTS } from "../data/blog";
import { COMPETITORS } from "../data/competitors";
import { INTEGRATE } from "../data/integrate";
import { SOLVE_ENTRIES } from "../data/solve";
import { buildStdioClaudeCodeCommand } from "../lib/mcp-install.ts";

// `llms.txt` — community spec (https://llmstxt.org) the LLM-IDE
// ecosystem (Claude Desktop, Perplexity, Cursor, Windsurf, Cline,
// Aider, GitHub Copilot) routinely fetches as a markdown index. We
// serve it via an endpoint so the comparison-page list + solve-page
// list + blog-post list stay in sync with their data files — adding a
// `/vs/<slug>`, `/solve/<slug>`, or `/blog/<slug>` is a one-file edit,
// not a multi-file edit.

const SITE = "https://nlqdb.com";
const DOCS_SITE = "https://docs.nlqdb.com";

// Internal links resolve to the trailing-slash 200 (CF serves
// `<route>/index.html`; the bare path 301-redirects). Advertise the
// non-redirecting URL so AI crawlers fetching llms.txt skip the hop.
const url = (path: string) => `${SITE}${path.endsWith("/") ? path : `${path}/`}`;

const PRIMARY_LINKS = [
  { title: "Homepage", path: "/", desc: "Pitch, embed demo, live carousel." },
  {
    title: "Agents",
    path: "/agents",
    desc: "Analytical memory for AI agents — give an agent a real Postgres it can GROUP BY, JOIN, and aggregate over, not just top-k vector recall.",
  },
  {
    title: "Agent-memory benchmark landscape",
    path: "/agent-memory-benchmarks",
    desc: "What LoCoMo, LongMemEval, DMR, Mem0 and Zep actually measure, whose numbers are self-reported or disputed, and the analysis-over-memory gap none of them test — every figure linked to its source.",
  },
  {
    title: "Manifesto",
    path: "/manifesto",
    desc: "Nine non-negotiables that decide every nlqdb design choice.",
  },
  {
    title: "Architecture",
    path: "/architecture",
    desc: "How nlqdb works — five surfaces, one edge-routed engine, the right data engine per workload — as an interactive 3D map with a full prose walkthrough.",
  },
  {
    title: "Integrations",
    path: "/integrations",
    desc: "Frameworks, MCP hosts, and surfaces nlqdb already plugs into.",
  },
  {
    title: "Comparisons",
    path: "/vs",
    desc: "Honest side-by-side against adjacent tools (Supabase, Vanna, Mem0, Outerbase, …).",
  },
  {
    title: "Solve pages",
    path: "/solve",
    desc: "One page per recurring search query; each answers the question with a working snippet and names what nlqdb doesn't do.",
  },
  {
    title: "Blog",
    path: "/blog",
    desc: "Engineering notes from building nlqdb — SQL traps, LLM-pipeline debugging, honest comparisons.",
  },
  {
    title: "Pricing",
    path: "/pricing",
    desc: "Free forever; upgrade when you need more. No credit card for the free tier.",
  },
];

const OPTIONAL_LINKS = [
  { title: "Sign in", path: "/auth/sign-in", desc: "Magic-link / GitHub / Google." },
  { title: "Anonymous start", path: "/app/new", desc: "Try a database without an account (72h)." },
];

export const GET: APIRoute = () => {
  const body =
    `# nlqdb\n\n` +
    `> Analytical memory for AI agents. A real database your agent connects to over\n` +
    `> MCP and queries in English — GROUP BY, JOIN, aggregate over what it remembered,\n` +
    `> not just the top-k a vector store recalls. Also a natural-language database for\n` +
    `> any app.\n\n` +
    `nlqdb gives an AI agent a real Postgres database it uses as memory: it writes typed\n` +
    `rows as it learns and asks questions in plain English, so it can analyse its memory\n` +
    `(counts, top-N, per-group rollups) instead of only recalling similar chunks. The LLM\n` +
    `never emits SQL — it returns a typed plan, the compiler emits parameterised SQL,\n` +
    `\`libpg_query\` re-validates it, and every answer carries the exact SQL it ran.\n` +
    `The same engine is also a generalist natural-language database: state a goal in\n` +
    `English and the system materialises the database that fits the workload, migrating\n` +
    `engines underneath as it evolves. Five surfaces share one engine: an HTML element\n` +
    `(\`<nlq-data>\`), a typed SDK, a CLI (\`nlq\`), an MCP server (\`mcp.nlqdb.com\`), and a\n` +
    `chat web app at app.nlqdb.com.\n\n` +
    `## For coding agents\n\n` +
    `Setting up memory for the app you build with? One command connects nlqdb over MCP:\n\n` +
    "```bash\n" +
    `claude mcp add --transport http nlqdb https://mcp.nlqdb.com/mcp\n` +
    "```\n\n" +
    `That hosted route authenticates with a browser OAuth on the first tool call — no\n` +
    `API key to paste, but it does need a human at a browser. **With nobody at a\n` +
    `browser, take the headless route instead:** the same five tools run locally over\n` +
    `stdio against the same production API, authenticated by a key, so no browser ever\n` +
    `opens. Mint an \`sk_mcp_\` MCP key at https://app.nlqdb.com/app/keys (one signed-in\n` +
    `visit) — scoped to MCP, not your whole account, and revocable on its own — then:\n\n` +
    "```bash\n" +
    `${buildStdioClaudeCodeCommand()}\n` +
    "```\n\n" +
    `Other hosts (Codex, Cursor, VS Code, Claude Desktop, Windsurf, Zed), both routes\n` +
    `per host, and the full machine-followable guide — expected tools, a verification\n` +
    `query, what to do on failure — are at ${DOCS_SITE}/agent-memory/. Two write paths,\n` +
    `both live for signed-in keys: \`nlqdb_query\` (provision + query in English, always\n` +
    `on) and the typed \`nlqdb_remember\` verb over the \`agent_memory_v1\` preset — create\n` +
    `one with \`POST /v1/databases { "preset": "agent_memory_v1" }\` (or the dashboard),\n` +
    `pass its id as \`db\`, and fact \`kind\` + \`tags\` become your GROUP BY columns.\n\n` +
    `Building this into a repo with Claude Code? The plugin wires the server AND the\n` +
    `instructions in one step, replacing the connect command above — run both lines\n` +
    `inside Claude Code:\n\n` +
    "```bash\n" +
    `/plugin marketplace add nlqdb/nlqdb\n` +
    `/plugin install nlqdb-memory@nlqdb\n` +
    "```\n\n" +
    `The plugin is nlqdb's published artifacts directory itself, so its two skills are\n` +
    `the same files below, never copies. It authenticates by the hosted route (browser\n` +
    `OAuth once); for a headless host use the stdio command above.\n\n` +
    `On any other host, one command installs the skill alone (Cursor, Codex, and 15\n` +
    `more — via the public repo, no account, no publish):\n\n` +
    "```bash\n" +
    `npx skills add https://github.com/nlqdb/nlqdb/tree/main/apps/web/public/agent-artifacts/nlqdb-memory\n` +
    "```\n\n" +
    `It writes \`.agents/skills/nlqdb-memory/SKILL.md\` — the cross-agent skill directory\n` +
    `Cursor and Codex read directly — plus a \`.claude/skills/\` symlink to it (Claude Code\n` +
    `documents only \`.claude/skills/\`) and a \`skills-lock.json\` (verified against the live\n` +
    `CLI 2026-07-25). It does NOT write a \`.cursor/rules/\` file and does NOT edit\n` +
    `\`AGENTS.md\`; a host that reads only \`AGENTS.md\` still needs the snippet below\n` +
    `appended by hand.\n\n` +
    `Or drop a ready-made file into the codebase by hand — every connect string in them\n` +
    `is pinned by a test to nlqdb's own source of truth, so they can't drift:\n\n` +
    `- Host-neutral \`AGENTS.md\`: append ${SITE}/agent-artifacts/AGENTS.snippet.md\n` +
    `- Claude Code skill: save ${SITE}/agent-artifacts/nlqdb-memory/SKILL.md to \`.claude/skills/nlqdb-memory/SKILL.md\`\n` +
    `- Cursor: save ${SITE}/agent-artifacts/nlqdb-memory.mdc to \`.cursor/rules/nlqdb-memory.mdc\`\n` +
    `- Codex: merge ${SITE}/agent-artifacts/codex-config.toml into \`~/.codex/config.toml\`\n\n` +
    `Working in a repo whose \`docs/\` hold its operating state? A second skill points the\n` +
    `same memory at those docs — it extracts the *structure* (decision ids + statuses,\n` +
    `open questions with dates, queues, trackers, and the references between them), never\n` +
    `prose, so "which features have open questions older than 30 days" and "which\n` +
    `decisions reference GLOBAL-013" become one query. One-way: markdown stays the source\n` +
    `of truth, nlqdb never writes it.\n\n` +
    "```bash\n" +
    `npx skills add https://github.com/nlqdb/nlqdb/tree/main/apps/web/public/agent-artifacts/nlqdb-docs-memory\n` +
    "```\n\n" +
    `Or by hand: save ${SITE}/agent-artifacts/nlqdb-docs-memory/SKILL.md to\n` +
    `\`.claude/skills/nlqdb-docs-memory/SKILL.md\`.\n\n` +
    `## Integrate\n\n` +
    `Add nlqdb to an app. Every surface calls the same \`/v1/ask\` engine — pick one;\n` +
    `each snippet is the smallest runnable shape, and the link is the page to read next.\n` +
    `Full machine-readable docs index: ${DOCS_SITE}/llms.txt\n\n` +
    INTEGRATE.map(
      (r) =>
        `### ${r.title}\n\n${r.sub}. [Docs →](${r.docs})\n\n` +
        "```" +
        `${r.lang}\n${r.snippet}\n` +
        "```",
    ).join("\n\n") +
    `\n\n## Pages\n\n` +
    PRIMARY_LINKS.map((l) => `- [${l.title}](${url(l.path)}): ${l.desc}`).join("\n") +
    `\n\n## Comparisons\n\n` +
    COMPETITORS.map((c) => `- [nlqdb vs ${c.name}](${url(`/vs/${c.slug}`)}): ${c.oneLiner}`).join(
      "\n",
    ) +
    `\n\n## Solve pages\n\n` +
    SOLVE_ENTRIES.map(
      (s) => `- [${s.searchTitle}](${url(`/solve/${s.slug}`)}): ${s.oneLiner}`,
    ).join("\n") +
    `\n\n## Blog\n\n` +
    BLOG_POSTS.map((p) => `- [${p.title}](${url(`/blog/${p.slug}`)}): ${p.description}`).join(
      "\n",
    ) +
    `\n\n## Optional\n\n` +
    OPTIONAL_LINKS.map((l) => `- [${l.title}](${url(l.path)}): ${l.desc}`).join("\n") +
    `\n\n## Status\n\n` +
    `Pre-beta, open — start anonymously. Phase 0 shipped; Phase 1 onboarding in progress.\n` +
    `Free chain forever (BYO-LLM at 0% markup). Source is public under FSL-1.1-ALv2\n` +
    `(source-available, self-hostable for any non-competing use), auto-converting to\n` +
    `Apache-2.0 two years after each release; no turnkey GA self-host container yet.\n\n` +
    `## Contact\n\n` +
    `Email: hello@nlqdb.com\n`;

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
