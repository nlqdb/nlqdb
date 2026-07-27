import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
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
// adds. Neon caps it at 30 days out and rejects a longer window with the same
// 4xx this exists to prevent, so the bound is checked too.
// Docs: https://neon.com/docs/guides/branch-expiration

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const WORKFLOW_DIR = join(REPO_ROOT, ".github", "workflows");

// The collection endpoint, closing quote included — `.../branches/${id}` is a
// delete and must not be mistaken for a create. The project id matches any
// expression, so a site that spells the secret differently is still scanned.
const CREATE_ENDPOINT = /"https:\/\/console\.neon\.tech\/api\/v2\/projects\/[^"/]+\/branches"/;
const EXPIRES_AT_FROM_VAR = /\\"expires_at\\":\s*\\"\$\{?expires\}?\\"/;
const EXPIRES_ASSIGNMENT =
  /expires=\$\(date -u -d '\+(\d+) (minute|hour|day|week)s?' \+%Y-%m-%dT%H:%M:%SZ\)/g;
const HOURS_PER_UNIT: Record<string, number> = { minute: 1 / 60, hour: 1, day: 24, week: 168 };
const NEON_MAX_EXPIRY_HOURS = 30 * 24;

// Splitting on the word bounds each candidate to its own command, so a
// neighbouring curl's flags can never satisfy the assertions for this one.
function neonBranchCreatePayloads(yaml: string): string[] {
  return yaml
    .split(/\bcurl\b/)
    .slice(1)
    .filter((invocation) => /-X POST/.test(invocation) && CREATE_ENDPOINT.test(invocation))
    .map(
      (invocation) =>
        invocation.split("\n").find((line) => line.trimStart().startsWith('-d "')) ?? "",
    );
}

const workflows = readdirSync(WORKFLOW_DIR)
  // Both extensions: Actions accepts `.yaml`, so filtering on `.yml` alone
  // would leave a whole naming convention unscanned.
  .filter((f) => /\.ya?ml$/.test(f))
  .map((file) => ({ file, yaml: readFileSync(join(WORKFLOW_DIR, file), "utf8") }));

const creates = workflows.flatMap(({ file, yaml }) =>
  neonBranchCreatePayloads(yaml).map((payload) => ({ file, payload })),
);

const windows = workflows.flatMap(({ file, yaml }) =>
  [...yaml.matchAll(EXPIRES_ASSIGNMENT)].map(([, amount, unit]) => ({
    file,
    hours: Number(amount) * HOURS_PER_UNIT[unit],
  })),
);

describe("Neon branch creation is bounded server-side", () => {
  // A scanner that quietly matches nothing would pass every assertion below.
  // Three sites exist today (ci.yml, preview-app.yml, _e2e-staging.yml); a
  // fourth is covered automatically, a broken scanner is not.
  test("the scan finds every known creation site", () => {
    expect(creates.length).toBeGreaterThanOrEqual(3);
  });

  test.each(creates)("$file sets expires_at from a computed timestamp", ({ payload }) => {
    expect(payload).not.toBe("");
    expect(payload).toMatch(EXPIRES_AT_FROM_VAR);
  });

  // One `date -u` window per creation site: a shortfall means a site hardcoded
  // its timestamp (which stops being in the future the day after it's written)
  // or spelled its window in a unit missing from `HOURS_PER_UNIT` — widen that,
  // don't drop the assertion.
  test("every expiry window is computed and inside Neon's 30-day ceiling", () => {
    expect(windows.length).toBe(creates.length);
    expect(windows.filter(({ hours }) => hours <= 0 || hours > NEON_MAX_EXPIRY_HOURS)).toEqual([]);
  });
});
