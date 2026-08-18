// @nlqdb/errors — the one registry from internal cause to user-facing copy.
//
// `renderError(code, params)` is the only way an error becomes words. The API
// puts the result on the wire; every surface renders `message` + `action` from
// there. Surfaces keep at most a sparse per-code override table, whose keys are
// type-checked against `ErrorCode` by `assertOverrides` below.
//
// Governed by GLOBAL-012 (one sentence + next action) and GLOBAL-011 (never
// claim something we don't know). Feature record: docs/features/error-taxonomy.

import { REGISTRY } from "./registry.ts";
import { type ErrorEntry, resolve, type Recoverability, type WireError } from "./types.ts";

export { REGISTRY } from "./registry.ts";
export type {
  ConstraintKind,
  FailoverReasonParam,
  LlmLane,
} from "./registry.ts";
export { FAILOVER_REASONS, LLM_LANES } from "./registry.ts";
export type { Recoverability, WireError } from "./types.ts";

export type ErrorCode = keyof typeof REGISTRY;

// Params accepted for a given code — inferred from its zod schema, so a caller
// passing the wrong shape fails to compile rather than shipping a wrong message.
export type ParamsFor<C extends ErrorCode> = (typeof REGISTRY)[C] extends {
  params: { _output: infer O };
}
  ? O
  : never;

export const ERROR_CODES = Object.keys(REGISTRY) as ErrorCode[];

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && value in REGISTRY;
}

// `transient` is the only recoverability worth an automatic retry. Everything
// else replays the same failure — the wasted-backoff half of the 2026-08-18
// `23503` incident, where a deterministic constraint violation was bucketed as
// connectivity and retried three times.
export function isRetryable(recoverability: Recoverability): boolean {
  return recoverability === "transient";
}

type Rendered = WireError & { recoverability: Recoverability; httpStatus: number };

// Render one error to its wire form. Params are validated through the code's
// schema: unknown or malformed fields are DROPPED, never echoed — the boundary
// guarantee that keeps raw provider text and keys server-side. A parse failure
// degrades to no params (generic-but-correct copy) rather than throwing on the
// error path.
export function renderError<C extends ErrorCode>(
  code: C,
  params?: Partial<ParamsFor<C>> | Record<string, unknown>,
): Rendered {
  // biome-ignore lint/suspicious/noExplicitAny: one cast at the registry
  // boundary; every entry's builders are typed against its own schema, so the
  // per-entry types are enforced where they're written.
  const entry = REGISTRY[code] as ErrorEntry<any>;
  const parsed = entry.params.safeParse(params ?? {});
  const p = parsed.success ? parsed.data : {};
  const recoverability = resolve(entry.recoverability, p);
  const clean = pruneEmpty(p);
  return {
    code,
    message: entry.message(p),
    action: entry.action(p),
    retryable: isRetryable(recoverability),
    recoverability,
    httpStatus: resolve(entry.httpStatus, p),
    ...(clean ? { params: clean } : {}),
  };
}

// Drop `undefined` and empty arrays so the wire carries only what we know
// (GLOBAL-011) and an omitted-params code emits no `params` key at all.
function pruneEmpty(p: Record<string, unknown>): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

// A surface's override table: sparse, keyed by real codes. Call it in the
// surface module so a typo or a retired code fails the build instead of
// silently never firing.
export function assertOverrides<T extends Partial<Record<ErrorCode, unknown>>>(table: T): T {
  return table;
}
