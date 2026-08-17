import { describe, expect, it } from "vitest";
import { withFallbackRouter } from "../src/fallback-router.ts";
import type { LLMRouter } from "../src/router.ts";
import type { LLMOperation } from "../src/types.ts";

// A minimal LLMRouter test double whose every op resolves to a tagged value or
// throws, so we can assert which lane answered without real providers.
function stubRouter(tag: string, opts?: { throwOn?: Set<LLMOperation> }): LLMRouter {
  const make =
    (op: LLMOperation) =>
    // biome-ignore lint/suspicious/noExplicitAny: test double returns a tagged marker, not the real op shape
    async (_req: any, _callOpts?: any): Promise<any> => {
      if (opts?.throwOn?.has(op)) throw new Error(`${tag}:${op} boom`);
      return { lane: tag, op };
    };
  return {
    route: make("route"),
    plan: make("plan"),
    summarize: make("summarize"),
    schemaInfer: make("schema_infer"),
    engineClassify: make("engine_classify"),
  };
}

describe("withFallbackRouter (SK-PREMIUM-020)", () => {
  it("serves the primary (premium) lane when it succeeds — no fallback", async () => {
    const calls: LLMOperation[] = [];
    const router = withFallbackRouter(stubRouter("premium"), stubRouter("free"), (op) =>
      calls.push(op),
    );
    // biome-ignore lint/suspicious/noExplicitAny: stub request
    expect(await router.plan({} as any)).toEqual({ lane: "premium", op: "plan" });
    expect(calls).toEqual([]);
  });

  it("falls back to the free chain when the premium lane throws", async () => {
    const calls: LLMOperation[] = [];
    const router = withFallbackRouter(
      stubRouter("premium", { throwOn: new Set<LLMOperation>(["plan", "route"]) }),
      stubRouter("free"),
      (op) => calls.push(op),
    );
    // biome-ignore lint/suspicious/noExplicitAny: stub request
    expect(await router.plan({} as any)).toEqual({ lane: "free", op: "plan" });
    // biome-ignore lint/suspicious/noExplicitAny: stub request
    expect(await router.route({} as any)).toEqual({ lane: "free", op: "route" });
    // onFallback fires once per fallen-back op (fail loud, never silent).
    expect(calls).toEqual(["plan", "route"]);
  });

  it("propagates the failure when both lanes throw (no infinite masking)", async () => {
    const router = withFallbackRouter(
      stubRouter("premium", { throwOn: new Set<LLMOperation>(["plan"]) }),
      stubRouter("free", { throwOn: new Set<LLMOperation>(["plan"]) }),
      () => {},
    );
    // biome-ignore lint/suspicious/noExplicitAny: stub request
    await expect(router.plan({} as any)).rejects.toThrow("free:plan boom");
  });

  it("re-throws a caller-cancelled request instead of re-running on the free chain", async () => {
    const calls: LLMOperation[] = [];
    const ctrl = new AbortController();
    ctrl.abort();
    const router = withFallbackRouter(
      stubRouter("premium", { throwOn: new Set<LLMOperation>(["plan"]) }),
      stubRouter("free"),
      (op) => calls.push(op),
    );
    // biome-ignore lint/suspicious/noExplicitAny: stub request
    await expect(router.plan({} as any, { signal: ctrl.signal })).rejects.toThrow("premium:plan");
    expect(calls).toEqual([]);
  });
});
