# nlqdb — natural-language databases

> *A database you talk to, with a backend that doesn't exist.*

You write HTML. Each component asks for what it wants in plain English.
nlqdb infers the schema, writes the SQL, runs it, and renders the result.
There is no backend for you to build.

Two actions. That's the whole product:

1. **Create a database** — one word: a name.
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

## Status — pre-alpha

nlqdb is **pre-alpha** and built in the open. The marketing site, the
`/v1/ask` pipeline, the `<nlq-data>` / `<nlq-action>` elements, the chat
app, the TypeScript SDK, the hosted MCP server, and the `nlq` CLI are all
live in some form (see the surface table below).

While we're proving query accuracy, the **do-work endpoints are gated**.
Until our natural-language → SQL accuracy clears a public bar (BIRD ≥ 0.65
and Spider 2.0 ≥ 0.75 on the free model chain), un-invited requests get a
friendly `feature_gated` response — the current scores plus a waitlist
link — instead of a possibly-wrong answer. **Joining the waitlist emails
you an invite code** that opens the gate; it then removes itself
automatically once both thresholds clear. See
[`GLOBAL-027`](./docs/decisions/GLOBAL-027-pre-alpha-gate.md) and
[`docs.nlqdb.com/pre-alpha/`](https://docs.nlqdb.com/pre-alpha/).

## Use it

The 60-second walkthrough — plain HTML, CLI, and ten framework wrappers —
lives at [`docs.nlqdb.com`](https://docs.nlqdb.com). Start with the
[HTML tutorial](https://docs.nlqdb.com/tutorials/html/) or the
[CLI tutorial](https://docs.nlqdb.com/tutorials/cli/).

You don't generate an API key separately: describe your database at
[nlqdb.com](https://nlqdb.com), and the chat hands you a `<nlq-data>`
snippet with the key already inlined.

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
  answer, refuse rather than guess when confidence is low.
- **Performance** — sub-400 ms cached, sub-1.5 s cold.

The bet: get this right on free, open models and it only gets better on
frontier ones — the scaffolding compounds with whatever model is
underneath.

## Models & plans

- **Free forever** on the built-in open-model chain — queries, embeds,
  and the elements, no card required.
- **Bring your own LLM key** (Anthropic / OpenAI / Gemini / OpenRouter)
  on any tier, at no markup.
- **Hosted premium models** on paid plans, when you'd rather not manage a
  key of your own.
- **Self-host the source** — the engine, CLI, MCP server, and SDKs are
  source-available under [FSL-1.1-ALv2](./LICENSE): free to self-host for
  any non-competing use, bring your own LLM key, no per-call fees. The
  license auto-converts to Apache 2.0 two years after each release.

Paid plans aren't live yet. The full model strategy is in
[`GLOBAL-026`](./docs/decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md).

## Surfaces at a glance

| Surface | Status | Where |
|---|---|---|
| HTTP API (`POST /v1/ask`, `POST /v1/run`) | ✓ shipped | `apps/api/src/ask/**` |
| `<nlq-data>` + `<nlq-action>` elements | ✓ shipped (v0.1) | `packages/elements/**` |
| `@nlqdb/sdk` (TypeScript) | ✓ shipped (incl. `runSql`) | `packages/sdk/**` |
| Framework wrappers (React / Next / Vue / Nuxt / Svelte / SvelteKit / Astro / Solid + Swift) | ✓ shipped | `packages/{react,next,…}/**` |
| Chat app `nlqdb.com/app` | ✓ shipped | `apps/web/**` |
| Hosted MCP server `mcp.nlqdb.com` | ✓ shipped (host auto-detect pending) | `apps/mcp/**`, `packages/mcp/**` |
| `nlq` CLI (Go) | ✓ shipped (core verbs; device-login pending) | `cli/**` |

Full integration matrix in [`docs/progress.md`](./docs/progress.md).

## Roadmap

The detailed plan below is a summary; the canonical phase plan and exit
gates live in [`docs/phase-plan.md`](./docs/phase-plan.md). Legend:
**✓ shipped · ~ in progress · ◯ planned**.

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
- ◯ Confidence floor (refuse-on-low-confidence) — lands with quality-eval

### Phase 2 — Distribution (agent + developer surfaces)

- ✓ Hosted MCP server (`mcp.nlqdb.com` + local stdio `@nlqdb/mcp`) —
  host auto-detect pending
- ✓ CLI `nlq` (Go) — core verbs + raw-SQL escape hatch; device-login +
  chat REPL pending
- ✓ `@nlqdb/sdk` — basic methods + `runSql`
- ✓ Framework wrappers + native Swift package
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
- ◯ Hosted-premium model lane (demand-gated)

### Phase 4 — Beyond v1

- ~ Bring-your-own Postgres / ClickHouse (`POST /v1/db/connect`)
- ◯ SSO (SAML / OIDC), audit-log export, per-org quotas
- ◯ EU data residency, VPC peering, SOC 2

## Develop locally

```bash
git clone git@github.com:nlqdb/nlqdb.git && cd nlqdb
scripts/bootstrap-dev.sh   # installs everything, pulls Ollama models, seeds .envrc
scripts/login-cloud.sh     # signs you into cloud providers that have a CLI flow
```

`bootstrap-dev.sh` stands up the whole toolchain in one shot — Bun, Node
20+, Go 1.24+, uv; Biome / gofumpt / golangci-lint / ruff; lefthook git
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
