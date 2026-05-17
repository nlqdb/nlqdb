# SDK e2e tests

Persona-driven contract tests for `@nlqdb/sdk`. Hermetic by default — replay against checked-in cassettes under `cassettes/`. Re-record against staging via `RECORD=1` (see [`SK-E2E-003`](../../../docs/features/e2e-coverage/FEATURE.md#sk-e2e-003--hybrid-llm-determinism-cassettes-for-contract-tests-live-llm-through-plan-cache-for-journey-tests)).

## Layout

```
tests/e2e/sdk/
├── package.json          # not in root workspaces — install locally
├── vitest.config.ts
├── tsconfig.json
├── _lib/
│   └── cassette.ts       # fetch shim that replays JSON cassettes
├── cassettes/            # one JSON file per (test × call sequence)
│   ├── p1_solo_builder.json
│   ├── p4_backend_engineer.json
│   └── p6_analytics_engineer.json
├── p1_solo_builder.test.ts
├── p4_backend_engineer.test.ts
└── p6_analytics_engineer.test.ts
```

## Run

```bash
cd tests/e2e/sdk
bun install            # vitest, typescript
bun run test           # hermetic replay
bun run typecheck      # tsc --noEmit
```

To re-record against staging:

```bash
RECORD=1 NLQDB_API_URL=https://<staging> NLQDB_API_KEY=sk_live_… bun run test
# Inspect the diff in `cassettes/`, commit if the new shape is intended.
```

## Trigger via GitHub Actions

```bash
gh workflow run e2e-sdk.yml
```

The `sdk` surface runs the `e2e-sdk.yml` reusable workflow, which `bun install`s this folder and runs `vitest run`. The job runs without secrets — cassettes are sufficient.

## Cassette format

Each cassette is a JSON file:

```json
{
  "exchanges": [
    {
      "request":  { "method": "POST", "path": "/v1/ask", "bodyContains": ["mealplan"] },
      "response": { "status": 200, "body": { "status": "ok", "rows": [], "rowCount": 0, "trace": {...} } }
    }
  ]
}
```

`bodyContains` is a list of substrings each of which must appear in the JSON body string. The matcher is intentionally loose — a request-shape change that doesn't affect the assertion shouldn't flake the test. The matcher is exact on `method` + `path` only.

## When to add a test

Per [`SK-E2E-001`](../../../docs/features/e2e-coverage/FEATURE.md#sk-e2e-001--persona-driven-journey-suites-are-the-organising-principle):

1. Pick the persona (P1/P4/P6 use the SDK — P2 uses MCP, P3+P5 are web-only).
2. Add a test in `pN_<name>.test.ts`, with a matching `cassettes/pN_<name>.json`.
3. Add the row to the persona's surface matrix in `tests/personas/PN-<name>/README.md`.

Reference: the SDK's own [unit tests](../../../packages/sdk/test/client.test.ts) use the same `FetchLike` shim — copy from there.
