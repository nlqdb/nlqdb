# Persona-driven E2E tests

This directory is the **organising principle** for nlqdb end-to-end coverage. One folder per persona from [`docs/research/personas.md`](../../docs/research/personas.md); each folder's `README.md` is the journey definition + the surface coverage matrix; each test file under it is one runner's implementation of that journey.

Read [`docs/features/e2e-coverage/FEATURE.md`](../../docs/features/e2e-coverage/FEATURE.md) before adding or editing tests here. The five-field decisions there (SK-E2E-001..006) constrain what goes where.

## Persona index

| ID | Persona | Primary surfaces | Folder |
|----|---------|-------------------|--------|
| P1 | The Solo Builder | CLI · SDK · web · examples (Next.js, Astro) | [`P1-solo-builder/`](./P1-solo-builder/) |
| P2 | The Agent Builder | MCP · CLI (`nlq mcp install`) | [`P2-agent-builder/`](./P2-agent-builder/) |
| P3 | The Data-Curious Analyst / PM / Ops | web | [`P3-data-analyst/`](./P3-data-analyst/) |
| P4 | The Backend Engineer at a Small Startup | SDK · examples (Nuxt, SvelteKit) · CLI (cron) | [`P4-backend-engineer/`](./P4-backend-engineer/) |
| P5 | The Student / First-Timer | web (anonymous mode) · examples (HTML) | [`P5-student/`](./P5-student/) |
| P6 | The Analytics / Observability Engineer | CLI (pipelines) · examples (curl, CLI) · SDK | [`P6-analytics-engineer/`](./P6-analytics-engineer/) |

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

All e2e is `workflow_dispatch`-only (see [`SK-E2E-004`](../../docs/features/e2e-coverage/FEATURE.md)). One dispatcher with a `surface` choice input routes to per-surface reusable workflows. Trigger from the Actions UI (`E2E (dispatcher)`) or via `gh`:

```bash
# Pick one surface
gh workflow run e2e.yml -f surface=cli
gh workflow run e2e.yml -f surface=sdk
gh workflow run e2e.yml -f surface=mcp
gh workflow run e2e.yml -f surface=examples
gh workflow run e2e.yml -f surface=web      # existing opencheck
gh workflow run e2e.yml -f surface=all      # serial, one staging spin-up shared
```

`surface=all` shares one Neon branch + Workers preview between surfaces (so the LLM plan-cache absorbs duplicate `ask` calls; see SK-E2E-003). Use it after changes that span surfaces (auth, SDK request shape, ask pipeline).

## Adding a new persona test

1. Pick the persona's folder (or open a P7 in `docs/research/personas.md` first; never add a persona here without it living there).
2. Add the test file in the appropriate runner directory.
3. Add the row to that persona's `README.md` surface table.
4. If the test is the first one for a new surface, add a row to the global runner table above + extend `_e2e-<surface>.yml` if a new reusable workflow is needed.
5. Run the runner locally; commit; reference the relevant `SK-E2E-NNN` decision in the PR body.

The dispatcher matrix is the runtime expression of this directory. Anything not reachable from the matrix is not running.
