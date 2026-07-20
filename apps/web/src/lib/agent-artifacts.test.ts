import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildClaudeCodeCommand,
  buildClaudeConfig,
  buildCodexConfig,
  MCP_ENDPOINT_URL,
  MCP_SERVER_ROUTE,
} from "./mcp-install.ts";

// R-07 drift guard. The droppable in-repo artifacts under
// `public/agent-artifacts/` embed the same MCP connect strings the site
// ships from `mcp-install.ts`. A developer drops one into their repo and
// their coding agent obeys it forever — so a stale command there is worse
// than a stale snippet on the site (nobody re-reads a dropped file). This
// test is the "ONE source of truth" contract: every connect string in every
// artifact must equal what `mcp-install.ts` produces, or the build fails.

const DIR = join(import.meta.dir, "../../public/agent-artifacts");
const read = (f: string) => readFileSync(join(DIR, f), "utf8");

const AGENTS = read("AGENTS.snippet.md");
const CURSOR = read("nlqdb-memory.mdc");
const CODEX = read("codex-config.toml");

/**
 * The first fenced ```<lang> block, dedented (fences nested under a
 * markdown list item are indented; the code they show is not).
 */
function firstFenced(text: string, lang: string): string {
  const body = text.match(new RegExp(`\`\`\`${lang}\\n([\\s\\S]*?)\`\`\``))?.[1];
  if (body === undefined) throw new Error(`no \`\`\`${lang} block found`);
  const lines = body.split("\n");
  while (lines.length && !lines.at(-1)?.trim()) lines.pop();
  const indent = Math.min(
    ...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)?.[0].length ?? 0),
  );
  return lines.map((l) => l.slice(indent)).join("\n");
}

/** Every `https://…` token in a raw text artifact. */
function urlsInText(text: string): string[] {
  return text.match(/https?:\/\/[^\s"`)]+/g) ?? [];
}

describe("agent-memory artifacts don't drift from mcp-install.ts", () => {
  test("the Claude Code command matches the shipped builder", () => {
    expect(AGENTS).toContain(buildClaudeCodeCommand(MCP_ENDPOINT_URL));
  });

  test("the Codex config block matches the shipped builder", () => {
    const block = buildCodexConfig(MCP_ENDPOINT_URL);
    expect(firstFenced(AGENTS, "toml")).toBe(block);
    expect(CODEX).toContain(block);
  });

  test("the Cursor / Claude mcpServers JSON matches the shipped builder", () => {
    const expected = JSON.parse(buildClaudeConfig(MCP_ENDPOINT_URL));
    expect(JSON.parse(firstFenced(AGENTS, "json"))).toEqual(expected);
    expect(JSON.parse(firstFenced(CURSOR, "json"))).toEqual(expected);
  });

  test("every mcp.nlqdb.com URL resolves to the server route — no bare domain, no doubled path", () => {
    for (const artifact of [AGENTS, CURSOR, CODEX]) {
      const endpoints = urlsInText(artifact).filter((u) => u.includes("mcp.nlqdb.com"));
      expect(endpoints.length).toBeGreaterThan(0);
      for (const url of endpoints) {
        expect(url).toBe(MCP_ENDPOINT_URL);
        expect(new URL(url).pathname).toBe(MCP_SERVER_ROUTE);
      }
    }
  });

  test("every published nlqdb.com link carries the agent-artifacts utm_source (SK-GTM-007)", () => {
    for (const artifact of [AGENTS, CURSOR, CODEX, read("README.md")]) {
      for (const url of urlsInText(artifact)) {
        // Marketing host only — docs.nlqdb.com / mcp.nlqdb.com don't run the
        // attribution capture; the apex is the one that does.
        if (/^https:\/\/nlqdb\.com\//.test(url)) {
          expect(url).toContain("utm_source=agent-artifacts");
        }
      }
    }
  });
});
