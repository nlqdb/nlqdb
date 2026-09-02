import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightLlmsTxt from "starlight-llms-txt";

// SK-GTM-007 — the docs host captures no first touch of its own
// (`localStorage` is per-origin) and the apex discards a `*.nlqdb.com`
// referrer as internal, so the channel has to ride the URL across the hop.
// `injectScript("page", …)` is Vite-processed, so it can import the typed,
// unit-tested module; Starlight's own reference calls a `Head` override,
// the other way to ship this, "a last resort".
const channelForward = {
  name: "nlqdb-channel-forward",
  hooks: {
    "astro:config:setup": ({ injectScript }) =>
      injectScript(
        "page",
        'import { applyChannelForwarding } from "/src/channel-forward.ts"; applyChannelForwarding();',
      ),
  },
};

export default defineConfig({
  site: "https://docs.nlqdb.com",
  integrations: [
    channelForward,
    starlight({
      title: "nlqdb docs",
      description:
        "Documentation for nlqdb, a database you talk to: quickstarts, the @nlqdb/sdk TypeScript reference, the HTTP API, MCP setup, the nlq CLI, and framework wrappers.",
      // Starlight emits og:title / og:type / og:url / og:description by default
      // but never og:image — one of the four required Open Graph tags — so every
      // page reads as an incomplete OG card in social/SEO crawlers. Inject a
      // single site-wide card (absolute URL, matching apps/web's og-default.png
      // per GLOBAL-017) plus twitter:image. Static PNG in public/, no build-time
      // rasteriser on the free-tier path (GLOBAL-013).
      head: [
        {
          tag: "meta",
          attrs: { property: "og:image", content: "https://docs.nlqdb.com/og-default.png" },
        },
        { tag: "meta", attrs: { property: "og:image:width", content: "1200" } },
        { tag: "meta", attrs: { property: "og:image:height", content: "630" } },
        { tag: "meta", attrs: { property: "og:image:type", content: "image/png" } },
        {
          tag: "meta",
          attrs: { property: "og:image:alt", content: "nlqdb — a database you talk to." },
        },
        {
          tag: "meta",
          attrs: { name: "twitter:image", content: "https://docs.nlqdb.com/og-default.png" },
        },
        {
          tag: "meta",
          attrs: { name: "twitter:image:alt", content: "nlqdb — a database you talk to." },
        },
      ],
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/nlqdb/nlqdb" }],
      editLink: {
        baseUrl: "https://github.com/nlqdb/nlqdb/edit/main/apps/docs/",
      },
      // WS06-T3 — self-describing machine index for agents that land on
      // docs.nlqdb.com. Emits /llms.txt, /llms-full.txt, /llms-small.txt
      // at build time (starlight-llms-txt, llmstxt.org spec). The
      // marketing /llms.txt (apps/web) links here.
      plugins: [
        starlightLlmsTxt({
          projectName: "nlqdb",
          description:
            "A database you talk to. Create one in plain English; query it in English via the <nlq-data> HTML element, the @nlqdb/sdk client, the nlq CLI, an MCP server (mcp.nlqdb.com), or POST /v1/ask. The schema, engine, indexes, and backups stay invisible unless you ask to see them.",
          details: "Free chain forever, bring-your-own-LLM at 0% markup.",
          optionalLinks: [
            { label: "Marketing site", url: "https://nlqdb.com" },
            { label: "GitHub", url: "https://github.com/nlqdb/nlqdb" },
          ],
        }),
      ],
      sidebar: [
        { label: "Give your agent memory", link: "/agent-memory/" },
        { label: "Tutorials", items: [{ autogenerate: { directory: "tutorials" } }] },
        { label: "SDK", link: "/sdk/" },
        { label: "Framework wrappers", link: "/frameworks/" },
        {
          label: "Reference",
          items: [
            { label: "HTTP API", link: "/reference/http-api/" },
            {
              label: "SDK (TypeScript)",
              items: [{ autogenerate: { directory: "reference/sdk" } }],
            },
          ],
        },
        { label: "MCP", link: "/mcp/" },
        { label: "CLI", link: "/cli/" },
        { label: "Security", link: "/security/" },
      ],
    }),
  ],
});
