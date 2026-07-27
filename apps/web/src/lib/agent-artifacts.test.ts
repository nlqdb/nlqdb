import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildClaudeCodeCommand,
  buildClaudeConfig,
  buildCodexConfig,
  buildStdioClaudeCodeCommand,
  buildStdioCodexConfig,
  buildStdioServerObject,
  buildWindsurfConfig,
  buildZedConfig,
  MCP_ENDPOINT_URL,
  MCP_SERVER_ROUTE,
  STDIO_KEY_ENV,
  STDIO_PACKAGE,
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

/** The R-04 canonical setup guide (docs.nlqdb.com/agent-memory/). */
const DOCS_GUIDE = readFileSync(
  join(import.meta.dir, "../../../docs/src/content/docs/agent-memory.mdx"),
  "utf8",
);

/**
 * Every fenced ```<lang> block in document order, dedented (fences nested
 * under a markdown list item are indented; the code they show is not).
 */
function allFenced(text: string, lang: string): string[] {
  const blocks = [...text.matchAll(new RegExp(`\`\`\`${lang}\\n([\\s\\S]*?)\`\`\``, "g"))];
  if (blocks.length === 0) throw new Error(`no \`\`\`${lang} block found`);
  return blocks.map(([, body]) => {
    const lines = (body as string).split("\n");
    while (lines.length && !lines.at(-1)?.trim()) lines.pop();
    const indent = Math.min(
      ...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)?.[0].length ?? 0),
    );
    return lines.map((l) => l.slice(indent)).join("\n");
  });
}

const firstFenced = (text: string, lang: string): string => allFenced(text, lang)[0] as string;

/**
 * Every `https://…` token in a raw text artifact. Autolink brackets and
 * sentence punctuation are not part of the URL — a `?utm_source=x>.` token
 * would otherwise read as a different channel key than the one published.
 */
