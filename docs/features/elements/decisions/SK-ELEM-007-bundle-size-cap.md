# SK-ELEM-007 — < 6 KB gzipped bundle ceiling enforced in CI

- **Decision:** The CDN bundle is hard-capped at < 6 KB gzipped. CI's `packages/elements (esbuild + bundle-size)` job (`.github/workflows/ci.yml`) fails the build if `gzip -c dist/v1.js | wc -c` reaches 6144 bytes.
- **Core value:** Free, Fast, Simple
- **Why:** Marketing pages — the primary embed target — care about Lighthouse 100s. A multi-KB element loaded on every page above the fold compounds across the funnel. 6 KB is the ceiling at which a `<script type="module">` doesn't move the needle for a tuned page. The cap also forces dependency discipline: no parsers, no big crypto libs, no framework runtimes (the package depends on no third-party runtime today). This is the elements-specific manifestation of `GLOBAL-013`'s bundle discipline.
- **Consequence in code:** Adding a dep requires showing the post-build `dist/v1.js` size. `build.ts` has esbuild minification + tree-shaking on. The package has zero runtime dependencies (verified by `package.json`'s `dependencies` block). CI runs the size check on every PR; reviewers reject any change that pushes the bundle over budget.
- **Alternatives rejected:**
  - Soft warning at 6 KB — bundles only ever grow under soft caps.
  - Separate "lite" and "full" bundles — embedders can't tell which to pick; defeats the one-tag pitch.
