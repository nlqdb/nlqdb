// Compact per-surface integration recipes for the `## Integrate`
// section of `nlqdb.com/llms.txt` (consumed by coding agents told
// "add nlqdb to my app"). Kept separate from the homepage CodePanel
// data (`snippets.ts`, full tabbed integrations) because llms.txt is
// read inside an agent's prompt budget — each recipe here is the
// smallest copy-runnable shape plus the canonical docs page the agent
// reads next. Data-driven per SK-CMP-004: editing this file is the
// only edit needed to change what the Integrate section emits.

export interface IntegrateRecipe {
  /** Stable surface id; the five surfaces every agent path can take. */
  id: "html" | "sdk" | "cli" | "mcp" | "http";
  /** Heading shown in llms.txt. */
  title: string;
  /** One-clause "what this is", mirrors the homepage tab subtitle. */
  sub: string;
  /** Markdown code-fence language tag. */
  lang: "html" | "ts" | "bash" | "json";
  /** Smallest copy-runnable snippet for the surface. */
  snippet: string;
  /** Canonical docs.nlqdb.com page the agent reads next. */
  docs: string;
}

const DOCS = "https://docs.nlqdb.com";

export const INTEGRATE: readonly IntegrateRecipe[] = [
  {
    id: "html",
    title: "HTML element",
    sub: "drop a tag, ship the page",
    lang: "html",
    snippet: `<script src="https://elements.nlqdb.com/v1.js" type="module"></script>
<nlq-data goal="today's orders, newest first" db="orders" api-key="pk_live_..."></nlq-data>`,
    docs: `${DOCS}/tutorials/html/`,
  },
  {
    id: "sdk",
    title: "TypeScript SDK",
    sub: "fetch is the SDK — zero deps, runs anywhere",
    lang: "ts",
    snippet: `npm i @nlqdb/sdk
import { createClient } from "@nlqdb/sdk";
const client = createClient({ apiKey: process.env.NLQDB_KEY! });
const res = await client.ask({ goal: "today's orders, newest first", dbId: "orders" });`,
    docs: `${DOCS}/sdk/`,
  },
  {
    id: "cli",
    title: "CLI",
    sub: "one binary, two verbs",
    lang: "bash",
    snippet: `curl -fsSL https://nlqdb.com/install | sh
nlq "an orders tracker for my coffee shop"`,
    docs: `${DOCS}/cli/`,
  },
  {
    id: "mcp",
    title: "MCP server",
    sub: "talk to your data from Claude, Cursor, Zed, Windsurf",
    lang: "json",
    snippet: `{ "mcpServers": { "nlqdb": { "url": "https://mcp.nlqdb.com/mcp" } } }`,
    docs: `${DOCS}/mcp/`,
  },
  {
    id: "http",
    title: "HTTP API",
    sub: "raw POST /v1/ask, no SDK required",
    lang: "bash",
    snippet: `curl -X POST https://app.nlqdb.com/v1/ask \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"goal":"today orders, newest first","dbId":"orders"}'`,
    docs: `${DOCS}/reference/http-api/`,
  },
];
