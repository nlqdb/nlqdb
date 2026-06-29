import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightLlmsTxt from "starlight-llms-txt";

export default defineConfig({
  site: "https://docs.nlqdb.com",
  integrations: [
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
