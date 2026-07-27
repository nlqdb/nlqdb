import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The `/agents` connect card offers two routes into nlqdb memory: the hosted
// MCP server (OAuth in a browser) and the local-stdio server (a key pasted
// into the host config). The stdio card is the only one an agent with no human
// at a browser can complete, and it is the only place on the marketing site
// that names the published npm package — so every identifier inside it is a
// cross-repo contract with `packages/mcp`, not page copy.
//
// Nothing else catches a drift here. `check-links.mjs` sweeps hrefs, not code
// blocks; the tarball-entrypoint guard checks what npm ships, not what the
// site tells a reader to type. Rename the package, change the env var the
// binary reads, or tighten its accepted key prefixes, and this card silently
// starts printing a command that fails on the reader's machine.
//
// Each assertion therefore derives its expected value from the `packages/mcp`
// source rather than restating a literal — and, for the credential, from the
// API's own prefix constants, so the card can't advertise a key nobody can mint.

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../../../..");

const agentsPage = readFileSync(join(here, "../agents/index.astro"), "utf8");
const mcpManifest = JSON.parse(
  readFileSync(join(repoRoot, "packages/mcp/package.json"), "utf8"),
) as { name: string };
const stdioSource = readFileSync(join(repoRoot, "packages/mcp/src/stdio.ts"), "utf8");
const apiKeysSource = readFileSync(join(repoRoot, "apps/api/src/api-keys.ts"), "utf8");

/** A key-prefix constant read from the API's own definition of it. */
function apiKeyPrefix(name: string): string {
  const value = apiKeysSource.match(new RegExp(`${name} = "([^"]+)"`))?.[1];
  if (!value) throw new Error(`\`api-keys.ts\` no longer exports ${name}`);
  return value;
}

/** The `mcpStdioConfig` template literal, parsed as the JSON a reader pastes. */
function stdioConfig(): {
  mcpServers: { nlqdb: { command: string; args: string[]; env: Record<string, string> } };
} {
  const match = agentsPage.match(/const mcpStdioConfig = `([\s\S]*?)`;/);
  if (!match?.[1]) throw new Error("`/agents` no longer defines `mcpStdioConfig`");
  return JSON.parse(match[1]);
}

describe("/agents local-stdio connect card", () => {
  test("the pasted block is valid JSON an MCP host can read", () => {
    const server = stdioConfig().mcpServers.nlqdb;
    expect(server.command).toBe("npx");
  });

  test("launches the package name `packages/mcp` actually publishes", () => {
    // A scope/name change in the manifest without one here leaves the site
    // telling readers to `npx` a package that does not exist.
    expect(stdioConfig().mcpServers.nlqdb.args).toEqual(["-y", mcpManifest.name]);
  });

  test("sets the credential env var the binary reads, with an accepted prefix", () => {
    const env = stdioConfig().mcpServers.nlqdb.env;
    const [name, placeholder] = Object.entries(env)[0] ?? [];

    // `stdio.ts` reads exactly one env var for the key and gates it on a
    // prefix allowlist; both are re-read here rather than hardcoded.
    expect(stdioSource).toContain(`env["${name}"]`);
    const prefixes = stdioSource
      .match(/const KEY_PREFIXES = \[([^\]]*)\]/)?.[1]
      ?.match(/"([^"]+)"/g)
      ?.map((q) => q.slice(1, -1));
    expect(prefixes?.length).toBeGreaterThan(0);
    expect(prefixes?.some((p) => placeholder?.startsWith(p))).toBe(true);
  });

  test("...and a prefix a reader can actually obtain", () => {
    // The gate the allowlist alone does not catch, and the one this card got
    // wrong first time round: `sk_mcp_` passes `runStdio` but is minted
    // server-side by the OAuth callback and never displayed (SK-APIKEYS-009),
    // and `/app/keys` deliberately won't mint one (SK-APIKEYS-012). Telling a
    // reader to paste a value that cannot exist is the same dead end this card
    // was added to remove. `sk_live_` is the only self-mintable prefix.
    const placeholder = Object.values(stdioConfig().mcpServers.nlqdb.env)[0] ?? "";
    expect(placeholder.startsWith(apiKeyPrefix("SK_MCP_PREFIX"))).toBe(false);
    expect(placeholder.startsWith(apiKeyPrefix("SK_LIVE_PREFIX"))).toBe(true);
    // …and the prose names the same prefix the block pastes.
    expect(agentsPage).toContain("<code>sk_live_</code>");
  });

  test("the card is reachable copy, wired to the connect demand signal", () => {
    // GLOBAL-024: whether anyone reaches for the headless route is only
    // measurable if the button reports its own transport.
    expect(agentsPage).toContain('data-copy-method="stdio"');
    expect(agentsPage).toContain('data-copy-method="url"');
  });
});
