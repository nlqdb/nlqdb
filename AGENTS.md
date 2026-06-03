# Agents Guide — nlqdb

Index for any agent (Claude Code, cold subagents, or human) editing this repo.
Read fully **before** the first edit. Per-area `AGENTS.md` files
narrow this guide to the directory you're working in.

## 1. What nlqdb is

> *A database you talk to, with a backend that doesn't exist.*

You write HTML. Each component asks for what it wants in plain English.
nlqdb answers. The full pitch and architecture are in
[`docs/architecture.md`](docs/architecture.md). Design-partner research is in
[`docs/runbook.md §10`](docs/runbook.md).

**Active focus → [`docs/now.md`](docs/now.md)** — current priorities; read first.

### North-star — what every PR moves

Four pillars per
[`GLOBAL-025`](docs/decisions/GLOBAL-025-north-star.md): **engine
quality** (NL→SQL + multi-engine), **onboarding**, **UX**,
**performance**. Every PR advances ≥ 1 AND degrades 0 — name the
KPI in the PR body. The bet: **great on free LLMs ⇒ invincible on
frontier LLMs** — scaffolding compounds with the model. LLM strategy per
[`GLOBAL-026`](docs/decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md):
free chain forever · BYOLLM every tier (0% markup) · hosted premium
on paid (flat sub + allowance + overage; §6-gated).
[`quality-eval`](docs/features/quality-eval/FEATURE.md) → Phase 2;
free-vs-frontier delta = headline KPI.

## 2. Five behavioral principles (non-negotiable)

Apply these to every edit, regardless of what the user has asked for.

### P1. Never contradict documented decisions silently

`docs/decisions.md` (cross-cutting `GLOBAL-NNN`) and the per-feature
`docs/features/<feature>/FEATURE.md` (local `SK-<FEATURE>-NNN`) are the
canonical record of why the system is the way it is. If a request would
violate one — even subtly — **stop and raise it with the user**, citing the
specific ID(s). Don't rationalise around it. The user may decide to
supersede the decision; if so, follow `P3`.

### P2. On any ambiguity or unfamiliar error, web-research first

If a task is even a little ambiguous, or an error is unfamiliar, **do a
web search for current best practices before jumping to a fix**. The fast
wrong answer is more expensive than the slower right one. State the
sources you checked when you propose the fix.

**Also:** When selecting any 3rd party package, SDK, or API, always web-search for
the latest stable version before using it. Version and API changes move fast; your
knowledge cutoff is stale for any external dependency.

### P3. Decisions live in one place

Each decision has one canonical home:

- `GLOBAL-NNN` lives in `docs/decisions/GLOBAL-NNN-<slug>.md` — the only
  place its body text exists. The index in `docs/decisions.md` lists
  every GLOBAL with a link to its file. Features affected by a GLOBAL list
  it by ID + title in their `## GLOBALs governing this feature` section,
  with optional feature-local commentary nested under the line. They don't
  repeat the decision body. (See `docs/feature-conventions.md` §5.)
- `SK-<FEATURE>-NNN` lives in that feature's `FEATURE.md` — the only
  place its body text exists.

