import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
  },
  resolve: {
    alias: {
      // `server-only` is a Next.js compile-time guard; under vitest we
      // alias it to an empty module so tests can exercise the same
      // source path without pulling in the Next compiler.
      "server-only": new URL("./test/stubs/server-only.ts", import.meta.url).pathname,
      "next/script": new URL("./test/stubs/next-script.tsx", import.meta.url).pathname,
    },
  },
});
