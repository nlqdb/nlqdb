import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
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
const SKILL = read("nlqdb-memory/SKILL.md");

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
    expect(SKILL).toContain(buildClaudeCodeCommand(MCP_ENDPOINT_URL));
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
    for (const artifact of [AGENTS, CURSOR, CODEX, SKILL]) {
      const endpoints = urlsInText(artifact).filter((u) => u.includes("mcp.nlqdb.com"));
      expect(endpoints.length).toBeGreaterThan(0);
      for (const url of endpoints) {
        expect(url).toBe(MCP_ENDPOINT_URL);
        expect(new URL(url).pathname).toBe(MCP_SERVER_ROUTE);
      }
    }
  });

  test("every published nlqdb.com link carries the agent-artifacts utm_source (SK-GTM-007)", () => {
    for (const artifact of [AGENTS, CURSOR, CODEX, SKILL, read("README.md")]) {
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

// R-07 one-command install guard. The `npx skills add <github-tree-url>` line
// (vercel-labs/skills, verified 2026-07-22) is the account-free drop-in path
// published on three agent-facing surfaces (this README, the docs guide,
// llms.txt). It fetches the skill straight from the public repo, so a moved
// skill directory or missing SKILL.md frontmatter silently breaks the command
// for every reader. This pins the URL to the on-disk skill and to all three
// surfaces — one source of truth for the published command.
const SKILL_REPO_PATH = "apps/web/public/agent-artifacts/nlqdb-memory";
const SKILLS_INSTALL_URL = `https://github.com/nlqdb/nlqdb/tree/main/${SKILL_REPO_PATH}`;
const SKILLS_INSTALL_CMD = `npx skills add ${SKILLS_INSTALL_URL}`;

describe("the npx skills add one-command install can't drift", () => {
  test("the SKILL.md still lives at the published repo path", () => {
    // The URL's repo-relative path must resolve to the SKILL.md the site serves.
    expect(SKILL_REPO_PATH.endsWith("/agent-artifacts/nlqdb-memory")).toBe(true);
    expect(existsSync(join(DIR, "nlqdb-memory/SKILL.md"))).toBe(true);
  });

  test("SKILL.md carries the name + description `skills add` requires", () => {
    const fm = SKILL.match(/^---\n([\s\S]*?)\n---/)?.[1];
    if (fm === undefined) throw new Error("SKILL.md has no YAML frontmatter");
    expect(fm).toMatch(/^name:\s*nlqdb-memory\s*$/m);
    expect(fm).toMatch(/^description:\s*\S.*$/m);
  });

  test("all three published surfaces show the exact install command", () => {
    const surfaces = {
      "agent-artifacts README": read("README.md"),
      "docs agent-memory guide": readFileSync(
        join(import.meta.dir, "../../../docs/src/content/docs/agent-memory.mdx"),
        "utf8",
      ),
      "llms.txt route": readFileSync(join(import.meta.dir, "../pages/llms.txt.ts"), "utf8"),
    };
    for (const [name, text] of Object.entries(surfaces)) {
      expect(text, name).toContain(SKILLS_INSTALL_CMD);
    }
  });
});
