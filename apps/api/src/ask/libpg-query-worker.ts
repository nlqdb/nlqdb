// Worker-compatible wrapper for libpg-query WASM.
//
// The stock libpg-query index.js calls PgQueryModule() at module scope,
// and the Emscripten loader inside it takes the ENVIRONMENT_IS_NODE path
// (Workers defines process.versions.node via nodejs_compat) which calls
// fs.readFileSync to load the .wasm binary — unsupported on Workers.
//
// This wrapper imports the Emscripten factory and the WASM binary
// separately. Wrangler's esbuild plugin handles the .wasm import,
// making it available as a WebAssembly.Module at runtime. We pass it
// via the instantiateWasm hook, bypassing the filesystem read entirely.

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
