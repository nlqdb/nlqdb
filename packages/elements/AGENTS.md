# Packages · Elements — Agents Guide

`<nlq-data>` (reads) + `<nlq-action>` (writes) web components for framework-free embedding.

> This is the local guide. Read root [`AGENTS.md`](../../AGENTS.md) first
> for the three behavioral principles, the full path → feature map, and
> the project-wide tech stack. This file narrows that guide to
> `packages/elements/`.

## Features relevant to this area

- [`elements`](../../docs/features/elements/FEATURE.md) — mandatory pre-read for changes that touch the feature.
- [`sdk`](../../docs/features/sdk/FEATURE.md) — mandatory pre-read for changes that touch the feature.

## Commands

```bash
bun run --filter @nlqdb/elements build
bun run --filter @nlqdb/elements test
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

`<nlq-data>` + `<nlq-action>` only render in a browser, so element e2e is covered by two complementary surfaces:

1. **Embedded in the web app** — [`tests/opencheck/tests.yaml`](../../tests/opencheck/tests.yaml) exercises every element-bearing case end-to-end through the persona journeys (P3 + P5 land directly on element-rendered DOM).
2. **Embedded in framework examples** — [`examples/*/e2e/smoke.spec.ts`](../../examples/) verifies the canonical `<nlq-data>` + `<nlq-action>` markup contract in HTML, Next.js, Astro, Nuxt, SvelteKit. Phase 0 status: source-content checks today; live-runtime checks `test.fixme`'d until `elements.nlqdb.com/v1.js` publishes.

After an attribute rename, slot change, or template behaviour shift, trigger both:

```bash
gh workflow run e2e-opencheck.yml         # opencheck
gh workflow run e2e-examples.yml    # framework matrix
```

A new attribute lands with a row added to every framework example's spec assertion set + the matching opencheck case if the attribute is reachable from the rendered chat surface.

See [`docs/features/e2e-coverage/FEATURE.md`](../../docs/features/e2e-coverage/FEATURE.md).

## When you finish

1. Run the commands above and ensure they all pass.
2. If you added a decision, it has an ID, lives in the right place
   (`docs/decisions.md` or the relevant `FEATURE.md`), and any duplicate
   of an affected `GLOBAL-NNN` is updated.
3. Open a PR; the root `AGENTS.md` §8 lists the pre-PR quality gates.
