// `gatePreAlpha` — Hono middleware that implements `GLOBAL-027`.
//
// Order in the route chain: `requirePrincipal` → `gatePreAlpha` → handler.
// The middleware is mounted explicitly per route in `index.ts`
// (`SK-GATE-004`): `POST /v1/ask`, `POST /v1/run`,
// `POST /v1/databases`, `POST /v1/chat/messages`. Listing surfaces
// are deliberately untouched.
//
// Flow per request:
//   1. Read `EVAL_BASELINE`. If `gateState === "open"` → `next()`. No IO.
//   2. Read both bypass primitives in parallel. Any hit → `next()`.
//   3. Else → emit `feature.requested.early_access` (fire-and-forget)
//      and return 403 `feature_gated` with the live progress payload.
//
// One OTel span `nlqdb.gate.check` per call with attributes for the
// outcome, bypass reason, and the two lane numbers. The two KV reads
// ride the parent route span (no extra span — they're regional KV,
// not "external" in the `GLOBAL-014` sense).

import type { NlqSurface } from "@nlqdb/events";
import { trace } from "@opentelemetry/api";
import type { MiddlewareHandler } from "hono";
import { buildEventEmitter } from "../events-emitter.ts";
import type { RequireSessionVariables } from "../middleware.ts";
import {
  accountTenantIdFromPrincipal,
  type Principal,
  type RequirePrincipalVariables,
  surfaceFromPrincipal,
} from "../principal.ts";
import { isInviteValid, isUserAllowlisted } from "./bypass.ts";
import { type GateState, gateState, type LaneStatus } from "./check.ts";
import { EVAL_BASELINE } from "./eval-baseline.ts";

export const INVITE_CODE_HEADER = "x-invite-code";

const WAITLIST_URL = "https://nlqdb.com/#waitlist";

/**
 * Body of a 403 `feature_gated` response. Mirrors the SDK's
 * `ApiErrorBody` extension exactly so consumers can rely on shape.
 */
export type FeatureGatedBody = {
  error: {
    status: "feature_gated";
    message: string;
    action: string;
    waitlist_url: string;
    gate: {
      bird_accuracy: number | null;
      spider_accuracy: number | null;
      bird_target: number;
      spider_target: number;
      measured_at: string;
    };
  };
};

function buildBody(state: GateState): FeatureGatedBody {
  return {
    error: {
      status: "feature_gated",
      message: "nlqdb is pre-alpha — join the waitlist for early access.",
      action: "Join the waitlist",
      waitlist_url: WAITLIST_URL,
      gate: {
        bird_accuracy: state.bird.accuracy,
        spider_accuracy: state.spider.accuracy,
        bird_target: state.bird.target,
        spider_target: state.spider.target,
        measured_at: state.measured_at,
      },
    },
  };
}

function setLaneAttrs(
  span: { setAttribute: (k: string, v: string | number) => void },
  lane: "bird" | "spider",
  status: LaneStatus,
) {
  span.setAttribute(`nlqdb.gate.${lane}.status`, status.status);
  if (status.accuracy !== null) {
    span.setAttribute(`nlqdb.gate.${lane}.accuracy`, status.accuracy);
  }
}

export type GateDeps = {
  kv: KVNamespace;
  // Optional — production wires the queue binding; tests inject undefined
  // and the emitter no-ops. Same pattern as `buildEventEmitter`.
  eventsQueue: Queue | undefined;
};

// Common shape the gate reads from the request, regardless of which
// auth middleware (`requirePrincipal` for `/v1/ask` / `/v1/run`;
// `requireSession` for `/v1/databases` / `/v1/chat/messages`) ran
// upstream. `allowlistKey` is the value looked up under
// `gate:user:<key>`; `null` for principals without an account.
type GateSubject = {
  kind: Principal["kind"] | "session";
  principalId: string;
  allowlistKey: string | null;
  surface: NlqSurface;
};

