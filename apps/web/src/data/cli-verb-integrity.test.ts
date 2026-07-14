import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// SK-WEB-008 / SK-CLI-002 CLI-verb integrity guard (sibling of the
// SK-MCP-002 mcp-tool-integrity sweep).
//
// Every `nlq <verb>` we render in a copy-pasteable marketing snippet is a
// hard-coded string with no shared source of truth with the shipped cobra
// tree — so they drift. Run 72 caught `nlq schema "{goal}"` live on two
// showcase-carousel slides: `schema` is not a shipped verb, so a stranger
// copying the snippet hits "unknown command" on their *very first* CLI call
// — the worst first impression, and copy an LLM lifts verbatim propagates it.
// Run 72 found it by hand; this automates that sweep so the next phantom
// fails CI instead of shipping.
//
// Source of truth: the top-level verbs the shipped CLI actually registers.
// Per cli/internal/cmd/root.go ("one verb per file"), each command file's
// first `Use:` token is its top-level verb; root.go's is the `nlq` root
// itself. We read those directly so the guard can't disagree with the binary.

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const WEB_SRC = join(REPO_ROOT, "apps", "web", "src");
const CLI_CMD = join(REPO_ROOT, "cli", "internal", "cmd");

// The shipped top-level verbs: first `Use:` token of every cmd file, minus
// the `nlq` root. A rename/add/drop in the CLI moves this set automatically,
// so the guard tracks reality with no hand-copied list to go stale.
const shippedVerbs = new Set<string>();
for (const name of readdirSync(CLI_CMD)) {
  if (!name.endsWith(".go") || name.endsWith("_test.go")) continue;
  const first = readFileSync(join(CLI_CMD, name), "utf8").match(/Use:\s*"([a-z][a-z-]*)/);
  if (first && first[1] !== "nlq") shippedVerbs.add(first[1]);
}

function tsFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) tsFiles(p, acc);
    else if (/\.(ts|tsx|astro)$/.test(name) && !name.endsWith(".test.ts")) acc.push(p);
  }
  return acc;
}

describe("CLI-verb integrity (SK-WEB-008 / SK-CLI-002)", () => {
  test("the shipped verb set is derived from the cobra tree", () => {
    // Pins the source of truth so a silent rename/drop in the CLI is caught
    // here — and any deferred verb (`chat`, `connection`, `keys rotate`) that
    // gets built must land as a real command file before this set includes it.
    expect([...shippedVerbs].sort()).toEqual([
      "ask",
      "byollm",
      "db",
      "help",
      "keys",
      "login",
      "logout",
      "mcp",
      "new",
      "query",
      "remember",
      "run",
      "update",
      "use",
      "whoami",
    ]);
  });

  test("every `nlq <verb>` snippet in apps/web is a shipped verb", () => {
    // Maps the first unshipped verb → the file it appears in, so a failure
    // names the phantom and where to fix it (e.g. `{ schema:
    // "apps/web/src/data/showcase-examples.ts" }`). The leading token after
    // `nlq ` must be a top-level verb; flags (`nlq --json …`) don't match
    // `[a-z]` and are skipped, and `nlqdb` has no space so it never matches.
    const offenders: Record<string, string> = {};
    for (const file of tsFiles(WEB_SRC)) {
      for (const m of readFileSync(file, "utf8").matchAll(/\bnlq ([a-z][a-z-]*)/g)) {
        const verb = m[1];
        if (shippedVerbs.has(verb)) continue;
        offenders[verb] ??= relative(REPO_ROOT, file);
      }
    }
    expect(offenders).toEqual({});
  });
});
