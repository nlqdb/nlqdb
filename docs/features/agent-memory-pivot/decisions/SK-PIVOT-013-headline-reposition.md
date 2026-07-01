# SK-PIVOT-013 — The lead string is "Analytical memory for AI agents"; the WS-13 founder gate tripped 2026-06-24

- **Decision:** The sitewide lead identity now leads with the agent-memory
  wedge. Canonical lede: **"Analytical memory for AI agents."**, with the
  support clause *"a real database your agent connects to over MCP and queries
  in English — `GROUP BY`, `JOIN`, aggregate over what it remembered, not just
  the top-k a vector store recalls."* The four gated lead strings (Hero lede,
  `README` H1 + tagline, `llms.txt` lede, root `package.json` description +
  homepage `<title>` / `SoftwareApplication` JSON-LD description) are swapped
  to this consistently. The generalist umbrella stays one click away — the
  hero `<CreateForm>` input is untouched (SK-WEB-002), and the `AlsoWorksFor`
  fold + every off-wedge `/vs`/`/solve` page + an "also a natural-language
  database for any app" line keep the GLOBAL-036 dual front door intact.
- **Core value:** Goal-first, Creative, Honest latency
- **Why:** WS-13 was the founder-gated final slice. The founder tripped the
  gate on 2026-06-24: the wedge content (`/agents`, the capability matrix, 10
  memory `/vs` pages, the live demo) is all live, so the brand bet is backed by
  real surface. Leading on the true moat — analytical SQL over structured
  memory + the typed-plan trust boundary, reached over MCP — focuses the brand
  on the one adjacent category the funded incumbents can't enter without
  rebuilding their storage layer.
- **Consequence in code:** `Hero.astro` lede/sub, `README.md` H1+tagline+intro,
  `llms.txt.ts` lede + surfaces clause, `index.astro` `<title>`+description
  (drives the homepage JSON-LD `description`), root `package.json`
  `description`, and `Base.astro` default `ogImageAlt` all lead with the wedge;
  the homepage OG card points at the wedge-led `/og/agents.png`. The `/agents`
  terminal CTA is rebuilt to **connect-via-MCP** (paste `mcp.nlqdb.com` /
  `nlq mcp install`, naming Claude / Cursor / Codex), demoting the generalist
  `/app/new` "try a goal" path to a secondary link — the agent-builder's real
  next action is connecting a host, not typing into a web form.
- **Alternatives rejected:** Keep the gate closed until the wedge showed
  non-zero conversions (the open-question default) — founder overrode it
  2026-06-24, judging the built wedge surface sufficient. · Swap only the hero, leave README/llms.txt/JSON-LD generalist —
  leaves the brand half-repositioned and inconsistent across the very surfaces
  crawlers and agents read.
