# @nlqdb/nuxt

Nuxt 4 module for [`<nlq-data>`](../elements). Auto-injects the elements CDN, registers `<NlqData>` as a global component, wires `compilerOptions.isCustomElement`, and exposes `useNlq()`.

## Install

```sh
bun add @nlqdb/nuxt @nlqdb/vue @nlqdb/elements
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["@nlqdb/nuxt"],
  nlqdb: {
    publishableKey: process.env.NLQDB_PK!,
  },
});
```

## Usage

```vue
<!-- pages/index.vue -->
<script setup lang="ts">
// `publishableKey` is a browser-safe `pk_live_*` — safe to bind into markup.
const key = useRuntimeConfig().public.nlqdb.publishableKey;
</script>

<template>
  <NlqData
    goal="today's revenue by drink"
    :api-key="key"
    template="table"
    refresh="60s"
    @load="({ rows, cached }) => console.info(rows, cached)"
  />

  <form id="order-form">
    <input name="customer" />
    <NlqAction goal="log this order" :api-key="key" form="order-form">Submit</NlqAction>
  </form>
</template>
```

Both `<NlqData>` and `<NlqAction>` are auto-imported. The publishable key is read from `runtimeConfig.public.nlqdb.publishableKey` (set in `nuxt.config.ts`) and bound with `:api-key`; the components don't read it implicitly, so the binding is required.

### `useNlq()` composable

```vue
<script setup lang="ts">
const { data, error } = await useNlq("top 5 most-loved coffee shops in Berlin");
</script>
```

`useNlq()` wraps `@nlqdb/sdk`'s `client.ask()` in Nuxt's `useAsyncData`, so the response rides the SSR payload (no refetch on hydration) **and** inherits the SDK's retry, auto Idempotency-Key, and one-class `NlqdbApiError` (surfaced as `error.value`) — never a hand-rolled `fetch` (GLOBAL-001).

### SSR caveat

The elements bundle only runs on the client; the module injects it via `useHead` from a `mode: 'client'` plugin. Server-rendered markup contains the inert `<nlq-data>` tag, which upgrades after hydration. This matches the pattern documented in [nuxt#17263](https://github.com/nuxt/nuxt/discussions/17263).
