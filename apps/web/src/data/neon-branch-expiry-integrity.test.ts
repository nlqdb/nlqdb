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

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

// The collection endpoint, closing quote included — `.../branches/${id}` is a
// delete and must not be mistaken for a create. The project id matches any
// expression, so a site that spells the secret differently is still scanned.
const CREATE_URL = /"https:\/\/console\.neon\.tech\/api\/v2\/projects\/[^"/]+\/branches"/;

// A body or any POST spelling means "create"; the list call is a bare GET.
// Matching the method alone is not enough — `curl -d` posts without naming one,
// which is the easiest way to add a site a method-only scan walks past.
const SENDS_A_BODY =
  /(^|\s)(-X\s*POST|--request[\s=]+POST|--json(?![\w-])|-d(?![\w-])|--data(-raw|-binary|-urlencode)?(?![\w-]))/;

const EXPIRES_AT_FROM_VAR = /\\"expires_at\\":\s*\\"\$\{?expires\}?\\"/;
const WINDOW =
  /\bexpires=\$\(date -u -d '\+(\d+) (minute|hour|day|week)s?' \+%Y-%m-%dT%H:%M:%SZ\)/g;
const HOURS_PER_UNIT: Record<string, number> = { minute: 1 / 60, hour: 1, day: 24, week: 168 };

// 30 days is Neon's own ceiling. The floor is the longest job that runs against
// a minted branch (`_e2e-opencheck.yml`'s suite, `timeout-minutes: 60`) — a
// shorter window reaps the branch mid-run, and the author meets a red check
// whose database has vanished.
const MAX_EXPIRY_HOURS = 30 * 24;
const MIN_EXPIRY_HOURS = 1;

// A creation site is only as findable as the place we look. Both earlier holes
// in this guard were scan-scope holes, so scan every YAML and shell file in the
// repo: a composite action, a reusable workflow, or a script a `run:` block
// calls is just as much a creation site as `.github/workflows/*.yml`.
function scannableFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (!entry.isDirectory()) return /\.(ya?ml|sh)$/.test(entry.name) ? [path] : [];
    // Skip build output, and every dotdir except `.github` — which holds the
    // workflows and composite actions this guard exists to police.
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "build") return [];
    if (entry.name.startsWith(".") && entry.name !== ".github") return [];
    return scannableFiles(path);
  });
}

// One curl command is the line it starts on plus its `\`-continued lines.
// Bounding it that way stops a neighbouring command's flags — another curl's
// `-X POST`, or the `date -u -d` computing the window — from satisfying these
// assertions on its behalf.
function curlCommands(text: string): string[] {
  const lines = text.split("\n");
  const commands: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/\bcurl\b/.test(lines[i])) continue;
    let command = lines[i];
    while (/\\\s*$/.test(lines[i]) && i + 1 < lines.length) command += `\n${lines[++i]}`;
    commands.push(command);
  }
  return commands;
}

// Inline any variable holding the endpoint, so factoring the shared URL out of
// the three sites — the obvious next tidy-up — can't blind the scan to all of
// them at once.
function inlineEndpointVars(text: string): string {
  let inlined = text;
  for (const [, name, url] of text.matchAll(
    /(\w+)=("https:\/\/console\.neon\.tech\/api\/v2\/projects\/[^"]*")/g,
  )) {
    inlined = inlined.replaceAll(`"$${name}"`, url).replaceAll(`"\${${name}}"`, url);
  }
  return inlined;
}

function windowsIn(text: string): number[] {
  return [...text.matchAll(WINDOW)].map(
    ([, amount, unit]) => Number(amount) * HOURS_PER_UNIT[unit],
  );
}

const creates = scannableFiles(REPO_ROOT).flatMap((path) => {
  const text = inlineEndpointVars(readFileSync(path, "utf8"));
  return curlCommands(text)
    .filter((command) => CREATE_URL.test(command) && SENDS_A_BODY.test(command))
    .map((command) => ({ file: relative(REPO_ROOT, path), command, windows: windowsIn(text) }));
});

describe("Neon branch creation is bounded server-side", () => {
  // A scanner that quietly matches nothing would pass every assertion below.
  // Three sites exist today (ci.yml, preview-app.yml, _e2e-staging.yml); a
  // fourth is covered automatically, a broken scanner is not.
  test("the scan finds every known creation site", () => {
    expect(creates.length).toBeGreaterThanOrEqual(3);
  });

  test.each(creates)("$file sets expires_at from a computed timestamp", ({ command }) => {
    expect(command).toMatch(EXPIRES_AT_FROM_VAR);
  });

  // Checked per file, not repo-wide: a count that only balances in aggregate
  // lets a site with no window of its own borrow one from an unrelated file.
  test.each(creates)("$file computes a window Neon will accept", ({ windows }) => {
    expect(windows.length).toBeGreaterThanOrEqual(1);
    expect(windows.filter((h) => h < MIN_EXPIRY_HOURS || h > MAX_EXPIRY_HOURS)).toEqual([]);
  });
});
