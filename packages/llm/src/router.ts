// Cost-ordered failover router with observability per
// PERFORMANCE §4 row 4 (Slice 4): one `llm.<op>` span per attempted
// provider, `nlqdb.llm.calls.total{provider,operation,status}`,
// `nlqdb.llm.duration_ms{provider,operation}`, and one
// `nlqdb.llm.failover.total{from_provider,to_provider,reason}` per
// fall-through.

import { genAiAttributes, llmCallsTotal, llmDurationMs, llmFailoverTotal } from "@nlqdb/otel";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import {
  type CallOpts,
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

// Per-attempt timeouts. Aligned with PERFORMANCE §2.2 stage budgets at
// roughly 3-4× p99 — long enough that healthy providers always finish,
// short enough that a hung provider is detected before the Worker's
// wall-clock budget burns out.
export const DEFAULT_TIMEOUTS_MS: Record<LLMOperation, number> = {
  classify: 1500,
  plan: 5000,
  summarize: 3000,
};

export type LLMRouterOptions = {
  providers: Provider[];
  chains: LLMChains;
  // Override per-operation attempt timeout in ms. Falls back to
  // DEFAULT_TIMEOUTS_MS for any operation not set here.
  timeouts?: Partial<Record<LLMOperation, number>>;
  // Circuit breaker. When a provider hits `failureThreshold` consecutive
  // failures, the router skips it for `cooldownMs` before retrying.
  // Avoids burning the wall-clock budget on a known-bad provider when
  // a healthy fallback exists. Defaults: 3 failures / 60s.
  circuitBreaker?: { failureThreshold: number; cooldownMs: number };
};

const DEFAULT_BREAKER = { failureThreshold: 3, cooldownMs: 60_000 };

type BreakerState = {
  consecutiveFailures: number;
  // ms-epoch when the breaker was opened (>0 means open until
  // openedAt + cooldownMs).
  openedAt: number;
};

function makeBreakerStore(): Map<ProviderName, BreakerState> {
  return new Map();
}

function breakerOpen(state: BreakerState | undefined, now: number, cooldown: number): boolean {
  if (!state || state.openedAt === 0) return false;
  return now - state.openedAt < cooldown;
}

export type LLMRouter = {
  classify(req: ClassifyRequest, opts?: CallOpts): Promise<ClassifyResponse>;
  plan(req: PlanRequest, opts?: CallOpts): Promise<PlanResponse>;
  summarize(req: SummarizeRequest, opts?: CallOpts): Promise<SummarizeResponse>;
};

export type AttemptRecord = {
  provider: ProviderName;
  reason: FailoverReason;
  // The thrown value carried for debuggability. `undefined` for the
  // `not_configured` case where no work was attempted.
  error: unknown;
};

export class NoProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoProviderError";
  }
}

// Distinguished from AllProvidersFailedError so dashboards / operators
// can tell "every chain entry is missing its API key" (a config bug)
// from "every chain entry returned errors" (a provider outage).
export class NoConfiguredProvidersError extends Error {
  constructor(
    message: string,
    public readonly chain: ProviderName[],
  ) {
    super(message);
    this.name = "NoConfiguredProvidersError";
  }
}

export class AllProvidersFailedError extends Error {
  constructor(
    message: string,
    public readonly attempts: AttemptRecord[],
  ) {
    super(message);
    this.name = "AllProvidersFailedError";
  }
}

function asError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

// Caller signal + per-attempt timeout, combined. AbortSignal.any is
// stable in Workers + Bun + Node ≥19; AbortSignal.timeout same.
function buildSignal(callerSignal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const t = AbortSignal.timeout(timeoutMs);
  return callerSignal ? AbortSignal.any([callerSignal, t]) : t;
}

type AttemptResult<Res> =
  | { ok: true; value: Res }
  | { ok: false; reason: FailoverReason; error: unknown };

