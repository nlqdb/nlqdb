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
      title: "nlqdb",
      description: "A database you talk to. Documentation.",
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
