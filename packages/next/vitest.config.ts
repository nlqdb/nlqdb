import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
  },
  resolve: {
    // `server-only` + `next/script` need stubs so source under test loads outside Next.
    alias: {
      "server-only": new URL("./test/stubs/server-only.ts", import.meta.url).pathname,
      "next/script": new URL("./test/stubs/next-script.tsx", import.meta.url).pathname,
    },
  },
});
