// Listeners attach imperatively — Solid's `on:` directive rejects event names with a colon.

import type {
  NlqActionConfirmDetail,
  NlqActionErrorDetail,
  NlqActionSuccessDetail,
  NlqDataErrorDetail,
  NlqDataLoadDetail,
} from "@nlqdb/elements";
import { type JSX, onCleanup, onMount } from "solid-js";

export type {
  NlqActionConfirmDetail,
  NlqActionErrorDetail,
  NlqActionSuccessDetail,
  NlqDataErrorDetail,
  NlqDataLoadDetail,
} from "@nlqdb/elements";

export type NlqDataTemplate = "table" | "list" | "kv" | "card-grid" | (string & {});

export type NlqDataProps = {
  goal?: string;
  db?: string;
  query?: string;
  apiKey?: string;
  endpoint?: string;
  template?: NlqDataTemplate;
  refresh?: string;
  onLoad?: (detail: NlqDataLoadDetail) => void;
  onError?: (detail: NlqDataErrorDetail) => void;
  children?: JSX.Element;
};

async function registerOnClient(): Promise<void> {
  if (typeof customElements === "undefined") return;
  if (customElements.get("nlq-data")) return;
  await import("@nlqdb/elements");
}

/** Read component — renders `<nlq-data>` (a goal/query → rows view). Props are camelCase (`apiKey`); events are `onLoad` / `onError`. */
export function NlqData(props: NlqDataProps): JSX.Element {
  let ref: HTMLElement | undefined;
  onMount(() => {
    void registerOnClient();
    if (!ref) return;
    const onLoadHandler = (e: Event) =>
      props.onLoad?.((e as CustomEvent<NlqDataLoadDetail>).detail);
    const onErrorHandler = (e: Event) =>
      props.onError?.((e as CustomEvent<NlqDataErrorDetail>).detail);
    ref.addEventListener("nlq-data:load", onLoadHandler);
    ref.addEventListener("nlq-data:error", onErrorHandler);
    onCleanup(() => {
      ref?.removeEventListener("nlq-data:load", onLoadHandler);
      ref?.removeEventListener("nlq-data:error", onErrorHandler);
    });
  });

  return (
    <nlq-data
      ref={ref}
      goal={props.goal}
      db={props.db}
      query={props.query}
      api-key={props.apiKey}
      endpoint={props.endpoint}
      template={props.template}
      refresh={props.refresh}
    >
      {props.children}
    </nlq-data>
  );
}

export type NlqActionProps = {
  goal?: string;
  db?: string;
  apiKey?: string;
  endpoint?: string;
  form?: string;
  label?: string;
  onSuccess?: (detail: NlqActionSuccessDetail) => void;
  onConfirmRequired?: (detail: NlqActionConfirmDetail) => void;
  onError?: (detail: NlqActionErrorDetail) => void;
  onSuccessAction?: "reload" | (string & {});
  children?: JSX.Element;
};

/** Write component — renders `<nlq-action>` with the preview→Apply diff hop. Events: `onSuccess` / `onConfirmRequired` / `onError`. */
export function NlqAction(props: NlqActionProps): JSX.Element {
  let ref: HTMLElement | undefined;
  onMount(() => {
    void registerOnClient();
    if (!ref) return;
    const success = (e: Event) =>
      props.onSuccess?.((e as CustomEvent<NlqActionSuccessDetail>).detail);
    const confirm = (e: Event) =>
      props.onConfirmRequired?.((e as CustomEvent<NlqActionConfirmDetail>).detail);
    const error = (e: Event) => props.onError?.((e as CustomEvent<NlqActionErrorDetail>).detail);
    ref.addEventListener("nlq-action:success", success);
    ref.addEventListener("nlq-action:confirm-required", confirm);
    ref.addEventListener("nlq-action:error", error);
    onCleanup(() => {
      ref?.removeEventListener("nlq-action:success", success);
      ref?.removeEventListener("nlq-action:confirm-required", confirm);
      ref?.removeEventListener("nlq-action:error", error);
    });
  });

  return (
    <nlq-action
      ref={ref}
      goal={props.goal}
      db={props.db}
      api-key={props.apiKey}
      endpoint={props.endpoint}
      form={props.form}
      label={props.label}
      on-success={props.onSuccessAction}
    >
      {props.children}
    </nlq-action>
  );
}

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      "nlq-data": JSX.HTMLAttributes<HTMLElement> & {
        goal?: string;
        db?: string;
        query?: string;
        "api-key"?: string;
        endpoint?: string;
        template?: string;
        refresh?: string;
      };
      "nlq-action": JSX.HTMLAttributes<HTMLElement> & {
        goal?: string;
        db?: string;
        "api-key"?: string;
        endpoint?: string;
        form?: string;
        label?: string;
        "on-success"?: string;
      };
    }
  }
}
