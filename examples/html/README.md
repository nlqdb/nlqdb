# Plain HTML

The whole app is one file. No build step, no framework, no package manager.

## The whole "backend"

```html
<script src="https://elements.nlqdb.com/v1.js" type="module"></script>

<nlq-data
  goal="the 5 newest orders, with customer and item"
  api-key="pk_live_xxx"
  template="table"
  refresh="10s"
></nlq-data>
```

That's the entire backend for a live order list. There is no API to write, no schema to define, no JSON to parse, no React to render. The element fetches, renders the table template, and refreshes every 10 seconds.

Every chat surface (web, CLI, MCP) offers a "Copy snippet" action next to any generated query; the copied HTML has the user's `pk_live_` already inlined. The key is right there, in the code the user was about to use.

## Writes (`<nlq-action>`)

```html
<form id="new-order">
  <input name="customer" />
  <input name="drink" />
  <input name="total" />
  <nlq-action
    goal="add an order from this form"
    db="orders"
    on-success="reset"
  >Submit</nlq-action>
</form>

<nlq-data id="orders-pane" db="orders" goal="the 5 newest orders" template="table"></nlq-data>
```

The form's field names are inferred into columns automatically. The first click previews the INSERT (verb · table · row count · plain-English summary); the second click commits. `on-success="reset"` clears the form; `on-success="refresh:#orders-pane"` re-fetches the sibling `<nlq-data>`.

## Run it

1. Replace `pk_live_REPLACE_ME` with your read-only key (from the chat's "Copy snippet" button on any query); the `<nlq-data>` pane will populate.
2. Open `index.html` in a browser. Done.

The `<nlq-action>` form authenticates via your same-origin `app.nlqdb.com`
session cookie ([`SK-ELEM-011`](../../docs/features/elements/decisions/SK-ELEM-011-action-cookie-session-only.md)) — sign in there once and the form works from any same-origin page. Cross-origin write-tokens are tracked in [`api-keys/FEATURE.md`](../../docs/features/api-keys/FEATURE.md) and ship in a follow-up slice.

Or serve it:

```bash
python3 -m http.server      # http://localhost:8000
# or
npx serve .
```

## Ship it

Drop the file on Cloudflare Pages, GitHub Pages, Netlify drop, S3, your own VPS — anywhere static HTML lives. There is no backend to deploy.

## Why it works

`<nlq-data>` and `<nlq-action>` are custom elements registered by `https://elements.nlqdb.com/v1.js`. They handle fetching, rendering, refresh, and the `on-success` lifecycle. Your form's field names (`customer`, `drink`, `total`) are inferred into columns automatically (`docs/architecture.md §3`).

This is exactly the `docs/architecture.md` §13 hello-world — the simplest possible nlqdb integration.
