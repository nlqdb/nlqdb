# @nlqdb/svelte

Svelte 5 wrappers for [`<nlq-data>`](../elements) (reads) and [`<nlq-action>`](../elements) (writes). Components use runes (`$props`).

## Install

```sh
bun add @nlqdb/svelte @nlqdb/elements
```

## Usage

```svelte
<script lang="ts">
  import { NlqData } from "@nlqdb/svelte";
</script>

<NlqData
  goal="today's revenue by drink"
  apiKey={import.meta.env.PUBLIC_NLQDB_KEY}
  template="table"
  refresh="60s"
  onload={({ rows, cached }) => console.info(rows, cached)}
/>
```

The component imports `@nlqdb/elements` on mount, so the bundle is only loaded once an `<NlqData>` actually renders. SSR-safe: the dynamic import is guarded by `typeof customElements !== "undefined"`.

### Event callbacks are lowercase (Svelte 5)

Per Svelte 5's event-attribute convention, the callback props are **lowercase**, not React's `onLoad`/`onError` camelCase. The full set:

| Component   | Callbacks |
|-------------|-----------|
| `<NlqData>`   | `onload`, `onerror` |
| `<NlqAction>` | `onsuccess`, `onconfirmRequired`, `onerror` |

`apiKey` stays camelCase (it's a data prop, not an event), and `onSuccessAction` is the post-write redirect config (e.g. `"reload"`), not an event callback.

## Write — `<NlqAction>`

```svelte
<script lang="ts">
  import { NlqAction } from "@nlqdb/svelte";
</script>

<form id="order-form">
  <input name="customer" />
  <NlqAction
    goal="log this order"
    form="order-form"
    apiKey={import.meta.env.PUBLIC_NLQDB_KEY}
    onsuccess={({ rowCount }) => console.info("committed", rowCount)}
    onSuccessAction="reload"
  >Submit order</NlqAction>
</form>
```

## SvelteKit

In SvelteKit projects use [`@nlqdb/sveltekit`](../sveltekit) — it adds a `<svelte:head>` helper for the CDN bundle and a `load()` helper for server-side fetches.

## Type augmentation for raw `<nlq-data>` tags

If you write the bare tag instead of `<NlqData>`, add this to `src/app.d.ts`:

```ts
import type { HTMLAttributes } from "svelte/elements";
declare module "svelte/elements" {
  interface SvelteHTMLElements {
    "nlq-data": HTMLAttributes<HTMLElement> & {
      goal?: string;
      db?: string;
      "api-key"?: string;
      template?: string;
      refresh?: string;
    };
  }
}
```
