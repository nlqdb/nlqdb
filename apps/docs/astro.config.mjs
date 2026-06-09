import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

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
      sidebar: [
        // GLOBAL-027 — pinned first so visitors see the gate state before they paste a snippet.
        {
          label: "Pre-alpha access",
          link: "/pre-alpha/",
          badge: { text: "gated", variant: "caution" },
        },
        { label: "Tutorials", items: [{ autogenerate: { directory: "tutorials" } }] },
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
      ],
    }),
  ],
});
