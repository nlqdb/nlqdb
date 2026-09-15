// Regression guard for the libpg-query WASM wrapper's self-set of the
// `__filename` / `__dirname` globals its Emscripten loader needs on
// Cloudflare Workers (GLOBAL-041 Phase A). Without them the loader
// dereferences `.href` on an undefined script URL and module init throws
// `TypeError: Cannot read properties of undefined (reading 'href')`. That
// crash 500'd every widen-on-write commit in prod (live KPI 1 = 0 %): the
// extend path's dynamic import of `sql-validate-ddl.ts` was the one caller
// that never ran the per-handler polyfill the create path had. The fix moved
// the guard INTO this wrapper so every importer is covered at the source.
//
// The original crash is Workers-isolate-only (Node's `fs` resolves the loader
// fine), so this asserts the invariant that matters instead: importing the
// wrapper defines the two globals even when they start undefined.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type WasmGlobals = { __filename?: string; __dirname?: string };

describe("libpg-query-worker WASM env self-guard", () => {
  const g = globalThis as unknown as WasmGlobals;
  let savedFilename: string | undefined;
  let savedDirname: string | undefined;

  beforeEach(() => {
    savedFilename = g.__filename;
    savedDirname = g.__dirname;
  });

  afterEach(() => {
    g.__filename = savedFilename;
    g.__dirname = savedDirname;
    vi.resetModules();
  });

  it("defines __filename / __dirname on import when they are unset", async () => {
    g.__filename = undefined;
    g.__dirname = undefined;
    vi.resetModules();

    await import("./libpg-query-worker.js");

    expect(typeof g.__filename).toBe("string");
    expect(typeof g.__dirname).toBe("string");
  });

  it("does not clobber a value a route handler already set", async () => {
    g.__filename = "already-set";
    g.__dirname = "/already";
    vi.resetModules();

    await import("./libpg-query-worker.js");

    expect(g.__filename).toBe("already-set");
    expect(g.__dirname).toBe("/already");
  });
});
