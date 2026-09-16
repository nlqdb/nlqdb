// Worker-compatible wrapper for libpg-query WASM.
//
// `libpg-query/wasm/libpg-query.js` is an Emscripten loader that picks its
// host environment when the factory is CALLED, and neither branch fits
// workerd out of the box:
//
//   if (typeof __filename != "undefined") { _scriptName = __filename }
//   else if (ENVIRONMENT_IS_WORKER)       { _scriptName = self.location.href }
//   ...
//   if (ENVIRONMENT_IS_NODE) { fs = require("fs"); scriptDirectory = __dirname + "/" }
//
// workerd defines `WorkerGlobalScope` but has no `location`, so without
// `__filename` the `.href` read throws `TypeError: Cannot read properties of
// undefined (reading 'href')` — the 2026-09-15 `/v1/ask` 500s. And
// `nodejs_compat` defines `process.versions.node`, so the node branch is the
// one that runs and it wants `__dirname`.
//
// Defining both globals immediately before the factory call satisfies both
// branches. It lives HERE, not at the call sites: the same polyfill used to be
// copy-pasted into four `index.ts` handlers, and the one path that never got a
// copy — widen-on-write's lazy `import("./sql-validate-ddl.ts")` in
// `ask/build-deps.ts` (SK-SCHEMA-008) — is what broke. This module owns its
// own precondition; no caller needs to know it exists.
//
// The filesystem read the node branch sets up is never reached: the `.wasm`
// import below is resolved by wrangler's esbuild plugin to a
// `WebAssembly.Module`, and `instantiateWasm` hands it straight to the loader.

// @ts-expect-error — Emscripten factory; no TS declarations
import PgQueryEmscripten from "libpg-query/wasm/libpg-query.js";
// @ts-expect-error — Wrangler resolves .wasm imports to WebAssembly.Module at runtime
import wasmModule from "libpg-query/wasm/libpg-query.wasm";

interface EmscriptenModule {
  _wasm_parse_query_raw(queryPtr: number): number;
  _malloc(len: number): number;
  _free(ptr: number): void;
  _wasm_free_parse_result(resultPtr: number): void;
  lengthBytesUTF8(str: string): number;
  stringToUTF8(str: string, outPtr: number, maxBytesToWrite: number): void;
  UTF8ToString(ptr: number, maxBytesToRead?: number): string;
  getValue(ptr: number, type: string): number;
}

let mod: EmscriptenModule | null = null;

const g = globalThis as { __filename?: string; __dirname?: string };
if (typeof g.__filename === "undefined") g.__filename = "worker";
if (typeof g.__dirname === "undefined") g.__dirname = "/";

const initPromise = (
  PgQueryEmscripten as (opts: Record<string, unknown>) => Promise<EmscriptenModule>
)({
  instantiateWasm(
    imports: WebAssembly.Imports,
    successCallback: (instance: WebAssembly.Instance) => void,
  ) {
    WebAssembly.instantiate(wasmModule as WebAssembly.Module, imports).then(successCallback);
    return {};
  },
}).then((m: EmscriptenModule) => {
  mod = m;
});

export async function loadModule(): Promise<void> {
  if (!mod) await initPromise;
}

export function parseSync(query: string): unknown {
  if (!mod) throw new Error("WASM module not initialized. Call `loadModule()` first.");

  const len = mod.lengthBytesUTF8(query) + 1;
  const queryPtr = mod._malloc(len);
  let resultPtr = 0;

  try {
    mod.stringToUTF8(query, queryPtr, len);
    resultPtr = mod._wasm_parse_query_raw(queryPtr);

    if (!resultPtr) {
      throw new Error("Failed to allocate memory for parse result");
    }

    const errorPtr = mod.getValue(resultPtr + 8, "i32");

    if (errorPtr) {
      const messagePtr = mod.getValue(errorPtr, "i32");
      const message = messagePtr ? mod.UTF8ToString(messagePtr) : "Unknown parse error";
      throw new Error(message);
    }

    const parseTreePtr = mod.getValue(resultPtr, "i32");
    if (!parseTreePtr) {
      throw new Error("Parse result is null");
    }

    return JSON.parse(mod.UTF8ToString(parseTreePtr));
  } finally {
    mod._free(queryPtr);
    if (resultPtr) {
      mod._wasm_free_parse_result(resultPtr);
    }
  }
}
