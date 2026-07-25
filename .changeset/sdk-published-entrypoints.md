---
"@nlqdb/sdk": patch
---

Fix the published package being impossible to import. Every released version
(0.1.0, 0.2.0, 0.2.1) published `main`/`types`/`exports` pointing at
`./src/index.ts` while the tarball shipped only `dist/`, so
`import "@nlqdb/sdk"` threw `ERR_MODULE_NOT_FOUND` after a clean install. The
corrected entrypoints lived in `publishConfig`, but overriding package.json
fields from there is a pnpm feature that npm ignores (npm/cli#7586), so they
never reached the registry. A `prepack` hook now applies them, and
`npm-tarball-entrypoint-integrity.test.ts` fails if any publishable package's
entrypoints fall outside its own `files` allowlist.
