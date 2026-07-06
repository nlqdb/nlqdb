// `configureNlqdb(app)` flips `isCustomElement` so raw `<nlq-data>` tags don't warn.

import type {
  NlqActionConfirmDetail,
  NlqActionErrorDetail,
  NlqActionSuccessDetail,
  NlqDataErrorDetail,
  NlqDataLoadDetail,
} from "@nlqdb/elements";
import { type App, defineComponent, h, onBeforeUnmount, onMounted, type PropType, ref } from "vue";

export type {
  NlqActionConfirmDetail,
  NlqActionErrorDetail,
  NlqActionSuccessDetail,
  NlqDataErrorDetail,
  NlqDataLoadDetail,
} from "@nlqdb/elements";

export type NlqDataTemplate = "table" | "list" | "kv" | "card-grid" | (string & {});

async function registerOnClient(): Promise<void> {
  if (typeof customElements === "undefined") return;
  if (customElements.get("nlq-data")) return;
  await import("@nlqdb/elements");
}

/** Read component — renders `<nlq-data>` (a goal/query → rows view). Props are camelCase (`apiKey`); events are `@load` / `@error`. */
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
    model: String as PropType<"auto" | "fast" | "best" | (string & {})>,
  },
  emits: {
    // Vue's typed-emit validator must return truthy; the parameter shapes the template payload.
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
          model: props.model,
        },
        slots["default"]?.(),
      );
  },
});

/** Write component — renders `<nlq-action>` with the preview→Apply diff hop. Events: `@success` / `@confirm-required` / `@error`. */
export const NlqAction = defineComponent({
  name: "NlqAction",
  props: {
    goal: String,
    db: String,
    apiKey: String,
    endpoint: String,
    form: String,
    label: String,
    onSuccessAction: String,
  },
  emits: {
    success: (_d: NlqActionSuccessDetail) => true,
    confirmRequired: (_d: NlqActionConfirmDetail) => true,
    error: (_d: NlqActionErrorDetail) => true,
  },
  setup(props, { emit, slots }) {
    const el = ref<HTMLElement | null>(null);
    const onSuccess = (e: Event) =>
      emit("success", (e as CustomEvent<NlqActionSuccessDetail>).detail);
    const onConfirm = (e: Event) =>
      emit("confirmRequired", (e as CustomEvent<NlqActionConfirmDetail>).detail);
    const onError = (e: Event) => emit("error", (e as CustomEvent<NlqActionErrorDetail>).detail);
    onMounted(() => {
      void registerOnClient();
      el.value?.addEventListener("nlq-action:success", onSuccess);
      el.value?.addEventListener("nlq-action:confirm-required", onConfirm);
      el.value?.addEventListener("nlq-action:error", onError);
    });
    onBeforeUnmount(() => {
      el.value?.removeEventListener("nlq-action:success", onSuccess);
      el.value?.removeEventListener("nlq-action:confirm-required", onConfirm);
      el.value?.removeEventListener("nlq-action:error", onError);
    });
    return () =>
      h(
        "nlq-action",
        {
          ref: el,
          goal: props.goal,
          db: props.db,
          "api-key": props.apiKey,
          endpoint: props.endpoint,
          form: props.form,
          label: props.label,
          "on-success": props.onSuccessAction,
        },
        slots["default"]?.(),
      );
  },
});

/** Plugin install — registers `<NlqData>` / `<NlqAction>` globally and flips `isCustomElement` so raw `<nlq-*>` tags don't warn. Call once on the app. */
export function configureNlqdb(app: App, opts: { registerCustomElement?: boolean } = {}): void {
  const registerCustomElement = opts.registerCustomElement ?? true;
  if (registerCustomElement) {
    const prev = app.config.compilerOptions.isCustomElement;
    app.config.compilerOptions.isCustomElement = (tag: string) =>
      tag === "nlq-data" || tag === "nlq-action" || (prev?.(tag) ?? false);
  }
  app.component("NlqData", NlqData);
  app.component("NlqAction", NlqAction);
}

declare module "vue" {
  interface GlobalComponents {
    NlqData: typeof NlqData;
    NlqAction: typeof NlqAction;
  }
}
