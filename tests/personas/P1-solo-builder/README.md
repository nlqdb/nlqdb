# P1 — The Solo Builder

> Canonical persona definition: [`docs/research/personas.md`](../../../docs/research/personas.md#p1--the-solo-builder)

**Real-life journey (Maya, building a meal-planning side-project on a Friday night):**

1. Runs `nlq db create mealplan` from her terminal. Gets a connection string and an API key on stdout.
2. Drops the publishable key into a Next.js page that mounts `<nlq-data goal="upcoming meals this week">`.
3. Sunday — real users sign up. She types `"how many signups this weekend, grouped by referrer"` into the web app's chat instead of opening `psql`.
4. Monday — she needs a `trial_ends_at` column. Says so in chat from the web app, reviews the diff, approves.
5. The same API key works from the SDK (a small Node script she runs for nightly digests).

This is the "[Phase 1 success](../../../docs/research/personas.md#p1--the-solo-builder) — deploys something real with nlqdb as its actual DB, not just the admin layer" path.

## Surface coverage matrix

| Step | Surface | Runner | File |
|------|---------|--------|------|
| 1 — `nlq db list` enumerates the tenant (the JSON envelope SK-CLI-004 promises) | CLI | Go `testscript` | [`tests/e2e/cli/scripts/p1_db_list.txtar`](../../e2e/cli/scripts/p1_db_list.txtar) |
| 1 — env-key auth resolves + token is redacted (GLOBAL-010 + SK-CLI-009) | CLI | Go `testscript` | [`tests/e2e/cli/scripts/p1_whoami_env_key.txtar`](../../e2e/cli/scripts/p1_whoami_env_key.txtar) |
| 2 — Next.js page embeds `<nlq-data>` with `pk_live_…` | Examples | Playwright via shared harness | [`examples/nextjs/e2e/smoke.spec.ts`](../../../examples/nextjs/e2e/smoke.spec.ts) |
| 2 — Astro page renders the same snippet | Examples | Playwright via shared harness | [`examples/astro/e2e/smoke.spec.ts`](../../../examples/astro/e2e/smoke.spec.ts) |
| 3 — web app chat reads + summarises | Web | opencheck | [`tests/opencheck/tests.yaml`](../../opencheck/tests.yaml) (cases `#read-shows-informative-data` · `#count-summarizes`) |
| 4 — DDL diff preview + approve in chat | Web | opencheck | [`tests/opencheck/tests.yaml`](../../opencheck/tests.yaml) (case `#submit-prefilled-row` — same diff-confirm chip path) |
| 5 — SDK contract: `client.ask("upcoming meals")` returns rows + summary | SDK | vitest + MSW cassette | [`tests/e2e/sdk/p1_solo_builder.test.ts`](../../e2e/sdk/p1_solo_builder.test.ts) |
| 5 — SDK silent token refresh on 401 (GLOBAL-009) | SDK | vitest + MSW cassette | [`tests/e2e/sdk/p1_solo_builder.test.ts`](../../e2e/sdk/p1_solo_builder.test.ts) |

## GLOBALs this journey verifies end-to-end

- **GLOBAL-002** (behaviour parity) — same `Idempotency-Key` accepted by CLI, SDK, web.
- **GLOBAL-007** (no login wall) — `nlq db create` works anonymously then adopts on `nlq login`.
- **GLOBAL-009** (silent token refresh) — SDK + CLI surface a fresh token, never a 401.
- **GLOBAL-020** (zero-config first 60s) — start-to-first-row in well under one minute.
- **GLOBAL-023** (trust-UX baseline) — DDL diff preview shown before apply.

## How to run just this persona

```bash
# Web slice (existing)
gh workflow run e2e-opencheck.yml

# CLI slice
gh workflow run e2e-cli.yml

# SDK slice (cassette-replay, hermetic)
gh workflow run e2e-sdk.yml

# Examples slice (smoke for nextjs + astro)
gh workflow run e2e-examples.yml
```

For a local run during development, see each runner's `tests/e2e/<surface>/README.md`.
