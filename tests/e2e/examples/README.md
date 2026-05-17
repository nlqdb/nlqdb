# Examples-as-tests

Stripe-samples–style: every `examples/<framework>/` ships an `e2e/smoke.spec.ts` (or `.sh` for shell-flavour examples) that exercises the README's quickstart. See [`SK-E2E-005`](../../../docs/features/e2e-coverage/FEATURE.md#sk-e2e-005--examples-as-tests-every-examplesframework-ships-a-smoke-test-wired-to-the-dispatcher) for the rationale.

## Layout

```
tests/e2e/examples/
├── package.json            # Playwright + tsconfig — one install for every framework example
├── playwright.config.ts    # discovers specs at examples/*/e2e/*.spec.ts
├── tsconfig.json
└── README.md

examples/<framework>/e2e/   # per-example specs (live next to the example)
└── smoke.spec.ts           # tagged @<framework>; runs the README's quickstart
```

## Run

```bash
# `@playwright/test` lives in the root workspace devDependencies (not
# here) so that example specs under examples/*/e2e/ — which are not
# in tests/e2e/examples — can resolve it via the standard upward
# node_modules walk. The local install is just the typecheck + bash
# smokes.
cd /home/user/nlqdb && bun install
cd tests/e2e/examples
bun install                    # vitest, typescript, bun-types
bun run install:browsers       # Playwright Chromium — ~150 MB; first run only
bun run test                   # every framework example
bun run test:html              # just the @html-tagged spec
bun run test:curl              # bash, no browser, live-mode only
bun run test:cli               # bash, no browser, live-mode only
```

## Coverage matrix

| Example | Tag | Spec file | Phase 0 status |
|---------|-----|-----------|----------------|
| `examples/html/`       | `@html`      | [`examples/html/e2e/smoke.spec.ts`](../../../examples/html/e2e/smoke.spec.ts) | runs today (static file) |
| `examples/nextjs/`     | `@nextjs`    | [`examples/nextjs/e2e/smoke.spec.ts`](../../../examples/nextjs/e2e/smoke.spec.ts) | skipped — `<nlq-data>` runtime lands Phase 1 |
| `examples/nuxt/`       | `@nuxt`      | [`examples/nuxt/e2e/smoke.spec.ts`](../../../examples/nuxt/e2e/smoke.spec.ts) | skipped — `<nlq-data>` runtime lands Phase 1 |
| `examples/sveltekit/`  | `@sveltekit` | [`examples/sveltekit/e2e/smoke.spec.ts`](../../../examples/sveltekit/e2e/smoke.spec.ts) | skipped — `<nlq-data>` runtime lands Phase 1 |
| `examples/astro/`      | `@astro`     | [`examples/astro/e2e/smoke.spec.ts`](../../../examples/astro/e2e/smoke.spec.ts) | skipped — `<nlq-data>` runtime lands Phase 1 |
| `examples/curl/`       | n/a (shell)  | [`examples/curl/e2e/smoke.sh`](../../../examples/curl/e2e/smoke.sh) | live-mode only — needs staging URL + key |
| `examples/cli/`        | n/a (shell)  | [`examples/cli/e2e/smoke.sh`](../../../examples/cli/e2e/smoke.sh) | live-mode only — needs staging URL + key |

Each framework example's spec file is intentionally tiny and self-contained — the spec is the test, the example file is the fixture. When Phase 1 lands and `elements.nlqdb.com/v1.js` publishes, the `test.fixme(true, …)` line lifts and the existing assertion stays.

## Trigger via GitHub Actions

```bash
gh workflow run e2e.yml -f surface=examples
```

The `examples` surface runs the `_e2e-examples.yml` reusable workflow, which:
1. Caches Playwright's Chromium binaries (same approach as `_e2e-opencheck.yml`).
2. Runs `playwright test` (skipped examples are still discovered + reported).
3. In `surface=all` mode, runs the bash shell smokes (`curl`, `cli`) against the staging URL the dispatcher spun up.

## When to add an example

Per [`SK-E2E-005`](../../../docs/features/e2e-coverage/FEATURE.md#sk-e2e-005--examples-as-tests-every-examplesframework-ships-a-smoke-test-wired-to-the-dispatcher) and `tests/personas/README.md`:

1. Add the example folder under `examples/<framework>/` with at least a README + main source file.
2. Add `examples/<framework>/e2e/smoke.spec.ts` (or `.sh`) — copy the closest existing example, retag.
3. Add the row to the coverage matrix above.
4. Wire the script in `package.json` if it's a one-off bash smoke.
