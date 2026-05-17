# P6 — The Analytics / Observability Engineer

> Canonical persona definition: [`docs/research/personas.md`](../../../docs/research/personas.md#p6--the-analytics--observability-engineer)

**Real-life journey (an analytics engineer running pipelines + dashboards):**

1. Pipes `nlq` output into duckdb: `nlq "orders this week, by source" --csv | duckdb -c "…"`.
2. Uses raw curl + a `sk_live_…` from a Bash cron — no SDK, no CLI: just HTTP.
3. From a Python notebook, hits the `/v1/ask` endpoint with the same wire shape exercised in (2).
4. Inspects the `trace` block on every response to validate the actual SQL the LLM emitted (GLOBAL-011 + GLOBAL-023).
5. When the LLM router refuses on low confidence (GLOBAL-023), surfaces that refusal verbatim — analytics pipelines must fail loud, not silently coerce.

## Surface coverage matrix

| Step | Surface | Runner | File |
|------|---------|--------|------|
| 1 — `nlq --help` is pipeline-safe (no ANSI escapes, all verbs present) — the contract a `nlq … \| duckdb …` flow depends on | CLI | Go `testscript` | [`tests/e2e/cli/scripts/p6_help_pipeline_safe.txtar`](../../e2e/cli/scripts/p6_help_pipeline_safe.txtar) |
| 2 — raw curl example matches the SDK wire shape | Examples | shell harness | [`examples/curl/e2e/smoke.sh`](../../../examples/curl/e2e/smoke.sh) |
| 2 — bash CLI example walks through 4 commands | Examples | shell harness | [`examples/cli/e2e/smoke.sh`](../../../examples/cli/e2e/smoke.sh) |
| 2 — SolidJS real-time dashboard (5s `refresh`) via the typed `@nlqdb/solid` wrapper | Examples | Playwright via shared harness | [`examples/solid/e2e/smoke.spec.ts`](../../../examples/solid/e2e/smoke.spec.ts) |
| 3 — SDK `ask` returns a `trace` block | SDK | vitest + MSW cassette | [`tests/e2e/sdk/p6_analytics_engineer.test.ts`](../../e2e/sdk/p6_analytics_engineer.test.ts) |
| 4 — `trace` carries the SQL + confidence | SDK | vitest + MSW cassette | [`tests/e2e/sdk/p6_analytics_engineer.test.ts`](../../e2e/sdk/p6_analytics_engineer.test.ts) |
| 5 — low-confidence refusal surfaced as a typed error (GLOBAL-023) | SDK | vitest + MSW cassette | [`tests/e2e/sdk/p6_analytics_engineer.test.ts`](../../e2e/sdk/p6_analytics_engineer.test.ts) |

## GLOBALs this journey verifies end-to-end

- **GLOBAL-011** (honest latency / live trace) — `trace` is surfaced on every response.
- **GLOBAL-015** (power-user escape hatch) — raw SQL + raw connection string available via the CLI.
- **GLOBAL-022** (recoverable failures retry to success) — transient 5xx + 429 retried by the SDK; pipeline never sees them.
- **GLOBAL-023** (trust-UX baseline) — refuses on low confidence rather than coercing wrong SQL.

## How to run just this persona

```bash
gh workflow run e2e-cli.yml
gh workflow run e2e-sdk.yml
gh workflow run e2e-examples.yml
```
