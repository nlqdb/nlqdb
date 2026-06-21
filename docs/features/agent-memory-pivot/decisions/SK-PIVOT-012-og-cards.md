# SK-PIVOT-012 — Wedge OG cards are committed static PNGs from a manually-run generator, never built in CI

- **Decision:** The per-surface social cards (WS-08, `/agents` + the four
  memory `/vs` pages) are **pre-rendered PNGs committed to
  `apps/web/public/og/`**, produced by a one-off generator
  (`apps/web/scripts/og/gen-og.mjs`, hand-authored SVG → PNG via
  `@resvg/resvg-js`) that is **not** part of `astro build`. Re-run `bun run
  --filter @nlqdb/web og:gen` by hand only when a card's copy changes.
- **Core value:** Simple, Free, Fast
- **Why:** Cloudflare free-tier is the hard budget (`GLOBAL-013`). Wiring an
  SVG rasteriser + ~800 KB of font binaries into the build (or worse, runtime
  OG generation in the Worker) would bloat the build path and risk the bundle
  budget for assets that change ~never. Cards are static type-on-dark
  (SK-PIVOT-004) — there is nothing dynamic to generate per request, so the
  cheapest correct mechanism is "render once, commit the PNG."
- **Consequence in code:** `@resvg/resvg-js` is an `apps/web` **devDependency**
  only (never imported by `src/`, never reaches the Worker); the JetBrains Mono
  ttfiles live under `scripts/og/fonts/` (build-tool assets, outside `public/`
  and `src/`, so unbundled). `Base.astro`'s existing `ogImage` prop is set on
  `/agents` and, in `vs/[slug].astro`, on the `persona === "P2 agent builder"`
  cluster; every other page keeps `og-default.png`.
- **Alternatives rejected:** **Generate at `astro build`** — pulls the
  rasteriser + fonts into the free-tier build every deploy for static output.
  · **Runtime OG endpoint on the Worker** — per-request CPU + bundle cost for
  a card that never varies. · **SVG `og:image`** — X/Facebook/LinkedIn don't
  render SVG social cards; must be raster.
