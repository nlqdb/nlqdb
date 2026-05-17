# SK-ELEM-006 — Single ESM bundle at `dist/v1.js`; CDN-first distribution

- **Decision:** The element ships as a single ESM file at `packages/elements/dist/v1.js`, published via Cloudflare Pages project `nlqdb-elements` (currently `nlqdb-elements.pages.dev/v1.js`; eventual `elements.nlqdb.com/v1.js`). Embedders use a `<script type="module" src="https://elements.nlqdb.com/v1.js"></script>` tag. Workspace consumers can `import "@nlqdb/elements"` for the same registration side-effect.
- **Core value:** Effortless UX, Free, Simple
- **Why:** A single ESM file is the framework-free distribution path: one `<script>` tag, no bundler, no npm install, no build step on the embedder's side. ESM gives import-once semantics so accidental double-loads no-op. Cloudflare Pages is free and gives sticky PR-preview URLs (`pr-<N>.nlqdb-elements.pages.dev/v1.js`) so embedders can test against unmerged changes.
- **Consequence in code:** `build.ts` produces exactly one output: `dist/v1.js`. No CommonJS, no UMD, no per-template chunked output. Versioning lives in the URL path (`/v1.js` is the v1 surface; v2 ships at a separate path). Workspace consumers re-export the same module so behaviour is byte-identical between CDN and import paths.
- **Alternatives rejected:**
  - Multiple chunks per template — defeats the "one tag, one fetch" pitch and adds HTTP-2 multiplexing complexity for no gain at this size.
  - npm-only distribution — third-party HTML pages can't depend on `npm install`.