When a decision changes:
- Edit the canonical file (one place — the per-GLOBAL file under
  `docs/decisions/`, or the feature's `FEATURE.md`).
- If the change affects how a feature applies the decision, update the
  feature-local commentary in that feature's FEATURE.md.
- New GLOBALs / SK-IDs land in their canonical home before any code
  change that depends on them. New GLOBALs also add a row to the
  `docs/decisions.md` index.

To find every feature affected by a GLOBAL:
`grep -rn 'GLOBAL-NNN' docs/features/`. To find every doc that
references it: `grep -rn 'GLOBAL-NNN' docs/`.

### P4. Four documentation rules

Before documenting any decision or plan:

- **D1. Resolve open questions first** — Don't document vague decisions. **Push the user to answer open questions** before you document.
- **D2. Never document ambiguity** — Vague or ambiguous decisions are worse than no documentation. If it's not clear enough to document, it's not ready.
- **D3. Clarity always increases** — When documenting, **the next steps must be clearer than before**. Never document in a way that leaves the reader more confused.
- **D4. No doc over 20 KB** — When a markdown file would cross 20 KB, split it before adding text and route from the §5 path map / §6 long-form index / feature index so agents land on the right shard. Edits to a file already over 20 KB must net-shrink it. **Exception ([GLOBAL-028](docs/decisions/GLOBAL-028-acquisition-progress-tracker.md)):** `docs/research/automated-icp-validation-plan.md` is the only file exempt from this cap — it is the canonical acquisition progress tracker and grows as experiments accumulate.

### P5. Keep functions simple. Keep high level architecture simple.

Simplify rather than complexify. Each goal must be achieved with minimal steps possible.
When fixing an issue or adding a feature - always look for a way to remove code, or simplify code rather than adding code. Same for documentations and comments.
De-prioritize backward compatilibty and prioritze clean code - we are still in a building stage.

## 3. Tech stack (high-level)

- **Runtime:** Cloudflare Workers (free tier — see `GLOBAL-013`)
- **DB (Phase 0):** Neon Postgres (free tier)
- **Auth:** Better Auth (`packages/auth-internal`)
- **LLM:** Multi-provider router (`packages/llm`)
- **Observability:** OpenTelemetry (`packages/otel`)
- **Frontend:** React + Web Components (`apps/web`, `packages/elements`)
- **Languages:** TypeScript everywhere; Workers-compatible bundles only
- **Monorepo:** Bun workspaces

For the full stack rationale see [`docs/architecture.md`](docs/architecture.md) §1–§2.

## 4. Project map

```
nlqdb/
├── apps/
│   ├── web/             # marketing + product web app
│   ├── api/             # Cloudflare Workers HTTP API
│   ├── events-worker/   # event-pipeline consumer (queue → sinks)
│   ├── mcp/             # hosted MCP server (mcp.nlqdb.com)
│   ├── docs/            # user-facing docs site (docs.nlqdb.com)
│   └── coming-soon/     # standalone landing page
├── cli/                 # `nlq` command-line tool
├── packages/
│   ├── sdk/             # @nlqdb/sdk — the only HTTP client (GLOBAL-001)
│   ├── elements/        # <nlq-data> web component
│   ├── react/           # @nlqdb/react — typed React 19 wrapper
│   ├── next/            # @nlqdb/next — Next 15 helpers + RSC server factory
│   ├── vue/             # @nlqdb/vue — Vue 3.5 component
│   ├── nuxt/            # @nlqdb/nuxt — Nuxt 3 module
│   ├── svelte/          # @nlqdb/svelte — Svelte 5 component
│   ├── sveltekit/       # @nlqdb/sveltekit — load() + <NlqHead>
│   ├── astro/           # @nlqdb/astro — Astro 5 integration
│   ├── solid/           # @nlqdb/solid — SolidJS component
│   ├── nlqdb-swift/     # Swift 6 Package (iOS / macOS / Linux)
│   ├── db/              # engine-agnostic DB adapter
│   ├── llm/             # LLM router + providers
│   ├── mcp/             # MCP server + host detection
│   ├── otel/            # OpenTelemetry helpers
│   ├── auth-internal/   # Better Auth wrapper
│   └── events/          # event-pipeline producer types
├── docs/                # long-form reference docs (see §6)
│   └── features/        # per-feature decision records (mandatory pre-read)
├── examples/            # working samples (HTML, frameworks)
└── AGENTS.md, CLAUDE.md # this file (CLAUDE.md → AGENTS.md symlink)
```

Each `apps/<x>/`, `packages/<x>/`, and `cli/` has its own `AGENTS.md`
with the local subset of the before-editing path map and any
package-specific commands.

## 5. Before-editing path map

When your change touches any of these paths, the listed feature is
**mandatory pre-reading**. (Features auto-load via `when-to-load.globs`
in editors that support it; otherwise read manually before editing.)

| If you touch… | Read first |
|---|---|
| `apps/api/src/routes/auth/**`, `packages/auth-internal/**` | `docs/features/auth/FEATURE.md` |
| `apps/api/src/api-keys.ts`, `apps/web/src/pages/app/keys.astro`, `apps/web/src/components/keys/**` | `docs/features/api-keys/FEATURE.md` |
| `apps/api/src/ask/**`, the `/v1/ask` pipeline | `docs/features/ask-pipeline/FEATURE.md` |
| `apps/api/src/run/**`, the `POST /v1/run` raw-SQL escape hatch (`GLOBAL-015`) | `docs/features/sdk/FEATURE.md` (`SK-SDK-009`) + `docs/features/cli/FEATURE.md` + `docs/features/sql-allowlist/FEATURE.md` |
| write/DDL diff preview, `confidence`, response `trace` block | `docs/features/trust-ux/FEATURE.md` |
| `apps/api/src/db-create/**`, `apps/api/src/ask/classifier.ts`, `apps/api/src/ask/sql-validate-ddl.ts` | `docs/features/hosted-db-create/FEATURE.md` |
| `apps/api/src/gate/**`, gatePreAlpha middleware, X-Invite-Code header, gate KV keys | `docs/features/pre-alpha-gate/FEATURE.md` |
| `apps/api/src/plan-cache/**`, plan storage | `docs/features/plan-cache/FEATURE.md` |
| `packages/llm/**`, model routing, prompts | `docs/features/llm-router/FEATURE.md` |
| `tools/eval/**`, `.github/workflows/quality-eval-*.yml` (BIRD/Spider NL-accuracy harness) | `docs/features/quality-eval/FEATURE.md` |
| `apps/api/src/ask/sql-validate.ts`, SQL allowlist | `docs/features/sql-allowlist/FEATURE.md` |
| `packages/db/**` | `docs/features/db-adapter/FEATURE.md` |
| anything touching `schema_hash`, schema fingerprinting | `docs/features/schema-widening/FEATURE.md` |
| any `POST`/`PATCH`/`DELETE` handler | `docs/features/idempotency/FEATURE.md` |
| `packages/otel/**`, new spans / metrics | `docs/features/observability/FEATURE.md` · `docs/features/byo-otel/FEATURE.md` |
| `apps/api/src/billing/**`, Stripe webhooks | `docs/features/stripe-billing/FEATURE.md` |
| `apps/api/src/billing/premium/**`, `apps/api/src/ask/model-picker.ts`, `packages/llm/src/chains/{paid,premium}.ts`, `model` preset / BYOLLM / spend-cap / hosted-premium meter | `docs/features/premium-tier/FEATURE.md` |
| `apps/events-worker/**`, `packages/events/**`, `apps/api/src/events-feature.ts`, `apps/api/src/ask/demand-signal.ts` | `docs/features/events-pipeline/FEATURE.md` |
| `apps/api/src/workload-analyser/**`, `packages/db/src/clickhouse-tinybird/pipe-management.ts`, `apps/api/migrations/0008_workload_analyser_audit.sql` | `docs/features/engine-migration/FEATURE.md` |
| rate-limit middleware (`apps/api/src/ask/rate-limit.ts`, `apps/api/src/principal.ts` `rateLimitBucketKey`, `apps/api/src/anon-rate-limit.ts`, `apps/api/src/anon-global-cap.ts`) | `docs/features/rate-limit/FEATURE.md` |
| `apps/api/src/principal.ts`, `apps/api/src/anon-rate-limit.ts`, `apps/api/src/anon-global-cap.ts`, `apps/api/src/turnstile.ts`, `apps/web/src/lib/{anon,prompt-storage,turnstile,api}.ts`, `apps/web/src/components/CreateForm.tsx` | `docs/features/anonymous-mode/FEATURE.md` |
| `cli/**` | `docs/features/cli/FEATURE.md` |
| `packages/elements/**` | `docs/features/elements/FEATURE.md` |
| `packages/sdk/**` | `docs/features/sdk/FEATURE.md` |
| `packages/{react,next,vue,nuxt,svelte,sveltekit,astro,solid}/**` | `docs/features/framework-wrappers/FEATURE.md` |
| `packages/nlqdb-swift/**` | `docs/features/sdk-swift/FEATURE.md` |
| `packages/mcp/**`, `apps/mcp/**` | `docs/features/mcp-server/FEATURE.md` |
| `apps/web/**` (onboarding, anonymous mode) | `docs/features/web-app/FEATURE.md` |
| `apps/web/src/data/competitors.ts`, `apps/web/src/pages/vs/**`, `apps/web/src/pages/llms.txt.ts` | `docs/features/comparison-pages/FEATURE.md` |
| `apps/web/src/data/solve.ts`, `apps/web/src/pages/solve/**` | `docs/features/solve-pages/FEATURE.md` |
| `apps/web/src/onboarding/**`, signup flow, first-query path | `docs/features/onboarding/FEATURE.md` |
| `apps/docs/**`, `docs.nlqdb.com` Starlight site | `docs/features/docs-site/FEATURE.md` |
| `.github/workflows/**`, `nlqdb/actions/**` (CI permissions) | `docs/features/ci-permissions/FEATURE.md` |
| `tests/personas/**`, `tests/opencheck/**`, `tests/e2e/**`, `examples/**/e2e/**`, `.github/workflows/e2e*.yml`, `.github/workflows/_e2e-*.yml`, `packages/nlqdb-rb/spec/e2e/**`, `packages/nlqdb-rs/tests/e2e/**` | `docs/features/e2e-coverage/FEATURE.md` |
| `apps/api/src/icp-*.ts`, `docs/research/automated-icp-validation-plan*.md`, `docs/research/icp-evidence-*.md` | `docs/features/icp-mining/FEATURE.md` |
| `tools/stranger-test/**`, `scripts/stranger-test.sh`, `scripts/flow-004-walk.sh`, `scripts/stranger-test-invited.sh` | `docs/features/stranger-test/FEATURE.md` |

Per-area `AGENTS.md` files (e.g. `packages/db/AGENTS.md`) repeat just
their slice of this table, so you don't need the full root view when
working in one directory.

## 6. Long-form reference docs (load on demand, not by default)

| File | What for |
|---|---|
| [`docs/decisions.md`](docs/decisions.md) + [`docs/decisions/`](docs/decisions/) | **Canonical** `GLOBAL-NNN` decisions. Index in `decisions.md`; one body per file under `decisions/`. Read before editing features. |
| [`docs/feature-conventions.md`](docs/feature-conventions.md) | How `docs/features/` is structured. Read before adding/editing a feature. |
| [`docs/architecture.md`](docs/architecture.md) | System architecture, surface specs, tech-stack rationale, risks. Phase plan extracted to `phase-plan.md`. |
| [`docs/phase-plan.md`](docs/phase-plan.md) | **Canonical phase plan** — per-phase items, exit gates, the §6 monetization + scaling trigger. |
| [`docs/runbook.md`](docs/runbook.md) | Operations: env vars, secrets, deploy, recovery. Design-partner reference (§10). |
| [`docs/founder-playbook.md`](docs/founder-playbook.md) | Design-partner recruitment, Sean Ellis interview script, inbound triage SLA — the founder-time work that lives next to the engineering plan. |
| [`docs/performance.md`](docs/performance.md) | Span/metric/label catalog + perf goals. |
| [`docs/guidelines.md`](docs/guidelines.md) | Code-review heuristics, the four habits. |
| [`docs/progress.md`](docs/progress.md) | Platform integration tiers (P0–P3). |
| [`docs/research-receipts.md`](docs/research-receipts.md) | Receipts for cited research. |
| [`docs/competitors.md`](docs/competitors.md) | Competitive landscape — categories, threat matrix, gap analysis. |
| [`docs/history/`](docs/history/) | Lessons learnt — one doc per operational topic. |
| [`docs/research/`](docs/research/) | Strategic research — personas, LLM credits plan, email & marketing strategy, Phase 1 exit criteria, open design questions. |
| [`docs/future/`](docs/future/) | Forward-looking plans not yet promoted to a feature — semantic-layer adoption, etc. Promote into the relevant feature once decisions are firm. |

These exist for depth; they are not loaded into every session by
default. The `docs/features/` directory is the front door for any
feature-specific work — each `FEATURE.md`'s `Status:` line is the
canonical status.

## 7. Common commands

```bash
bun install                  # install workspaces
bun run dev                  # all dev servers (apps/*)
bun run test                 # all tests
bun run typecheck            # type-check the workspace
bun run lint                 # lint
bun run build                # build all packages
# bundle budget check (GLOBAL-013):
bun run --filter apps/api build && wrangler deploy --dry-run --outdir=/tmp/out
```

Per-package commands are in each area's `AGENTS.md`.

## 8. Quality gates before opening a PR

> **Format and lint before every commit.**

1. `bun run typecheck && bun run lint && bun run test` all green.
2. Every new decision has an ID (`GLOBAL-NNN` or `SK-<FEATURE>-NNN`)
   and is in its canonical home (`docs/decisions/GLOBAL-NNN-<slug>.md`
   for `GLOBAL` plus a row in `docs/decisions.md`,
   `docs/features/<feature>/FEATURE.md` for `SK`). Features reference
   GLOBALs by ID; they don't duplicate the body
   (`docs/feature-conventions.md` §5).
3. No `### GLOBAL-NNN` block exists under `docs/features/` — only
   reference lines in `## GLOBALs governing this feature` sections.
   Verify: `grep -rn '^### GLOBAL-' docs/features/` prints nothing.
4. Every new external call has an OTel span (`GLOBAL-014`).
5. Every mutating endpoint accepts `Idempotency-Key` (`GLOBAL-005`).
6. New capability added → SDK + CLI + MCP + elements all updated, or
   gap tracked in the affected feature (`GLOBAL-003`).
7. PR body names the [`GLOBAL-025`](docs/decisions/GLOBAL-025-north-star.md) KPI advanced + confirms no other KPI degrades.

## 9. When in doubt

- Read the relevant `FEATURE.md` first.
- Then the per-GLOBAL file under `docs/decisions/` for any cited
  `GLOBAL-NNN` (the index in `docs/decisions.md` links to each).
- Then ask the user. Don't guess across a documented decision.

## 10. Workflow — features and bug fixes

The standard loop for every change:

```
Touch path X
  → §5 path map gives the FEATURE.md name
  → read that FEATURE.md fully (5 fields per SK-* decision; the GLOBALs
    section lists which GLOBAL-NNNs apply — open the relevant file under
    docs/decisions/ alongside the feature if you need their text)
  → do the work
  → new decision? apply P4 (D1, D2, D3): resolve open questions,
    ensure clarity, then add SK-<PREFIX>-NNN (or promote to GLOBAL if
    cross-cutting)
  → changed a GLOBAL? edit the GLOBAL's file under docs/decisions/
    (one place); update any affected feature's *In this feature:*
    commentary if the change affects how the feature applies the rule
  → ambiguity or unfamiliar error? web-search current best
    practices, cite sources (P2)
  → contradicts a documented decision? STOP, raise to user with
    the specific ID (P1)
  → run the §8 quality gates before opening the PR
```

### 10.1 Adding a new feature

| Scope | Action |
|---|---|
| Fits an existing feature | Add `SK-<PREFIX>-<next-N>` block(s) to that feature's `FEATURE.md`. Update its `Status:` line if status moves (e.g. `partial` → `implemented`). |
| Crosses several features | Add SK-* blocks in each affected feature, with cross-refs between them. |
| Genuinely new (no feature covers it) | Create `docs/features/<feature>/FEATURE.md` from the [`docs/feature-conventions.md`](docs/feature-conventions.md) §3 template. Add the path-glob row to §5 above. Reserve the `SK-<PREFIX>-NNN` prefix (kebab-case → `<PREFIX>` is upper-snake, e.g. `auth` → `SK-AUTH-NNN`). |
| Touches all surfaces (HTTP / SDK / CLI / MCP / elements) | Per `GLOBAL-003`, ship to all surfaces in the same PR or annotate the gap explicitly in the affected features under *Open questions*. |
| Introduces a cross-cutting rule (multiple features must obey) | Promote to a new `GLOBAL-NNN`: create `docs/decisions/GLOBAL-NNN-<slug>.md` with the five-field block, then add a row to `docs/decisions.md` linking to it. Then add a reference line in each affected feature's `## GLOBALs governing this feature` section (`- **GLOBAL-NNN** — Title.`), with feature-local commentary nested under it only when the GLOBAL has a feature-specific implication worth calling out. |

Every SK-* and GLOBAL-* decision must have all five fields
(Decision / Core value / Why / Consequence / Alternatives) — see
[`docs/feature-conventions.md`](docs/feature-conventions.md) §4.
Per P4 (D1–D3), if you can't fill all five, don't document it yet.

### 10.2 Fixing a bug

1. Reproduce + isolate. Find the file. §5 → feature. Read the feature.
2. **Does the bug contradict a documented decision?**
   - **Code wrong, decision right** → fix the code so it conforms. Normal bug fix.
   - **Decision wrong** (the bug is intended behaviour, but the behaviour is wrong) → **STOP.** Don't silently change behaviour. Per `P1`, raise it with the user, citing the specific `SK-*` or `GLOBAL-NNN` ID. The user decides whether to supersede.
3. If you supersede a decision: add a new `SK-<PREFIX>-<next-N>` (or `GLOBAL-<next-N>`) with full 5 fields. Mark the old one `Status: superseded by <new-id>` — **don't delete or renumber. IDs are sticky.**
4. If your fix touches a `GLOBAL-NNN`, per `P3` update every place it's copied in the same PR (`grep -rn 'GLOBAL-NNN' docs/features/ docs/`).
5. If the fix raises a question that's not yet decided, add it to that feature's `## Open questions / known unknowns`. Don't decide for the user.

### 10.3 Tie-breakers when sources disagree

- **Feature says X, code does Y** → feature wins. Fix the code (or, if the code's behaviour is correct, file a P1 to amend the feature — don't silently update either).
- **`docs/architecture.md` (or `docs/runbook.md`) says X, feature says Y** → feature wins. If you find a stale prose passage that contradicts a feature, fix the prose. Don't change the feature to match stale prose.
- **A feature has a `### GLOBAL-NNN` block with body text** → convention violation. `docs/feature-conventions.md` §5 says features reference GLOBALs by ID, not by copy. Replace the block with a one-liner reference under `## GLOBALs governing this feature`. The decision body lives only in `docs/decisions/GLOBAL-NNN-<slug>.md`.
- **Two features disagree on a cross-cutting rule** → the rule should have been a `GLOBAL-NNN`. Promote it (per §10.1) and update both features to copy it.
