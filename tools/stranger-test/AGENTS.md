# Agents Guide — tools/stranger-test

`tools/stranger-test/` is the **§1.1 anti-self-deception primitive** from
[`docs/research/automated-icp-validation-plan.md §1.1`](../../docs/research/automated-icp-validation-plan.md).
A headless Playwright walker hits the deployed acquisition surfaces
(FLOW-001 / FLOW-002 / FLOW-003 — anonymous-first, /solve/, /vs/) with
seeded persona prompts and writes a structured JSON outcome. Read
[`docs/features/stranger-test/FEATURE.md`](../../docs/features/stranger-test/FEATURE.md)
before editing.

## Read first

| If you touch… | Read first |
|---|---|
| `src/browser.ts` | [`SK-STRG-001`](../../docs/features/stranger-test/FEATURE.md) (one shared browser per run) |
| `src/flows/flow-001.ts` | [`automated-icp-validation-plan-verification.md FLOW-001`](../../docs/research/automated-icp-validation-plan-verification.md#flow-001--anonymous-first-happy-path) |
| `src/flows/flow-002.ts` | [`automated-icp-validation-plan-verification.md FLOW-002`](../../docs/research/automated-icp-validation-plan-verification.md#flow-002--pain-driven-aeo-inbound-search--solveslug--first-query) |
| `src/flows/flow-003.ts` | [`automated-icp-validation-plan-verification.md FLOW-003`](../../docs/research/automated-icp-validation-plan-verification.md#flow-003--comparison-driven-inbound-search--vscompetitor--first-query) |
| `src/personas.ts` | the §1.1 paragraph (25 prompts shape; persona-to-flow mapping) |
| `src/runner.ts` | the CLI shape — `--base-url`, `--flows`, `--prompts`, `--out` |

## Layout

```
tools/stranger-test/
├── src/
│   ├── runner.ts             # CLI entry — orchestrates walks, writes JSON
│   ├── browser.ts            # shared chromium + per-walk deadline helper
│   ├── personas.ts           # 25 seeded prompts (P1×10, P2×8, P3×4, P6×3)
│   ├── types.ts              # WalkResult / FlowResult / FlowRun / StepResult
│   └── flows/
│       ├── flow-001.ts       # anonymous-first happy path (two-door home → /app/new/ hero)
│       ├── flow-002.ts       # /solve/<slug> → first query
│       └── flow-003.ts       # /vs/<slug> → first query
├── test/                     # bun test, no browser launch
└── results/                  # walk JSON output (gitignored except .gitkeep)
```

## Running locally

```bash
# All flows, 3 prompts each, against production:
bash scripts/stranger-test.sh

# More breadth (5 prompts each — 15 walks):
bash scripts/stranger-test.sh --prompts 5

# One flow only:
bash scripts/stranger-test.sh --flows flow-001 --prompts 10

# A preview deployment:
NLQDB_BASE_URL=https://preview-xyz.nlqdb.com bash scripts/stranger-test.sh

# Unit tests (no network, no browser launch):
bun run --filter @nlqdb/stranger-test test
bun run --filter @nlqdb/stranger-test typecheck
```

First run on a machine without the Playwright Chromium cached: `bunx playwright install chromium`. The walker uses the same Chromium revision Playwright 1.49.x pins. On Cloudflare-hosted environments where `PLAYWRIGHT_BROWSERS_PATH` is already provisioned with a 1.49.x chromium (e.g. `/opt/pw-browsers/chromium-1148`), the install is a no-op.

The script exits non-zero if any walked run failed or was blocked, so an
agent can use the exit code as the regression signal without parsing JSON.
A summary line — `→ N/M passed (failed=X blocked=Y) ttfv p50=…ms p95=…ms`
— prints to stdout. JSON goes to `tools/stranger-test/results/walk-<utc>.json`
unless `--out` overrides.

## Conventions

- **No notifications fire from this primitive.** Per
  [`GLOBAL-028`](../../docs/decisions/GLOBAL-028-acquisition-progress-tracker.md)
  the operator loop is "founder runs one prompt; agent runs the walker;
  the JSON file IS the alert." No LogSnag, no email, no webhook.
- **One browser per run.** Per-walk contexts isolate state; the browser
  is launched once and torn down after the last walk. Adding a flow =
  add a `walkFlowNNN(...)` function that takes `(prompt, baseUrl,
  userAgent, browser)` and returns `FlowRun`.
- **`withDeadline` wraps every walk.** A stalled CDN or hung
  `waitForResponse` is degraded to a `failed step 0 walk deadline`
  entry — the runner never hangs longer than 180 s per walk × the
  number of walks.
- **401 and 429 are not HTTP errors.** Sessions probe `/api/auth/get-session`
  unconditionally; rate-limit handling is the rate-limit feature's
  responsibility. Anything else 4xx/5xx surfaces in `httpErrors[]`.
- **Steps map 1:1 to the verification mirror.** The mirror's
  walkthrough is the source of truth for step numbering; the walker
  asserts the same things in the same order.
