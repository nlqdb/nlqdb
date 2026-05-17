# Apps · Web — Agents Guide

Marketing + product web app. Onboarding, anonymous-mode default, demo dataset.

> This is the local guide. Read root [`AGENTS.md`](../../AGENTS.md) first
> for the three behavioral principles, the full path → feature map, and
> the project-wide tech stack. This file narrows that guide to
> `apps/web/`.

## Features relevant to this area

- [`web-app`](../../docs/features/web-app/FEATURE.md) — mandatory pre-read for changes that touch the feature.
- [`anonymous-mode`](../../docs/features/anonymous-mode/FEATURE.md) — mandatory pre-read for changes that touch the feature.
- [`sdk`](../../docs/features/sdk/FEATURE.md) — mandatory pre-read for changes that touch the feature.
- [`api-keys`](../../docs/features/api-keys/FEATURE.md) — mandatory pre-read for changes under `src/pages/app/keys.astro` or `src/components/keys/**`.

## Commands

```bash
bun run --filter apps/web dev
bun run --filter apps/web build
bun run --filter apps/web test
```

## Local rules

- Every change here must respect the `GLOBAL-NNN` decisions in
  [`docs/decisions.md`](../../docs/decisions.md).
- A new external call (DB / LLM / HTTP / queue) needs an OTel span
  (`GLOBAL-014`).
- If a request is ambiguous or an error is unfamiliar — web-research
  current best practices first (see root `AGENTS.md` §2 P2).
- A decision change (new or amended) updates every place that copies
  it, in the same PR (root `AGENTS.md` §2 P3).

## E2E coverage

Web persona journeys are exercised by opencheck — [`tests/opencheck/tests.yaml`](../../tests/opencheck/tests.yaml) — driven by a Playwright-MCP agent against an ephemeral preview (Neon branch + Workers Versions alias). Persona mapping: [P3 — Data-Curious Analyst](../../tests/personas/P3-data-analyst/README.md), [P5 — Student / First-Timer](../../tests/personas/P5-student/README.md), and elements of every other persona that touches the app.

After a change that could move a button, rename a chat affordance, change a confirm-dialog wording, or alter the trace pane:

```bash
gh workflow run e2e.yml -f surface=web      # opencheck (live LLM via Groq through plan-cache)
gh workflow run e2e.yml -f surface=all      # web + every other surface, shared staging
```

The legacy [`e2e-opencheck.yml`](../../.github/workflows/e2e-opencheck.yml) entry point continues to work as a backwards-compat alias for `surface=web`.

`tests/opencheck/.opencheck-cache` is checked into the GitHub Actions cache keyed on `apps/{api,web}/src/**` + `tests/opencheck/tests.yaml` — only changes to those paths force LLM re-derivation, which keeps Groq's 1k-RPD free tier comfortable across many runs per day.

See [`docs/features/e2e-coverage/FEATURE.md`](../../docs/features/e2e-coverage/FEATURE.md) for the harness conventions.

## When you finish

1. Run the commands above and ensure they all pass.
2. If you added a decision, it has an ID, lives in the right place
   (`docs/decisions.md` or the relevant `FEATURE.md`), and any duplicate
   of an affected `GLOBAL-NNN` is updated.
3. Open a PR; the root `AGENTS.md` §8 lists the pre-PR quality gates.
