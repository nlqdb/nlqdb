// Two surfaces: the `<NlqData>` Vue component (typed props + emits)
// for embedders who want autocomplete, and `configureNlqdb(app)` to
// flip `isCustomElement` so raw `<nlq-data>` tags don't trigger Vue's
// unknown-component warning.

import type { NlqDataErrorDetail, NlqDataLoadDetail } from "@nlqdb/elements";
import { type App, defineComponent, h, onBeforeUnmount, onMounted, type PropType, ref } from "vue";

export type { NlqDataErrorDetail, NlqDataLoadDetail } from "@nlqdb/elements";

export type NlqDataTemplate = "table" | "list" | "kv" | "card-grid" | (string & {});

async function registerOnClient(): Promise<void> {
  if (typeof customElements === "undefined") return;
  if (customElements.get("nlq-data")) return;
  await import("@nlqdb/elements");
}

export const NlqData = defineComponent({
  name: "NlqData",
  props: {
    goal: String,
    db: String,
    query: String,
    apiKey: String,
    endpoint: String,
    template: String as PropType<NlqDataTemplate>,
    refresh: String,
  },
  emits: {
    // Vue's typed-emit runtime requires returning a truthy value;
    // the parameter exists so the payload type flows into templates.
    load: (_d: NlqDataLoadDetail) => true,
    error: (_d: NlqDataErrorDetail) => true,
  },
  setup(props, { emit, slots }) {
    const el = ref<HTMLElement | null>(null);
    const onLoad = (e: Event) => emit("load", (e as CustomEvent<NlqDataLoadDetail>).detail);
    const onError = (e: Event) => emit("error", (e as CustomEvent<NlqDataErrorDetail>).detail);
    onMounted(() => {
      void registerOnClient();
      el.value?.addEventListener("nlq-data:load", onLoad);
      el.value?.addEventListener("nlq-data:error", onError);
    });
    onBeforeUnmount(() => {
      el.value?.removeEventListener("nlq-data:load", onLoad);
      el.value?.removeEventListener("nlq-data:error", onError);
    });
    return () =>
      h(
        "nlq-data",
        {
          ref: el,
          goal: props.goal,
          db: props.db,
          query: props.query,
          "api-key": props.apiKey,
          endpoint: props.endpoint,
          template: props.template,
          refresh: props.refresh,
        },
        slots["default"]?.(),
      );
  },
});

export function configureNlqdb(app: App, opts: { registerCustomElement?: boolean } = {}): void {
  const registerCustomElement = opts.registerCustomElement ?? true;
  if (registerCustomElement) {
    const prev = app.config.compilerOptions.isCustomElement;
    app.config.compilerOptions.isCustomElement = (tag: string) =>
      tag === "nlq-data" || (prev?.(tag) ?? false);
  }
  app.component("NlqData", NlqData);
}

declare module "vue" {
  interface GlobalComponents {
    NlqData: typeof NlqData;
  }
}
