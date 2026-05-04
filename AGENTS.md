# Agents Guide — nlqdb

Index for any agent (Claude Code, cold subagents, or human) editing this repo.
Read this file fully **before** the first edit. Per-area `AGENTS.md` files
narrow this guide to the directory you're working in.

## 1. What nlqdb is

> *A database you talk to, with a backend that doesn't exist.*

You write HTML. Each component asks for what it wants in plain English.
nlqdb answers. The full pitch and architecture are in
[`docs/architecture.md`](docs/architecture.md). Design-partner research is in
[`docs/runbook.md §10`](docs/runbook.md).

## 2. Three behavioral principles (non-negotiable)

Apply these to every edit, regardless of what the user has asked for.

### P1. Never contradict documented decisions silently

`docs/decisions.md` (cross-cutting `GLOBAL-NNN`) and the per-feature
`.claude/skills/<feature>/SKILL.md` (local `SK-<FEATURE>-NNN`) are the
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

- `GLOBAL-NNN` lives in `docs/decisions.md` — the only place its body
  text exists. Skills affected by a GLOBAL list it by ID + title in
  their `## GLOBALs governing this feature` section, with optional
  skill-local commentary nested under the line. They don't repeat the
  decision body. (See `docs/skill-conventions.md` §5.)
- `SK-<FEATURE>-NNN` lives in that feature's `SKILL.md` — the only
  place its body text exists.

When a decision changes:
- Edit the canonical file (one place).
- If the change affects how a feature applies the decision, update the
  skill-local commentary in that feature's SKILL.md.
- New GLOBALs / SK-IDs land in their canonical home before any code
  change that depends on them.

To find every skill affected by a GLOBAL:
`grep -rn 'GLOBAL-NNN' .claude/skills/`. To find every doc that
references it: `grep -rn 'GLOBAL-NNN' docs/`.

### P4. Three documentation rules

Before documenting any decision or plan:

