# @nlqdb/svelte

Svelte 5 wrapper for [`<nlq-data>`](../elements). Component uses runes (`$props`).

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
