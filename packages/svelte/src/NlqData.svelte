<script lang="ts">
import type { NlqDataErrorDetail, NlqDataLoadDetail } from "@nlqdb/elements";
import { onMount } from "svelte";

type Props = {
  goal?: string;
  db?: string;
  query?: string;
  apiKey?: string;
  endpoint?: string;
  template?: "table" | "list" | "kv" | "card-grid" | (string & {});
  refresh?: string;
  model?: "auto" | "fast" | "best" | (string & {});
  onload?: (d: NlqDataLoadDetail) => void;
  onerror?: (d: NlqDataErrorDetail) => void;
};

let { goal, db, query, apiKey, endpoint, template, refresh, model, onload, onerror }: Props =
  $props();
let el: HTMLElement;

onMount(() => {
  if (typeof customElements !== "undefined" && !customElements.get("nlq-data")) {
    void import("@nlqdb/elements");
  }
  const loadHandler = (e: Event) => onload?.((e as CustomEvent<NlqDataLoadDetail>).detail);
  const errorHandler = (e: Event) => onerror?.((e as CustomEvent<NlqDataErrorDetail>).detail);
  el.addEventListener("nlq-data:load", loadHandler);
  el.addEventListener("nlq-data:error", errorHandler);
  return () => {
    el.removeEventListener("nlq-data:load", loadHandler);
    el.removeEventListener("nlq-data:error", errorHandler);
  };
});
</script>

<nlq-data
  bind:this={el}
  {goal}
  {db}
  {query}
  api-key={apiKey}
  {endpoint}
  {template}
  {refresh}
  {model}
></nlq-data>
