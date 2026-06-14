// Cost-ordered failover router with observability per
// PERFORMANCE §4 row 4 (Slice 4): one `llm.<op>` span per attempted
// provider, `nlqdb.llm.calls.total{provider,operation,status}`,
// `nlqdb.llm.duration_ms{provider,operation}`, and one
// `nlqdb.llm.failover.total{from_provider,to_provider,reason}` per
// fall-through.

import {
  genAiAttributes,
  llmCallsTotal,
  llmDurationMs,
  llmFailoverTotal,
  SEMCONV_SCHEMA_URL,
} from "@nlqdb/otel";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import {
  type CallOpts,
  type EngineClassifyRequest,
  type EngineClassifyResponse,
  type FailoverReason,
  type LLMOperation,
  type PlanRequest,
  type PlanResponse,
  type Provider,
  ProviderError,
  type ProviderName,
  type RouteRequest,
  type RouteResponse,
  type SchemaInferRequest,
  type SchemaInferResponse,
  type SummarizeRequest,
  type SummarizeResponse,
} from "./types.ts";

export type LLMChains = Partial<Record<LLMOperation, ProviderName[]>>;

// Per-attempt timeouts. Aligned with PERFORMANCE §2.2 stage budgets at
// roughly 3-4× p99 — long enough that healthy providers always finish,
// short enough that a hung provider is detected before the Worker's
// wall-clock budget burns out.
export const DEFAULT_TIMEOUTS_MS: Record<LLMOperation, number> = {
  // SK-ASK-009 — merged routeAsk runs cheap-tier on the hot path
  // before plan-cache lookup. One short prompt (goal + dbset +
  // recent-tables MRU), one short JSON response.
  route: 1500,
  plan: 5000,
  summarize: 3000,
  // Schema-inference is a one-shot creation event; budget like a
  // hard plan call (PERFORMANCE §2.2 stage budgets) rather than the
  // hot-path `plan` op — it runs once per DB, not per query.
  schema_infer: 8000,
  // Engine classification (SK-DB-010) — cheap-tier, short prompt, runs
  // once per db.create when the caller didn't pin `engine`. Same
  // 1500 ms budget as route.
  engine_classify: 1500,
};

// HTTP statuses that indicate a config bug (bad key, forbidden), not
// a provider outage. Excluded from the circuit breaker — opening the
// breaker on these just delays surfacing the real problem and tricks
// dashboards into thinking the upstream is unhealthy.
const AUTH_FAILURE_STATUSES = new Set([401, 403]);

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
  // SK-LLM-030 — upper bound on the per-incident cooldown a single 429's
  // `Retry-After` may open the breaker for. Caps a provider that sends a
  // multi-minute window from wedging the prod router (which rotates for
  // latency). Defaults to 5 min; the eval sets it to Infinity to honor
  // the server's full window for its checkpoint-and-resume decision.
  maxRateLimitCooldownMs?: number;
  // SK-LLM-014 — Hedged-request races for operations marked here. After
  // `afterMs` head-start, fire the second eligible provider in parallel
  // with the first; whichever returns a usable result first wins, the
  // loser's signal aborts. Trades ~1.05× provider RPS for elimination
  // of the timeout-tail (Dean & Barroso 2013, "The Tail at Scale").
  //
  // ⚠️ FREE-TIER PROVIDER CHAINS ONLY. Hedging duplicates the request
  // to a second provider on the slow tail; on free-tier providers
  // (Groq / Gemini / Workers AI / OpenRouter free) the marginal cost
  // is $0, so racing them is pure latency win. When the paid chain
  // lands (SK-LLM-007 — retention-off Anthropic / OpenAI for Pro
  // tenants), do NOT enable hedging there: every paid call is real
  // per-token money and racing doubles the bill on the tail. Wire
  // this map per-operation so paid-chain ops can opt out individually
  // even when their op shares a key (e.g. `plan`) with a free hedge.
  hedge?: Partial<Record<LLMOperation, { afterMs: number }>>;
};

const DEFAULT_BREAKER = { failureThreshold: 3, cooldownMs: 60_000 };

// SK-LLM-030 — prod-safe ceiling on a 429-driven cooldown (5 min).
const DEFAULT_MAX_RATE_LIMIT_COOLDOWN_MS = 5 * 60_000;

