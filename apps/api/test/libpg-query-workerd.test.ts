// Regression test for the 2026-09-15 `/v1/ask` 500s
// (`TypeError: Cannot read properties of undefined (reading 'href')`).
//
// `libpg-query`'s Emscripten loader picks its host environment when the
// factory is called: workerd defines `WorkerGlobalScope` but has no
// `location`, so with `__filename` undefined it evaluates
// `self.location.href` and the whole `ask/sql-validate-ddl.ts` module init
// rejects. The create path hid that behind a `globalThis.__filename` polyfill
// copy-pasted into four `index.ts` handlers; widen-on-write's lazy
// `import("./sql-validate-ddl.ts")` (`ask/build-deps.ts`, SK-SCHEMA-008) had
// no copy, so every first-insert write ask 500'd.
//
// This runs in the real workerd runtime (the `integration` vitest project) and
// imports the validator exactly the way `extendWrite` does — from a request
// isolate that has run no create, so nothing outside the module has set the
// globals up. Against the pre-fix tree the last assertion fails: `__filename`
// is still undefined after the import, which is the production crash.

import { expect, it } from "vitest";

it("SK-SCHEMA-008 — the libpg_query DDL validator loads in workerd with no caller-set globals", async () => {
  const { validateCompiledDdl } = await import("../src/ask/sql-validate-ddl.ts");

  // The WASM parser really ran: allow the widen-on-write shapes, reject a
  // destructive verb (SK-HDC-006).
  expect(validateCompiledDdl(['CREATE TABLE "s"."t" ("id" integer)'])).toEqual({ ok: true });
  expect(validateCompiledDdl(['ALTER TABLE "s"."t" ADD COLUMN "note" text'])).toEqual({ ok: true });
  expect(validateCompiledDdl(['DROP TABLE "s"."t"']).ok).toBe(false);

  // `ask/libpg-query-worker.ts` satisfied the Emscripten loader's precondition
  // itself. No route handler, and no other module, may be responsible for it.
  const g = globalThis as { __filename?: string; __dirname?: string };
  expect(typeof g.__filename).toBe("string");
  expect(typeof g.__dirname).toBe("string");
});
