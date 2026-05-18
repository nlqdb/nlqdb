# Svelte (Vite SPA, Svelte 5 runes)

A Vite + Svelte 5 single-page app using the typed [`@nlqdb/svelte`](../../packages/svelte/) wrapper. This is the first-timer's entry point — Svelte's small mental model + nlqdb's "type what you want" prompt means a student can see real rows in under a minute.

## Run it

```bash
npm create vite@latest nlqdb-first-db -- --template svelte-ts
cd nlqdb-first-db
npm install @nlqdb/svelte @nlqdb/elements
```

Replace `src/App.svelte` with the file in this folder, then:

```bash
echo "VITE_NLQDB_KEY=pk_live_yourkey" > .env
npm run dev
```

## Notes

- **Svelte 5 runes.** This sample uses the modern lowercase-callback convention (`onload=` instead of `on:load=`). The wrapper supports both.
- **Apostrophe-free goal.** `"all users, newest first"` reads naturally and stays under nlqdb's "one-clause, one-result" sweet spot.
- **No `<svelte:head>` needed** — the wrapper injects `elements.nlqdb.com/v1.js` the first time `<NlqData />` mounts.
- For SvelteKit (with SSR + `+server.ts` SDK calls), see [`examples/sveltekit/`](../sveltekit/).
