// React 19 forwards primitive props to custom elements as attributes
// but does NOT bind `on*` props to non-standard DOM events — the
// onLoad/onError props attach listeners imperatively in an effect.
// https://react.dev/blog/2024/12/05/react-19 §"Support for Custom Elements".

import type { NlqDataErrorDetail, NlqDataLoadDetail } from "@nlqdb/elements";
import {
  type CSSProperties,
  createElement,
  type DetailedHTMLProps,
  Fragment,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
  useEffect,
  useRef,
} from "react";

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
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  id?: string;
  ref?: Ref<HTMLElement>;
};

// SSR-safe: no `customElements` on the server; the elements package
// itself is idempotent against double-define.
async function registerOnClient(): Promise<void> {
  if (typeof customElements === "undefined") return;
  if (customElements.get("nlq-data")) return;
  await import("@nlqdb/elements");
}

export function NlqData(props: NlqDataProps) {
  const {
    goal,
    db,
    query,
    apiKey,
    endpoint,
    template,
    refresh,
    onLoad,
    onError,
    children,
    className,
    style,
    id,
    ref,
  } = props;
  const internal = useRef<HTMLElement | null>(null);

  useEffect(() => {
    void registerOnClient();
  }, []);

  useEffect(() => {
    const el = internal.current;
    if (!el) return;
    const loadHandler = (e: Event) => onLoad?.((e as CustomEvent<NlqDataLoadDetail>).detail);
    const errorHandler = (e: Event) => onError?.((e as CustomEvent<NlqDataErrorDetail>).detail);
    if (onLoad) el.addEventListener("nlq-data:load", loadHandler);
    if (onError) el.addEventListener("nlq-data:error", errorHandler);
    return () => {
      el.removeEventListener("nlq-data:load", loadHandler);
      el.removeEventListener("nlq-data:error", errorHandler);
    };
  }, [onLoad, onError]);

  const setRef = (node: HTMLElement | null) => {
    internal.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) (ref as { current: HTMLElement | null }).current = node;
  };

  return createElement(
    "nlq-data",
    {
      ref: setRef,
      goal,
      db,
      query,
      "api-key": apiKey,
      endpoint,
      template,
      refresh,
      class: className,
      style,
      id,
    },
    children,
  );
}

export type NlqScriptProps = {
  src?: string;
};

// Drop into a root layout to load the elements CDN bundle. Use the
// framework-specific re-export (`@nlqdb/next/NlqScript`) where one
// exists — it picks the right loading strategy for that framework.
export function NlqScript({ src = "https://elements.nlqdb.com/v1.js" }: NlqScriptProps = {}) {
  return createElement(Fragment, null, createElement("script", { type: "module", src }));
}

declare module "react" {
  // biome-ignore lint/style/useNamingConvention: JSX namespace name is fixed by React.
  namespace JSX {
    interface IntrinsicElements {
      "nlq-data": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
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
