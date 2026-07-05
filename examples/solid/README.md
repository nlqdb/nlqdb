# SolidJS (Vite SPA)

A Vite + SolidJS single-page app using the typed [`@nlqdb/solid`](../../packages/solid/) wrapper. Picked for real-time dashboards where Solid's fine-grained reactivity keeps the patch cost low even with frequent `refresh` cycles.

## Run it

```bash
npm create vite@latest nlqdb-errors-dashboard -- --template solid-ts
cd nlqdb-errors-dashboard
npm install @nlqdb/solid @nlqdb/elements
```

> **Not on npm yet** — `@nlqdb/solid` and `@nlqdb/elements` are built on `main` but unpublished (`docs/progress.md §0`), so the install above 404s today. Until they publish, run this example inside the monorepo (`bun install` links the workspace packages) or use the CDN `<nlq-data>` element per the [HTML example](../html/).

Replace `src/App.tsx` with the file in this folder, then:

```bash
echo "VITE_NLQDB_KEY=pk_live_yourkey" > .env
npm run dev
```

## Notes

- **`refresh="5s"`** is aggressive on purpose — Solid's no-virtual-DOM model patches only the changed cells of the underlying `<nlq-data>` shadow root, so a 5-second poll on a 1000-row table is essentially free.
- **Typed props** — `goal`, `apiKey`, `template`, `refresh` are camelCase and TS-checked. The `NlqDataLoadDetail` type re-exports from `@nlqdb/elements`.
- **Free-tier caveat.** The plan-cache absorbs identical prompts, so a 5-second `refresh` against a stable query burns one LLM call per cache TTL window, not one per refresh. For dashboards on raw SQL (no LLM at all), use `query="…"` instead of `goal="…"`.
- For SSR (Solid Start), the same component import works; the start template handles head injection.