export function createLLMRouter(opts: LLMRouterOptions): LLMRouter {
  const byName = new Map<ProviderName, Provider>();
  for (const p of opts.providers) byName.set(p.name, p);
  const timeouts = { ...DEFAULT_TIMEOUTS_MS, ...opts.timeouts };
  const breaker = { ...DEFAULT_BREAKER, ...opts.circuitBreaker };
  const breakerState = makeBreakerStore();

  const tracer = trace.getTracer("@nlqdb/llm");

  async function attempt<Req, Res>(
    op: LLMOperation,
    provider: Provider,
    req: Req,
    call: (p: Provider, r: Req, o: CallOpts) => Promise<Res>,
    callerOpts: CallOpts | undefined,
    timeoutMs: number,
  ): Promise<AttemptResult<Res>> {
    return tracer.startActiveSpan(
      `llm.${op}`,
      {
        attributes: {
          ...genAiAttributes({
            system: provider.name,
            operation: op,
            requestModel: provider.model(op),
          }),
          // Legacy attribute names — kept until existing dashboards
          // migrate to the gen_ai.* keys above.
          "llm.provider": provider.name,
          "llm.model": provider.model(op),
        },
      },
      async (span) => {
        const startedAt = performance.now();
        let outcome: "ok" | "error" = "error";
        const signal = buildSignal(callerOpts?.signal, timeoutMs);
        try {
          const value = await call(provider, req, {
            fetch: callerOpts?.fetch,
            signal,
          });
          outcome = "ok";
          return { ok: true as const, value };
        } catch (err) {
          const reason = classifyError(err, signal);
          const wrapped = asError(err);
          span.recordException(wrapped);
          span.setStatus({ code: SpanStatusCode.ERROR, message: wrapped.message });
          return { ok: false as const, reason, error: err };
        } finally {
          const elapsed = performance.now() - startedAt;
          llmDurationMs().record(elapsed, {
            provider: provider.name,
            operation: op,
          });
          llmCallsTotal().add(1, {
            provider: provider.name,
            operation: op,
            status: outcome,
          });
          span.end();
        }
      },
    );
  }

  async function route<Req, Res>(
    op: LLMOperation,
    req: Req,
    call: (p: Provider, r: Req, o: CallOpts) => Promise<Res>,
    callerOpts: CallOpts | undefined,
  ): Promise<Res> {
    const chain = opts.chains[op] ?? [];
    if (chain.length === 0) {
      throw new NoProviderError(`llm: no chain configured for "${op}"`);
    }
    if (!chain.some((name) => byName.has(name))) {
      throw new NoConfiguredProvidersError(
        `llm.${op}: no provider in chain [${chain.join(",")}] is registered`,
        [...chain],
      );
    }

    const attempts: AttemptRecord[] = [];
    const timeoutMs = timeouts[op];

    for (let i = 0; i < chain.length; i++) {
      const name = chain[i];
      if (name === undefined) continue;
      const provider = byName.get(name);
      const next = chain[i + 1];

      if (!provider) {
        attempts.push({ provider: name, reason: "not_configured", error: undefined });
        if (next) {
          llmFailoverTotal().add(1, {
            from_provider: name,
            to_provider: next,
            reason: "not_configured",
          });
        }
        continue;
      }

      // Circuit breaker: skip providers in their cooldown window.
      const now = Date.now();
      const state = breakerState.get(name);
      if (breakerOpen(state, now, breaker.cooldownMs)) {
        attempts.push({ provider: name, reason: "circuit_open", error: undefined });
        if (next) {
          llmFailoverTotal().add(1, {
            from_provider: name,
            to_provider: next,
            reason: "circuit_open",
          });
        }
        continue;
      }

      const result = await attempt(op, provider, req, call, callerOpts, timeoutMs);
      if (result.ok) {
        // Success resets the breaker.
        breakerState.set(name, { consecutiveFailures: 0, openedAt: 0 });
        return result.value;
      }

      // Caller-initiated cancel — propagate, don't keep walking the chain
      // and burning budget the caller no longer wants spent.
      if (callerOpts?.signal?.aborted) {
        throw asError(result.error);
      }

      // Update breaker. Only count "real" failures — skip not_configured
      // (it's a config error, not a provider outage) and parse (which
      // is more often our own bug than the provider's).
      if (result.reason !== "not_configured" && result.reason !== "parse") {
        const failures = (state?.consecutiveFailures ?? 0) + 1;
        breakerState.set(name, {
          consecutiveFailures: failures,
          openedAt: failures >= breaker.failureThreshold ? now : 0,
        });
      }

      attempts.push({ provider: name, reason: result.reason, error: result.error });
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
    classify(req, callerOpts) {
      return route<ClassifyRequest, ClassifyResponse>(
        "classify",
        req,
        (p, r, o) => p.classify(r, o),
        callerOpts,
      );
    },
    plan(req, callerOpts) {
      return route<PlanRequest, PlanResponse>("plan", req, (p, r, o) => p.plan(r, o), callerOpts);
    },
    summarize(req, callerOpts) {
      return route<SummarizeRequest, SummarizeResponse>(
        "summarize",
        req,
        (p, r, o) => p.summarize(r, o),
        callerOpts,
      );
    },
  };
}

function classifyError(err: unknown, signal: AbortSignal): FailoverReason {
  if (err instanceof ProviderError) return err.reason;
  // The combined signal aborting via our timeout surfaces here as an
  // AbortError-like throw the provider couldn't catch (or any subtle
  // code path that bypasses the provider's own ProviderError wrap).
  if (signal.aborted && err instanceof Error && err.name === "AbortError") {
    return "timeout";
  }
  // Anything else — programmer error, unexpected exception. Tagged
  // distinct from `network` so dashboards don't lie.
  return "unknown";
}
