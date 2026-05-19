# Plain HTML

The whole app is one file. No build step, no framework, no package manager.

## Step 0 — Get your key (60 seconds)

> **Pre-alpha:** every "do-work" call returns `403 feature_gated` until our free LLM chain clears BIRD ≥ 65% and Spider ≥ 75% ([`GLOBAL-027`](../../docs/decisions/GLOBAL-027-pre-alpha-gate.md)). Today it's closed. If you have an invite code, set `NLQDB_INVITE_CODE` before any call; everyone else lands on the [`Join the waitlist`](https://nlqdb.com/#waitlist) CTA below. Full surface table: [`docs.nlqdb.com/pre-alpha/`](https://docs.nlqdb.com/pre-alpha/).

The snippet below needs a `pk_live_` key scoped to your database. You don't generate one separately — the chat hands it to you, already inlined.

1. Open **[nlqdb.com](https://nlqdb.com)** and describe what you're building in one sentence (e.g. *"a personal book library — title, author, genre, rating, finished_at"*). Hit **Create the DB**.
2. The schema and a few sample rows render in place. Click **Open chat →**. First chat opens the sign-in screen (Google, GitHub, or magic link — no password). Sign-in is always free and requires no card — the free tier covers queries, embeds, and BYOLLM forever ([`GLOBAL-026`](../../docs/decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md)). It also adopts the anonymous DB you just created — same `dbId`, same data ([`SK-ANON-003`](../../docs/features/anonymous-mode/FEATURE.md)).
3. Ask anything against the DB. Next to any answer, click **Copy snippet**. The clipboard now contains the `<nlq-data>` block below with `api-key="pk_live_<dbId>"` already filled in ([`SK-WEB-007`](../../docs/features/web-app/FEATURE.md)).

Paste it into the HTML file in the next section and you're done.

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

1. Save the snippet above into an `index.html`. The `api-key` value should already be your real `pk_live_<dbId>` if you copied it from the chat per Step 0. Otherwise replace `pk_live_xxx` with the value from your chat's **Copy snippet** button.
2. Open `index.html` in a browser. The `<nlq-data>` pane fetches, renders the table, and starts refreshing on the cadence you set.

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
