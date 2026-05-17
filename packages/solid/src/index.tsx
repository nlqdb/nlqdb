// Solid sets attributes (not properties) for unknown tags, so plain
// JSX prop passthrough is the right shape. Listeners are attached
// imperatively because Solid's `on:` directive rejects event names
// that contain a colon.

import type { NlqDataErrorDetail, NlqDataLoadDetail } from "@nlqdb/elements";
import { type JSX, onCleanup, onMount } from "solid-js";

export type { NlqDataErrorDetail, NlqDataLoadDetail } from "@nlqdb/elements";

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
    }
  }
}
