# nlqdb — Agent Instructions

*nlqdb — your autonomous DBA.* It attaches to the database a team already has
(Postgres; D1 second) and runs one deterministic loop — observe → propose →
apply → verify → revert. The product: [`docs/END_GOAL.md`](docs/END_GOAL.md);
numbers: [`docs/scorecard.md`](docs/scorecard.md). Per-area `AGENTS.md` files
narrow this guide to their directory.

## Shared rules — read first

Read every resource on https://mcp.hochly.com/mcp before anything else:
Omer's rules for all his repos (rules://general is the baseline). A run
that cannot reach the server says so and stops; it never improvises the
rules. Send Authorization: Bearer $RULES_MCP_TOKEN (set in the run's
environment); without it the server answers 404. This file adds only this
repo's facts and firm calls.

## 1. What nlqdb is

It exists for the [mission](docs/END_GOAL.md#mission): encapsulate the
trial-and-error journey every company walks to a good database infrastructure.
Bet: [`GLOBAL-043`](docs/decisions/GLOBAL-043-attach-first-autonomous-dba.md);
its roadmap, [`docs/ROADMAP.md`](docs/ROADMAP.md), is the work queue, run by `/daily` step 2 (1a attach build on
synthetic DBs → 1b Postgres spike + rateme12 D1 attach,
[`002`](docs/history/dogfood-iterations/002-rateme12-attach.md) → 2 deletion
series → 3 playbook). Depth only; Show HN waits on the love gate.

## 2. Firm calls — do not re-litigate

- **`END_GOAL.md` outranks everything** — P1–P6 and every decision doc; whatever contradicts it is the bug, fixed in the same PR.
- **Attach-first, never on the request path** — the loop runs off the app's request path with no LLM in any hot path; every engine PR names the KPI (A, B or C) it moves (`GLOBAL-043`).
- **Four pillars** — engine quality, onboarding, UX, performance: every PR advances ≥ 1 and degrades 0 (`GLOBAL-025`, §8 item 7).
- **LLM strategy** — BYO-LLM plus hosted premium (`GLOBAL-026`).
- **Cloudflare Workers at $0** — the stack and its bundle budget (`GLOBAL-013`); rationale in [`docs/architecture.md`](docs/architecture.md) §2, §6.
- **P1. Never contradict documented decisions silently** — if a request would violate `END_GOAL.md`, a `GLOBAL-NNN` or an `SK-<FEATURE>-NNN`, stop and raise it with the user citing the ID; never rationalise around it.
- **P2. Web-research first** — on any ambiguity or unfamiliar error, and before picking any dependency's version (`rules://general` rule 6); state the sources checked when proposing the fix.
- **P3. Decisions live in one place** — `GLOBAL-NNN` only in `docs/decisions/GLOBAL-NNN-<slug>.md` (indexed in `docs/decisions.md`), `SK-<FEATURE>-NNN` only in that feature's `FEATURE.md`; cite by ID, never restate; the canonical home lands before dependent code ([`docs/feature-conventions.md`](docs/feature-conventions.md)).
- **P4. Documentation rules** — `rules://workflow` and `rules://general` rule 10.
- **P5. Simplest path** — `rules://general` rule 10; clean code beats backward compatibility while we are still building; the no-patch-on-patch rule is [`END_GOAL.md` § Architecture](docs/END_GOAL.md#architecture--simple-and-scalable).
- **P6. World-class customer journeys** — `rules://general` and `rules://guidelines`.

## 3. Tech stack (high-level)

Cloudflare Workers (`GLOBAL-013`) + Neon Postgres + D1; Better Auth; LLM
router; OTel; Astro/React; TypeScript, Bun workspaces. Rationale:
[`docs/architecture.md`](docs/architecture.md) §2, §6.

## 4. Project map

```
nlqdb/
├── apps/
│   ├── web/             # marketing + product web app
│   ├── api/             # Cloudflare Workers HTTP API
│   ├── events-worker/   # event-pipeline consumer (queue → sinks)
│   ├── email-router/    # inbound mail (Email Routing catch-all)
│   ├── mcp/             # hosted MCP server (mcp.nlqdb.com)
│   ├── docs/            # user-facing docs site (docs.nlqdb.com)
│   └── coming-soon/     # standalone landing page
├── cli/                 # `nlq` command-line tool
├── packages/
│   ├── sdk/             # @nlqdb/sdk — the only HTTP client (GLOBAL-001)
│   ├── elements/ + react/ next/ vue/ nuxt/ svelte/ sveltekit/ astro/ solid/  # <nlq-data> + wrappers
│   ├── nlqdb-swift/ nlqdb-rb/ nlqdb-rs/ cli-shim/  # other-language SDKs + `nlq` npm shim
│   ├── db/ platform-db/ # engine-agnostic adapter · control-plane DB (not user DBs)
│   └── llm/ mcp/ otel/ auth-internal/ email/ events/  # router · MCP · OTel · auth · email · events
├── tools/               # workspace tooling (eval, stranger-test)
├── docs/                # long-form reference docs (see §6)
│   └── features/        # per-feature decision records (mandatory pre-read)
├── examples/            # working samples (HTML, frameworks)
└── AGENTS.md, CLAUDE.md # this file (CLAUDE.md → AGENTS.md symlink)
```

## 5. Before-editing path map

When your change touches any of these paths, the listed feature is
**mandatory pre-reading**. (Auto-load via `when-to-load.globs` where
supported; else read manually before editing.)

| If you touch… | Read first |
|---|---|
| `apps/api/src/auth/**`, `packages/auth-internal/**` | `docs/features/auth/FEATURE.md` |
| `apps/api/src/api-keys.ts`, `apps/web/src/pages/app/keys.astro`, `apps/web/src/components/keys/**` | `docs/features/api-keys/FEATURE.md` |
| `apps/api/src/ask/**`, the `/v1/ask` pipeline | `docs/features/ask-pipeline/FEATURE.md` |
| `apps/api/src/run/**`, the `POST /v1/run` raw-SQL escape hatch (`GLOBAL-015`) | `docs/features/sdk/FEATURE.md` (`SK-SDK-009`) + `docs/features/cli/FEATURE.md` + `docs/features/sql-allowlist/FEATURE.md` |
| write/DDL diff preview, `confidence`, response `trace` block | `docs/features/trust-ux/FEATURE.md` |
| `packages/errors/**`, `apps/api/src/error-envelope.ts`, any error copy or new error code | `docs/features/error-taxonomy/FEATURE.md` |
| `apps/api/src/db-create/**` | retired (`GLOBAL-043`) — `docs/features/hosted-db-create/FEATURE.md` |
| `apps/api/src/ask/sql-validate-ddl.ts`, `apps/api/src/scheduled/**` (cron job table) — kept by `GLOBAL-043` | `docs/features/hosted-db-create/FEATURE.md` |
| `apps/api/src/ask/plan-cache.ts`, plan storage | `docs/features/plan-cache/FEATURE.md` |
| `packages/llm/**`, model routing, prompts | `docs/features/llm-router/FEATURE.md` |
| `tools/eval/**`, `.github/workflows/quality-eval-*.yml` (BIRD/Spider NL-accuracy harness) | retired (`GLOBAL-043`) — `docs/features/quality-eval/FEATURE.md` |
| `apps/api/src/ask/sql-validate.ts`, SQL allowlist | `docs/features/sql-allowlist/FEATURE.md` |
| `packages/db/**` | `docs/features/db-adapter/FEATURE.md` |
| `apps/api/src/db-connect/**`, `apps/api/src/ask/build-deps.ts`, `packages/db/src/clickhouse-byo.ts` (BYO — egress + sealed-secret; security-sensitive) | `docs/features/byo-connect/FEATURE.md` |
| `packages/db/src/clickhouse-tinybird/**`, `packages/db/src/introspect-clickhouse.ts` (non-Postgres engines) | `docs/features/multi-engine-adapter/FEATURE.md` |
| anything touching `schema_hash`, schema inference / evolution, `apps/api/src/insert/**` | retired (`GLOBAL-043`) — `docs/features/schema-widening/FEATURE.md` |
| any `POST`/`PATCH`/`DELETE` handler | `docs/features/idempotency/FEATURE.md` |
| `packages/otel/**`, new spans / metrics | `docs/features/observability/FEATURE.md` · `docs/features/byo-otel/FEATURE.md` |
| `apps/api/src/stripe/**`, Stripe webhooks | `docs/features/stripe-billing/FEATURE.md` |
| `apps/api/src/byollm-account.ts`, `apps/api/src/ask/byollm.ts`, `apps/api/src/llm-router.ts`, `model` preset / BYOLLM / hosted-premium meter | `docs/features/premium-tier/FEATURE.md` |
| `packages/llm/src/frontier/**` (founder-funded lane) | `docs/features/frontier-keys/FEATURE.md` |
| `apps/events-worker/**`, `packages/events/**`, `apps/api/src/events-feature.ts`, `apps/api/src/ask/demand-signal.ts` | `docs/features/events-pipeline/FEATURE.md` |
| `apps/api/src/workload-analyser/**`, optimizer proposals / dashboard / apply surfaces, `packages/db/src/clickhouse-tinybird/pipe-management.ts`, `apps/api/migrations/0008_workload_analyser_audit.sql` | `docs/features/engine-migration/FEATURE.md` + `GLOBAL-043` |
| rate-limit middleware (`apps/api/src/{ask/rate-limit,anon-rate-limit,anon-global-cap}.ts`, `principal.ts` `rateLimitBucketKey`) | `docs/features/rate-limit/FEATURE.md` |
| `apps/api/src/{anon-rate-limit,anon-global-cap,turnstile}.ts`, `apps/web/src/lib/{anon,anon-adopt,handoff,prompt-storage,turnstile}.ts`, `apps/web/src/components/CreateForm.tsx` | retired (`GLOBAL-043`) — `docs/features/anonymous-mode/FEATURE.md` |
| `apps/api/src/admin/**`, `apps/api/src/pmf-survey.ts`, `apps/web/src/pages/app/admin.astro`, `apps/web/src/components/admin/**`, `apps/web/src/lib/attribution.ts`, `apps/web/src/{lib/pmf-survey.ts,components/chat/PmfSurveyCard.tsx}` | retired (`GLOBAL-043`) — `docs/features/gtm-metrics/FEATURE.md` |
| `cli/**` | `docs/features/cli/FEATURE.md` |
| `packages/elements/**` | `docs/features/elements/FEATURE.md` |
| `packages/sdk/**` | `docs/features/sdk/FEATURE.md` |
| `packages/{react,next,vue,nuxt,svelte,sveltekit,astro,solid}/**` | retired (`GLOBAL-043`) — `docs/features/framework-wrappers/FEATURE.md` |
| `packages/nlqdb-swift/**` | retired (`GLOBAL-043`) — `docs/features/sdk-swift/FEATURE.md` |
| `packages/mcp/**`, `apps/mcp/**` | `docs/features/mcp-server/FEATURE.md` |
| `apps/web/**` (onboarding, anonymous mode) | `docs/features/web-app/FEATURE.md` |
| `apps/web/src/data/competitors.ts`, `apps/web/src/pages/vs/**`, `apps/web/src/pages/llms.txt.ts` | retired (`GLOBAL-043`) — `docs/features/comparison-pages/FEATURE.md` |
| `apps/web/src/data/solve.ts`, `apps/web/src/pages/solve/**` | retired (`GLOBAL-043`) — `docs/features/solve-pages/FEATURE.md` |
| `apps/web/src/data/blog.ts`, `apps/web/src/pages/blog/**`, `apps/web/src/lib/inline-md.ts` | retired (`GLOBAL-043`) — `docs/features/blog/FEATURE.md` |
| `apps/api/src/db-create/presets/agent-memory-v1.ts`, `apps/api/src/memory/**`, `tools/docs-memory/**`, `nlqdb_remember`/`nlqdb_recall` MCP tools | retired (`GLOBAL-043`) — `docs/features/agent-memory-pivot/FEATURE.md` |
| expert-knowledge platform ("Become AI" marketplace): `docs/features/expert-knowledge-platform/**`, `apps/api/src/grants.ts` + `/v1/grants` routes | retired (`GLOBAL-043`) — `docs/features/expert-knowledge-platform/FEATURE.md` |
| `apps/web/src/onboarding/**`, signup flow, first-query path | `docs/features/onboarding/FEATURE.md` |
| `apps/docs/**`, `docs.nlqdb.com` Starlight site | `docs/features/docs-site/FEATURE.md` |
| `.github/workflows/**`, `nlqdb/actions/**` (CI permissions) | `docs/features/ci-permissions/FEATURE.md` |
| `tests/{personas,opencheck,e2e}/**`, `examples/**/e2e/**`, `.github/workflows/{e2e*,_e2e-*}.yml`, `packages/nlqdb-{rb/spec,rs/tests}/e2e/**` | `docs/features/e2e-coverage/FEATURE.md` |
| `apps/api/src/icp-*.ts`, `docs/research/automated-icp-validation-plan*.md`, `docs/research/icp-evidence-*.md` | retired (`GLOBAL-043`) — `docs/features/icp-mining/FEATURE.md` |
| `tools/stranger-test/**`, `scripts/stranger-test.sh`, `scripts/flow-005-walk.sh`, `scripts/flow-005-stdio-walk.sh` | `docs/features/stranger-test/FEATURE.md` |

## 6. Long-form reference docs (load on demand)

| File | What for |
|---|---|
| [`docs/decisions.md`](docs/decisions.md) + [`docs/decisions/`](docs/decisions/) | **Canonical** `GLOBAL-NNN` decisions — index + one body per file. |
| [`docs/END_GOAL.md`](docs/END_GOAL.md) | The finished product, flow by flow — **top-ranked**: outranks P1–P6 and every decision doc. |
| [`docs/feature-conventions.md`](docs/feature-conventions.md) | How `docs/features/` is structured. Read before adding/editing a feature. |
| [`docs/architecture.md`](docs/architecture.md) | System architecture, surface specs, tech-stack rationale, risks. |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | The task queue: `GLOBAL-043`'s phases as boxes. |
| [`docs/phase-plan.md`](docs/phase-plan.md) | Exit gate + the §6 monetization + scaling trigger. |
| [`docs/runbook.md`](docs/runbook.md) | Operations: env, secrets, deploy, recovery; design-partner ref (§10). |
| [`docs/founder-playbook.md`](docs/founder-playbook.md) | Design-partner recruitment, Sean Ellis interview script, inbound triage SLA. |
| [`docs/performance.md`](docs/performance.md) | Span/metric/label catalog + perf goals. |
| [`docs/guidelines.md`](docs/guidelines.md) | This repo's additions to `rules://guidelines`: eagle-eye checks, bullet-proof checklist, build-vs-reuse. |
| [`docs/progress.md`](docs/progress.md) | Platform integration tiers (P0–P3). |
| [`docs/research-receipts.md`](docs/research-receipts.md) | Receipts for cited research. |
| [`docs/competitors.md`](docs/competitors.md) | Competitive landscape — threat matrix + gap analysis. |
| [`docs/history/`](docs/history/) | Lessons learnt — one doc per topic; the open dogfood iteration brief. |
| [`docs/research/`](docs/research/) | Strategic research. |
| [`docs/research/acquisition-channels.md`](docs/research/acquisition-channels.md) + [`-mechanisms.md`](docs/research/acquisition-channels-mechanisms.md) | Acquisition-channel ledger + its mechanism-notes shard. |
| [`docs/future/`](docs/future/) | Forward-looking plans not yet promoted to a feature. |
| [`docs/scorecard.md`](docs/scorecard.md) | Current numbers; the `/daily` measurement tracker. |
| [`blocked-by-human.md`](blocked-by-human.md) | The founder mailbox — open asks only. |
| [`docs/cost-ladder.md`](docs/cost-ladder.md) | Cost policy: $0/month until someone pays. |
| [`docs/weekly-review.md`](docs/weekly-review.md) | `/weekly`'s direction check and focus number. |
| [`docs/architecture-build-vs-buy.md`](docs/architecture-build-vs-buy.md) · [`docs/progress-p3-catalog.md`](docs/progress-p3-catalog.md) | Build-vs-buy calls · P3 integration catalog. |
| [`.claude/commands/`](.claude/commands/) | `/daily`, `/review`, `/weekly` (+ `/founder-summary`, `/ek`). |
| [`.github/pull_request_template.md`](.github/pull_request_template.md) | PR body: roadmap item + KPI, `Walked:`, blockers. |
| [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | The CI gate (typecheck, Biome, tests). |
| [`.github/dependabot.yml`](.github/dependabot.yml) | Weekly grouped dependency bumps, `tests/` suites included. |
| [`docs/AGENTS.md`](docs/AGENTS.md) | The scheduled run: cron prompt, modes, merge gate, deploys. |

Each `FEATURE.md`'s `Status:` line is the canonical feature status.

## 7. Common commands

```bash
bun install                  # install workspaces
bun run dev                  # all dev servers (apps/*)
bun run test                 # all tests
bun run typecheck            # type-check the workspace
bun run check                # Biome format + lint (what CI runs)
bun run build                # build all packages
# bundle budget check (GLOBAL-013):
bun run --filter apps/api build && wrangler deploy --dry-run --outdir=/tmp/out
```

Inside `.claude/worktrees/<id>`, biome's `!**/.claude` ignore makes `bun run
lint` / `format` check 0 files (exit 1) — pass explicit paths. CI is unaffected.

## 8. Quality gates before opening a PR

1. `bun run typecheck && bun run check && bun run test` all green.
2. Every new decision is in its canonical home per `P3`; a new
   `GLOBAL` also adds a row to the `docs/decisions.md` index.
3. `grep -rn '^### GLOBAL-' docs/features/` prints nothing — features
   reference GLOBALs by ID, bodies live only under `docs/decisions/`.
4. Every new external call has an OTel span (`GLOBAL-014`).
5. Every mutating endpoint accepts `Idempotency-Key` (`GLOBAL-005`).
6. New capability added → SDK + CLI + MCP + elements all updated, or
   gap tracked in the affected feature (`GLOBAL-003`).
7. PR body names the `GLOBAL-025` KPI advanced **and** the
   [`docs/ROADMAP.md`](docs/ROADMAP.md) phase it moves (1a attach build, 1b spike/attach, 2 deletion, 3 playbook) or `none`;
   no other KPI degrades. The
   [PR template](.github/pull_request_template.md) pre-fills the line.

## 9. Workflow

[`docs/END_GOAL.md`](docs/END_GOAL.md) (outranks all that follow) → §5 → its
`FEATURE.md` → the cited `GLOBAL-NNN` → P1–P6 → §8; still unsure,
ask the user — never guess across a documented decision. Adding or replacing
a decision follows [`docs/feature-conventions.md`](docs/feature-conventions.md).
