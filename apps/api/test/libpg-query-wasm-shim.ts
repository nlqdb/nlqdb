// Test-only shim: in unit tests (Node.js), the static `.wasm` import
// in `src/ask/libpg-query-worker.ts` can't be resolved by Node's ESM
// loader. vitest.config.ts aliases the import to this file, which reads
// the binary from disk and compiles it — the same shape Wrangler's
// esbuild plugin produces at build time (a WebAssembly.Module).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const wasmPath = require.resolve("libpg-query/wasm/libpg-query.wasm");
export default await WebAssembly.compile(readFileSync(wasmPath));
