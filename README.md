# nlqdb — your autonomous DBA.

> Build a real app from day one with no data modeling. nlqdb infers your schema from how you use it, evolves it, and keeps it optimized — and shows you every change before it lands.

Your app talks to its database in plain English — over HTTP, the SDK, the
`nlq` CLI, or MCP from Claude, Cursor and Codex. The first insert creates the
shape; later inserts and reads evolve it; the DBA builds the indexes and
places data on the right engine, and every change is previewed, versioned and
one click to undo. The LLM never emits SQL: it returns a typed plan, our
compiler emits the parameterised statement, and you see the exact SQL every time.

**No backend to build.** You write HTML; each
component asks for what it wants in plain English; nlqdb infers the schema,
writes the SQL, runs it, and renders the result. There is no backend for you
to build.

Two actions. That's the whole product:

1. **Create a database** — one word: a name (or a goal).
2. **Talk to it** in plain English.

```html
<script src="https://elements.nlqdb.com/v1.js" type="module"></script>

<nlq-data
  goal="the 5 newest orders, with customer and item"
  api-key="pk_live_xxx"
  template="table"
  refresh="10s"
></nlq-data>
```

That's the entire backend for a live order list — no API to write, no
schema to define, no JSON to parse. Engine choice (Postgres / Mongo /
Redis / DuckDB / pgvector / …), schema inference, indexing, backups, and
auto-migration between engines based on your real workload are background
concerns you never have to see.

## Status — early, open

nlqdb is **early** and built in the open, but fully public — no gate, no
invite code. The marketing site, the `/v1/ask` pipeline, the `<nlq-data>` /
`<nlq-action>` elements, the chat app, the TypeScript SDK, the hosted MCP
server, and the `nlq` CLI are all live in some form (see the surface table
below). Natural-language → SQL accuracy is still climbing toward our public
bar (BIRD ≥ 0.65, Spider 2.0 ≥ 0.75 on the free model chain), so answers can
be wrong — every response carries a confidence signal and the SQL it ran.

## Use it

Connecting an agent over MCP? On **Claude Code**, one marketplace add wires the
hosted server *and* both memory skills in a single step:

```
/plugin marketplace add nlqdb/nlqdb
/plugin install nlqdb-memory@nlqdb
```

