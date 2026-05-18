# Decisions Log — `GLOBAL-NNN`

Cross-cutting decisions that govern more than one feature. Each
`GLOBAL-NNN` is a self-contained file under
[`docs/decisions/`](./decisions/) — that is the canonical text. **This
file is the index.**

When you change a GLOBAL, edit only its file under `docs/decisions/`
(one place). Features under `docs/features/` reference the GLOBAL by ID;
they don't duplicate the body. If a change affects how a feature
applies the rule, update that feature's `## GLOBALs governing this
feature` commentary in the same PR
(see [`docs/feature-conventions.md`](./feature-conventions.md) §5).

Format of every block follows
[`docs/feature-conventions.md`](./feature-conventions.md) §4 — the five
fields (Decision / Core value / Why / Consequence / Alternatives) are
mandatory. Core values are cited by name from
[`docs/architecture.md`](./architecture.md) §0.

To find every feature affected by a GLOBAL:

```bash
grep -rn 'GLOBAL-007' docs/features/
```

## Index

| ID | Title | Primary surface(s) | Status |
|----|-------|---------------------|--------|
| [GLOBAL-001](./decisions/GLOBAL-001-sdk-only-http-client.md) | SDK is the only HTTP client | every surface | active |
| [GLOBAL-002](./decisions/GLOBAL-002-behavior-parity.md) | Behavior parity across surfaces | every surface | active |
| [GLOBAL-003](./decisions/GLOBAL-003-all-surfaces-one-pr.md) | New capabilities ship to all surfaces in one PR | every surface | active |
| [GLOBAL-004](./decisions/GLOBAL-004-schemas-only-widen.md) | Logical schemas widen; physical layout reshapes | schema-inference, plan-cache, db-adapter, multi-engine-adapter | active |
| [GLOBAL-005](./decisions/GLOBAL-005-idempotency-key.md) | Every mutation accepts `Idempotency-Key` | every mutating endpoint | active |
| [GLOBAL-006](./decisions/GLOBAL-006-plan-cache-content-addressing.md) | Plans content-addressed by `(schema_hash, query_hash)` | plan-cache, ask-pipeline | active |
| [GLOBAL-007](./decisions/GLOBAL-007-no-login-wall.md) | No login wall before first value | auth, web-app, cli, ask-pipeline | active |
| [GLOBAL-008](./decisions/GLOBAL-008-one-better-auth-identity.md) | One Better Auth identity across all surfaces | auth, cli, mcp, web-app | active |
| [GLOBAL-009](./decisions/GLOBAL-009-silent-token-refresh.md) | Tokens refresh silently — never surface a 401 | auth, sdk, cli, mcp | active |
| [GLOBAL-010](./decisions/GLOBAL-010-keychain-credentials.md) | Credentials live in OS keychain; `NLQDB_API_KEY` is the CI escape hatch | cli, mcp, api-keys | active |
| [GLOBAL-011](./decisions/GLOBAL-011-honest-latency.md) | Honest latency — show the live trace; never spinner-lie | web-app, ask-pipeline, observability | active |
| [GLOBAL-012](./decisions/GLOBAL-012-one-sentence-errors.md) | Errors are one sentence with the next action | every surface | active |
| [GLOBAL-013](./decisions/GLOBAL-013-free-tier-bundle-budget.md) | $0/month for the free tier; Workers free-tier bundle ≤ 3 MiB compressed | every package | active |
| [GLOBAL-014](./decisions/GLOBAL-014-otel-on-external-calls.md) | OTel span on every external call (DB, LLM, HTTP, queue) | observability, every surface | active |
| [GLOBAL-015](./decisions/GLOBAL-015-power-user-escape-hatch.md) | Power users always have an escape hatch (raw SQL/Mongo/connection string) | db-adapter, ask-pipeline, cli | active |
| [GLOBAL-016](./decisions/GLOBAL-016-mature-packages-no-rc.md) | Reach for small mature packages before DIY; hard-pass on RC on the critical path | every package — baseline | active |
| [GLOBAL-017](./decisions/GLOBAL-017-one-way-to-do-things.md) | Two endpoints, two CLI verbs, one chat box — one way to do each thing | every surface | active |
| [GLOBAL-018](./decisions/GLOBAL-018-instant-revocation.md) | Revocation is instant and visible across devices | auth, api-keys | active |
| [GLOBAL-019](./decisions/GLOBAL-019-apache2-open-source-core.md) | Free + Open Source core (Apache-2.0); Cloud is convenience, not a moat | every package — baseline | active |
| [GLOBAL-020](./decisions/GLOBAL-020-zero-config-first-60s.md) | No "pick a region", no config files in the first 60s | web-app, cli, ask-pipeline | active |
| [GLOBAL-021](./decisions/GLOBAL-021-external-system-ownership.md) | Each external system has one canonical owning module | every package — baseline | active |
| [GLOBAL-022](./decisions/GLOBAL-022-recoverable-failures-retry-to-success.md) | Recoverable failures retry to success — never surface a fixable error | sdk, ask-pipeline, llm-router, idempotency, observability | active |
| [GLOBAL-023](./decisions/GLOBAL-023-trust-ux-baseline.md) | Trust UX baseline — diff preview, visible SQL trace, refuse-on-low-confidence | ask-pipeline, web-app, cli, elements, mcp-server | active |
| [GLOBAL-024](./decisions/GLOBAL-024-demand-signal-telemetry.md) | Demand-signal telemetry on every "not yet" path | every surface, events-pipeline | active |
| [GLOBAL-025](./decisions/GLOBAL-025-north-star.md) | North-star: engine quality (NL→SQL + data-engine layers), seamless onboarding, seamless UX — each with explicit KPIs | every feature | active |
| [GLOBAL-026](./decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md) | LLM strategy: free chain forever, BYOLLM for everyone, hosted premium on paid (flat sub + included request allowance + soft-meter overage, 0% markup) | llm-router, premium-tier, stripe-billing, api-keys | active |

## Adding a new GLOBAL

1. Pick the next `GLOBAL-NNN` (sticky; never renumber).
2. Create `docs/decisions/GLOBAL-NNN-<slug>.md` with the five-field
   block. Slug is kebab-case, derived from the title.
3. Add a row to the index above.
4. For each affected feature, add a one-line reference under its
   `## GLOBALs governing this feature` section. Add nested
   commentary only when the GLOBAL has a feature-specific
   implication worth calling out.
5. Per `CLAUDE.md` §10.1, `GLOBAL-NNN` lands **before** any code that
   depends on it.
