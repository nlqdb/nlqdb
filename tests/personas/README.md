# Persona-driven E2E tests

This directory is the **organising principle** for nlqdb end-to-end coverage. One folder per persona from [`docs/research/personas.md`](../../docs/research/personas.md); each folder's `README.md` is the journey definition + the surface coverage matrix; each test file under it is one runner's implementation of that journey.

Read [`docs/features/e2e-coverage/FEATURE.md`](../../docs/features/e2e-coverage/FEATURE.md) before adding or editing tests here. The five-field decisions there (SK-E2E-001..006) constrain what goes where.

## Persona index

| ID | Persona | Primary surfaces | Folder |
|----|---------|-------------------|--------|
| P1 | The Solo Builder | CLI · SDK · web · examples (Next.js, Astro, React, Vue) | [`P1-solo-builder/`](./P1-solo-builder/) |
| P2 | The Agent Builder | MCP · CLI (`nlq mcp install`) | [`P2-agent-builder/`](./P2-agent-builder/) |
| P3 | The Data-Curious Analyst / PM / Ops | web | [`P3-data-analyst/`](./P3-data-analyst/) |
| P4 | The Backend Engineer at a Small Startup | SDK · examples (Nuxt, SvelteKit) · CLI (cron) | [`P4-backend-engineer/`](./P4-backend-engineer/) |
| P5 | The Student / First-Timer | web (anonymous mode) · examples (HTML, Svelte) | [`P5-student/`](./P5-student/) |
| P6 | The Analytics / Observability Engineer | CLI (pipelines) · examples (curl, CLI, Solid) · SDK | [`P6-analytics-engineer/`](./P6-analytics-engineer/) |

## How a persona test maps to a runner

Each persona README binds the journey to the runner that implements it:

```
P1-solo-builder/
├── README.md                # journey definition + surface matrix
└── (runner-specific tests live in tests/e2e/<surface>/ or examples/<framework>/e2e/,
   linked from the README so reviewers can trace persona → runner → file in one hop)
```

Runners live in:

| Surface | Runner | Path |
|---------|--------|------|
| Web | opencheck + Playwright MCP | [`tests/opencheck/`](../opencheck/) |
| CLI | Go `testscript` | [`tests/e2e/cli/`](../e2e/cli/) |
| SDK | vitest + MSW cassettes | [`tests/e2e/sdk/`](../e2e/sdk/) |
| MCP server | `@modelcontextprotocol/sdk` in-memory + `@modelcontextprotocol/inspector` headless | [`tests/e2e/mcp/`](../e2e/mcp/) |
| Elements | covered by web runner (only renders in browser) | [`tests/opencheck/`](../opencheck/) |
| Examples | Playwright via shared harness | [`tests/e2e/examples/`](../e2e/examples/) + `examples/<framework>/e2e/` |
| Ruby SDK (future) | RSpec `pending` skeleton | [`packages/nlqdb-rb/spec/e2e/`](../../packages/nlqdb-rb/spec/e2e/) |
| Rust SDK (future) | `cargo test --ignored` skeleton | [`packages/nlqdb-rs/tests/e2e/`](../../packages/nlqdb-rs/tests/e2e/) |

## Triggering an e2e run

All e2e is `workflow_dispatch`-only (see [`SK-E2E-004`](../../docs/features/e2e-coverage/FEATURE.md)). One workflow per surface — pick the one that matches the change you just made, or trigger several when a cross-surface journey is at stake:

```bash
gh workflow run e2e-cli.yml
gh workflow run e2e-sdk.yml
gh workflow run e2e-mcp.yml
gh workflow run e2e-examples.yml                  # framework Playwright matrix (hermetic)
gh workflow run e2e-examples.yml -f live=true     # + live curl + CLI shell smokes (spins up staging)
gh workflow run e2e-opencheck.yml                 # web — staging spin-up + opencheck
```

For a cross-surface change (auth, SDK request shape, ask pipeline) trigger every relevant surface. Web + examples-live share a Neon branch + Workers preview alias via a common `e2e-staging` concurrency group, so overlapping runs queue rather than orphan resources.

## Adding a new persona test

1. Pick the persona's folder (or open a P7 in `docs/research/personas.md` first; never add a persona here without it living there).
2. Add the test file in the appropriate runner directory.
3. Add the row to that persona's `README.md` surface table.
4. If the test is the first one for a new surface, add a row to the global runner table above + add a new `.github/workflows/e2e-<surface>.yml` workflow (mirror the closest existing one).
5. Run the runner locally; commit; reference the relevant `SK-E2E-NNN` decision in the PR body.

The list of e2e workflows under `.github/workflows/e2e-*.yml` is the runtime expression of this directory. Anything not reachable from a workflow is not running.
