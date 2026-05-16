import { defineConfig } from "vitest/config";

// `pool: "forks"` + `singleFork: true` isolates the heavy
// `@modelcontextprotocol/sdk` module init in a single child process —
// avoids the actions-runner SIGABRT we hit when the default `threads`
// pool boots multiple workers in parallel.
export default defineConfig({
  test: {
    pool: "forks",
    forks: {
      singleFork: true,
    },
  },
});
