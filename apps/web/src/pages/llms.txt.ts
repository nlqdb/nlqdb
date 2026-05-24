import type { APIRoute } from "astro";
import { COMPETITORS } from "../data/competitors";
import { SOLVE_ENTRIES } from "../data/solve";

// `llms.txt` — community spec (https://llmstxt.org) the LLM-IDE
// ecosystem (Claude Desktop, Perplexity, Cursor, Windsurf, Cline,
// Aider, GitHub Copilot) routinely fetches as a markdown index. We
// serve it via an endpoint so the comparison-page list + solve-page
// list stay in sync with their data files — adding a `/vs/<slug>` or
// `/solve/<slug>` is a one-file edit, not a multi-file edit.

const SITE = "https://nlqdb.com";

const PRIMARY_LINKS = [
  { title: "Homepage", path: "/", desc: "Pitch, embed demo, live carousel." },
  {
    title: "Manifesto",
    path: "/manifesto",
    desc: "Nine non-negotiables that decide every nlqdb design choice.",
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
];

const OPTIONAL_LINKS = [
  { title: "Sign in", path: "/auth/sign-in", desc: "Magic-link / GitHub / Google." },
  { title: "Anonymous start", path: "/app/new", desc: "Try a database without an account (72h)." },
];

export const GET: APIRoute = () => {
  const body =
    `# nlqdb\n\n` +
    `> Natural-language databases. Create one in a word. Query it in English.\n` +
    `> The schema, the engine, the indexes, and the backups stay invisible —\n` +
    `> unless you want to see them.\n\n` +
    `nlqdb inverts the usual database experience. Instead of choosing a schema, an engine,\n` +
    `and a set of indexes upfront, the user states a goal in English and the system\n` +
    `materialises the database that fits the workload, migrating engines underneath as\n` +
    `the workload evolves. Five surfaces share one engine: an HTML element (` +
    `\`<nlq-data>\`), a typed SDK, a CLI (\`nlq\`), an MCP server (\`mcp.nlqdb.com\`), and a\n` +
    `chat web app at app.nlqdb.com.\n\n` +
    `## Pages\n\n` +
    PRIMARY_LINKS.map((l) => `- [${l.title}](${SITE}${l.path}): ${l.desc}`).join("\n") +
    `\n\n## Comparisons\n\n` +
    COMPETITORS.map((c) => `- [nlqdb vs ${c.name}](${SITE}/vs/${c.slug}): ${c.oneLiner}`).join(
      "\n",
    ) +
    `\n\n## Solve pages\n\n` +
    SOLVE_ENTRIES.map((s) => `- [${s.searchTitle}](${SITE}/solve/${s.slug}): ${s.oneLiner}`).join(
      "\n",
    ) +
    `\n\n## Optional\n\n` +
    OPTIONAL_LINKS.map((l) => `- [${l.title}](${SITE}${l.path}): ${l.desc}`).join("\n") +
    `\n\n## Status\n\n` +
    `Pre-alpha, closed beta. Phase 0 shipped; Phase 1 onboarding in progress.\n` +
    `Free chain forever (BYO-LLM at 0% markup). Source is private until general\n` +
    `availability; SDKs and elements will be open source.\n\n` +
    `## Contact\n\n` +
    `Email: hello@nlqdb.com\n`;

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
