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
        { label: "Tutorials", autogenerate: { directory: "tutorials" } },
        {
          label: "Reference",
          items: [
            { label: "HTTP API", link: "/reference/http-api/" },
            { label: "SDK (TypeScript)", autogenerate: { directory: "reference/sdk" } },
          ],
        },
        { label: "MCP", link: "/mcp/" },
        { label: "CLI", link: "/cli/" },
      ],
    }),
  ],
});
