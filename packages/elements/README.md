# @nlqdb/elements

`<nlq-data>` and (eventually) `<nlq-action>` custom elements — the
"drop one HTML tag, get a backend" surface from
[DESIGN §3.5](../../DESIGN.md) and [§14.5](../../DESIGN.md).

## What's in v0.1 (Slice 10)

- `<nlq-data>` custom element with `goal`, `db`, `query`, `api-key`,
  `endpoint`, `template`, `refresh` attributes.
- Live `POST /v1/ask` integration. Default endpoint
  `https://app.nlqdb.com/v1/ask`; override with the `endpoint` attr
  for self-hosted / preview deploys.
- Three client-side templates: `table`, `list`, `kv`.
- Single-file ESM build at `dist/v1.js` for CDN distribution.
- Events: `nlq-data:load` on success, `nlq-data:error` on failure
  (network / auth / api). Both bubble + compose.

## What's NOT in v0.1 (Slice 11+)

- `pk_live_*` publishable keys (origin-pinned, rate-limited). Today
  the element sends the `api-key` attribute as `Authorization: Bearer`
  and relies on `credentials: include` for cookie sessions; the API
  ignores the Bearer header until Slice 11.
- `<nlq-action>` writes counterpart.
- Server-side template rendering (the `render: "html"` API path
  from DESIGN §3.5).
- `card-grid` and `chart` templates.
- SSE auto-upgrade.

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

The first import on a page registers `<nlq-data>` on
`customElements`; subsequent imports are a no-op.

### Events

```js
document.querySelector("nlq-data").addEventListener("nlq-data:load", (e) => {
  // e.detail = { rows: number, cached: boolean }
});
document.querySelector("nlq-data").addEventListener("nlq-data:error", (e) => {
  // e.detail.kind = "network" | "auth" | "api"
});
```

## Local dev

```bash
bun run --cwd packages/elements typecheck
bun run --cwd packages/elements test
bun run --cwd packages/elements build      # produces dist/v1.js
```

## Bundle budget

DESIGN §3.5 caps the CDN bundle at < 6 KB gzipped. Verify after
build with `gzip -c dist/v1.js | wc -c`. CI fails the build if the
gzipped size reaches 6144 bytes.
