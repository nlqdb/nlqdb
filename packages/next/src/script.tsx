// `afterInteractive` so the bundle loads after hydration and
// upgrades any inert <nlq-data> tag the server rendered, without
// blocking first paint.

import Script from "next/script";

export type NlqScriptProps = {
  src?: string;
  strategy?: "afterInteractive" | "lazyOnload" | "beforeInteractive";
};

export function NlqScript({
  src = "https://elements.nlqdb.com/v1.js",
  strategy = "afterInteractive",
}: NlqScriptProps = {}) {
  return <Script src={src} strategy={strategy} type="module" />;
}
