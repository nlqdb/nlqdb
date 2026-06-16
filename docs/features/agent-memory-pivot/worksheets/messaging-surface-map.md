# Messaging surface map — every place a user (or agent) lands

The complete inventory the pivot must move, **text and visuals both**.
Current copy is verbatim (file:line). "Target" is the agent-memory-led
direction under GLOBAL-036 — additive until WS-13, which is the only entry
allowed to change a *lead/headline* string. Each row names the worksheet
that owns it.

**Brand constraint (load-bearing for every visual row):** the site is
deliberately illustration-free — acid-lime `#c6f432` on near-black
`#0b0f0a`, JetBrains Mono, hard shadows, live `<nlq-data>` + CSS motion.
Manifesto tenet 08 forbids stock photos, logo grids, produced video, and
decorative raster imagery. Every "visualization" below is type-on-dark or
live code, never an image of a UI. (SK-PIVOT-004.)

---

## A. Marketing text surfaces (a human lands here)

| Surface | File:line | Current (verbatim) | Target direction | WS | Lead-string? |
|---|---|---|---|---|---|
| Home hero lede | `apps/web/src/components/Hero.astro:24-28` | "Natural-language databases. Create one in a word. Query it in English…" | Unchanged until WS-13. Agent-memory enters via a reweighted section order + a new band, not the wordmark. | 12 | ⚠️ lead — gated to 13 |
| Home section order | `apps/web/src/pages/index.astro:22-31` | Hero → Carousel → Waitlist → CodePanel → Replaces → Receipts → Manifesto | Insert an agent-memory band (matrix teaser + `/agents` CTA) high; demote multi-persona content into an "also works for…" fold. | 12 | no |
| Carousel slides | `apps/web/src/data/showcase-examples.ts` (20 slides; agent-memory at L325) | 1 of 20 is agent-memory ("last 6 turns across all my agent threads") | Add 1–2 slides showing **analytics over** agent memory (`GROUP BY`, aggregation) — the wedge, not just recall. | 05 | no |
| Create form | `apps/web/src/components/CreateForm.tsx:149,167` | H1 "Spin up a database from a sentence." · placeholder "an orders tracker" | On `/agents`, an agent-memory variant placeholder (e.g. "what my agent remembered about each user, this week"). Home unchanged. | 07 | no |
| `/vs` pages | `apps/web/src/data/competitors.ts` (6: supabase, vanna, **mem0**, outerbase, wrenai, askyourdatabase) | Only Mem0 is a memory competitor | Add Zep, Letta, LangMem (P2). Keep the rest (demoted in nav, not deleted). | 01, 02 | no |
| `/solve` pages | `apps/web/src/data/solve.ts` (5; `give-ai-agent-persistent-memory` at L170) | Memory page framed "complementary, not replacement" | Sharpen to the analytical-memory wedge; add an "analytical queries over agent memory" sibling. | 03 | no |
| Manifesto | `apps/web/src/pages/manifesto.astro:117-119` | "Not a vector store with a wrapper. Postgres with pgvector is one of the engines under the hood, not the product." | **Reinforce** — this line already states the wedge; cite it on `/agents`. | 07 | no |
| README | `README.md:1-7` | "# nlqdb — natural-language databases" / "A database you talk to…" | Lead-string — **gated to WS-13.** Until then, add an agent-memory paragraph + `/agents` link in the body. | 13 | ⚠️ lead — gated |
| `llms.txt` lede | `apps/web/src/pages/llms.txt.ts:42-51` | "Natural-language databases. Create one in a word…" | Lead-string — **gated to WS-13.** Until then, the `## Comparisons` block auto-picks up new `/vs` slugs (one manual edit to the hard-coded competitor list at L26). | 13 | ⚠️ lead — gated |
| SEO `<title>`/desc | `apps/web/src/layouts/Base.astro` + per page | Home: "nlqdb — natural-language databases" | `/agents` page gets its own title/desc/OG (agent-memory-led) **now**; sitewide lead strings gated to 13. | 07, 13 | partial |
| JSON-LD | `Base.astro:21-30` (`SoftwareApplication.description`) | page-supplied generalist desc | `/agents` supplies an agent-memory description; sitewide gated to 13. | 07, 13 | partial |
| Pricing | `apps/web/src/pages/pricing.astro` | "Free forever…" + BYOLLM callout | Add the "no per-call fees / BYO key / self-hostable (FSL)" anti-VC line. | 10 | no |

