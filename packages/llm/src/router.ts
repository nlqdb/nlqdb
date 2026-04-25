// Cost-ordered failover router with observability per
// PERFORMANCE §4 row 4 (Slice 4): one `llm.<op>` span per attempted
// provider, `nlqdb.llm.calls.total{provider,operation,status}`,
// `nlqdb.llm.duration_ms{provider,operation}`, and one
// `nlqdb.llm.failover.total{from_provider,to_provider,reason}` per
// fall-through.

import { llmCallsTotal, llmDurationMs, llmFailoverTotal } from "@nlqdb/otel";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import {
  type ClassifyRequest,
  type ClassifyResponse,
  type FailoverReason,
  type LLMOperation,
  type PlanRequest,
  type PlanResponse,
  type Provider,
  ProviderError,
  type ProviderName,
  type SummarizeRequest,
  type SummarizeResponse,
} from "./types.ts";

export type LLMChains = Partial<Record<LLMOperation, ProviderName[]>>;

export type LLMRouterOptions = {
  providers: Provider[];
  chains: LLMChains;
};

export type LLMRouter = {
  classify(req: ClassifyRequest): Promise<ClassifyResponse>;
  plan(req: PlanRequest): Promise<PlanResponse>;
  summarize(req: SummarizeRequest): Promise<SummarizeResponse>;
};

export class NoProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoProviderError";
  }
}

export class AllProvidersFailedError extends Error {
  constructor(
    message: string,
    public readonly attempts: { provider: ProviderName; reason: FailoverReason }[],
  ) {
    super(message);
    this.name = "AllProvidersFailedError";
  }
}

export function createLLMRouter(opts: LLMRouterOptions): LLMRouter {
  const byName = new Map<ProviderName, Provider>();
  for (const p of opts.providers) byName.set(p.name, p);

  const tracer = trace.getTracer("@nlqdb/llm");

  async function attempt<Req, Res>(
    op: LLMOperation,
    provider: Provider,
    req: Req,
    call: (p: Provider, r: Req) => Promise<Res>,
  ): Promise<{ ok: true; value: Res } | { ok: false; reason: FailoverReason; error: unknown }> {
    return tracer.startActiveSpan(
      `llm.${op}`,
      {
        attributes: {
          "llm.provider": provider.name,
          "llm.model": provider.model(op),
        },
      },
      async (span) => {
        const startedAt = performance.now();
        try {
          const value = await call(provider, req);
          llmDurationMs().record(performance.now() - startedAt, {
            provider: provider.name,
            operation: op,
          });
          llmCallsTotal().add(1, {
            provider: provider.name,
            operation: op,
            status: "ok",
          });
          return { ok: true as const, value };
        } catch (err) {
          llmDurationMs().record(performance.now() - startedAt, {
            provider: provider.name,
            operation: op,
          });
          const reason: FailoverReason = err instanceof ProviderError ? err.reason : "network";
          llmCallsTotal().add(1, {
            provider: provider.name,
            operation: op,
            status: "error",
          });
          span.recordException(err as Error);
          span.setStatus({ code: SpanStatusCode.ERROR });
          return { ok: false as const, reason, error: err };
        } finally {
          span.end();
        }
      },
    );
  }

  async function route<Req, Res>(
    op: LLMOperation,
    req: Req,
    call: (p: Provider, r: Req) => Promise<Res>,
  ): Promise<Res> {
    const chain = opts.chains[op] ?? [];
    if (chain.length === 0) {
      throw new NoProviderError(`llm: no chain configured for "${op}"`);
    }

    const attempts: { provider: ProviderName; reason: FailoverReason }[] = [];

    for (let i = 0; i < chain.length; i++) {
      const name = chain[i];
      if (name === undefined) continue;
      const provider = byName.get(name);
      const next = chain[i + 1];

      if (!provider) {
        attempts.push({ provider: name, reason: "not_configured" });
        if (next) {
          llmFailoverTotal().add(1, {
            from_provider: name,
            to_provider: next,
            reason: "not_configured",
          });
        }
        continue;
      }

      const result = await attempt(op, provider, req, call);
      if (result.ok) {
        return result.value;
      }
      attempts.push({ provider: name, reason: result.reason });
      if (next) {
        llmFailoverTotal().add(1, {
          from_provider: name,
          to_provider: next,
          reason: result.reason,
        });
      }
    }

    throw new AllProvidersFailedError(
      `llm.${op}: all providers in chain failed (${attempts.map((a) => `${a.provider}:${a.reason}`).join(", ")})`,
      attempts,
    );
  }

  return {
    classify(req) {
      return route<ClassifyRequest, ClassifyResponse>("classify", req, (p, r) => p.classify(r));
    },
    plan(req) {
      return route<PlanRequest, PlanResponse>("plan", req, (p, r) => p.plan(r));
    },
    summarize(req) {
      return route<SummarizeRequest, SummarizeResponse>("summarize", req, (p, r) => p.summarize(r));
    },
  };
}
