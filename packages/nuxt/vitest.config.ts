import { defineConfig } from "vitest/config";

export default defineConfig({
  // No DOM: the composable is server-side data-fetching. We stub Nuxt's
  // ambient composables (`useAsyncData`, `useRuntimeConfig`) on `globalThis`.
  test: {
    environment: "node",
  },
});
