---
name: e2e-coverage
description: End-to-end test coverage across every surface (web, CLI, SDK, MCP, elements, examples) organized by persona; one workflow_dispatch workflow per surface; cache- and rate-limit-aware.
when-to-load:
  globs:
    - tests/personas/**
    - tests/opencheck/**
    - tests/e2e/**
    - examples/**/e2e/**
    - .github/workflows/e2e-*.yml
    - .github/workflows/_e2e-opencheck.yml
    - packages/nlqdb-rb/spec/e2e/**
    - packages/nlqdb-rs/tests/e2e/**
  topics: [e2e, end-to-end, integration, opencheck, playwright, testscript, msw, cassette, persona, workflow_dispatch]
---

# Feature: E2E Coverage

**One-liner:** End-to-end test coverage across every surface (web, CLI, SDK, MCP, elements, examples) organized by persona, manually triggered, cache- and rate-limit-aware.
**Status:** partial — harness + persona scaffolding shipped; per-surface coverage seeded; broader cases land as surfaces mature.
**Owners (code):** `tests/personas/**`, `tests/opencheck/**`, `tests/e2e/**`, `examples/**/e2e/**`, `.github/workflows/e2e-*.yml`, `.github/workflows/_e2e-opencheck.yml`
**Cross-refs:** [`docs/research/personas.md`](../../research/personas.md) (P1–P6 — the test organising principle) · [`quality-eval/FEATURE.md`](../quality-eval/FEATURE.md) (orthogonal — accuracy benchmark, not transactional e2e) · GLOBAL-002, GLOBAL-003, GLOBAL-013, GLOBAL-014 (canonical text in [`docs/decisions/`](../../decisions/); index in [`docs/decisions.md`](../../decisions.md))

## Touchpoints — read this feature before editing

- `tests/personas/` — persona journey definitions (one folder per persona, README per persona)
- `tests/opencheck/` — web journey runner (Playwright MCP + opencheck)
- `tests/e2e/cli/` — CLI Go testscript harness
- `tests/e2e/sdk/` — SDK contract-test harness (vitest + MSW cassettes)
- `tests/e2e/mcp/` — MCP server harness (Inspector + in-memory transport)
- `tests/e2e/examples/` — cross-example shared utilities
- `examples/*/e2e/` — per-example smoke tests (`smoke.spec.*`)
- `packages/nlqdb-{rb/spec,rs/tests}/e2e/` — Ruby (`pending`) + Rust (`#[ignore]`) SDK skeletons, not in CI
- `.github/workflows/e2e-{cli,sdk,mcp,examples,opencheck}.yml` — one `workflow_dispatch` surface each (`e2e-examples.yml` takes a `live` input)
- `.github/workflows/_e2e-{staging,opencheck}.yml` — reusable (`workflow_call`) preview spin-up + opencheck runner

## Decisions

### SK-E2E-001 — Persona-driven journey suites are the organising principle

- **Decision:** E2E tests are organised by persona, not by feature. One folder per persona (`tests/personas/P1-solo-builder/`, `P2-agent-builder/`, …, `P6-analytics-engineer/`), each holding a `README.md` that names the journey and links every surface-specific test file that implements it. A journey is a multi-step real-user flow ("solo builder spins up a side-project DB and queries it from CLI + framework example").
- **Core value:** Effortless UX, Goal-first
- **Why:** [`docs/research/personas.md`](../../research/personas.md) is the canonical record of who the product is for and what success looks like. Mirroring tests onto that taxonomy means every persona has visible coverage and every test answers the question "which user does this protect?" Feature-organised e2e tests fragment the same journey across folders and silently drift apart; persona-organised tests stay coherent and let GLOBAL-002 (behaviour parity across surfaces) be verified end-to-end inside one journey.
- **Consequence in code:** No persona may lose a journey without an explicit ID supersession. New surfaces are added by appending a row to each persona's README + a corresponding test file + a new `e2e-<surface>.yml` workflow. The list of `e2e-*.yml` workflows under `.github/workflows/` is the runtime expression of this layout — every surface listed there has at least one persona journey covering it.
- **Alternatives rejected:**
  - Feature-organised e2e (one folder per FEATURE.md) — duplicates the same journey across feature folders, drift inevitable.
  - Surface-organised e2e (one folder per surface) — verifies surface behaviour in isolation but cannot exercise cross-surface journeys (e.g. CLI creates DB, web reads it).
  - Ad-hoc test placement — review noise; new contributors don't know where to put tests.

