import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { GET as LLMS_TXT } from "../pages/llms.txt.ts";
import {
  buildClaudeCodeCommand,
  buildClaudeConfig,
  buildCodexConfig,
  buildStdioClaudeCodeCommand,
  buildStdioCodexConfig,
  buildStdioMcpServersConfig,
  buildStdioServerObject,
  buildWindsurfConfig,
  buildZedConfig,
  MCP_ENDPOINT_URL,
  MCP_SERVER_ROUTE,
  STDIO_KEY_ENV,
  STDIO_PACKAGE,
  STDIO_PLACEHOLDER_KEY,
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
/** The SK-PIVOT-017 docs→memory pack — goal pack #1 (SK-PIVOT-018). */
const DOCS_SKILL = read("nlqdb-docs-memory/SKILL.md");

const docsPage = (name: string) =>
  readFileSync(join(import.meta.dir, `../../../docs/src/content/docs/${name}.mdx`), "utf8");

/** The R-04 canonical setup guide (docs.nlqdb.com/agent-memory/). */
const DOCS_GUIDE = docsPage("agent-memory");

/** The MCP setup page (docs.nlqdb.com/mcp/) — the other page that names tools. */
const DOCS_MCP = docsPage("mcp");

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
 * The two hosts where an artifact link ends in a first touch, so SK-GTM-007
 * applies. The docs host was exempted here until 2026-07-26 on the grounds that
 * it runs no attribution capture — true, but it made the *primary* link in
 * every artifact unattributable while only the tertiary "Learn more" counted, so
 * the R-07 yield gate could not fire. `apps/docs/src/channel-forward.ts` now
 * carries the key across the hop. `mcp.nlqdb.com` (protocol only) is not one.
 */
const ATTRIBUTING_HOSTS = ["https://nlqdb.com/", "https://docs.nlqdb.com/"];

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
    expect(DOCS_SKILL).toContain(buildClaudeCodeCommand(MCP_ENDPOINT_URL));
  });

  // The docs→memory pack's re-sync runs in CI, where nobody can approve a
  // browser OAuth page — so it is the one artifact for which the headless
  // route is load-bearing, not an alternative. Both strings pinned.
  test("the docs→memory pack ships the headless route for its unattended re-sync", () => {
    expect(DOCS_SKILL).toContain(buildStdioClaudeCodeCommand());
    expect(DOCS_SKILL).toContain(STDIO_PACKAGE);
    expect(DOCS_SKILL).toContain(STDIO_KEY_ENV);
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

  // R-07 headless-route coverage. Every artifact carries the hosted route
  // above *and* the `@nlqdb/mcp` + `sk_mcp_` stdio route for an unattended
  // agent (GLOBAL-003) — a dropped file whose only path opens a browser
  // dead-ends the very reader (a CI/container agent) it exists for.
  test("every artifact offers the headless stdio route (@nlqdb/mcp + the key env)", () => {
    for (const [name, text] of Object.entries({ AGENTS, CURSOR, CODEX, SKILL })) {
      expect(text, name).toContain(STDIO_PACKAGE);
      expect(text, name).toContain(STDIO_KEY_ENV);
    }
  });

  // SK-APIKEYS-015. An artifact lives in someone else's repo and nobody
  // re-reads it, so the credential it names must be the least-privilege one:
  // the MCP key, not the full-account `sk_live_`. Both halves matter — the
  // MCP-scoped placeholder must be present *and* the account key absent, since
  // re-adding `sk_live_` beside it is the same over-scoped paste.
  test("every artifact names the MCP-scoped key, never the full-account one", () => {
    for (const [name, text] of Object.entries({ AGENTS, CURSOR, CODEX, SKILL, DOCS_SKILL })) {
      expect(text, name).toContain(STDIO_PLACEHOLDER_KEY);
      expect(text, name).not.toContain("sk_live_");
    }
  });

  test("the headless Claude Code command matches the shipped builder", () => {
    expect(AGENTS).toContain(buildStdioClaudeCodeCommand());
    expect(SKILL).toContain(buildStdioClaudeCodeCommand());
  });

  test("the headless Codex TOML matches the shipped builder", () => {
    const block = buildStdioCodexConfig();
    // AGENTS ships it as its 2nd (headless) ```toml block, uncommented.
    expect(allFenced(AGENTS, "toml")[1]).toBe(block);
    // codex-config.toml ships it as a commented alternative — only one live
    // [mcp_servers.nlqdb] table is valid TOML — so uncomment before matching.
    expect(CODEX.replace(/^# ?/gm, "")).toContain(block);
  });

  test("the headless mcpServers JSON matches the shipped builder", () => {
    const expected = JSON.parse(buildStdioMcpServersConfig());
    // AGENTS and the Cursor rule each ship it as their 2nd (headless) block.
    expect(JSON.parse(allFenced(AGENTS, "json")[1] as string)).toEqual(expected);
    expect(JSON.parse(allFenced(CURSOR, "json")[1] as string)).toEqual(expected);
  });

  test("every mcp.nlqdb.com URL resolves to the server route — no bare domain, no doubled path", () => {
    for (const artifact of [AGENTS, CURSOR, CODEX, SKILL, DOCS_SKILL]) {
      const endpoints = urlsInText(artifact).filter((u) => u.includes("mcp.nlqdb.com"));
      expect(endpoints.length).toBeGreaterThan(0);
      for (const url of endpoints) {
        expect(url).toBe(MCP_ENDPOINT_URL);
        expect(new URL(url).pathname).toBe(MCP_SERVER_ROUTE);
      }
    }
  });

  // An artifact lives in someone else's repo, so its links are externally
  // published URLs and SK-GTM-007 applies to every one of them.
  test("every published nlqdb link carries the agent-artifacts utm_source (SK-GTM-007)", () => {
    for (const artifact of [AGENTS, CURSOR, CODEX, SKILL, DOCS_SKILL, read("README.md")]) {
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

// Both docs pages enumerate the tool catalog in prose, and a reader takes that
// list as the contract — `/mcp` shipped naming four while the server has long
// registered five, so `nlqdb_connect_database` was invisible to anyone who read
// that page instead of the guide. Neither page can be pinned to a builder (it
// is prose, not a config block), so pin it to the registrations themselves.
describe("the docs pages name every tool packages/mcp registers", () => {
  const registered = [
    ...readFileSync(
      join(import.meta.dir, "../../../../packages/mcp/src/server.ts"),
      "utf8",
    ).matchAll(/registerTool\(\s*"(nlqdb_[a-z_]+)"/g),
  ].map(([, name]) => name as string);

  test("the registry itself is readable, so a rename can't silently empty this", () => {
    expect(registered.length).toBeGreaterThan(4);
  });

  test.each([
    ["agent-memory guide", DOCS_GUIDE],
    ["mcp setup page", DOCS_MCP],
  ])("%s lists all of them", (_name, page) => {
    for (const tool of registered) expect(page).toContain(tool);
  });

  // …and nothing else. Under-listing was the bug (`nlqdb_connect_database`
  // invisible on `/mcp`); over-listing is the same false claim pointing the
  // other way — a reader who wires a call to a tool the server never
  // registered gets an error the page told them to expect to work.
  test.each([
    ["agent-memory guide", DOCS_GUIDE],
    ["mcp setup page", DOCS_MCP],
  ])("%s names no tool the server doesn't register", (_name, page) => {
    for (const named of new Set(page.match(/nlqdb_[a-z_]+/g) ?? [])) {
      expect(registered, named).toContain(named);
    }
  });
});

// Hard rule 1, inverted: the guide must not deny a capability that shipped.
// Until 2026-07-26 there genuinely was no headless credential, and both
// agent-fetched surfaces said so — then `@nlqdb/mcp` published to npm and the
// sentences stayed. An agent reads "no headless credential, hand this to the
// developer" and stops at a wall that no longer exists, which is worse than
// silence. Two halves, because either alone is escapable: the headless route
// must be present *and* the retracted denial must be absent.
//
// llms.txt is asserted on its *rendered* body, not its source, so building a
// string from `mcp-install.ts` counts as shipping it — the source-text form
// would have failed on the very refactor it should reward.
//
// Scope is these two surfaces, not "every". `/agents` is agent-fetched too and
// carries the route since #836 — guarded separately, against the builders it
// renders, by `pages/__tests__/agents-stdio-config.test.ts`. The four droppable
// artifacts carry the headless route too as of this change — guarded by the
// "headless" tests in the first describe block above.
describe("both R-04 agent-fetched surfaces offer the headless route", () => {
  async function surfaces(): Promise<Record<string, string>> {
    return {
      "docs agent-memory guide": DOCS_GUIDE,
      "llms.txt route": await (await LLMS_TXT({} as never)).text(),
    };
  }

  test("names the published package and the env var that authenticates it", async () => {
    for (const [name, text] of Object.entries(await surfaces())) {
      expect(text, name).toContain(STDIO_PACKAGE);
      expect(text, name).toContain(STDIO_KEY_ENV);
    }
  });

  test("no surface still claims a headless credential doesn't exist", async () => {
    for (const [name, text] of Object.entries(await surfaces())) {
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

// SK-PIVOT-017 / SK-PIVOT-018 — the docs→memory pack (goal pack #1). Same
// one-command path as its sibling, so the same drift risk applies: the command
// carries a repo path, and a moved directory 404s for every reader.
const DOCS_SKILL_REPO_PATH = "apps/web/public/agent-artifacts/nlqdb-docs-memory";
const DOCS_SKILLS_INSTALL_CMD = `npx skills add https://github.com/nlqdb/nlqdb/tree/main/${DOCS_SKILL_REPO_PATH}`;

describe("the docs→memory pack (SK-PIVOT-017)", () => {
  test("its SKILL.md lives at the published repo path, with the frontmatter `skills add` requires", () => {
    expect(existsSync(join(DIR, "nlqdb-docs-memory/SKILL.md"))).toBe(true);
    const fm = DOCS_SKILL.match(/^---\n([\s\S]*?)\n---/)?.[1];
    if (fm === undefined) throw new Error("nlqdb-docs-memory/SKILL.md has no YAML frontmatter");
    // `skills add` derives the install directory from `name`, so it must equal
    // the directory in the published URL above.
    expect(fm).toMatch(/^name:\s*nlqdb-docs-memory\s*$/m);
    expect(fm).toMatch(/^description:\s*\S.*$/m);
  });

  test("every surface that publishes it shows the exact install command", () => {
    for (const [name, text] of Object.entries(installSurfaces())) {
      expect(text, name).toContain(DOCS_SKILLS_INSTALL_CMD);
    }
  });

  // Hard rule 1 (R-07): only promise what is live in prod. `nlqdb_remember`
  // and the `agent_memory_v1` preset ride the `MEMORY_PRESET` flag (on since
  // 2026-07-29, but a one-var rollback), and this artifact lands in someone
  // else's repo where nobody re-reads it — so the flag, its two observable
  // error codes, and the always-on path must be named in the file itself,
  // not just on the site.
  // D-01 acceptance point 5 (SK-PIVOT-018): a corpus that mentions a
  // credential yields metadata rows only — the value never enters `content`.
  test("states the credential rule: metadata only, never secret values", () => {
    const prose = normalizeProse(DOCS_SKILL);
    expect(prose).toContain("never store secret values");
  });

  test("states the MEMORY_PRESET flag, how an off state shows up, and the always-on path", () => {
    const prose = normalizeProse(DOCS_SKILL);
    expect(prose).toContain("memory_preset");
    expect(prose).toContain("wrong_preset");
    expect(prose).toContain("preset_disabled");
    expect(prose).toContain("nlqdb_query");
  });

  // SK-PIVOT-017's two load-bearing constraints. Both halves matter: an agent
  // that ingests prose rebuilds the vector-RAG product the decision rejects,
  // and one that writes markdown breaks the git-reviewed source of truth.
  test("keeps the one-way, structure-only contract explicit", () => {
    const prose = normalizeProse(DOCS_SKILL);
    expect(prose).toContain("never ingest arbitrary prose");
    expect(prose).toContain("nlqdb does not write markdown");
    expect(prose).not.toContain("two-way");
    expect(prose).not.toContain("bidirectional");
  });
});

// R-09 — the Claude Code plugin. `apps/web/public/agent-artifacts/` doubles as
// the plugin root: the two skill directories it already serves are the plugin's
// `skills`, so the plugin ships zero copies of them and cannot drift from the
// files the site publishes. What CAN drift is the wiring — the manifest's skill
// paths, the bundled MCP endpoint, and the marketplace entry's `source`, none of
// which any other test covers. A wrong `source` or a moved artifacts directory
// makes `/plugin install` fail for every reader with no local symptom.
const PLUGIN_DIR_FROM_ROOT = "apps/web/public/agent-artifacts";
const REPO_ROOT = join(import.meta.dir, "../../../..");
const readJson = (p: string) => JSON.parse(readFileSync(join(REPO_ROOT, p), "utf8"));

const PLUGIN = readJson(`${PLUGIN_DIR_FROM_ROOT}/.claude-plugin/plugin.json`);
const PLUGIN_MCP = readJson(`${PLUGIN_DIR_FROM_ROOT}/.mcp.json`);
const MARKETPLACE = readJson(".claude-plugin/marketplace.json");
const MARKETPLACE_ENTRY = MARKETPLACE.plugins.find((p: { name: string }) => p.name === PLUGIN.name);

/** The two published one-liners: register the marketplace, then install. */
const PLUGIN_INSTALL_CMDS = [
  `/plugin marketplace add nlqdb/nlqdb`,
  `/plugin install ${PLUGIN.name}@${MARKETPLACE.name}`,
];

describe("the Claude Code plugin (R-09)", () => {
  test("its skills are the published artifacts themselves, not copies", () => {
    // Each declared path must be a real directory holding a SKILL.md — this is
    // what makes "one source of truth" structural rather than test-enforced.
    expect(PLUGIN.skills).toEqual(["./nlqdb-memory/", "./nlqdb-docs-memory/"]);
    for (const rel of PLUGIN.skills as string[]) {
      expect(existsSync(join(DIR, rel, "SKILL.md")), rel).toBe(true);
    }
  });

  test("the bundled MCP server is the shipped endpoint, in Claude Code's own shape", () => {
    // `claude mcp add --transport http` writes `type` + `url`; a block without
    // `type` loads zero servers with no error (same trap as the VS Code block).
    expect(PLUGIN_MCP).toEqual({
      mcpServers: { nlqdb: { type: "http", url: MCP_ENDPOINT_URL } },
    });
  });

  test("the marketplace entry points at the plugin root and agrees on the name", () => {
    expect(MARKETPLACE_ENTRY).toBeDefined();
    expect(MARKETPLACE_ENTRY.source).toBe(`./${PLUGIN_DIR_FROM_ROOT}`);
    expect(existsSync(join(REPO_ROOT, PLUGIN_DIR_FROM_ROOT, ".claude-plugin/plugin.json"))).toBe(
      true,
    );
  });

  // GLOBAL-019 — the licence a reader sees in `/plugin` must be the real one,
  // never "Apache-2.0 today". SK-GTM-007 — the manifest `homepage` is the one
  // link the plugin manager surfaces, and it is this channel's own key, not the
  // skills' (`agent-artifacts`), so plugin installs are attributable separately.
  test("declares FSL-1.1-ALv2 and a homepage keyed to this channel", () => {
    expect(PLUGIN.license).toBe("FSL-1.1-ALv2");
    expect(new URL(PLUGIN.homepage).searchParams.get("utm_source")).toBe("claude-plugin");
    expect(ATTRIBUTING_HOSTS.some((h) => PLUGIN.homepage.startsWith(h))).toBe(true);
  });

  test("every surface that publishes the skills also publishes the plugin", () => {
    for (const [name, text] of Object.entries(installSurfaces())) {
      for (const cmd of PLUGIN_INSTALL_CMDS) expect(text, name).toContain(cmd);
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
