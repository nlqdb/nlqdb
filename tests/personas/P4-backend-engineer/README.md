# P4 — The Backend Engineer at a Small Startup

> Canonical persona definition: [`docs/research/personas.md`](../../../docs/research/personas.md#p4--the-backend-engineer-at-a-small-startup)

**Real-life journey (Sam, backend engineer at a 5-person SaaS team):**

1. Adds `@nlqdb/sdk` to a Nuxt application; reads from a server-side route handler with `sk_live_…`.
2. Bolts the same SDK onto a SvelteKit project's `+server.ts` for a small operational dashboard.
3. Writes a nightly cron (`nlq "regression rows since last release" --csv > /tmp/rows.csv`) to email to the team.
4. The SDK gives him an `Idempotency-Key` on writes (GLOBAL-005) — re-runs of the cron are safe.
5. When `apps/api` rotates tokens, the SDK refreshes silently (GLOBAL-009); Sam never sees a 401.

## Surface coverage matrix

| Step | Surface | Runner | File |
|------|---------|--------|------|
| 1 — Nuxt server route calls `@nlqdb/sdk` with `sk_live_` | Examples | Playwright via shared harness | [`examples/nuxt/e2e/smoke.spec.ts`](../../../examples/nuxt/e2e/smoke.spec.ts) |
| 2 — SvelteKit `+server.ts` same SDK call | Examples | Playwright via shared harness | [`examples/sveltekit/e2e/smoke.spec.ts`](../../../examples/sveltekit/e2e/smoke.spec.ts) |
| 3 — `--json` envelope is the only output-shape switch (SK-CLI-004) — the contract every cron + CI pipeline depends on | CLI | Go `testscript` | [`tests/e2e/cli/scripts/p4_json_envelope.txtar`](../../e2e/cli/scripts/p4_json_envelope.txtar) |
| 4 — `Idempotency-Key` header set on every mutation; same key reused across retries (GLOBAL-005 + SK-SDK-006) | SDK | vitest + cassette | [`tests/e2e/sdk/p4_backend_engineer.test.ts`](../../e2e/sdk/p4_backend_engineer.test.ts) |
| 5 — transient 5xx is silently retried (GLOBAL-022); 401 is surfaced for the auth layer above the SDK to refresh (GLOBAL-009 lives at the auth-wrapper layer, not in the SDK's fetch loop) | SDK | vitest + cassette | [`tests/e2e/sdk/p4_backend_engineer.test.ts`](../../e2e/sdk/p4_backend_engineer.test.ts) |

## GLOBALs this journey verifies end-to-end

- **GLOBAL-001** (SDK is the only HTTP client) — both framework examples route through the SDK, not raw fetch.
- **GLOBAL-005** (Idempotency-Key on every mutation).
- **GLOBAL-009** (silent token refresh).
- **GLOBAL-010** (`NLQDB_API_KEY` is the CI escape hatch) — the CLI cron path uses it.
- **GLOBAL-022** (recoverable failures retry to success).

## How to run just this persona

```bash
gh workflow run e2e.yml -f surface=cli
gh workflow run e2e.yml -f surface=sdk
gh workflow run e2e.yml -f surface=examples
```
