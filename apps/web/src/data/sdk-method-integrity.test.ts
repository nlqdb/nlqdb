import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// SK-SDK-013 SDK-method integrity guard (third sibling of the SK-MCP-002
// mcp-tool-integrity and SK-WEB-008 cli-verb-integrity sweeps).
//
// Every `client.<method>(` we render in a copy-pasteable snippet — and every
// `NlqClient.<method>` we name in reference prose — is a hard-coded string
// with no shared source of truth with the shipped `@nlqdb/sdk` surface, so
// they drift. The failure mode is the run-62 `nlqdb_recall` incident in the
// SDK lane: a stranger copies `client.foo(...)` from the site or docs and
// their first SDK call throws `client.foo is not a function` — the worst
// first impression, and an LLM lifting the snippet verbatim propagates it.
// The CLI verbs (SK-WEB-008) and MCP tools (SK-MCP-002) each already had a
// guard; the SDK method surface was the last un-guarded advertised capability.
//
// The sweep spans every copy-pasteable stranger-facing surface: `apps/web/src`
// (`.ts/.tsx/.astro`) *and* the docs-site prose `apps/docs/src` (`.md/.mdx`).
//
// Source of truth: the members the shipped `NlqClient` type actually declares.
// Every member carries a JSDoc block, so we read the identifier that opens
// each one straight from `packages/sdk/src/index.ts` — the guard can't
// disagree with the type. A pin test asserts the derived set so a rename /
// add / drop in the SDK is caught here too.

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const WEB_SRC = join(REPO_ROOT, "apps", "web", "src");
const DOCS_SRC = join(REPO_ROOT, "apps", "docs", "src");
const SDK_SRC = join(REPO_ROOT, "packages", "sdk", "src", "index.ts");

// The shipped member set: every identifier that opens a JSDoc-documented
// member of the `NlqClient` type (top-level verbs plus the namespaced
// `databases.connect`). Brace-matched so nested members are included and a
// method's parameter names (which are never JSDoc-preceded) are not.
function extractMembers(): Set<string> {
  const src = readFileSync(SDK_SRC, "utf8");
  const start = src.indexOf("export type NlqClient = {");
  let depth = 0;
  let end = -1;
  for (let i = src.indexOf("{", start); i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) {
      end = i;
      break;
    }
  }
  const block = src.slice(start, end + 1);
  return new Set(
    [...block.matchAll(/\*\/\s*\n\s+([a-zA-Z_][a-zA-Z0-9_]*)\??\s*[(:<]/g)].map((m) => m[1]),
  );
}

const shippedMembers = extractMembers();

// Collect files under `dir` matching `ext`, skipping test files so the
// guard's own fixtures never trip it.
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

describe("SDK-method integrity (SK-SDK-013)", () => {
  test("the shipped member set is derived from the NlqClient type", () => {
    // Pins the source of truth so a silent rename/drop in the SDK is caught
    // here — and any deferred verb that gets built must land as a real member
    // of `NlqClient` before this set includes it.
    expect([...shippedMembers].sort()).toEqual([
      "ask",
      "askStream",
      "clearByollm",
      "connect",
      "createDatabase",
      "databases",
      "deleteDatabase",
      "getByollmStatus",
      "getKeyStatus",
      "getModels",
      "listChat",
      "listDatabases",
      "listKeys",
      "mintKey",
      "postChat",
      "redeemOAuthBridgeCode",
      "registerPremiumInterest",
      "remember",
      "revokeKey",
      "runSql",
      "setByollm",
    ]);
  });

  test("every `client.*` / `NlqClient.*` reference in apps/web + apps/docs is a shipped member", () => {
    // Maps the first unshipped segment → the file it appears in, so a failure
    // names the phantom and where to fix it (e.g. `{ recall:
    // "apps/docs/src/content/docs/sdk.mdx" }`). Astro's `client:load` /
    // `client:only` directives use a colon, not a dot, so they never match.
    const offenders: Record<string, string> = {};
    for (const file of swept) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(
        /\b(?:client|NlqClient)\.([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)?)/g,
      )) {
        for (const seg of m[1].split(".")) {
          if (shippedMembers.has(seg)) continue;
          offenders[seg] ??= relative(REPO_ROOT, file);
        }
      }
    }
    expect(offenders).toEqual({});
  });
});
