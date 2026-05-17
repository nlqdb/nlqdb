// Injects the elements CDN as a head script on every page. The
// guard around `customElements.get('nlq-data')` is the dedupe so
// client-side route transitions don't re-append the tag.

import type { AstroIntegration } from "astro";

export type NlqdbIntegrationOptions = {
  /** Override the CDN URL — self-host, preview deploys. */
  src?: string;
};

const DEFAULT_SRC = "https://elements.nlqdb.com/v1.js";

export function nlqdb(options: NlqdbIntegrationOptions = {}): AstroIntegration {
  const src = options.src ?? DEFAULT_SRC;
  return {
    name: "@nlqdb/astro",
    hooks: {
      "astro:config:setup": ({ injectScript }) => {
        injectScript(
          "page",
          `if (typeof customElements !== "undefined" && !customElements.get("nlq-data")) {
            const s = document.createElement("script");
            s.type = "module";
            s.src = ${JSON.stringify(src)};
            document.head.appendChild(s);
          }`,
        );
      },
    },
  };
}

export default nlqdb;
