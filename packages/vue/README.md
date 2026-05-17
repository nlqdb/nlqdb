# @nlqdb/vue

Vue 3.5 wrappers for [`<nlq-data>`](../elements) (reads) and [`<nlq-action>`](../elements) (writes with preview→Apply).

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

### Write — `<NlqAction>`

```vue
<template>
  <form id="order-form">
    <input name="customer" />
    <NlqAction
      goal="log this order"
      form="order-form"
      :api-key="apiKey"
      @confirm-required="({ diff }) => console.info('preview', diff)"
      @success="({ rowCount }) => console.info('committed', rowCount)"
      on-success-action="reload"
    >Submit order</NlqAction>
  </form>
</template>
```

### Direct tag form

`configureNlqdb(app)` also wires `compilerOptions.isCustomElement` so you can write the raw tags directly in templates:

```vue
<template>
  <nlq-data goal="…" api-key="pk_live_…" template="table"></nlq-data>
  <nlq-action goal="…" api-key="pk_live_…" form="order-form">Submit</nlq-action>
</template>
```

Pass `{ registerCustomElement: false }` to opt out of the compiler tweak (e.g. you've already configured it).

## Nuxt

`@nlqdb/vue` is consumed by [`@nlqdb/nuxt`](../nuxt); use the Nuxt module instead in Nuxt projects — it auto-imports `<NlqData>` and injects the elements bundle via `useHead`.