## B. Agent / product description surfaces (an agent or developer lands here)

| Surface | File:line | Current (verbatim) | Target direction | WS |
|---|---|---|---|---|
| **MCP tool `nlqdb_query`** | `packages/mcp/src/server.ts:76-78` | title "Query a database in natural language" / "Run a natural-language query against an nlqdb database…" | **Highest-leverage agent-facing string.** Lead clause signals analytical memory ("…the structured memory your agent can query — `GROUP BY`/`JOIN`/aggregate, not just recall") while keeping the exact contract text. | 04 |
| MCP tool `nlqdb_list_databases` / `describe` | `server.ts:94,111` | generic schema/list copy | Light memory framing; contract text intact. | 04 |
| MCP package desc | `packages/mcp/package.json` | "Model Context Protocol server for nlqdb — local-stdio transport…" | "…analytical memory for AI agents: a queryable database your agent reads and writes in natural language." | 04 |
| Docs-site MCP page | `apps/docs/src/content/docs/mcp.mdx` | install/usage prose | Intro framed as the memory MCP server; usage unchanged. | 04 |
| Docs-site identity | `apps/docs/astro.config.*:9-10` | title "nlqdb" / "A database you talk to. Documentation." | Lead-string-ish — keep generalist; the `mcp.mdx` page carries the wedge. | 04 |
| Root package desc | `package.json` | "Natural-language databases. Ship data-driven features with an English goal, not a query." | Lead-string — gated to 13. | 13 |
| SDK / elements / wrapper descs | `packages/{sdk,elements,react,…}/package.json` | per-package generic | Leave; these are surface wrappers, not positioning. (Parity check only.) | — |
| CLI root help | `cli/**` (root command description) | generalist | Leave; add an `nlq` agent-memory example in docs, not the help string. | 04 (docs only) |

## C. Visual surfaces (what they actually SEE)

| Visual | Where | Current | Target direction | WS |
|---|---|---|---|---|
| OG / social card | `apps/web/public/og-default.png` (single static 1200×630; **no per-page OG route**) | one generic card | Per-surface, on-brand type-on-dark cards for `/agents` + memory `/vs` pages — **this is the image people see when the wedge is shared on HN/X/Reddit.** No screenshots; type + the matrix glyphs in brand palette. | 08 |
| Capability matrix | _new_ | none | The signature visual: a 4-column glyph grid (Mem0\|Zep\|Letta\|nlqdb) rendered in brand palette, on `/agents` + in the blog. | 06 |
| Live demo | _new_ on `/agents` | none | An in-page `<nlq-data>` panel running a real `GROUP BY` over an `agent_memory` table — proof, not a video. | 09 |
| Carousel animation | `Carousel.astro` (typewriter + ignite) | 20 slides | Reused for the analytics-over-memory slides (WS-05); mechanism unchanged. | 05 |
| Logo / favicon | `apps/web/public/{logo.svg,favicon.svg}` | `nlq` mark | Unchanged — no rebrand. | — |

---

## Lead strings — the gate list (do NOT touch before WS-13)

These four are the brand's lead identity. WS-13 (founder-gated) is the only
worksheet allowed to change them, and only after the wedge content is live:

1. Home hero lede — `Hero.astro:24`
2. README H1 + tagline — `README.md:1,3`
3. `llms.txt` lede — `llms.txt.ts:42-51`
4. Root `package.json` description + sitewide JSON-LD/`<title>` default

Everything else in tables A–C is **additive** and ships now.
