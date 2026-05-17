# @nlqdb/elements

`<nlq-data>` (reads) and `<nlq-action>` (writes) custom elements — the
"drop one HTML tag, get a backend" surface from
[`docs/architecture.md §3`](../../docs/architecture.md) and [`docs/features/elements/FEATURE.md`](../../docs/features/elements/FEATURE.md).

## What ships today

### `<nlq-data>` (Slice 10)

- Attributes: `goal`, `db`, `query`, `api-key`, `endpoint`, `template`,
  `refresh`.
- Live `POST /v1/ask` integration. Default endpoint
  `https://app.nlqdb.com/v1/ask`; override with `endpoint=` for
  self-hosted / preview deploys.
- Three client-side templates: `table`, `list`, `kv`.
- Public `el.refresh()` for imperative reload.
- Events: `nlq-data:load` (success), `nlq-data:error` (`network` /
  `auth` / `api`). Both bubble + compose.

### `<nlq-action>` (this slice — Phase 2)

- Attributes: `goal`, `db`, `api-key`, `endpoint`, `form`, `label`,
  `on-success`.
- Click → preview hop (`POST /v1/ask`, no `confirm`) → renders the
  diff (verb · table · row count · summary) with Cancel + Apply
  buttons. Apply commits with `confirm: true`.
  ([`SK-ELEM-012`](../../docs/features/elements/decisions/SK-ELEM-012-action-two-click-commit.md),
  [`SK-TRUST-001`](../../docs/features/trust-ux/FEATURE.md))
- Form data is collected from the closest `<form>` ancestor (or
  `form="<id>"`) and appended to the goal text — no `/v1/ask` shape
  change ([`SK-ELEM-013`](../../docs/features/elements/decisions/SK-ELEM-013-action-form-context-in-goal.md)).
- Events: `nlq-action:confirm-required` (preview hop done),
  `nlq-action:success` (commit succeeded), `nlq-action:error`
  (`network` / `auth` / `api`).
- `on-success`: `reset` resets the associated form; `reload` reloads
  the page; `refresh:<selector>` calls `.refresh()` on every element
  matching the selector (typically a sibling `<nlq-data>`).

Both elements default to `aria-live="polite"` on the host so state
transitions are announced; opt out by setting your own value.

## Authentication

| Element        | Auth in v0.1                                              |
| :------------- | :-------------------------------------------------------- |
| `<nlq-data>`   | `pk_live_*` (forward-compat) **or** same-origin cookie session. Cross-origin `pk_live_*` 401s until Slice 11 lands issuance. |
| `<nlq-action>` | Same-origin cookie session only. `api-key=` is honoured forward-compat but `pk_live_*` is read-only ([`SK-APIKEYS-003`](../../docs/features/api-keys/decisions/SK-APIKEYS-003-pk-live-readonly.md)) and will 401 against the write path. Cross-origin write-token deferred ([`SK-ELEM-011`](../../docs/features/elements/decisions/SK-ELEM-011-action-cookie-session-only.md)). |

> [!WARNING]
> Never bind `endpoint=` to user-controlled input (URL params, CMS
> fields, etc.). The element sends your `api-key` as `Authorization:
> Bearer …` to whatever URL the attribute resolves to. The element
> warns to console when an api-key is sent over plain http, but only
> the developer can prevent injection.

## What's NOT in v0.1

- `pk_live_*` publishable key issuance + origin-pinning (Slice 11).
- `<nlq-action>` cross-origin write-token (deferred — see
  [`api-keys/FEATURE.md`](../../docs/features/api-keys/FEATURE.md)
  open question).
- `<nlq-action>` file inputs (multipart upload is its own slice).
- Server-side template rendering (the `render: "html"` API path
  from `docs/architecture.md §3`).
- `card-grid` and `chart` templates.
- SSE auto-upgrade.
- Error backoff during refresh polling (today: hammers at the
  configured cadence regardless of failure).

## Usage

CDN script tag (third-party sites):

```html
<script src="https://elements.nlqdb.com/v1.js" type="module"></script>

<nlq-data
  goal="the 5 most-loved coffee shops in Berlin"
  db="coffee"
  api-key="pk_live_..."
  template="table"
  refresh="60s"
></nlq-data>
```

Workspace import (Astro / Next / SolidStart inside this monorepo):

```ts
import "@nlqdb/elements";
```

The first import on a page registers `<nlq-data>` and `<nlq-action>`
on `customElements`; subsequent imports are a no-op.

### `<nlq-action>` example

```html
<form id="new-order">
  <input name="customer" required />
  <input name="drink" required />
  <input name="total" required />
  <nlq-action
    goal="add an order from this form"
    db="orders"
    on-success="reset"
  >Submit</nlq-action>
</form>

<nlq-data id="orders-pane" db="orders" goal="the 5 newest orders" template="table"></nlq-data>
```

To refresh the data pane after a successful write, use
`on-success="refresh:#orders-pane"` instead of `reset`.

### Events

```js
const data = document.querySelector("nlq-data");
data.addEventListener("nlq-data:load", (e) => {
  // e.detail = { rows: number, cached: boolean }
});
data.addEventListener("nlq-data:error", (e) => {
  // e.detail.kind = "network" | "auth" | "api"
});

const action = document.querySelector("nlq-action");
action.addEventListener("nlq-action:confirm-required", (e) => {
  // e.detail.diff = { verb, table, affectedRows, summary }
});
action.addEventListener("nlq-action:success", (e) => {
  // e.detail = { rowCount, diff }
});
action.addEventListener("nlq-action:error", (e) => {
  // e.detail.kind = "network" | "auth" | "api"
});
```

### Imperative reload

```js
document.querySelector("nlq-data").refresh();
```

Coalesces with any pending attribute change (one fetch per microtask).

## Local dev

```bash
bun run --cwd packages/elements typecheck
bun run --cwd packages/elements test
bun run --cwd packages/elements build      # produces dist/v1.js
```

## Bundle budget

`docs/architecture.md §3` caps the CDN bundle at < 6 KB gzipped. Verify after
build with `gzip -c dist/v1.js | wc -c`. CI fails the build if the
gzipped size reaches 6144 bytes.
