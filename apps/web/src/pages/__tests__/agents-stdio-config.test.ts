import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildClaudeCodeCommand,
  buildClaudeConfig,
  buildStdioMcpServersConfig,
  MCP_ENDPOINT_URL,
} from "../../lib/mcp-install.ts";

// The `/agents` connect card offers two routes into nlqdb memory: the hosted
// MCP server (OAuth in a browser) and the local-stdio server (a key pasted
// into the host config). The stdio card is the only one an agent with no human
// at a browser can complete.
//
// Every identifier inside those blocks is a cross-repo contract with
// `packages/mcp`, not page copy — but the page no longer restates any of them.
// It renders `mcp-install.ts`'s builders, so the contract itself is pinned to
// `packages/mcp` once, in `mcp-install-stdio.test.ts` (package name, env var,
// accepted *and* obtainable key prefix, shouted-suffix placeholder). What is
// left for this file is the part only `/agents` can get wrong: that the page
// still renders those builders rather than a copy that can drift, and that its
// prose and instrumentation match the block it ships.

const here = dirname(fileURLToPath(import.meta.url));
const agentsPage = readFileSync(join(here, "../agents/index.astro"), "utf8");

describe("/agents connect card renders the canonical install strings", () => {
  test("both config blocks and the CLI one-liner come from mcp-install.ts", () => {
    // Assigned from the builders, never re-typed. A literal reintroduced here
    // is exactly the drift that once shipped a placeholder key nobody could mint.
    expect(agentsPage).toContain("const mcpConfig = buildClaudeConfig(MCP_ENDPOINT_URL);");
    expect(agentsPage).toContain("const mcpCommand = buildClaudeCodeCommand(MCP_ENDPOINT_URL);");
    expect(agentsPage).toContain("const mcpStdioConfig = buildStdioMcpServersConfig();");
  });

  test("no install string is hardcoded on the page any more", () => {
    // The three values the builders own. Any of them appearing as page text
    // means a second copy exists, and one of the two will go stale.
    for (const rendered of [
      buildStdioMcpServersConfig(),
      buildClaudeConfig(MCP_ENDPOINT_URL),
      buildClaudeCodeCommand(MCP_ENDPOINT_URL),
    ]) {
      expect(agentsPage).not.toContain(rendered);
    }
    // The npm package and the credential env var reach the page only through
    // `mcp-install.ts`; `@nlqdb/mcp` may still appear in prose/comments, but a
    // pasteable key placeholder may not.
    expect(agentsPage).not.toContain("sk_mcp_REPLACE_ME");
  });

  test("the stdio block a reader pastes is valid JSON under `mcpServers`", () => {
    const parsed = JSON.parse(buildStdioMcpServersConfig()) as {
      mcpServers: { nlqdb: { command: string } };
    };
    expect(parsed.mcpServers.nlqdb.command).toBe("npx");
  });

  test("the prose names the same prefix the block pastes", () => {
    expect(agentsPage).toContain("<code>sk_mcp_</code>");
  });

  test("the card is reachable copy, wired to the connect demand signal", () => {
    // GLOBAL-024: whether anyone reaches for the headless route is only
    // measurable if the button reports its own transport.
    expect(agentsPage).toContain('data-copy-method="stdio"');
    expect(agentsPage).toContain('data-copy-method="url"');
  });
});