// SK-LLM-038 — transient reasons worth a single same-provider retry at
// the chain tail. `network` (fetch threw) and `http_5xx` (upstream
// temporarily unavailable) are transient and fast-failing; a retry is
// the textbook recovery. `rate_limited` / `circuit_open` are capacity
// (failover, not retry), `http_4xx` / `parse` are request-shaped (a
// retry reproduces them), and `timeout` already burned the full budget
// so a retry would likely time out again — all excluded.
const TAIL_RETRY_REASONS: ReadonlySet<FailoverReason> = new Set(["network", "http_5xx"]);

// Short fixed backoff before the tail retry. Best practice is not to
// retry a transient failure instantly (it hammers a recovering
// upstream); 150 ms is enough to clear a momentary blip without
// meaningfully extending an already-failed request.
const TAIL_RETRY_BACKOFF_MS = 150;

type BreakerState = {
  consecutiveFailures: number;
  // ms-epoch when the breaker was opened (>0 means open until
  // openedAt + cooldownMs).
  openedAt: number;
  // SK-LLM-030 — per-incident cooldown override (a 429's capped
  // `Retry-After` window). Undefined ⇒ use the router-wide cooldownMs.
  cooldownMsOverride?: number;
};

function makeBreakerStore(): Map<ProviderName, BreakerState> {
  return new Map();
}

function breakerOpen(state: BreakerState | undefined, now: number, cooldown: number): boolean {
  if (!state || state.openedAt === 0) return false;
  return now - state.openedAt < (state.cooldownMsOverride ?? cooldown);
}

export type LLMRouter = {
  route(req: RouteRequest, opts?: CallOpts): Promise<RouteResponse>;
  plan(req: PlanRequest, opts?: CallOpts): Promise<PlanResponse>;
  summarize(req: SummarizeRequest, opts?: CallOpts): Promise<SummarizeResponse>;
  schemaInfer(req: SchemaInferRequest, opts?: CallOpts): Promise<SchemaInferResponse>;
  engineClassify(req: EngineClassifyRequest, opts?: CallOpts): Promise<EngineClassifyResponse>;
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

// Translate the caller's `signal.reason` (whatever they passed to
// `controller.abort(reason)`) back into a thrown error.
//   • If the caller passed an Error, propagate it untouched — preserves
//     their stack and lets `instanceof DOMException` / name checks work.
//   • Otherwise (or if abort was called with no argument), construct a
//     synthetic AbortError so consumers using `err.name === "AbortError"`
//     to detect cancellation still see a sensible result.
function asAbortError(reason: unknown): Error {
  if (reason instanceof Error) return reason;
  const e = new Error(reason === undefined ? "caller cancelled" : String(reason));
  e.name = "AbortError";
  return e;
}

// SK-LLM-038 — abort-aware backoff for the tail retry. Resolves after
// `ms` or as soon as the caller's signal aborts (the caller-abort guard
// after the await turns that into the propagated AbortError), so a
// cancelled request never sits out the full backoff.
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      signal?.removeEventListener("abort", done);
      clearTimeout(timer);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });
}

