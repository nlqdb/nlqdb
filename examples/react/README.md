# React (Vite SPA)

A Vite + React 19 single-page app using the typed [`@nlqdb/react`](../../packages/react/) wrapper. This is the solo-builder's alternative to the Next.js example: no SSR, no router — just `npm create vite@latest`, drop in `App.tsx`, ship.

## Run it

```bash
npm create vite@latest nlqdb-meals -- --template react-ts
cd nlqdb-meals
npm install @nlqdb/react @nlqdb/elements
```

Replace `src/App.tsx` with the file in this folder, then:

```bash
echo "VITE_NLQDB_KEY=pk_live_yourkey" > .env
npm run dev
```

## Notes

- **`<NlqScript />`** injects `https://elements.nlqdb.com/v1.js` once. It deduplicates across re-renders and across multiple `<NlqData />` siblings.
- **Typed props.** The wrapper's `goal` / `apiKey` / `template` / `refresh` are camelCase and TS-checked; the underlying custom element keeps its kebab-case attributes. The `onLoad` handler gets a typed `NlqDataLoadDetail`.
- **SPA-only.** This sample is client-rendered; for App Router / RSC, see [`examples/nextjs/`](../nextjs/).
- **Action element** (`<NlqAction />`) is the write side of the wrapper; we omit it here to keep the read-only sample focused. See the `@nlqdb/react` README for the full surface.
