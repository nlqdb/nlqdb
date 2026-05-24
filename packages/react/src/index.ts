// React 19 forwards primitive props to custom elements as attributes but does NOT bind
// `on*` props to non-standard DOM events — we attach listeners imperatively in an effect.

import type {
  NlqActionConfirmDetail,
  NlqActionErrorDetail,
  NlqActionSuccessDetail,
  NlqDataErrorDetail,
  NlqDataLoadDetail,
} from "@nlqdb/elements";
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
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  id?: string;
  ref?: Ref<HTMLElement>;
};

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
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  id?: string;
  ref?: Ref<HTMLElement>;
};

export function NlqAction(props: NlqActionProps) {
  const {
    goal,
    db,
    apiKey,
    endpoint,
    form,
    label,
    onSuccess,
    onConfirmRequired,
    onError,
    onSuccessAction,
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
    const successHandler = (e: Event) =>
      onSuccess?.((e as CustomEvent<NlqActionSuccessDetail>).detail);
    const confirmHandler = (e: Event) =>
      onConfirmRequired?.((e as CustomEvent<NlqActionConfirmDetail>).detail);
    const errorHandler = (e: Event) => onError?.((e as CustomEvent<NlqActionErrorDetail>).detail);
    if (onSuccess) el.addEventListener("nlq-action:success", successHandler);
    if (onConfirmRequired) el.addEventListener("nlq-action:confirm-required", confirmHandler);
    if (onError) el.addEventListener("nlq-action:error", errorHandler);
    return () => {
      el.removeEventListener("nlq-action:success", successHandler);
      el.removeEventListener("nlq-action:confirm-required", confirmHandler);
      el.removeEventListener("nlq-action:error", errorHandler);
    };
  }, [onSuccess, onConfirmRequired, onError]);

  const setRef = (node: HTMLElement | null) => {
    internal.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) (ref as { current: HTMLElement | null }).current = node;
  };

  return createElement(
    "nlq-action",
    {
      ref: setRef,
      goal,
      db,
      "api-key": apiKey,
      endpoint,
      form,
      label,
      "on-success": onSuccessAction,
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

export function NlqScript({ src = "https://elements.nlqdb.com/v1.js" }: NlqScriptProps = {}) {
  return createElement(Fragment, null, createElement("script", { type: "module", src }));
}

declare module "react" {
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
      "nlq-action": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
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