// 401/403 are config bugs (bad/missing API key), not provider outages.
// Excluding them from the breaker keeps a misconfigured deploy from
// looking like an upstream problem on dashboards.
function isAuthFailure(reason: FailoverReason, error: unknown): boolean {
  if (reason !== "http_4xx") return false;
  const status = (error as { status?: number } | undefined)?.status;
  return status !== undefined && AUTH_FAILURE_STATUSES.has(status);
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
  const maxRateLimitCooldownMs = opts.maxRateLimitCooldownMs ?? DEFAULT_MAX_RATE_LIMIT_COOLDOWN_MS;
  const breakerState = makeBreakerStore();

  // Tracer pinned to semconv 1.37 for our gen_ai.* attributes. The
  // 3-arg `getTracer(name, version, { schemaUrl })` form requires
  // @opentelemetry/api ≥1.10; on 1.9.x we surface the schema URL as
  // a span attribute instead so schema-aware backends can still pick
  // it up. Once we bump api → 1.10, fold this back into getTracer's
  // options arg and drop the per-span attribute.
  const tracer = trace.getTracer("@nlqdb/llm");
  const schemaUrlAttr = { "otel.schema_url": SEMCONV_SCHEMA_URL } as const;

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
          ...schemaUrlAttr,
          // Legacy attribute names — kept until existing dashboards
          // migrate to the gen_ai.* keys above.
          "llm.provider": provider.name,
          "llm.model": provider.model(op),
        },
      },
      async (span) => {
        const startedAt = performance.now();
        // SK-LLM-014 — `hedge_lost` is its own outcome value (not
        // "error") so dashboards filtering `status="error"` don't
        // over-count cancelled hedge legs. Bounded cardinality:
        // 3 values × ops × providers stays well under SK-OBS-002's
        // 8 k active-series budget.
        let outcome: "ok" | "error" | "hedge_lost" = "error";
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
          if (reason === "hedge_lost") {
            // SK-LLM-014 — hedge winner cancelled this leg. Not a
            // real failure: skip the ERROR span status and the
            // recorded exception so Tempo's "errors" filter doesn't
            // light up. The boolean attribute lets dashboards
            // explicitly filter / count hedge-cancel spans.
            span.setAttribute("nlqdb.llm.hedge_lost", true);
            outcome = "hedge_lost";
          } else {
            const wrapped = asError(err);
            span.recordException(wrapped);
            span.setStatus({ code: SpanStatusCode.ERROR, message: wrapped.message });
          }
          // SK-LLM-030 — surface the server's back-off window so a trace
          // explains why this provider's breaker opened on a 429.
          if (err instanceof ProviderError && err.retryAfterMs !== undefined) {
            span.setAttribute("nlqdb.llm.retry_after_ms", err.retryAfterMs);
          }
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

  // Update the breaker for a single provider given an attempt result.
  // Shared by the sequential path and the hedged path so the rules
  // for "what counts as a real provider-health failure" stay in one
  // place. `hedge_lost` is intentionally skipped: it's our own cancel,
  // not a provider failure.
  function updateBreakerFromResult(
    name: ProviderName,
    result: AttemptResult<unknown>,
    now: number,
  ): void {
    if (result.ok) {
      breakerState.set(name, { consecutiveFailures: 0, openedAt: 0 });
      return;
    }
    // SK-LLM-030 — a 429 is an unambiguous "back off now", unlike a flaky
    // 5xx: open the breaker immediately (no 3-strike wait) for the
    // server's `Retry-After` window, floored at the default cooldown and
    // capped so a long window can't wedge the router.
    if (result.reason === "rate_limited") {
      const retryAfterMs = (result.error as ProviderError | undefined)?.retryAfterMs ?? 0;
      const cooldownMsOverride = Math.min(
        Math.max(retryAfterMs, breaker.cooldownMs),
        maxRateLimitCooldownMs,
      );
      const failures = (breakerState.get(name)?.consecutiveFailures ?? 0) + 1;
      breakerState.set(name, { consecutiveFailures: failures, openedAt: now, cooldownMsOverride });
      return;
    }
    const skip =
      result.reason === "not_configured" ||
      result.reason === "parse" ||
      result.reason === "hedge_lost" ||
      isAuthFailure(result.reason, result.error);
    if (skip) return;
    const state = breakerState.get(name);
    const failures = (state?.consecutiveFailures ?? 0) + 1;
    breakerState.set(name, {
      consecutiveFailures: failures,
      openedAt: failures >= breaker.failureThreshold ? now : 0,
    });
  }

  // Walks the provider chain for `op`, attempting each in order until
  // one succeeds. Renamed from `route` so it doesn't shadow the
  // returned router's `route` method (the SK-ASK-009 op).
  async function dispatch<Req, Res>(
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

    // SK-LLM-014 — Hedged race over the first two eligible providers
    // when `opts.hedge[op]` is configured. Free-tier providers only —
    // see LLMRouterOptions.hedge for the cost rationale. Both legs
    // emit their own `llm.<op>` span via `attempt()`; the loser's
    // span ends with `reason: "hedge_lost"` so dashboards can count
    // hedge fires without inflating the breaker.
    let chainStart = 0;
    const hedgeCfg = opts.hedge?.[op];
    if (hedgeCfg) {
      type Eligible = { name: ProviderName; chainIdx: number; provider: Provider };
      const eligible: Eligible[] = [];
      const nowForEligibility = Date.now();
      for (let i = 0; i < chain.length && eligible.length < 2; i++) {
        const name = chain[i];
        if (!name) continue;
        const provider = byName.get(name);
        if (!provider) continue;
        const state = breakerState.get(name);
        if (breakerOpen(state, nowForEligibility, breaker.cooldownMs)) continue;
        eligible.push({ name, chainIdx: i, provider });
      }

      if (eligible.length >= 2) {
        const [a, b] = eligible as [Eligible, Eligible];
        const outcome = await raceHedgedPair(
          op,
          a.provider,
          b.provider,
          req,
          call,
          callerOpts,
          timeoutMs,
          hedgeCfg.afterMs,
          attempt,
        );

        // Caller-abort cuts the whole call short, mirror the
        // mid-walk abort handling in the sequential loop below.
        if (callerOpts?.signal?.aborted) {
          throw asAbortError(callerOpts.signal.reason);
        }

        const now = Date.now();
        updateBreakerFromResult(a.name, outcome.a, now);
        if (outcome.b) updateBreakerFromResult(b.name, outcome.b, now);

        if (outcome.winner) {
          // Hedge actually engaged AND the secondary leg fired? Record
          // the cancel of the losing leg so dashboards can count hedge
          // fires. `outcome.b === undefined` means primary returned
          // before the head-start delay, so no hedge happened.
          if (outcome.b !== undefined) {
            const loser = outcome.winner.from === "primary" ? b.name : a.name;
            const winner = outcome.winner.from === "primary" ? a.name : b.name;
            llmFailoverTotal().add(1, {
              from_provider: loser,
              to_provider: winner,
              reason: "hedge_lost",
            });
          }
          return outcome.winner.value;
        }

        // Both legs failed (or only `a` ran and failed within the
        // head-start before `b` got the chance — handled below by
        // checking `outcome.b`). Record each attempt and advance the
        // chain index past the pair.
        if (!outcome.a.ok) {
          attempts.push({ provider: a.name, reason: outcome.a.reason, error: outcome.a.error });
        }
        if (outcome.b && !outcome.b.ok) {
          attempts.push({ provider: b.name, reason: outcome.b.reason, error: outcome.b.error });
          const next = chain[b.chainIdx + 1];
          if (next) {
            llmFailoverTotal().add(1, {
              from_provider: b.name,
              to_provider: next,
              reason: outcome.b.reason,
            });
          }
          chainStart = b.chainIdx + 1;
        } else {
          // `b` never fired (primary failed inside the head-start
          // window so we skipped the hedge). Fall through from the
          // entry after `a` — `b` is still eligible for the sequential
          // pass.
          const next = chain[a.chainIdx + 1];
          if (next && !outcome.a.ok) {
            llmFailoverTotal().add(1, {
              from_provider: a.name,
              to_provider: next,
              reason: outcome.a.reason,
            });
          }
          chainStart = a.chainIdx + 1;
        }
      }
    }

    for (let i = chainStart; i < chain.length; i++) {
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
        // Emit a zero-duration span so traces stay self-explanatory —
        // without this, dashboards just see "no span" and can't tell the
        // breaker rejected anything (vs. the request never happening).
        tracer
          .startSpan(`llm.${op}`, {
            attributes: {
              ...genAiAttributes({
                system: provider.name,
                operation: op,
                requestModel: provider.model(op),
              }),
              ...schemaUrlAttr,
              "llm.provider": provider.name,
              "llm.model": provider.model(op),
              "nlqdb.llm.circuit_open": true,
            },
          })
          .end();
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

      let result = await attempt(op, provider, req, call, callerOpts, timeoutMs);
      if (result.ok) {
        // Success resets the breaker.
        breakerState.set(name, { consecutiveFailures: 0, openedAt: 0 });
        return result.value;
      }

      // Caller-initiated cancel — propagate the caller's abort reason
      // (not the inner provider's wrapped error) so try/catch on
      // `signal.reason` / `err.name === "AbortError"` works as expected.
      // Don't keep walking the chain and burning budget the caller no
      // longer wants spent.
      if (callerOpts?.signal?.aborted) {
        throw asAbortError(callerOpts.signal.reason);
      }

      // SK-LLM-038 — tail transient retry. The last provider in the
      // chain has no fallback, so a single transient blip on it
      // (`mistral:network` on the planner tier's capacity backstop,
      // SK-LLM-028) permanently loses the request even though the
      // provider is healthy. Retry it once after a short backoff before
      // declaring total failure. Fires only here, on the
      // already-exhausted tail — zero added latency for any request that
      // currently succeeds, and strictly additive: it can only convert a
      // would-be failure into a success, never regress a passing call.
      if (!next && TAIL_RETRY_REASONS.has(result.reason)) {
        await sleep(TAIL_RETRY_BACKOFF_MS, callerOpts?.signal);
        if (callerOpts?.signal?.aborted) {
          throw asAbortError(callerOpts.signal.reason);
        }
        const retry = await attempt(op, provider, req, call, callerOpts, timeoutMs);
        if (retry.ok) {
          breakerState.set(name, { consecutiveFailures: 0, openedAt: 0 });
          return retry.value;
        }
        if (callerOpts?.signal?.aborted) {
          throw asAbortError(callerOpts.signal.reason);
        }
        // Retry also failed — record the retry's reason as the tail's
        // final attempt (the first failure already emitted its own span).
        result = retry;
      }

      // Update breaker. Shared with the hedged path so "what counts as a
      // provider-health failure" lives in one place: rate_limited opens
      // immediately (SK-LLM-030); 5xx / network / timeout count toward the
      // 3-strike threshold; not_configured / parse / 401-403 are skipped.
      updateBreakerFromResult(name, result, now);

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
    route(req, callerOpts) {
      return dispatch<RouteRequest, RouteResponse>(
        "route",
        req,
        (p, r, o) => p.route(r, o),
        callerOpts,
      );
    },
    plan(req, callerOpts) {
      return dispatch<PlanRequest, PlanResponse>(
        "plan",
        req,
        (p, r, o) => p.plan(r, o),
        callerOpts,
      );
    },
    summarize(req, callerOpts) {
      return dispatch<SummarizeRequest, SummarizeResponse>(
        "summarize",
        req,
        (p, r, o) => p.summarize(r, o),
        callerOpts,
      );
    },
    schemaInfer(req, callerOpts) {
      return dispatch<SchemaInferRequest, SchemaInferResponse>(
        "schema_infer",
        req,
        (p, r, o) => p.schemaInfer(r, o),
        callerOpts,
      );
    },
    engineClassify(req, callerOpts) {
      return dispatch<EngineClassifyRequest, EngineClassifyResponse>(
        "engine_classify",
        req,
        (p, r, o) => p.engineClassify(r, o),
        callerOpts,
      );
    },
  };
}

// SK-LLM-014 — race two providers with a head-start delay. Free-tier
// only; see LLMRouterOptions.hedge for the cost rationale.
//
// Flow:
//   1. Fire `primary` immediately.
//   2. Race primary's promise against a `hedgeAfterMs` head-start
//      timer.
//   3. If primary returns OK before the timer: skip the hedge — `b`
//      never starts. (The point of the head-start is to avoid burning
//      a duplicate request on the common fast-path case.)
//   4. Otherwise: fire `secondary` in parallel. First success wins;
//      loser's `AbortController` aborts with `HEDGE_LOST`.
//   5. If both fail: return both results so dispatch can record both
//      attempts and fall through to the rest of the chain.
//
// We use plain Promise/resolve plumbing (rather than `AbortSignal.any`
// over the head-start timer) because the head-start logic needs to
// inspect whether primary actually settled — `AbortSignal.timeout`
// doesn't carry that signal.
type HedgeOutcome<Res> = {
  // Set iff at least one leg returned `{ok: true}`.
  winner: { value: Res; from: "primary" | "secondary" } | undefined;
  // Primary always runs in this path, so `a` is always set.
  a: AttemptResult<Res>;
  // `b` is `undefined` when primary returned within the head-start
  // window (success OR failure) — the hedge skipped firing it. Set
  // to the secondary's result when the hedge actually fired.
  b: AttemptResult<Res> | undefined;
};

async function raceHedgedPair<Req, Res>(
  op: LLMOperation,
  primary: Provider,
  secondary: Provider,
  req: Req,
  call: (p: Provider, r: Req, o: CallOpts) => Promise<Res>,
  callerOpts: CallOpts | undefined,
  timeoutMs: number,
  hedgeAfterMs: number,
  attemptFn: (
    op: LLMOperation,
    provider: Provider,
    req: Req,
    call: (p: Provider, r: Req, o: CallOpts) => Promise<Res>,
    callerOpts: CallOpts | undefined,
    timeoutMs: number,
  ) => Promise<AttemptResult<Res>>,
): Promise<HedgeOutcome<Res>> {
  const primaryCtrl = new AbortController();
  const secondaryCtrl = new AbortController();

  // Bridge the caller's outer signal into both leg signals so a
  // caller-side cancel cuts both legs cleanly (and `classifyError`
  // surfaces the caller's `reason`, not `HEDGE_LOST`). The listener
  // MUST be removed at the end of the race — without that, every
  // `raceHedgedPair` call holds two `AbortController` instances in the
  // outer signal's listener list until the outer signal aborts (which,
  // for a successfully completed request, is never). With ~thousands
  // of hedged ops per long-lived caller signal that adds up to a real
  // memory leak.
  let detachAbortBridge: (() => void) | undefined;
  if (callerOpts?.signal) {
    const outer = callerOpts.signal;
    if (outer.aborted) {
      primaryCtrl.abort(outer.reason);
      secondaryCtrl.abort(outer.reason);
    } else {
      const onOuterAbort = () => {
        primaryCtrl.abort(outer.reason);
        secondaryCtrl.abort(outer.reason);
      };
      outer.addEventListener("abort", onOuterAbort, { once: true });
      detachAbortBridge = () => outer.removeEventListener("abort", onOuterAbort);
    }
  }

  try {
    const primaryOpts: CallOpts = {
      ...(callerOpts?.fetch !== undefined ? { fetch: callerOpts.fetch } : {}),
      signal: primaryCtrl.signal,
    };
    const secondaryOpts: CallOpts = {
      ...(callerOpts?.fetch !== undefined ? { fetch: callerOpts.fetch } : {}),
      signal: secondaryCtrl.signal,
    };

    let primaryDone = false;
    let primaryResult: AttemptResult<Res> | undefined;
    const primaryP = attemptFn(op, primary, req, call, primaryOpts, timeoutMs).then((r) => {
      primaryDone = true;
      primaryResult = r;
      return r;
    });

    // Wait for primary OR the head-start delay (whichever fires first).
    // Race primary's resolution against a sleep — if primary settles
    // first, we get to inspect it before deciding on the hedge.
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, hedgeAfterMs);
      void primaryP.finally(() => {
        clearTimeout(timer);
        resolve();
      });
    });

    // Primary already succeeded before the head-start? Done — no hedge.
    if (primaryDone && primaryResult?.ok) {
      return {
        winner: { value: primaryResult.value, from: "primary" },
        a: primaryResult,
        b: undefined,
      };
    }

    // Primary already failed before the head-start? Skip the hedge and
    // let the caller fall through to the rest of the chain. (Firing
    // the hedge here would waste a request — we already know primary's
    // verdict and can move on sequentially.)
    if (primaryDone && primaryResult && !primaryResult.ok) {
      return { winner: undefined, a: primaryResult, b: undefined };
    }

    // Primary is still pending: fire the hedge.
    const secondaryP = attemptFn(op, secondary, req, call, secondaryOpts, timeoutMs);

    // Abort the loser as soon as the winner is known. The abort fires
    // ~immediately (next microtask) on AbortController.abort() so the
    // loser's `attempt()` settles with `reason: "hedge_lost"` within a
    // few ms — `Promise.all` below blocks only on that brief cleanup.
    void primaryP.then((r) => {
      if (r.ok) secondaryCtrl.abort(HEDGE_LOST);
    });
    void secondaryP.then((r) => {
      if (r.ok) primaryCtrl.abort(HEDGE_LOST);
    });

    const [pResult, sResult] = await Promise.all([primaryP, secondaryP]);

    // Tie-breaker: when both legs succeed (rare — secondary fires at
    // the head-start delay, so primary would have to land within the
    // first ~ms of secondary's call), prefer primary. The head-start
    // already filtered out the trivially-fast primary case, so any
    // dual-success here is genuinely a race we can resolve either way.
    let winner: { value: Res; from: "primary" | "secondary" } | undefined;
    if (pResult.ok) {
      winner = { value: pResult.value, from: "primary" };
    } else if (sResult.ok) {
      winner = { value: sResult.value, from: "secondary" };
    }

    return { winner, a: pResult, b: sResult };
  } finally {
    detachAbortBridge?.();
  }
}

function classifyError(err: unknown, signal: AbortSignal): FailoverReason {
  if (err instanceof ProviderError) return err.reason;
  // The combined signal aborting via our timeout surfaces here as an
  // AbortError-like throw the provider couldn't catch (or any subtle
  // code path that bypasses the provider's own ProviderError wrap).
  if (signal.aborted && err instanceof Error && err.name === "AbortError") {
    // SK-LLM-014 — hedge race cancels the loser with `abort(HEDGE_LOST)`;
    // distinguish from a real timeout so the breaker doesn't trip the
    // cancelled provider and dashboards can count actual hedge fires.
    if (signal.reason === HEDGE_LOST) return "hedge_lost";
    return "timeout";
  }
  // Anything else — programmer error, unexpected exception. Tagged
  // distinct from `network` so dashboards don't lie.
  return "unknown";
}

// Sentinel passed to AbortController.abort() when a hedged race
// cancels the losing leg. Exported so tests can assert on it.
export const HEDGE_LOST = "nlqdb.llm.hedge_lost";
