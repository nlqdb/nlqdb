# @nlqdb/vue

Vue 3.5 wrapper for [`<nlq-data>`](../elements).

## Install

```sh
bun add @nlqdb/vue @nlqdb/elements
```

## Usage

```ts
// main.ts
import { createApp } from "vue";
import { configureNlqdb } from "@nlqdb/vue";
import App from "./App.vue";

const app = createApp(App);
configureNlqdb(app);
app.mount("#app");
```

```vue
<!-- App.vue -->
<script setup lang="ts">
import { NlqData } from "@nlqdb/vue";
const apiKey = import.meta.env.VITE_NLQDB_KEY;
</script>

<template>
  <NlqData
    goal="today's revenue by drink"
    :api-key="apiKey"
    template="table"
    refresh="60s"
    @load="({ rows, cached }) => console.info(rows, cached)"
    @error="(err) => console.error(err)"
  />
</template>
```

### Direct tag form

`configureNlqdb(app)` also wires `compilerOptions.isCustomElement` so you can write `<nlq-data>` directly in templates without the Vue compiler warning:

```vue
<template>
  <nlq-data goal="…" api-key="pk_live_…" template="table"></nlq-data>
</template>
```

Pass `{ registerCustomElement: false }` to opt out of the compiler tweak (e.g. you've already configured it).

## Nuxt

`@nlqdb/vue` is consumed by [`@nlqdb/nuxt`](../nuxt); use the Nuxt module instead in Nuxt projects — it auto-imports `<NlqData>` and injects the elements bundle via `useHead`.
