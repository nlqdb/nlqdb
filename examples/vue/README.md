# Vue (Vite SPA)

A Vite + Vue 3.5 single-page app using the typed [`@nlqdb/vue`](../../packages/vue/) wrapper. This is the solo-builder's alternative to the Nuxt example: same framework family, smaller footprint, no SSR — pick this when you want a static deploy on Pages.

## Run it

```bash
npm create vite@latest nlqdb-meals -- --template vue-ts
cd nlqdb-meals
npm install @nlqdb/vue @nlqdb/elements
```

Replace `src/main.ts` and `src/App.vue` with the files in this folder, then:

```bash
echo "VITE_NLQDB_KEY=pk_live_yourkey" > .env
npm run dev
```

## Notes

- **`configureNlqdb(app)`** in `main.ts` does two things: registers `<NlqData>` and `<NlqAction>` globally, and teaches Vue's template compiler that the underlying `<nlq-data>` custom element is not a Vue component (silencing the unknown-tag warning).
- **`:api-key`** uses Vue's dynamic-attribute binding; the script tag for `elements.nlqdb.com/v1.js` is injected by the wrapper itself the first time `<NlqData>` mounts — no `useHead` or `<svelte:head>` needed.
- **`@load`** is the Vue-idiomatic event handler; the payload type (`NlqDataLoadDetail`) re-exports from `@nlqdb/elements` so it stays in sync with the underlying element.
- For Nuxt (with SSR + `useRuntimeConfig`), see [`examples/nuxt/`](../nuxt/).
