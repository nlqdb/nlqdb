import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// Every workflow that mints a Neon branch races the same ten Free-tier slots.
// When they run out, `POST /branches` answers `422 BRANCHES_LIMIT_EXCEEDED`
// and `ci.yml`'s `test-api-smoke-neon` fails on a PR whose diff is innocent —
// shared capacity, not the change under test.
//
// Every client-side cleanup we have can miss. `preview-app.yml`'s runs only on
// `pull_request: closed`; `ci.yml`'s `if: always()` delete and its >1 h sweep
// both need a live runner, and the sweep only fires on the *next* CI run —
// which is the run the cap is already failing. `pr-571` (closed 2026-07-02)
// and `pr-648` (merged 2026-07-10) each held a slot for weeks that way, until
// a human deleted them by hand.
//
// `expires_at` moves the reap server-side, where no lost runner can skip it,
// so it is not optional on any creation site — including the next one someone
// adds. Neon bounds the window at 30 days and rejects a longer one with the
// same 4xx this exists to prevent, so the window is bounded here too.
// Docs: https://neon.com/docs/guides/branch-expiration
//
// Three review passes each found the same hole: a working creation site the
// guard read green because it did not recognise how the request was written.
// So this does not try to recognise a request in the general case. It pins the
// short list of files allowed to reach the Neon API at all — a new caller in
// any language, via any client, has to be added on purpose — and checks the
// payload only inside them.

const SELF = fileURLToPath(import.meta.url);
const REPO_ROOT = join(dirname(SELF), "..", "..", "..", "..");
const NEON_API = "console.neon.tech/api";

// The whole inventory of Neon control-plane callers. A creation site written in
// something other than shell+curl — `wget`, `actions/github-script`, an inline
// python, a Makefile recipe, a composite action, a `.buildkite/pipeline.yml` —
// lands here first, and adding the line is the prompt to give it an
// `expires_at`. `verify-secrets.sh` only reads the project.
const NEON_API_CALLERS = [
  ".github/workflows/_e2e-staging.yml",
  ".github/workflows/ci.yml",
  ".github/workflows/e2e-examples.yml",
  ".github/workflows/e2e-opencheck.yml",
  ".github/workflows/preview-app.yml",
  "scripts/verify-secrets.sh",
];

// The collection endpoint. Quote-agnostic — Neon's own documented example
// single-quotes the URL — and `(?![\w/])` keeps `/branches/${id}`, a delete,
// out. The host is matched per file, not per command, because the URL is
// routinely assembled from variables a line or two above the call.
const CREATES_A_BRANCH = /\/branches(?![\w/])/;

// Any spelling of "carries a payload" or "is a POST". Matching the method alone
// is not enough (`curl -d` posts without naming one) and neither is matching a
// body (Neon accepts a bodyless POST). Reads are bare GETs and deletes name
// `-X DELETE`, so neither trips this — but `date -u -d '1 hour ago'`, which the
// sweep uses, would, so date's own `-d` comes out first.
const IS_A_WRITE =
  /(^|\s)(-X\s*POST|--request[\s=]+POST|--method[\s=]+POST|--json(?![\w-])|-d(?![\w-])|--data(-raw|-binary)?(?![\w-])|--body-data|method:\s*["']POST)/;
const withoutDateFlag = (text: string) => text.replace(/\bdate (-u )?-d\b/g, "date");

// `expires_at` has to come from a variable the same block computes with
// `date -u`. Tying the two together is what stops a site from borrowing a
// window computed for something else. One spelling is prescribed on purpose: a
// window built by epoch arithmetic, or fed in through `jq --arg`, fails here
// rather than being followed through — the guard stays a text match.
const EXPIRES_AT_VAR = /expires_at\\?["']?\s*:\s*\\?["']?\$\{?(\w+)\}?/g;
// And it belongs to the `branch` object. `{"branch":{"name":"x"},"expires_at":…}`
// closes `branch` first, so the branch is created with no expiry at all — the
// last way left to ship a payload that looks compliant and is not. Shell
// expansions come out first: `${PR_NUMBER}` is not the end of the object.
const NESTED_IN_BRANCH = /branch\\?["']?\s*:\s*\{[^}]*expires_at/;
const withoutExpansions = (text: string) => text.replace(/\$\{[^}]*\}/g, "V");
const windowFor = (name: string) =>
  new RegExp(
    `\\b${name}=\\$\\(date -u -d ["']\\+(\\d+) (minute|hour|day|week)s?["'] \\+%Y-%m-%dT%H:%M:%SZ\\)`,
    "g",
  );
const HOURS_PER_UNIT: Record<string, number> = { minute: 1 / 60, hour: 1, day: 24, week: 168 };

// 30 days is Neon's own ceiling. The floor is the longest single job that runs
// against a minted branch (`_e2e-opencheck.yml`, `timeout-minutes: 60`) — less
// than that reaps the branch mid-run and the author meets a red check whose
// database has vanished. It is a floor, not a sufficient window: the shared
// `e2e` branch is held across up to three sequential opencheck suites plus the
// staging deploy (~3.2 h), which is why `_e2e-staging.yml` sets 6 h.
const MAX_EXPIRY_HOURS = 30 * 24;
const MIN_EXPIRY_HOURS = 1;

function repoFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (!entry.isDirectory()) return path === SELF ? [] : [path];
    // Generated, vendored, or (`.claude`) full agent worktrees of this same
    // repo. Every other directory is walked, dotted CI configs included
    // (`.buildkite`, `.circleci`, `.gitlab`) — a creation site hides in one
    // just as well as in `.github/workflows`.
    return /^(node_modules|dist|build|coverage|\.git|\.claude|\.astro|\.wrangler|\.turbo)$/.test(
      entry.name,
    )
      ? []
      : repoFiles(path);
  });
}

