import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// SK-MCP-002 marketing-copy guard.
//
// Every MCP tool nlqdb advertises to a stranger is a hard-coded string in
// both the server registration *and* the marketing copy, with no shared
// source of truth — so they drift. Run 62 caught `nlqdb_recall` (an
// unshipped verb) live on /agents + /integrations: a stranger who wired
// `mcp.nlqdb.com` and told their agent to call it got "tool not found" —
// their first FLOW-005 tool call 404'd. The old guard scanned `competitors.ts`
// alone and pinned a hand-copied 4-tool set (already stale: it omitted the
// shipped `nlqdb_connect_database`), so those two surfaces were unguarded.
//
// This sweep instead reads the shipped catalog from the server's own
// `registerTool(...)` sites — the same catalog the FLOW-005 stdio walker
// (SK-STRG-009) asserts at runtime against the real binary — and requires
// every `nlqdb_*` token in the marketing app (`apps/web/src`) *and* the
// docs-site prose (`apps/docs/src`, docs.nlqdb.com) to be either a shipped
// tool or an explicitly classified non-tool. A new phantom on any surface
// is neither, so it fails loudly. Sweeping docs too closes the last gap in
// the advertised-capability guard trilogy — the CLI-verb (SK-WEB-008) and
// SDK-method (SK-SDK-013) guards already cover the docs site; a stranger
// reads the same MCP tool names there before wiring `mcp.nlqdb.com`.

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const WEB_SRC = join(REPO_ROOT, "apps", "web", "src");
const DOCS_SRC = join(REPO_ROOT, "apps", "docs", "src");
const MCP_SERVER = join(REPO_ROOT, "packages", "mcp", "src", "server.ts");

// Source of truth: the verbs the shipped MCP server actually registers.
const shippedTools = new Set(
  [...readFileSync(MCP_SERVER, "utf8").matchAll(/registerTool\(\s*"(nlqdb_[a-z_]+)"/g)].map(
    (m) => m[1],
  ),
);

// `nlqdb_*` tokens that legitimately appear in apps/web but are NOT MCP
// tools — browser-storage keys, the analytics channel, and the manifesto
// "before" foil (SK-MCP-002: there is deliberately no `create_database`
// verb; provisioning is implicit in `nlqdb_query`). Anything outside this
// set and `shippedTools` is an unshipped tool being advertised.
const NON_TOOL_TOKENS = new Set([
  "nlqdb_anon", // anon device token (localStorage)
  "nlqdb_anon_pk", // anon publishable key (CopySnippet)
  "nlqdb_anon_prev", // prior anon token, adoption handoff
  "nlqdb_pending", // pending prompt across sign-in
  "nlqdb_draft", // draft prompt (localStorage)
  "nlqdb_history", // prompt history (localStorage)
  "nlqdb_src", // first-touch acquisition source (localStorage, SK-GTM-007)
  "nlqdb_logsnag", // analytics channel name
  "nlqdb_create_database", // manifesto foil — intentionally unshipped
]);

// Extension-parameterised so the same walker sweeps the web app's source
// (`.ts/.tsx/.astro`) and the docs site's Starlight prose (`.md/.mdx`),
// matching the SK-SDK-013 sweep shape.
function sweepFiles(dir: string, ext: RegExp, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sweepFiles(p, ext, acc);
    else if (ext.test(name) && !name.endsWith(".test.ts")) acc.push(p);
  }
  return acc;
}

const swept = [...sweepFiles(WEB_SRC, /\.(ts|tsx|astro)$/), ...sweepFiles(DOCS_SRC, /\.(md|mdx)$/)];

describe("MCP tool-name integrity (SK-MCP-002)", () => {
  test("the shipped catalog is the SK-MCP-002 verb set", () => {
    // Pins the source of truth so a silent rename/drop in the server is
    // caught here (and forces the doc + this allow-set to move together).
    expect([...shippedTools].sort()).toEqual([
      "nlqdb_connect_database",
      "nlqdb_describe",
      "nlqdb_list_databases",
      "nlqdb_query",
      "nlqdb_remember",
    ]);
  });

  test("every nlqdb_* token in apps/web + apps/docs is a shipped tool or a documented non-tool", () => {
    const offenders: Record<string, string> = {};
    for (const file of swept) {
      for (const m of readFileSync(file, "utf8").matchAll(/nlqdb_[a-z][a-z_]*/g)) {
        const tok = m[0];
        if (shippedTools.has(tok) || NON_TOOL_TOKENS.has(tok)) continue;
        offenders[tok] ??= relative(REPO_ROOT, file);
      }
    }
    // Maps token → first file it appears in, so a failure names the phantom
    // and where to fix it (e.g. `{ nlqdb_recall: "apps/docs/src/content/docs/mcp.mdx" }`).
    expect(offenders).toEqual({});
  });
});
