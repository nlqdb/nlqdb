<script lang="ts">
import type {
  NlqActionConfirmDetail,
  NlqActionErrorDetail,
  NlqActionSuccessDetail,
} from "@nlqdb/elements";
import { onMount } from "svelte";

type Props = {
  goal?: string;
  db?: string;
  apiKey?: string;
  endpoint?: string;
  form?: string;
  label?: string;
  onSuccessAction?: "reload" | (string & {});
  onsuccess?: (d: NlqActionSuccessDetail) => void;
  onconfirmRequired?: (d: NlqActionConfirmDetail) => void;
  onerror?: (d: NlqActionErrorDetail) => void;
  children?: () => unknown;
};

let {
  goal,
  db,
  apiKey,
  endpoint,
  form,
  label,
  onSuccessAction,
  onsuccess,
  onconfirmRequired,
  onerror,
  children,
}: Props = $props();
let el: HTMLElement;

onMount(() => {
  if (typeof customElements !== "undefined" && !customElements.get("nlq-action")) {
    void import("@nlqdb/elements");
  }
  const success = (e: Event) => onsuccess?.((e as CustomEvent<NlqActionSuccessDetail>).detail);
  const confirm = (e: Event) =>
    onconfirmRequired?.((e as CustomEvent<NlqActionConfirmDetail>).detail);
  const error = (e: Event) => onerror?.((e as CustomEvent<NlqActionErrorDetail>).detail);
  el.addEventListener("nlq-action:success", success);
  el.addEventListener("nlq-action:confirm-required", confirm);
  el.addEventListener("nlq-action:error", error);
  return () => {
    el.removeEventListener("nlq-action:success", success);
    el.removeEventListener("nlq-action:confirm-required", confirm);
    el.removeEventListener("nlq-action:error", error);
  };
});
</script>

<nlq-action
  bind:this={el}
  {goal}
  {db}
  api-key={apiKey}
  {endpoint}
  {form}
  {label}
  on-success={onSuccessAction}
>
  {#if children}{@render children()}{/if}
</nlq-action>
