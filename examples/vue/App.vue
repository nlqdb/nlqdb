<!--
  src/App.vue — Vite + Vue 3.5 SPA.

  The @nlqdb/vue wrapper gives <NlqData> a typed defineComponent with
  Vue-idiomatic `:api-key` bindings and `@load`/`@error` emits.

  This is the solo-builder's alternative to the Nuxt example: same
  framework family, smaller footprint, no SSR — useful when Maya wants
  to publish a static side-project on Netlify/Vercel/Cloudflare Pages
  without standing up a server.
-->

<script setup lang="ts">
import { NlqData, type NlqDataLoadDetail } from "@nlqdb/vue";

const apiKey = import.meta.env.VITE_NLQDB_KEY ?? "pk_live_REPLACE_ME";

function onLoad({ rows, cached }: NlqDataLoadDetail) {
  console.info("nlq-data loaded", { rows, cached });
}
</script>

<template>
  <main>
    <h1>Upcoming meals this week</h1>
    <NlqData
      goal="upcoming meals this week, soonest first"
      :api-key="apiKey"
      template="table"
      refresh="30s"
      @load="onLoad"
    />
  </main>
</template>
