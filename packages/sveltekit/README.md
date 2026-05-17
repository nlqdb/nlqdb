# @nlqdb/sveltekit

SvelteKit helpers around [`@nlqdb/svelte`](../svelte) and [`@nlqdb/sdk`](../sdk).

## Install

```sh
bun add @nlqdb/sveltekit @nlqdb/svelte @nlqdb/elements
```

## Usage

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { NlqHead } from "@nlqdb/sveltekit";
</script>

<NlqHead />
<slot />
```

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
  import { NlqData } from "@nlqdb/sveltekit";
  import { env } from "$env/dynamic/public";
</script>

<NlqData
  goal="today's revenue by drink"
  apiKey={env.PUBLIC_NLQDB_KEY}
  template="table"
  refresh="60s"
/>
```

## Server-side fetch

`/server` is the only entry that imports `@nlqdb/sdk`. Use it from `+page.server.ts` / `+layout.server.ts` so the `sk_live_*` key stays off the wire:

```ts
// src/routes/dashboard/+page.server.ts
import { nlqdbLoad } from "@nlqdb/sveltekit/server";

export async function load({ fetch }) {
  const ask = await nlqdbLoad({ goal: "weekly signups by referrer" }, { fetch });
  return { ask };
}
```

`event.fetch` is forwarded so SvelteKit's same-origin cookie passthrough works in dev.
