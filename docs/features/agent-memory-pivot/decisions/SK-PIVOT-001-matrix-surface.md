# SK-PIVOT-001 — The multi-competitor capability matrix is a new surface, not a hacked `/vs` template

- **Decision:** The "What can your agent actually DO with its memory?" table
  (rows = capabilities; columns = Mem0 · Zep · Letta · **nlqdb**) ships as its
  own typed data structure rendered on `/agents`, **not** by extending the
  `/vs/[slug].astro` single-`them`-column template.
- **Core value:** Simple, Creative
- **Why:** The comparison template renders one competitor column (`us` vs
  `them`). The wedge's signature artifact is a *four-column* side-by-side;
  bending the template into an N-column one complicates every existing `/vs`
  page for one consumer. A dedicated typed matrix keeps both simple.
- **Consequence in code:** A typed `agentMemoryMatrix.ts` with
  `{ capability, mem0, zep, letta, nlqdb }` rows rendered as a glyph grid
  (`✓ / ◐ / —`, the `ComparisonRow` vocabulary). Honest claims only. Reused
  on `/agents` + the blog.
- **Alternatives rejected:** Add N `them` columns to `ComparisonRow` —
  pollutes all six existing pages. · A static image — unmaintainable + off-brand (tenet 08).
