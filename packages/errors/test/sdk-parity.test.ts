// Compile-time drift guard between the registry and the SDK's `ApiErrorCode`
// union — the trick this package inherited from packages/mcp's ERROR_COPY,
// promoted here so all surfaces get it. If either side gains a code the other
// lacks, `tsc --noEmit` fails naming it; the runtime assertion below repeats
// the check for anyone reading test output instead of the compiler's.

import type { ApiErrorCode } from "@nlqdb/sdk";
import { expect, it } from "vitest";
import { ERROR_CODES, type ErrorCode } from "../src/index.ts";

// Drop `(string & {})` so only the named literals remain.
type LiteralOnly<T> = T extends string ? (string extends T ? never : T) : never;
type SdkCode = LiteralOnly<ApiErrorCode>;

type AssertNever<T extends never> = T;
type _RegistryCoversSdk = AssertNever<Exclude<SdkCode, ErrorCode>>;
type _SdkCoversRegistry = AssertNever<Exclude<ErrorCode, SdkCode>>;

it("exposes every registry code as a plain list", () => {
  expect(ERROR_CODES.length).toBe(new Set(ERROR_CODES).size);
  expect(ERROR_CODES).toContain("llm_failed");
  expect(ERROR_CODES).toContain("write_constraint");
});
