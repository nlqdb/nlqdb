# P5 — The Student / First-Timer

> Canonical persona definition: [`docs/research/personas.md`](../../../docs/research/personas.md#p5--the-student--first-timer)

**Real-life journey (a CS undergrad learning SQL for the first time):**

1. Lands on the marketing page; never signed up; never typed a card.
2. Hits Ctrl+G, types `"create a users table with id, name, email"`. Sees a table appear with sample rows.
3. Tries to add a row (`"add a new row…"`). The web app redirects to `/auth/sign-in` only when a *mutation* is attempted — read paths stayed anonymous (GLOBAL-007).
4. Signs in via the mock IdP; lands back on `/app` with the pre-filled prompt preserved.
5. Drops the same `<nlq-data>` snippet into a plain `index.html` on their machine, opens it in a browser, and sees the same component render.

## Surface coverage matrix

| Step | Surface | Runner | File |
|------|---------|--------|------|
| 1–2 — anonymous table-create, no login wall (GLOBAL-007) | Web | opencheck | [`tests/opencheck/tests.yaml`](../../opencheck/tests.yaml) (cases `#hero-or-cmdg`, `#create-table-anon`) |
| 3 — mutation gates to `/auth/sign-in` | Web | opencheck | [`tests/opencheck/tests.yaml`](../../opencheck/tests.yaml) (case `#add-row-redirects-to-auth`) |
| 4 — mock-IdP sign-in, pre-filled prompt preserved | Web | opencheck | [`tests/opencheck/tests.yaml`](../../opencheck/tests.yaml) (cases `#mock-sign-in`, `#authed-state-preserved`) |
| 5 — plain HTML embed: same snippet boots in a browser | Examples | Playwright via shared harness | [`examples/html/e2e/smoke.spec.ts`](../../../examples/html/e2e/smoke.spec.ts) |
| 5 — Svelte 5 (runes) via the typed `@nlqdb/svelte` wrapper — smallest mental model for a first-timer | Examples | Playwright via shared harness | [`examples/svelte/e2e/smoke.spec.ts`](../../../examples/svelte/e2e/smoke.spec.ts) |

## GLOBALs this journey verifies end-to-end

- **GLOBAL-007** (no login wall before first value) — the table render is anonymous.
- **GLOBAL-017** (one way to do each thing) — Ctrl+G, then chat. No alternate "create table" wizard.
- **GLOBAL-020** (zero-config first 60s) — no region picker, no config file in the anon flow.
- **GLOBAL-019** (open-source core) — the HTML example loads `elements.nlqdb.com/v1.js`, the public CDN; no proprietary SDK needed.

## How to run just this persona

```bash
gh workflow run e2e-opencheck.yml
gh workflow run e2e-examples.yml
```
