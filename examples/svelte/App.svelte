<!--
  src/App.svelte — Vite + Svelte 5 (runes mode).

  The @nlqdb/svelte wrapper hides the elements.nlqdb.com loader and
  gives <NlqData> Svelte 5's lowercase `onload` callback convention.

  This is the first-timer's entry point: a CS student who picked Svelte
  because it's "the framework with the smallest mental model" and wants
  to see real rows in the browser within a minute of `npm create vite`.
-->

<script lang="ts">
  import { NlqData, type NlqDataLoadDetail } from "@nlqdb/svelte";

  const apiKey = (import.meta.env.VITE_NLQDB_KEY as string) || "pk_live_REPLACE_ME";

  function handleLoad({ rows, cached }: NlqDataLoadDetail) {
    console.info("nlq-data loaded", { rows, cached });
  }
</script>

<main>
  <h1>Users in my first DB</h1>
  <NlqData
    goal="all users, newest first"
    {apiKey}
    template="table"
    refresh="60s"
    onload={handleLoad}
  />
</main>