// One shell script or inline snippet: a `run:`/`script:` block scalar in YAML,
// anything else whole. Coarser than one curl invocation on purpose — a
// per-command window cannot see the variable holding the URL, or a payload
// spread over lines that carry no `\`.
function scriptBlocks(path: string, text: string): string[] {
  if (!/\.ya?ml$/.test(path)) return [text];
  const lines = text.split("\n");
  const blocks: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const open = /^\s*(?:-\s+)?(?:run|script):[ \t]*(.*)$/.exec(lines[i]);
    if (!open) continue;
    const indent = lines[i].search(/\S/);
    const body = [/^[|>]/.test(open[1]) ? "" : open[1]];
    while (
      i + 1 < lines.length &&
      (lines[i + 1].trim() === "" || lines[i + 1].search(/\S/) > indent)
    )
      body.push(lines[++i]);
    blocks.push(body.join("\n"));
  }
  return blocks;
}

// One command inside a block: the line it starts on plus its `\`-continued
// lines. The block above is what catches a request the line split hides; this
// is what stops a second, bare create from hiding behind a compliant one in the
// same block.
function commands(block: string): string[] {
  const lines = block.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    let command = lines[i];
    while (/\\\s*$/.test(lines[i]) && i + 1 < lines.length) command += `\n${lines[++i]}`;
    out.push(command);
  }
  return out;
}

const neonFiles = repoFiles(REPO_ROOT).flatMap((path) => {
  const text = readFileSync(path, "utf8");
  return text.includes(NEON_API) ? [{ file: relative(REPO_ROOT, path), text }] : [];
});

const creates = neonFiles.flatMap(({ file, text }) =>
  scriptBlocks(file, text)
    .filter((block) => CREATES_A_BRANCH.test(block) && IS_A_WRITE.test(withoutDateFlag(block)))
    .map((block, index) => ({ site: `${file} #${index + 1}`, block })),
);

describe("Neon branch creation is bounded server-side", () => {
  // The tripwire. A creation site the payload checks below cannot parse is
  // still caught here the moment it lives in a file nobody has vouched for.
  test("only NEON_API_CALLERS reach the Neon API", () => {
    expect(neonFiles.map(({ file }) => file).sort()).toEqual(NEON_API_CALLERS);
  });

  // A scanner that quietly matches nothing would pass every assertion below.
  // Three sites exist today (ci.yml, preview-app.yml, _e2e-staging.yml); a
  // fourth is covered automatically, a broken scanner is not.
  test("the scan finds every known creation site", () => {
    expect(creates.length).toBeGreaterThanOrEqual(3);
  });

  // Failures read as a list of what to change, not as `Expected: not []`: the
  // author who trips this guard is the author it exists to protect.
  test.each(creates)("$site sets expires_at from a window Neon accepts", ({ block }) => {
    const problems: string[] = [];
    const names = [...block.matchAll(EXPIRES_AT_VAR)].map(([, name]) => name);
    if (names.length === 0) problems.push("no expires_at fed from a shell variable");
    else if (!NESTED_IN_BRANCH.test(withoutExpansions(block)))
      problems.push("expires_at sits outside the `branch` object, where Neon ignores it");
    for (const name of names) {
      const hours = [...block.matchAll(windowFor(name))].map(
        ([, amount, unit]) => Number(amount) * HOURS_PER_UNIT[unit],
      );
      if (hours.length === 0)
        problems.push(`$${name} is not a \`date -u -d '+N unit' +%Y-%m-%dT%H:%M:%SZ\` window`);
      for (const h of hours.filter((h) => h < MIN_EXPIRY_HOURS || h > MAX_EXPIRY_HOURS))
        problems.push(`$${name} is ${h} h, outside ${MIN_EXPIRY_HOURS}–${MAX_EXPIRY_HOURS} h`);
    }
    // And no single request in the block skips it. Requests are written as one
    // `\`-continued command here, as all three sites and Neon's own documented
    // example are; a payload spread over unjoined lines fails this.
    for (const command of commands(block))
      if (
        CREATES_A_BRANCH.test(command) &&
        IS_A_WRITE.test(withoutDateFlag(command)) &&
        !command.includes("expires_at")
      )
        problems.push(`this request skips expires_at: ${command.split("\n")[0].trim()}`);
    expect(problems).toEqual([]);
  });
});
