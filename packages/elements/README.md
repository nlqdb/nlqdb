# @nlqdb/elements

`<nlq-data>` and (eventually) `<nlq-action>` custom elements — the
"drop one HTML tag, get a backend" surface from
[DESIGN §3.5](../../DESIGN.md) and [§14.5](../../DESIGN.md).

## What's in v0 (Slice 9)

- `<nlq-data>` custom element with `goal`, `db`, `query`, `api-key`,
  `template`, `refresh`, `data-demo` attributes.
- Three client-side templates: `table`, `list`, `kv`.
- `data-demo="…"` mode renders fixture data inline — no API call.
  Used by `apps/web` to dogfood the element on the marketing page
  while the live `/v1/ask` integration is still being built.
- Single-file ESM build at `dist/v1.js` for CDN distribution.

## What's NOT in v0 (Slice 10+)

- Live `/v1/ask` integration (`pk_live_*` Authorization, anonymous
  mode, refresh-driven polling against the API).
- `<nlq-action>` writes counterpart.
- Server-side template rendering (the `render: "html"` API path
  from DESIGN §3.5).
- `card-grid` and `chart` templates.
- SSE auto-upgrade.

## Usage

CDN script tag (third-party sites):

```html
<script src="https://elements.nlqdb.com/v1.js" type="module"></script>

<nlq-data data-demo="orders" template="table"></nlq-data>
```

Workspace import (Astro / Next / SolidStart inside this monorepo):

```ts
import "@nlqdb/elements";
```

The first import on a page registers `<nlq-data>` on
`customElements`; subsequent imports are a no-op.

## Local dev

```bash
bun run --cwd packages/elements typecheck
bun run --cwd packages/elements test
bun run --cwd packages/elements build      # produces dist/v1.js
```

## Bundle budget

DESIGN §3.5 caps the CDN bundle at < 6 KB gzipped. Verify after
build with `gzip -c dist/v1.js | wc -c`.