function urlsInText(text: string): string[] {
  return (text.match(/https?:\/\/[^\s"`)<>]+/g) ?? []).map((u) => u.replace(/[.,;:]+$/, ""));
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

  // An artifact lives in someone else's repo, so its links are externally
  // published URLs and SK-GTM-007 applies to every one of them. The docs host
  // was exempted here until 2026-07-26 on the grounds that it runs no
  // attribution capture — true, but it made the *primary* link in all five
  // artifacts unattributable while only the tertiary "Learn more" counted, so
  // the R-07 yield gate could not fire. `apps/docs/src/channel-forward.ts`
  // now carries the key across the hop; these two hosts are the ones that end
  // in a first touch, and `mcp.nlqdb.com` (protocol only) is not one of them.
  const ATTRIBUTING_HOSTS = ["https://nlqdb.com/", "https://docs.nlqdb.com/"];

  test("every published nlqdb link carries the agent-artifacts utm_source (SK-GTM-007)", () => {
    for (const artifact of [AGENTS, CURSOR, CODEX, SKILL, read("README.md")]) {
      const attributable = urlsInText(artifact).filter((u) =>
        ATTRIBUTING_HOSTS.some((h) => u.startsWith(h)),
      );
      expect(attributable.length).toBeGreaterThan(0);
      for (const url of attributable) {
        expect(new URL(url).searchParams.get("utm_source")).toBe("agent-artifacts");
      }
    }
  });
});

// R-04 drift guard. The canonical setup guide hand-writes one connect block
// per host, and R-04's "Do" requires those strings come from
// `mcp-install.ts`. `apps/docs` has no test runner, so they are pinned here —
// same contract as the R-07 artifacts above. Remote-server schemas re-verified
// against vendor docs 2026-07-25 — every host diverges, so a shared block is a
// wrong-key block for most of them:
//   Cursor    `.cursor/mcp.json`                  `mcpServers` + `url` (no `type`)
//             https://cursor.com/docs/context/mcp
//   VS Code   `.vscode/mcp.json`                  `servers` + `type:"http"` + `url`
//             https://code.visualstudio.com/docs/copilot/customization/mcp-servers
//   Windsurf  `~/.codeium/windsurf/mcp_config.json` `mcpServers` + `serverUrl`
//             https://docs.windsurf.com/windsurf/cascade/mcp
//   Zed       `~/.config/zed/settings.json`       `context_servers` + `url`
//             (same path on macOS and Linux) https://zed.dev/docs/ai/mcp
// All four also confirm a hand-written file is sufficient — the one-click
// deep-links are a convenience, not a requirement.
describe("the R-04 setup guide's connect blocks don't drift from mcp-install.ts", () => {
  test("the Claude Code command and Codex TOML match the shipped builders", () => {
    expect(DOCS_GUIDE).toContain(buildClaudeCodeCommand(MCP_ENDPOINT_URL));
    const toml = allFenced(DOCS_GUIDE, "toml");
    expect(toml).toHaveLength(2);
    // Hosted route first (Step 1), then the headless one.
    expect(toml[0]).toBe(buildCodexConfig(MCP_ENDPOINT_URL));
    expect(toml[1]).toBe(buildStdioCodexConfig());
  });

  test("each JSON block matches its host's vendor schema at the shipped endpoint", () => {
    const blocks = allFenced(DOCS_GUIDE, "json");
    // Pinned positionally, so a host added to Step 1 without a matching
    // assertion below would ship unguarded. Fail until it is pinned too.
    expect(blocks).toHaveLength(5);
    const [windsurf, zed, cursor, vscode, stdio] = blocks.map((b) => JSON.parse(b));
    expect(windsurf).toEqual(JSON.parse(buildWindsurfConfig(MCP_ENDPOINT_URL)));
    expect(zed).toEqual(JSON.parse(buildZedConfig(MCP_ENDPOINT_URL)));
    // Cursor's documented remote shape is the same `mcpServers` + `url`.
    expect(cursor).toEqual(JSON.parse(buildClaudeConfig(MCP_ENDPOINT_URL)));
    // VS Code is the one divergent shape and has no `mcp-install.ts` builder
    // (it ships as a deep-link, not a config fallback). A wrong root key here
    // loads zero servers with no error — exactly what the guide must not ship.
    expect(vscode).toEqual({ servers: { nlqdb: { type: "http", url: MCP_ENDPOINT_URL } } });
    // The headless route's server value, root-key-less by design (the reader
    // keeps the wrapper from their host's Step 1 block).
    expect(stdio).toEqual(JSON.parse(buildStdioServerObject()));
  });

  test("the Claude Code headless one-liner matches its builder", () => {
    expect(DOCS_GUIDE).toContain(buildStdioClaudeCodeCommand());
  });
});

// Hard rule 1, inverted: the guide must not deny a capability that shipped.
// Until 2026-07-26 there genuinely was no headless credential, and both
// agent-fetched surfaces said so — then `@nlqdb/mcp` published to npm and the
// sentences stayed. An agent reads "no headless credential, hand this to the
// developer" and stops at a wall that no longer exists, which is worse than
// silence. Two halves, because either alone is escapable: the headless route
// must be present *and* the retracted denial must be absent.
describe("every agent-fetched surface offers the headless route", () => {
  const surfaces = () => ({
    "docs agent-memory guide": DOCS_GUIDE,
    "llms.txt route": readFileSync(join(import.meta.dir, "../pages/llms.txt.ts"), "utf8"),
  });

  test("names the published package and the env var that authenticates it", () => {
    for (const [name, text] of Object.entries(surfaces())) {
      expect(text, name).toContain(STDIO_PACKAGE);
      expect(text, name).toContain(STDIO_KEY_ENV);
    }
  });

  test("no surface still claims a headless credential doesn't exist", () => {
    for (const [name, text] of Object.entries(surfaces())) {
      expect(normalizeProse(text), name).not.toContain("no headless credential");
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
    for (const [name, text] of Object.entries(installSurfaces())) {
      expect(text, name).toContain(SKILLS_INSTALL_CMD);
    }
  });

  // Hard rule 1 — only promise what the command actually does. Until
  // 2026-07-25 all three surfaces claimed it "formats a matching Cursor rule"
  // and "registers it in AGENTS.md"; run against the live CLI three ways
  // (default, `--agent cursor`, `--all`) it writes neither, so a reader
  // waiting on that `AGENTS.md` entry got nothing. Two halves, because
  // either alone is escapable: the disclosure must be present (deleting it
  // goes red) *and* the old mechanism claim must be absent (re-adding it
  // alongside the disclosure would otherwise pass).
  test("every surface discloses what the command does not write", () => {
    for (const [name, text] of Object.entries(installSurfaces())) {
      const prose = normalizeProse(text);
      expect(prose, name).toContain(".agents/skills/nlqdb-memory/skill.md");
      expect(prose, name).toContain("does not write a .cursor/rules/ file");
      expect(prose, name).toContain("does not edit agents.md");
      // The by-hand section legitimately names both files, so forbid the
      // mechanism phrasing, not the filenames.
      expect(prose, name).not.toContain("matching cursor");
      expect(prose, name).not.toContain("registers it in agents.md");
      expect(prose, name).not.toContain("agents.md entry");
    }
  });
});

function installSurfaces(): Record<string, string> {
  return {
    "agent-artifacts README": read("README.md"),
    "docs agent-memory guide": DOCS_GUIDE,
    "llms.txt route": readFileSync(join(import.meta.dir, "../pages/llms.txt.ts"), "utf8"),
  };
}

// Flattens a surface to comparable prose: llms.txt is TS source, so literal
// `\n` escapes and template-string punctuation would otherwise split a
// sentence mid-phrase across source lines.
function normalizeProse(text: string): string {
  return text
    .replace(/\\n/g, " ")
    .replace(/[`"'+\\*]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}
