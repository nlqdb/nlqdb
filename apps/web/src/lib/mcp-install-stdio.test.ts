import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildStdioClaudeCodeCommand,
  buildStdioCodexConfig,
  buildStdioServerObject,
  STDIO_KEY_ENV,
  STDIO_PACKAGE,
  STDIO_PLACEHOLDER_KEY,
} from "./mcp-install.ts";

// R-04 headless-route drift guard.
//
// The hosted MCP route dead-ends an unattended coding agent at a browser
// consent screen, so `@nlqdb/mcp` over local stdio is the only route the reach
// track's own ICP — a coding agent with no human at a browser — can finish.
// Every identifier in the strings we publish for it is a contract with
// `packages/mcp`, not copy: rename the package, change the env var the binary
// reads, or tighten its key-prefix allowlist, and the published command starts
// failing on the reader's machine with no test going red.
//
// Nothing else covers this. `mcp-install.test.ts` pins the *hosted* endpoint
// against the server route; the tarball-entrypoint guard checks what npm ships,
// not what we tell a reader to type. So each assertion re-reads the `packages/mcp`
// source rather than restating a literal.

const repoRoot = join(import.meta.dir, "../../../..");

const manifest = JSON.parse(readFileSync(join(repoRoot, "packages/mcp/package.json"), "utf8")) as {
  name: string;
  bin: Record<string, string>;
};

const stdioSource = readFileSync(join(repoRoot, "packages/mcp/src/stdio.ts"), "utf8");

const apiKeysSource = readFileSync(join(repoRoot, "apps/api/src/api-keys.ts"), "utf8");

/** A key-prefix constant read from the API's own definition of it. */
function apiKeyPrefix(name: string): string {
  const value = apiKeysSource.match(new RegExp(`${name} = "([^"]+)"`))?.[1];
  if (!value) throw new Error(`\`api-keys.ts\` no longer exports ${name}`);
  return value;
}

const SK_LIVE_PREFIX = apiKeyPrefix("SK_LIVE_PREFIX");
const SK_MCP_PREFIX = apiKeyPrefix("SK_MCP_PREFIX");

/** The prefixes `runStdio` accepts before it will even open a transport. */
function keyPrefixes(): string[] {
  const list = stdioSource
    .match(/const KEY_PREFIXES = \[([^\]]*)\]/)?.[1]
    ?.match(/"([^"]+)"/g)
    ?.map((q) => q.slice(1, -1));
  if (!list?.length) throw new Error("`stdio.ts` no longer declares KEY_PREFIXES");
  return list;
}

describe("the published headless-route strings match packages/mcp", () => {
  test("names the package `packages/mcp` actually publishes", () => {
    // A scope/name change without one here tells every reader to `npx` a
    // package that does not exist.
    expect(STDIO_PACKAGE).toBe(manifest.name);
  });

  test("`npx -y <package>` resolves a bin, so the command can run at all", () => {
    // npx runs a package's single bin even when its name differs from the
    // package name. Ship a second bin and `npx -y @nlqdb/mcp` gets ambiguous.
    expect(Object.keys(manifest.bin)).toHaveLength(1);
  });

  test("sets the one env var the binary reads the credential from", () => {
    expect(stdioSource).toContain(`process.env["${STDIO_KEY_ENV}"]`);
  });

  test("the placeholder key carries a prefix the binary accepts", () => {
    // `runStdio` exits 1 before connecting on a prefix outside the allowlist,
    // so a placeholder that fails this is a command that can never work.
    expect(keyPrefixes().some((p) => STDIO_PLACEHOLDER_KEY.startsWith(p))).toBe(true);
  });

  test("...and one a reader can actually obtain", () => {
    // The gate the prefix allowlist alone does not catch, and the one this
    // guide got wrong first time round: `sk_mcp_` passes `runStdio` but is
    // minted server-side by the OAuth callback and never displayed
    // (SK-APIKEYS-009), and `/app/keys` deliberately won't mint one
    // (SK-APIKEYS-012). Telling a reader to paste a value that cannot exist
    // is the same dead end the headless route was added to remove.
    expect(STDIO_PLACEHOLDER_KEY.startsWith(SK_MCP_PREFIX)).toBe(false);
    expect(STDIO_PLACEHOLDER_KEY.startsWith(SK_LIVE_PREFIX)).toBe(true);
    // The prefix alone is not enough in the other direction either: every
    // assertion above also accepts a *real* key, because `mintSkLiveKey` emits
    // `sk_live_` + 32 lowercase hex (`randomHex` has no other alphabet). A
    // shouted suffix rejects that, and a bare keyless `sk_live_`, here — rather
    // than at CI's semgrep `p/secrets`, which only sees them after the push.
    // Guards every surface at once now that `/agents`, the docs guide and
    // llms.txt all render this constant (`agents-stdio-config.test.ts`).
    expect(STDIO_PLACEHOLDER_KEY.slice(SK_LIVE_PREFIX.length)).toMatch(/^[A-Z_]{3,}$/);
  });

  test("the server object is valid JSON in the shape an MCP host executes", () => {
    const server = JSON.parse(buildStdioServerObject()) as {
      command: string;
      args: string[];
      env: Record<string, string>;
    };
    expect(server.command).toBe("npx");
    expect(server.args).toEqual(["-y", STDIO_PACKAGE]);
    expect(server.env[STDIO_KEY_ENV]).toBe(STDIO_PLACEHOLDER_KEY);
  });

  test("the Claude Code command keeps `--env` away from the server name", () => {
    // Documented CLI trap: a bare name directly after `--env` is read as
    // another KEY=value pair and rejected, so the flag order is load-bearing
    // (https://code.claude.com/docs/en/mcp).
    const cmd = buildStdioClaudeCodeCommand();
    expect(cmd).not.toMatch(new RegExp(`--env ${STDIO_KEY_ENV}=\\S+ nlqdb`));
    // Everything after `--` is handed to the server untouched.
    expect(cmd.endsWith(`-- npx -y ${STDIO_PACKAGE}`)).toBe(true);
  });

  test("the Codex table is stdio, not the hosted route's `url` key", () => {
    const toml = buildStdioCodexConfig();
    expect(toml).toStartWith("[mcp_servers.nlqdb]");
    expect(toml).toContain('command = "npx"');
    expect(toml).toContain(`args = ["-y", "${STDIO_PACKAGE}"]`);
    expect(toml).toContain(`env = { ${STDIO_KEY_ENV} = "${STDIO_PLACEHOLDER_KEY}" }`);
    expect(toml).not.toContain("url =");
  });
});