- **D1. Resolve open questions first** — Don't document vague decisions. **Push the user to answer open questions** before you document.
- **D2. Never document ambiguity** — Vague or ambiguous decisions are worse than no documentation. If it's not clear enough to document, it's not ready.
- **D3. Clarity always increases** — When documenting, **the next steps must be clearer than before**. Never document in a way that leaves the reader more confused.

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
│   └── coming-soon/     # standalone landing page
├── cli/                 # `nlq` command-line tool
├── packages/
│   ├── sdk/             # @nlqdb/sdk — the only HTTP client (GLOBAL-001)
│   ├── elements/        # <nlq-data> web component
│   ├── db/              # engine-agnostic DB adapter
│   ├── llm/             # LLM router + providers
│   ├── mcp/             # MCP server + host detection
│   ├── otel/            # OpenTelemetry helpers
│   ├── auth-internal/   # Better Auth wrapper
│   └── events/          # event-pipeline producer types
├── docs/                # long-form reference docs (see §6)
├── .claude/skills/      # per-feature skills (mandatory pre-read)
├── examples/            # working samples (HTML, frameworks)
└── AGENTS.md, CLAUDE.md # this file (CLAUDE.md → AGENTS.md symlink)
```

Each `apps/<x>/`, `packages/<x>/`, and `cli/` has its own `AGENTS.md`
with the local subset of the before-editing path map and any
package-specific commands.

## 5. Before-editing path map

When the change you're about to make touches any of these paths, the
listed skill is **mandatory pre-reading**. (Skills auto-load via their
`when-to-load.globs` field in editors that support it; otherwise read
manually before editing.)

| If you touch… | Read first |
|---|---|
| `apps/api/src/routes/auth/**`, `packages/auth-internal/**` | `.claude/skills/auth/SKILL.md` |
| `apps/api/src/keys/**`, anything `api-key` related | `.claude/skills/api-keys/SKILL.md` |
| `apps/api/src/ask/**`, the `/v1/ask` pipeline | `.claude/skills/ask-pipeline/SKILL.md` |
| `apps/api/src/db-create/**`, `apps/api/src/ask/classifier.ts`, `apps/api/src/ask/sql-validate-ddl.ts` | `.claude/skills/hosted-db-create/SKILL.md` |
| `apps/api/src/plan-cache/**`, plan storage | `.claude/skills/plan-cache/SKILL.md` |
| `packages/llm/**`, model routing, prompts | `.claude/skills/llm-router/SKILL.md` |
| `apps/api/src/ask/sql-validate.ts`, SQL allowlist | `.claude/skills/sql-allowlist/SKILL.md` |
| `packages/db/**` | `.claude/skills/db-adapter/SKILL.md` |
| anything touching `schema_hash`, schema fingerprinting | `.claude/skills/schema-widening/SKILL.md` |
| any `POST` / `PATCH` / `DELETE` handler | `.claude/skills/idempotency/SKILL.md` |
| `packages/otel/**`, new spans / metrics | `.claude/skills/observability/SKILL.md` |
| `apps/api/src/billing/**`, Stripe webhooks | `.claude/skills/stripe-billing/SKILL.md` |
| `apps/api/src/billing/premium/**`, `apps/api/src/ask/model-picker.ts`, `packages/llm/src/chains/paid.ts`, anything `model` preset / BYOK / spend-cap related | `.claude/skills/premium-tier/SKILL.md` |
| `apps/events-worker/**`, `packages/events/**` | `.claude/skills/events-pipeline/SKILL.md` |
| rate-limit middleware | `.claude/skills/rate-limit/SKILL.md` |
| `cli/**` | `.claude/skills/cli/SKILL.md` |
| `packages/elements/**` | `.claude/skills/elements/SKILL.md` |
| `packages/sdk/**` | `.claude/skills/sdk/SKILL.md` |
| `packages/mcp/**` | `.claude/skills/mcp-server/SKILL.md` |
| `apps/web/**` (onboarding, anonymous mode) | `.claude/skills/web-app/SKILL.md` |
| `apps/web/src/onboarding/**`, signup flow, first-query path | `.claude/skills/onboarding/SKILL.md` |

Per-area `AGENTS.md` files (e.g. `packages/db/AGENTS.md`) repeat just
their slice of this table, so you don't need the full root view when
working in one directory.

## 6. Long-form reference docs (load on demand, not by default)

| File | What for |
|---|---|
| [`docs/decisions.md`](docs/decisions.md) | **Canonical** `GLOBAL-NNN` decisions. Read before editing skills. |
| [`docs/skill-conventions.md`](docs/skill-conventions.md) | How `.claude/skills/` is structured. Read before adding/editing a skill. |
| [`docs/architecture.md`](docs/architecture.md) | System architecture, surface specs, phase plan, tech-stack rationale, risks. |
| [`docs/runbook.md`](docs/runbook.md) | Operations: env vars, secrets, deploy, recovery. Design-partner reference (§10). |
| [`docs/performance.md`](docs/performance.md) | Span/metric/label catalog + perf goals. |
| [`docs/guidelines.md`](docs/guidelines.md) | Code-review heuristics, the four habits. |
| [`docs/progress.md`](docs/progress.md) | Platform integration tiers (P0–P3). |
| [`docs/research-receipts.md`](docs/research-receipts.md) | Receipts for cited research. |
| [`docs/competitors.md`](docs/competitors.md) | Competitive landscape — categories, threat matrix, gap analysis. |
| [`docs/history/`](docs/history/) | Lessons learnt — one doc per operational topic (infra setup, migrations, etc.). |
| [`docs/research/`](docs/research/) | Strategic research — personas, LLM credits plan, email & marketing strategy. |

These exist for depth; they are not loaded into every session by
default. The skill index (`.claude/skills/_index.md`) is the front
door for any feature-specific work.

## 7. Common commands

```bash
bun install                    # install workspaces
bun run dev                        # run all dev servers (apps/*)
bun run test                       # run all tests
bun run typecheck                  # type-check the workspace
bun run lint                       # lint
bun run build                      # build all packages

# bundle budget check (GLOBAL-013)
bun run --filter apps/api build && wrangler deploy --dry-run --outdir=/tmp/out
```

Per-package commands are in each area's `AGENTS.md`.

## 8. Quality gates before opening a PR

1. `bun run typecheck && bun run lint && bun run test` all green.
2. Every new decision has an ID (`GLOBAL-NNN` or `SK-<FEATURE>-NNN`)
   and is in its canonical home (`docs/decisions.md` for `GLOBAL`,
   `.claude/skills/<feature>/SKILL.md` for `SK`). Skills reference
   GLOBALs by ID; they don't duplicate the body
   (`docs/skill-conventions.md` §5).
3. No `### GLOBAL-NNN` block exists under `.claude/skills/` — only
   reference lines in `## GLOBALs governing this feature` sections.
   Verify: `grep -rn '^### GLOBAL-' .claude/skills/` prints nothing.
4. Every new external call has an OTel span (`GLOBAL-014`).
5. Every mutating endpoint accepts `Idempotency-Key` (`GLOBAL-005`).
6. New capability added → SDK + CLI + MCP + elements all updated, or
   gap tracked in the affected skill (`GLOBAL-003`).

## 9. When in doubt

- Read the relevant `SKILL.md` first.
- Then `docs/decisions.md` for any cited `GLOBAL-NNN`.
- Then ask the user. Don't guess across a documented decision.

## 10. Workflow — features and bug fixes

The standard loop for every change:

```
Touch path X
  → §5 path map gives the SKILL.md name
  → read that SKILL.md fully (5 fields per SK-* decision; the GLOBALs
    section lists which GLOBAL-NNNs apply — open docs/decisions.md
    alongside the skill if you need their text)
  → do the work
  → new decision? apply P4 (D1, D2, D3): resolve open questions,
    ensure clarity, then add SK-<PREFIX>-NNN (or promote to GLOBAL if
    cross-cutting)
  → changed a GLOBAL? edit docs/decisions.md (one place); update any
    affected skill's *In this skill:* commentary if the change
    affects how the feature applies the rule
  → ambiguity or unfamiliar error? web-search current best
    practices, cite sources (P2)
  → contradicts a documented decision? STOP, raise to user with
    the specific ID (P1)
  → run the §8 quality gates before opening the PR
```

### 10.1 Adding a new feature

| Scope | Action |
|---|---|
| Fits an existing skill | Add `SK-<PREFIX>-<next-N>` block(s) to that skill's `SKILL.md`. Update `_index.md` if status moves (e.g. `partial` → `implemented`). |
| Crosses several skills | Add SK-* blocks in each affected skill, with cross-refs between them. |
| Genuinely new (no skill covers it) | Create `.claude/skills/<feature>/SKILL.md` from the [`docs/skill-conventions.md`](docs/skill-conventions.md) §3 template. Add a row to `.claude/skills/_index.md`. Add the path-glob row to §5 above. Reserve the `SK-<PREFIX>-NNN` prefix (kebab-case → `<PREFIX>` is upper-snake, e.g. `auth` → `SK-AUTH-NNN`). |
| Touches all surfaces (HTTP / SDK / CLI / MCP / elements) | Per `GLOBAL-003`, ship to all surfaces in the same PR or annotate the gap explicitly in the affected skills under *Open questions*. |
| Introduces a cross-cutting rule (multiple features must obey) | Promote to a new `GLOBAL-NNN` in `docs/decisions.md`. Then add a reference line in each affected skill's `## GLOBALs governing this feature` section (`- **GLOBAL-NNN** — Title.`), with skill-local commentary nested under it only when the GLOBAL has a feature-specific implication worth calling out. |

Every SK-* and GLOBAL-* decision must have all five fields
(Decision / Core value / Why / Consequence / Alternatives) — see
[`docs/skill-conventions.md`](docs/skill-conventions.md) §4. Per P4 (D1–D3), if you
can't fill all five or have open questions, don't document it yet.

### 10.2 Fixing a bug

1. Reproduce + isolate. Find the file. §5 → skill. Read the skill.
2. **Does the bug contradict a documented decision?**
   - **Code wrong, decision right** → fix the code so it conforms. Normal bug fix.
   - **Decision wrong** (the bug is intended behaviour, but the behaviour is wrong) → **STOP.** Don't silently change behaviour. Per `P1`, raise it with the user, citing the specific `SK-*` or `GLOBAL-NNN` ID. The user decides whether to supersede.
3. If you supersede a decision: add a new `SK-<PREFIX>-<next-N>` (or `GLOBAL-<next-N>`) with full 5 fields. Mark the old one `Status: superseded by <new-id>` — **don't delete or renumber. IDs are sticky.**
4. If your fix touches a `GLOBAL-NNN`, per `P3` update every place it's copied in the same PR (`grep -rn 'GLOBAL-NNN' .claude/skills/ docs/`).
5. If the fix raises a question that's not yet decided, add it to that skill's `## Open questions / known unknowns`. Don't decide for the user.

### 10.3 Tie-breakers when sources disagree

- **Skill says X, code does Y** → skill wins. Fix the code (or, if the code's behaviour is correct, file a P1 to amend the skill — don't silently update either).
- **`docs/architecture.md` (or `docs/runbook.md`) says X, skill says Y** → skill wins. If you find a stale prose passage that contradicts a skill, fix the prose. Don't change the skill to match stale prose.
- **A skill has a `### GLOBAL-NNN` block with body text** → convention violation. `docs/skill-conventions.md` §5 says skills reference GLOBALs by ID, not by copy. Replace the block with a one-liner reference under `## GLOBALs governing this feature`. The decision body lives only in `docs/decisions.md`.
- **Two skills disagree on a cross-cutting rule** → the rule should have been a `GLOBAL-NNN`. Promote it (per §10.1) and update both skills to copy it.