function subjectFromContext(c: {
  get: (k: "principal" | "session") => unknown;
}): GateSubject | null {
  const principal = c.get("principal") as Principal | undefined;
  if (principal) {
    return {
      kind: principal.kind,
      principalId: principal.id,
      allowlistKey: accountTenantIdFromPrincipal(principal),
      surface: surfaceFromPrincipal(principal),
    };
  }
  const session = c.get("session") as
    | { user: { id: string }; session: { token: string } }
    | undefined;
  if (session) {
    return {
      kind: "session",
      principalId: session.user.id,
      allowlistKey: session.user.id,
      surface: "chat",
    };
  }
  return null;
}

export function makeGatePreAlpha(deps: GateDeps): MiddlewareHandler<{
  Variables: RequirePrincipalVariables & RequireSessionVariables;
}> {
  return async (c, next) => {
    const tracer = trace.getTracer("@nlqdb/api");
    return tracer.startActiveSpan("nlqdb.gate.check", async (span) => {
      try {
        const state = gateState(EVAL_BASELINE);
        setLaneAttrs(span, "bird", state.bird);
        setLaneAttrs(span, "spider", state.spider);

        if (state.kind === "open") {
          span.setAttribute("nlqdb.gate.outcome", "pass");
          span.setAttribute("nlqdb.gate.bypass_reason", "open");
          return await next();
        }

        const subject = subjectFromContext(c);
        span.setAttribute("nlqdb.principal.kind", subject?.kind ?? "unknown");

        const inviteHeader = c.req.header(INVITE_CODE_HEADER) ?? null;
        const inviteAttempted = (inviteHeader ?? "").trim().length > 0;
        const [allowlistOutcome, inviteOutcome] = await Promise.all([
          isUserAllowlisted(deps.kv, subject?.allowlistKey ?? null),
          isInviteValid(deps.kv, inviteHeader),
        ]);

        // Surface KV errors on the span without crashing the request
        // (fail-closed at the bypass layer per `bypass.ts` header).
        // An operator who sees `nlqdb.gate.kv_error` non-empty in
        // traces knows to investigate KV health before assuming a
        // genuine pre-alpha block.
        if (allowlistOutcome.error || inviteOutcome.error) {
          span.setAttribute(
            "nlqdb.gate.kv_error",
            allowlistOutcome.error ?? inviteOutcome.error ?? "",
          );
        }

        if (allowlistOutcome.hit) {
          span.setAttribute("nlqdb.gate.outcome", "pass");
          span.setAttribute("nlqdb.gate.bypass_reason", "allowlist");
          return await next();
        }
        if (inviteOutcome.hit) {
          span.setAttribute("nlqdb.gate.outcome", "pass");
          span.setAttribute("nlqdb.gate.bypass_reason", "invite_code");
          return await next();
        }

        span.setAttribute("nlqdb.gate.outcome", "block");
        // Distinguish "no invite presented" from "invite presented
        // but invalid" — the latter is signal for brute-force guess
        // attempts. Operators can alert on a spike in
        // `bypass_reason=invite_invalid` from a single principal.
        span.setAttribute("nlqdb.gate.bypass_reason", inviteAttempted ? "invite_invalid" : "none");

        // `SK-GATE-006` — fire-and-forget demand-signal emit. Per
        // `GLOBAL-024`, every "not yet" path produces a typed event.
        // `executionCtx` is absent in some unit-test flows; tolerate it.
        if (subject) {
          const ctx = tryGetExecutionCtx(c);
          if (ctx) {
            ctx.waitUntil(
              buildEventEmitter(deps.eventsQueue).emit({
                name: "feature.requested.early_access",
                principalId: subject.principalId,
                surface: subject.surface,
              }),
            );
          }
        }

        return c.json(buildBody(state), 403);
      } finally {
        span.end();
      }
    });
  };
}

function tryGetExecutionCtx(c: unknown): ExecutionContext | null {
  try {
    return (c as { executionCtx: ExecutionContext }).executionCtx;
  } catch {
    return null;
  }
}