### SK-E2E-002 — Per-surface native runner; opencheck is the web runner only

- **Decision:** Each surface uses its language-native test runner: web via opencheck + Playwright MCP (`tests/opencheck/`); CLI via Go `testscript` (`tests/e2e/cli/`); SDK via vitest + MSW (`tests/e2e/sdk/`); MCP via `@modelcontextprotocol/sdk` in-memory transport + the headless `@modelcontextprotocol/inspector` CLI for protocol conformance (`tests/e2e/mcp/`); elements are exercised through the web runner since they only render in a browser; examples each ship a Playwright smoke test in `examples/<framework>/e2e/` driven by a shared harness in `tests/e2e/examples/`.
- **Core value:** Simple, Effortless UX (for the test author)
- **Why:** A unifying DSL (Hurl, Stepci, Bruno) sounds attractive but every surface has rich language-native idioms (Go `testscript` golden files; vitest + MSW cassettes; MCP Inspector's stdio probe) that ship with their ecosystem and need zero glue. Forcing one DSL would either lose those idioms or introduce a layer of translation that breaks under real-world failures. The 2025-26 dominant pattern across polyglot monorepos (authentik, supabase) is exactly this: native runner per language, manifest-level coordination.
- **Consequence in code:** No top-level "e2e DSL" package. Each runner is invoked by its own `e2e-<surface>.yml` workflow. Cross-surface coordination happens at the workflow level (workflows that deploy staging share the `e2e-staging` concurrency group so they queue rather than orphan resources) and at the persona-folder level (the README binds the runners' tests to one journey).
- **Alternatives rejected:**
  - Single DSL (Hurl / Stepci / Bruno) — loses native idioms; adds a translation layer.
  - Playwright everywhere (including CLI and MCP via subprocess shimming) — wrong tool for non-browser surfaces, brittle.
  - Custom in-house harness — violates GLOBAL-016 (reach for mature packages before DIY).

### SK-E2E-003 — Hybrid LLM determinism: cassettes for contract tests, live LLM through plan-cache for journey tests

- **Decision:** Contract-style tests (SDK request/response shape; CLI command parsing; MCP tool schema conformance) use **MSW cassettes** (`tests/e2e/*/cassettes/`) — recorded once against the live API, committed, replayed in CI. Journey-style tests (a persona's end-to-end flow) run against a **live ephemeral staging** (the existing Neon-branch + Workers-preview pattern from `e2e-opencheck.yml`) and lean on the [`plan-cache`](../plan-cache/FEATURE.md) (GLOBAL-006: content-addressed plans) to dedupe identical LLM calls across journeys. Cassette re-recording is opt-in via `RECORD=1` env var.
- **Core value:** Free, Fast, Bullet-proof
- **Why:** Contract tests must be hermetic so they can run hundreds of times a day on contributor laptops without touching the LLM provider — cassettes give that for ~$0 and millisecond runtimes. Journey tests must catch real LLM-and-pipeline drift, so a live-but-cache-mediated path is correct: the first identical query in a journey burns one LLM call; subsequent journeys that re-issue the same query hit `plan_cache` and never reach Groq. The free-tier rate-limit landscape (see the model table below) means we *must* be cache-aware — the opencheck infra learned this expensively (comment block at top of `tests/opencheck/tests.yaml`); we do not relearn it.
- **Consequence in code:** Cassettes live under `tests/e2e/<surface>/cassettes/` and are checked in. Contract tests fail closed if their cassette is missing (no silent live-fetch). Journey workflows (`e2e-opencheck.yml`; `e2e-examples.yml` with `live=true`) spin up a single ephemeral staging URL per run and never spin up their own LLM provider. `tests/e2e/sdk/_lib/cassette.ts` is the per-surface MSW-style helper. No new LLM credentials cross any test boundary beyond `GROQ_API_KEY`, which is passed only to the web journey workflow.
- **Alternatives rejected:**
  - All-live LLM — non-deterministic and expensive; burns rate-limit budget on every contributor PR.
  - All-mocked LLM (cassettes everywhere) — loses signal on LLM drift between model releases.
  - Live LLM for contract tests behind a "test mode" backend flag — couples the production code to the test harness.

### SK-E2E-004 — Manual `workflow_dispatch` only; one workflow per surface

- **Decision:** All e2e workflows are `workflow_dispatch`-only. One top-level workflow per surface — `e2e-opencheck.yml` (web), `e2e-cli.yml`, `e2e-sdk.yml`, `e2e-mcp.yml`, `e2e-examples.yml` — each independently discoverable in the Actions UI list and triggerable on its own. `e2e-examples.yml` carries a `live` boolean input that opts into the per-run ephemeral preview (Neon branch + Workers Versions alias) for the bash curl + CLI shell smokes; hermetic Playwright is the default. Workflows that deploy staging (`e2e-opencheck.yml`, `e2e-examples.yml` with `live=true`) share the `e2e-staging` concurrency group with `cancel-in-progress: false` so overlapping deploys queue rather than orphan a Neon branch. Pull-request and push triggers are *not* added; e2e is intentionally an operator action.
- **Core value:** Free, Simple
- **Why:** Two costs forced this shape. (1) Every e2e run consumes free-tier provider quota — Neon branch creation (10-branch ceiling), Workers Versions upload, Groq tokens — so it must be a deliberate operator action, not an implicit consequence of opening a PR. (2) Multi-PR contention on the single `e2e` Neon branch would orphan resources; the shared `e2e-staging` concurrency group queues overlapping runs cleanly. One workflow per surface (vs a dispatcher with a `surface` input) makes the Actions UI list itself the discovery surface — operators see `E2E CLI`, `E2E SDK`, `E2E MCP`, `E2E Examples`, `E2E (opencheck)` directly rather than having to remember a hidden input. The 2025-26 industry pattern for expensive cross-surface e2e (stripe-samples, supabase, vercel) is `workflow_dispatch` + queued concurrency.
- **Consequence in code:** Each `e2e-<surface>.yml` is self-contained: hermetic surfaces (CLI, SDK, MCP) have no staging deploy; the examples + opencheck workflows both delegate their preview spin-up to the shared `_e2e-staging.yml` reusable (one source of truth for the Neon-branch + Workers-Versions pattern). Secrets are passed explicitly per workflow, not `secrets: inherit`. A cross-surface change triggers each relevant workflow individually; the shared `e2e-staging` concurrency group prevents Neon-branch races between `e2e-opencheck.yml` and a `e2e-examples.yml -f live=true` run.
- **Alternatives rejected:**
  - `pull_request` trigger — too expensive, exhausts free-tier quota, blocks PRs on flaky e2e.
  - `schedule` cron — runs without context; failures land at 3 a.m. without a triggering author.
  - One dispatcher with a `surface=…` input + per-surface reusables — adds a layer of indirection (operator picks input value rather than picking workflow); reusables don't show up in the Actions UI manual list, so the operator can't trigger one directly without going through the dispatcher.
  - Matrix in a single workflow — can't easily target one surface at a time.

### SK-E2E-005 — Examples-as-tests: every `examples/<framework>/` ships a smoke test wired to a workflow

- **Decision:** Every example folder under `examples/` (`html`, `nextjs`, `nuxt`, `sveltekit`, `astro`, `cli`, `curl`) ships an `e2e/` subfolder with a smoke test that boots the example and exercises the README's quickstart commands. Tests live with the example, not with their runner — the example folder *is* the fixture. `e2e-examples.yml` runs them as a matrix; an example whose runtime is Phase 0 (`<nlq-data>` not yet wired) ships a test that **builds and type-checks but is gated on a feature flag**; once Phase 1 lands the gate flips. Stripe-samples' shared-CI pattern is the model.
- **Core value:** Effortless UX (for the example author + the user copying the example), Bullet-proof
- **Why:** Every framework example's README has a "drop in this file + run" recipe. The only honest verification of that recipe is to execute it. Documentation-only examples drift the moment a `<nlq-data>` attribute renames; the README looks right but the example throws. Wiring the example to a test that runs the README's commands ties the example's correctness to the surface it documents — and lets us assert one of GLOBAL-003's strongest claims: "the same snippet works in Next.js, Nuxt, SvelteKit, Astro and plain HTML." Stripe (`stripe-samples/sample-ci`), Supabase, and Vercel all do this for their first-party examples; the convention is mature.
- **Consequence in code:** `examples/<framework>/e2e/smoke.spec.ts` (or `.sh` for `curl/` and `cli/`) per example. A shared Playwright config at `tests/e2e/examples/playwright.config.ts` discovers every `examples/*/e2e/*.spec.ts` via a single `testDir`; the spec files themselves are the per-example harness — small enough that extracting a separate `harness.ts` would obscure what the test actually does. `e2e-examples.yml` runs the matrix; one project cell per framework, plus a separate `shell-smokes` job for the bash flavour. Examples whose Phase 0 status flags them as "scaffold-only" still get their test file but with an explicit `test.fixme()` + comment naming the Phase trigger.
- **Alternatives rejected:**
  - One example, one cassette, no live runtime — same drift hazard as docs-only; misses framework integration.
  - Centralised "test all examples" file — couples examples, harder to add a new framework.
  - Snapshot of expected HTML — brittle, snapshots churn faster than behaviour.

### SK-E2E-006 — Future SDK scaffolds (Ruby, Rust) ship test skeletons before runtime code

- **Decision:** `packages/nlqdb-rb/` (Ruby SDK, skeleton today) gets `spec/e2e/` with an RSpec skeleton whose specs are `pending` until the SDK lands. `packages/nlqdb-rs/` (Rust SDK, skeleton today) gets `tests/e2e/` with `#[ignore]`-marked tests. Neither is wired to CI today. Both ship now so the contract — "what does a P4 Backend Engineer in Ruby/Rust expect to be able to do?" — is documented as executable specification before the implementation.
- **Core value:** Goal-first, Bullet-proof
- **Why:** GLOBAL-003 (all surfaces one PR) prevents net-new capability shipping without a surface story, but it can't prevent a *future* surface from drifting its semantics during its own first implementation PR. Pre-shipped tests (even pending/ignored) anchor the contract — when the SDK lands its tests must pass, so the SDK is forced to match the documented persona journey rather than re-derive its own interpretation. Cost is near-zero (a few skeleton files) and the protection is real.
- **Consequence in code:** Ruby tests use the standard `pending "…"` block; Rust tests carry `#[ignore = "ships with the SDK implementation"]`. Neither has a matching `e2e-*.yml` workflow today. The persona READMEs cross-link to these tests so contributors discover them when they pick up the SDK work; the SDK-landing PR adds the workflow alongside.
- **Alternatives rejected:**
  - Wait until the SDK lands — repeats SK-E2E-005's drift problem at the surface level.
  - Empty placeholder files — no contract; nothing for the implementer to satisfy.
  - Documentation-only contract (FEATURE.md describes it) — falls out of sync with code; the test is the spec.

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per
GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list
below names the rules that constrain this feature; any feature-local
commentary is nested under the rule.

- **GLOBAL-002** — Behavior parity across surfaces.
  - *In this feature:* every persona journey exercises ≥ 2 surfaces where the persona uses them, so parity (same auth mode, same error shape, same idempotency semantics) is verified end-to-end, not asserted on faith.
- **GLOBAL-003** — New capabilities ship to all surfaces in one PR.
  - *In this feature:* the persona-folder READMEs are the parity checklist — a new capability adds a row in every persona that touches it, and any unfilled cell is an explicit gap with a feature-doc link.
- **GLOBAL-013** — $0/month for the free tier.
  - *In this feature:* every e2e workflow is `workflow_dispatch`-only, plan-cache deduplicates LLM calls across journey runs, cassettes serve contract tests at $0. The single `e2e` Neon branch is reused across journey workflows (`e2e-opencheck.yml` + `e2e-examples.yml -f live=true` share the `e2e-staging` concurrency group) to stay inside Neon Free's 10-branch ceiling.
- **GLOBAL-014** — OTel span on every external call.
  - *In this feature:* journey tests run against a real staging API, so every external call already has a span by the time it reaches the persona test. The test harness does not introduce its own external calls outside of staging itself.

## Free LLM model selection (opencheck)

**Policy: FREE MODELS ONLY** (GLOBAL-013). `LLM_API_KEY` in
`e2e-opencheck.yml` MUST source from a free provider (Groq, Cerebras,
OpenRouter `:free` only) — never a paid slug. On OpenRouter, `:free` suffix
is required; the bare slug (no `:free`) is paid tier
(2026-05-21: Mistral Small 3.2 paid ~$14 burned; reverted 2026-06-03).

Each Groq model has its own per-model TPM pool; the three active suites draw
from separate pools: llama (12K TPM), gpt-oss-120b (8K TPM), qwen3-32b (6K TPM).
Total per full 3-suite run: ~360–500 K tokens across all suites.

| Model | Provider | TPM | RPM | Daily | Ctx | Notes |
|---|---|---|---|---|---|---|
| `llama-3.3-70b-versatile` | Groq | 12 K | 1000 | 500 K | 131 K | **Suite A.** Tool-call verified 2026-06-03. |
| `openai/gpt-oss-120b` | Groq | 8 K | 1000 | 500 K | 131 K | **Suite B.** Reasoning-tuned; separate TPM pool; tool-call verified 2026-06-04. |
| `openai/gpt-oss-20b` | Groq | 8 K | 1000 | 500 K | 131 K | **Suite C.** Lighter/faster; separate TPM pool; tool-call verified 2026-06-04. |
| `gpt-oss-120b` | Cerebras | 30 K | 5 | 1 M | 131 K | Tool-call verified 2026-06-04; 5 RPM too slow for agent loops (~32 calls/min needed). |
| `openai/gpt-oss-120b:free` | OpenRouter `:free` | shared | shared | shared | 131 K | $0; fallback when Groq TPD exhausted; `:free` suffix required. |
| ~~`qwen/qwen3-32b`~~ | Groq | — | — | — | — | **Not usable** — tool-call fails entirely on Groq (verified 2026-06-04). |
| ~~`llama-4-scout-17b-16e`~~ | Groq | — | — | — | — | **Not usable** — returns number params as strings; Groq schema validation rejects (verified 2026-06-04). |

**Switching:** edit `model:` in the target suite YAML
(`tests/opencheck/tests-{a,b,c}-*.yaml`),
`OPENAI_BASE_URL` (`_e2e-opencheck.yml`), and the `LLM_API_KEY` source
(`e2e-opencheck.yml`); re-verify the provider's tool-call shape with a
one-shot `curl … /chat/completions` first.

## Opencheck progress tracker (append-only)

| Date | Change | Outcome |
|---|---|---|
| 2026-05-20 | reruns of same config | all failed — cascade from `#submit-prefilled-row` 240 s timeout |
| 2026-05-21 | swap to paid Mistral via OpenRouter | failed; **policy violation** (paid) — ~$14 burned |
| 2026-05-31 | rerun on main | failed; cascade + model hallucinated `/app/databases` → 404 (route absent) |
| 2026-06-03 | first free-only run (Groq `llama-3.3-70b-versatile`, run [26890333007](https://github.com/nlqdb/nlqdb/actions/runs/26890333007)) | **cancelled at 60-min ceiling** — key worked (~1.9k agent-loop emissions, no dead-key hang); **`/app/databases` hallucination did NOT recur** (0 mentions); but `#submit-prefilled-row` + 169 nav-timeout markers → persistent-mode cascade **persists**. Triggers remediation (a)+(b) below. |
| 2026-06-04 | 3-suite split (A: bootstrap 5 tests / B: read-write 8 tests / C: cleanup 9 tests); separate Groq model per suite for independent TPM pools; simplified `#submit-prefilled-row` (removed table-creation recovery path — fail fast); `_e2e-opencheck.yml` extended with `config_file` input; top-5 model list added inline to all YAML comments | **split infrastructure confirmed working** — cascade now isolated to Suite A; run [26924055024](https://github.com/nlqdb/nlqdb/actions/runs/26924055024): `#hero-or-cmdg` ✅ PASSED; `#create-table-anon` timed out 240s (root cause: no redirect-polling after Enter — model waits forever for URL change); fix shipped same day |
| 2026-06-04 | Fix `#create-table-anon`: add explicit 6×3s redirect-polling loop after pressing Enter (was: single snapshot check with no retry); remove branch-b recovery (fail-fast if no ?db= after sign-in); same simplification applied to canonical `tests.yaml` | run [26924879778](https://github.com/nlqdb/nlqdb/actions/runs/26924879778) — ALL 5 tests timed out at exactly 240 s including trivial `#hero-or-cmdg`; root cause: transient Groq API outage (no recordings saved = LLM never started browser calls) |
| 2026-06-04 | Root-cause `#create-table-anon` fundamental flow bug: test polled for redirect to `/app` after anonymous hero create, but `CreateForm.tsx` never redirects to `/app` — it shows "Provisioned with..." on the **same** marketing page (SK-ANON-012 first-call succeeds in place). Second anon call (per-device cap hit) redirects to `/auth/sign-in`, not `/app`. Test rewritten: poll for "Provisioned with" on marketing page (60 s / 5 s intervals), then navigate to /auth/sign-in manually. | run [26925791614](https://github.com/nlqdb/nlqdb/actions/runs/26925791614) — in progress |

**Cascade root-cause (2026-06-03):** `sessionMode: persistent` + one timed-out test (`#submit-prefilled-row`) starved downstream tests of their expected DB state — run burned the full 60-min ceiling (169 nav-timeout markers). **Remediation (a) SHIPPED 2026-06-04:** split into three suites (A/B/C), each starting with a fresh browser session and an explicit sign-in setup step; `#submit-prefilled-row` simplified to fail-fast on missing table (no 36s table-creation recovery loop). **Remediation (b) parked:** API-seeded fixtures held until the suite split proves insufficient.

## Open questions / known unknowns

- **Cassette staleness cron.** Cassettes are committed and replayed; if the live API's wire shape drifts they lie until re-recorded. Decide whether to run a weekly re-record-and-PR cron (cf. [`quality-eval/FEATURE.md`](../quality-eval/FEATURE.md)) or keep it manual. Lean: manual until staleness bites more than once.
- **Per-PR e2e for high-risk paths.** Today every e2e is manual. High-risk changes (e.g. `apps/api/src/ask/**`) might warrant a narrow PR-trigger running one persona's journey on a path-glob match. Lean: defer until a real regression escapes PR-time unit + integration tests.
- **Visual regression for elements.** `<nlq-data>` rendering regressions are caught today only by opencheck's NL assertions. Decide whether to add Playwright screenshot diffing in the elements/examples surfaces. Lean: defer until a CSS regression escapes; headless screenshot diffs are flaky.