On any other MCP host, [**connect your agent**](https://docs.nlqdb.com/agent-memory/)
with one browser-OAuth approval; headless hosts skip the browser with
`npx -y @nlqdb/mcp` (`0.1.1`) and an `sk_mcp_*` MCP key
([MCP setup](https://docs.nlqdb.com/mcp/)). `@nlqdb/sdk` (`0.4.0`) and
`@nlqdb/mcp` (`0.1.1`) are both published and importable from npm.

The 60-second walkthrough — plain HTML, CLI, and ten framework wrappers —
lives at [`docs.nlqdb.com`](https://docs.nlqdb.com). Start with the
[HTML tutorial](https://docs.nlqdb.com/tutorials/html/) or the
[CLI tutorial](https://docs.nlqdb.com/tutorials/cli/).

You don't generate an API key separately: describe your database at
[nlqdb.com](https://nlqdb.com/?utm_source=github), and the chat hands you a
`<nlq-data>` snippet with the key already inlined.

## Examples

[`examples/`](./examples) — minimal scaffolds in plain HTML, Next.js,
Nuxt, SvelteKit, Astro, plus a CLI-only walkthrough. Each is the smallest
valid integration around one `<nlq-data>` element or one CLI session.

## What makes it different

Four things every release has to move, none allowed to regress
([`GLOBAL-025`](./docs/decisions/GLOBAL-025-north-star.md)):

- **Engine quality** — natural-language → SQL accuracy (measured
  continuously on BIRD + Spider 2.0 + an internal eval), plus the
  multi-engine layer that moves your data to the right engine for your
  workload.
- **Onboarding** — landing to first answer in under a minute, no card,
  no config.
- **UX** — see the diff before any write, see the SQL behind every
  answer, and on low confidence get a one-click clarify — a guided turn,
  never a dead-end, and never a silent guess.
- **Performance** — sub-400 ms cached, sub-1.5 s cold.

The bet: get this right on free, open models and it only gets better on
frontier ones — the scaffolding compounds with whatever model is
underneath.

## Models & plans

- **Free forever** on the built-in open-model chain — queries, embeds,
  and the elements, no card required.
- **Bring your own LLM key** (Anthropic / OpenAI / Gemini / Grok / OpenRouter)
  on any tier, at no markup.
- **Hosted premium models** on paid plans, when you'd rather not manage a
  key of your own.
- **Self-host the source** — the engine, CLI, MCP server, and SDKs are
  source-available under [FSL-1.1-ALv2](./LICENSE): free to self-host for
  any non-competing use, bring your own LLM key, no per-call fees. The
  license auto-converts to Apache 2.0 two years after each release.

The hosted-premium model lane went live 2026-08-14. The full model strategy is in
[`GLOBAL-026`](./docs/decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md).

## Surfaces at a glance

| Surface | Status | Where |
|---|---|---|
| HTTP API (`POST /v1/ask`, `POST /v1/run`) | ✓ shipped | `apps/api/src/ask/**` |
| `<nlq-data>` + `<nlq-action>` elements | ✓ shipped (v0.1) | `packages/elements/**` |
| `@nlqdb/sdk` (TypeScript) | ✓ shipped (incl. `runSql` + cross-tenant grant + pack-import runner verbs) — installable from npm (`0.4.0`) | `packages/sdk/**` |
| Framework wrappers (React / Next / Vue / Nuxt / Svelte / SvelteKit / Astro / Solid + Swift) | ~ built + CI-tested; npm / SPM publish pending | `packages/{react,next,…}/**` |
| Chat app `nlqdb.com/app` | ✓ shipped | `apps/web/**` |
| Hosted MCP server `mcp.nlqdb.com/mcp` | ✓ shipped (host auto-detect pending) | `apps/mcp/**`, `packages/mcp/**` |
| Local stdio MCP server `@nlqdb/mcp` | ✓ shipped (`0.1.1`) — `npx -y @nlqdb/mcp` with an `sk_mcp_*` key | `packages/mcp/**` |
| Droppable agent artifacts (AGENTS.md · Claude Code skill **+ plugin** · Cursor rules · Codex config) | ✓ shipped — `/plugin marketplace add nlqdb/nlqdb` installs the server + skills in one step | `apps/web/public/agent-artifacts/**` |
| `nlq` CLI (Go) | ✓ shipped (core verbs; device-login pending) | `cli/**` |

Full integration matrix in [`docs/progress.md`](./docs/progress.md).

## Packages on npm

Published to the public npm registry with build provenance
([`SK-CIPERM-003`](./docs/features/ci-permissions/FEATURE.md)). Version badges
are live from npm; the table itself is generated from the workspace by
[`scripts/sync-readme-packages.mjs`](./scripts/sync-readme-packages.mjs), so it
lists exactly the packages that are un-gated (`"private"` removed) and nothing
that isn't.

<!-- BEGIN:packages -->
| Package | Version | What it is | Source |
|---|---|---|---|
| [`@nlqdb/cli`](https://www.npmjs.com/package/@nlqdb/cli) | [![@nlqdb/cli](https://img.shields.io/npm/v/@nlqdb/cli?label=npm&color=cb3837)](https://www.npmjs.com/package/@nlqdb/cli) | Shim that installs the nlq CLI binary for the host platform. | [`packages/cli-shim`](./packages/cli-shim) |
| [`@nlqdb/mcp`](https://www.npmjs.com/package/@nlqdb/mcp) | [![@nlqdb/mcp](https://img.shields.io/npm/v/@nlqdb/mcp?label=npm&color=cb3837)](https://www.npmjs.com/package/@nlqdb/mcp) | Analytical-memory MCP server for nlqdb — a real database your AI agent can GROUP BY / JOIN / aggregate over in natural language, not just recall. | [`packages/mcp`](./packages/mcp) |
| [`@nlqdb/sdk`](https://www.npmjs.com/package/@nlqdb/sdk) | [![@nlqdb/sdk](https://img.shields.io/npm/v/@nlqdb/sdk?label=npm&color=cb3837)](https://www.npmjs.com/package/@nlqdb/sdk) | Typed HTTP client for the nlqdb /v1 API — works in browsers, Node, Bun, Workers. | [`packages/sdk`](./packages/sdk) |
<!-- END:packages -->

## Roadmap

The two sections below are the **live focus**; the numbered phases after
them are the engine roadmap. Canonical plan + exit gates:
[`docs/phase-plan.md`](./docs/phase-plan.md). Legend:
**✓ shipped · ~ in progress · ◯ planned**.

> **This roadmap is yours to shape.** Want something added, reprioritised, or
> dropped? Open a PR editing this section (and
> [`docs/phase-plan.md`](./docs/phase-plan.md) if it's engine-facing), or open
> an issue to float it first. Say **why now** — which of the four north-star
> pillars (engine quality, onboarding, UX, performance) it moves. New to the
> codebase? Point your coding agent at this repo and paste:
>
> ```
> Read README.md and docs/phase-plan.md, then propose a roadmap change:
> add/change "<your idea>" under the right section in one line, with a
> "why now" naming which north-star pillar it moves. Open a PR with just
> that edit — no code.
> ```
>
> Setup, branch naming, and the CLA are in [CONTRIBUTING.md](./CONTRIBUTING.md).

### Now — Phase A: the schema infers itself (`GLOBAL-041`)

The first insert creates the shape; later inserts and reads evolve it. KPI:
first-insert inference rate ≥ 95 % at Phase A exit. Build order in
[`docs/pivot-autonomous-dba.md` §4](./docs/pivot-autonomous-dba.md).

- ◯ `kind=extend` typed plan — a write naming an unseen table or field widens
  the schema in the same transaction as the insert, never a `schema_mismatch`
- ◯ Extend diff + trace on every surface (SDK · CLI · MCP · `<nlq-data>`)
- ✓ KPI counters `asks_extend_ok` / `asks_extend_failed` on the `/v1/ask` write path
  (`SK-SCHEMA-010`; the rate reads on `/app/admin`)
- ◯ Phase B — `pg_stat_*` + `EXPLAIN` collection → typed proposals (index /
  retype / drop / rename / move-to-engine) → `/app/dba` dashboard with
  1-click apply + undo
- ✓ Rails kept from the prior bet for the expert-knowledge app:
  `agent_memory_v1` preset, `nlqdb_remember` / `nlqdb_read` MCP tools,
  per-agent RLS isolation, the Claude Code plugin, `/agents`

### Next — the expert-knowledge marketplace ("Become AI")

Non-technical professionals turn their expertise into structured,
queryable knowledge that AI agents pay to use. Decisions locked; build
gated on Phase A (`SK-EKP-005`)
([`docs/features/expert-knowledge-platform/`](./docs/features/expert-knowledge-platform/FEATURE.md)).

- ◯ Interview authoring — answer questions about your craft, get queryable
  rows (pilot: language tutor)
- ✓ Cross-tenant read grants — mint/list/revoke control plane + live
  fail-closed granted read on `/v1/ask` (schema-only plan, rows-only
  egress, exactly-once per-query metering proven at the route boundary);
  revoke-in-flight bound measured against live Postgres
- ◯ One catalog — free packs + paid expert knowledge DBs
- ~ Trust hardening — buyer queries schema-only end-to-end: knowledge-DB
  asks skip narration by default and the granted cross-tenant read is
  un-narrated (returned rows never reach an LLM); no-training
  interview-provider pin pending

### Phase 0 — Foundations ✓

Worker skeleton · KV + D1 + R2 bindings · Neon adapter + OTel · LLM router
(free chain) · Better Auth (GitHub + Google + magic link) · `/v1/ask`
end-to-end · events queue + drain · Stripe webhook · CI/CD + PR preview
environments.

### Phase 1 — On-ramp

A stranger lands on `nlqdb.com`, creates a DB in plain English, embeds it,
and shares the link — in under 60 seconds, no card, no config.

- ✓ Marketing site (Astro, live at `nlqdb.com`)
- ✓ `<nlq-data>` + `<nlq-action>` elements (v0.1)
- ✓ Sign-in — magic link + GitHub + Google
- ✓ Chat surface — streaming three-part response (answer / data / trace),
  anonymous mode
- ✓ Anonymous mode — 72h token, adopted onto your account on sign-in
- ✓ Hosted db.create pipeline (table-card embeddings stubbed pending the
  pgvector slice)
- ✓ API keys dashboard (`/app/keys`)
- ◯ Hello-world tutorial polish

### Phase 1.5 — Trust + telemetry

- ✓ Diff preview on writes + visible SQL trace on every response
- ✓ Demand-signal telemetry on every "not yet" path
- ◯ Confidence floor (clarify-on-low-confidence — a guided turn, not a dead-end) — lands with quality-eval

### Phase 2 — Distribution (agent + developer surfaces)

- ✓ Hosted MCP server (`mcp.nlqdb.com/mcp`) — host auto-detect pending;
  local stdio `@nlqdb/mcp@0.1.1` is on npm, so `npx -y @nlqdb/mcp` with an
  `sk_mcp_*` key is a headless route in with no browser consent step
  (`/agents` now carries it; the per-host install panel is still OAuth-only).
  On Claude Code, `/plugin marketplace add nlqdb/nlqdb` installs the server +
  both memory skills in one step
- ✓ CLI `nlq` (Go) — core verbs + raw-SQL escape hatch; device-login +
  chat REPL pending
- ✓ `@nlqdb/sdk` — basic methods + `runSql` + cross-tenant grant +
  pack-import runner verbs; published and importable from the registry
  (`0.4.0`)
- ~ Framework wrappers + native Swift package — built + CI-tested; npm /
  SPM publish pending
- ✓ Quality-eval harness (BIRD + Spider 2.0, manual on-demand) — the
  free-vs-frontier accuracy delta is the headline KPI
- ~ Bring-your-own-LLM dispatch — HTTP lane live; remaining surfaces in
  progress
- ◯ CSV upload in chat
- ~ Docs-site reference completeness — SDK + framework-wrapper guides,
  an enumerable error-code reference, and a build-time `/llms.txt` for
  agents now live; tutorial polish remains
- ◯ Custom domains for embeds

### Phase 3 — Multi-engine engine (the moat)

- ◯ Workload analyzer → migration orchestrator
- ◯ ClickHouse / DuckDB / Redis as additional engines
- ◯ Dual-read verification
- ✓ Hosted-premium model lane (demand-gated) — live 2026-08-14 (`PREMIUM_METER_LIVE` flipped)

### Phase 4 — Beyond v1

- ~ Bring-your-own Postgres / ClickHouse — connect path live end-to-end
  (`POST /v1/db/connect` + web UI, CLI, SDK, query dispatch); prod-gated on
  the `BYO_SECRET_KEK` secret. **Supabase** adds one-click OAuth connect over
  the read-only Management-API (no DSN to paste); prod-gated on the
  `SUPABASE_OAUTH_CLIENT_ID` / `_SECRET` secrets, with a graceful fall-back to
  paste when unset
- ◯ SSO (SAML / OIDC), audit-log export, per-org quotas
- ◯ EU data residency, VPC peering, SOC 2

## Develop locally

```bash
git clone git@github.com:nlqdb/nlqdb.git && cd nlqdb
scripts/bootstrap-dev.sh   # installs everything, pulls Ollama models, seeds .envrc
scripts/login-cloud.sh     # signs you into cloud providers that have a CLI flow
```

`bootstrap-dev.sh` stands up the whole toolchain in one shot — Bun, Node
20+, Go 1.25+, uv; Biome / gofumpt / golangci-lint / ruff; lefthook git
hooks; the cloud CLIs (wrangler, flyctl, stripe, gh); a local Ollama so the
LLM router works offline; and a `.envrc` with self-generated dev secrets.
Details in
[`docs/history/infrastructure-setup.md §8`](./docs/history/infrastructure-setup.md#8-dev-toolchain).

Day-to-day:

```bash
bun run fix          # biome format + lint --write (most issues)
bun run check:all    # biome + golangci-lint + ruff (what CI runs)
bun run hooks:run    # run pre-commit hooks against staged files
```

### End-to-end tests (manual trigger)

E2E coverage is **persona-driven** and **manually triggered** so cost stays
inside the free-tier envelope — one `workflow_dispatch` workflow per
surface:

```bash
gh workflow run e2e-opencheck.yml             # web — live LLM, Neon branch, Workers preview
gh workflow run e2e-cli.yml                   # Go testscript, hermetic
gh workflow run e2e-sdk.yml                   # vitest + cassettes, hermetic
gh workflow run e2e-mcp.yml                   # InMemoryTransport protocol tests, hermetic
gh workflow run e2e-examples.yml              # Playwright across HTML/Next/Astro/Nuxt/SvelteKit
gh workflow run e2e-examples.yml -f live=true # + staging for the curl + CLI shell smokes
```

Run the hermetic surfaces locally without GitHub:

```bash
( cd tests/e2e/cli && go test ./... )
( cd tests/e2e/sdk && bun install && bun run test )
( cd tests/e2e/mcp && bun install && bun run test )
( cd tests/e2e/examples && bun install && bun run install:browsers && bun run test )
```

Only *execution* is manual: `tests/e2e/{sdk,mcp,examples}` live outside the root
workspace, so CI's `typecheck-e2e` job `tsc`s them on every PR — the free
backstop against a suite that compiles today and rots before the next dispatch.

Conventions, persona mapping, and cassette governance are in
[`docs/features/e2e-coverage/FEATURE.md`](./docs/features/e2e-coverage/FEATURE.md).

## Docs & reference

- [`docs/architecture.md`](./docs/architecture.md) — system design (auth,
  pricing, the $0 stack, model selection, hosted db.create, hello-world).
- [`docs/phase-plan.md`](./docs/phase-plan.md) — canonical phase plan and
  exit gates.
- [`docs/decisions.md`](./docs/decisions.md) — cross-cutting `GLOBAL-NNN`
  decisions; per-feature records live under
  [`docs/features/`](./docs/features).
- [`docs/performance.md`](./docs/performance.md) — SLOs, latency budgets,
  span/metric catalog.
- [`docs/competitors.md`](./docs/competitors.md) — competitive landscape.

## Community & legal

- [CONTRIBUTING.md](./CONTRIBUTING.md) — dev setup, branch naming, commits, CLA flow.
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) — Contributor Covenant 2.1. Reports to `conduct@nlqdb.com`.
- [SECURITY.md](./SECURITY.md) — vulnerability disclosure (`security@nlqdb.com`). 90-day fix target.
- [SUPPORT.md](./SUPPORT.md) — where to ask questions and what we don't (yet) offer.
- [CLA.md](./CLA.md) — Contributor License Agreement, signed once via the bot on your first PR.
- [TRADEMARKS.md](./TRADEMARKS.md) — what you can and can't do with the nlqdb name and logo.
- [SUBPROCESSORS.md](./SUBPROCESSORS.md) — third-party services that may process personal data on our behalf.
- [IMPRESSUM.md](./IMPRESSUM.md) — Swiss UWG-mandated operator disclosures.
- Privacy policy and terms of service: [nlqdb.com/privacy](https://nlqdb.com/privacy) · [nlqdb.com/terms](https://nlqdb.com/terms).

## License

[FSL-1.1-ALv2](./LICENSE) — Functional Source License, Apache 2.0 future
license. Source-available for any non-competing use; auto-converts to
Apache 2.0 two years after each release. (Pattern used by Sentry, Convex,
and others.)

`nlqdb`™ is an unregistered trademark of the project's licensor. See
[TRADEMARKS.md](./TRADEMARKS.md) for usage guidelines.
