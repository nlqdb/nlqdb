// `gatePreAlpha` — `GLOBAL-027` middleware. Mounted after `requirePrincipal`
// (or `requireSession`) on the four "do-work" routes (`SK-GATE-004`).
// The two KV reads ride the parent route span — regional KV isn't an
// "external call" in the `GLOBAL-014` sense, so no separate span.

import type { NlqSurface } from "@nlqdb/events";
import { gateChecksTotal } from "@nlqdb/otel";
import { type Span, trace } from "@opentelemetry/api";
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

type GateOutcome = "pass" | "block";

// Records the gate decision in both places it needs to live: the
// `nlqdb.gate.check` span (per-request debugging) and the
// `nlqdb.gate.checks.total` counter (SK-GATE-008 — the funnel survives
// Tempo's 30-day retention so block rate / redemptions stay queryable).
function recordOutcome(
  span: Span,
  outcome: GateOutcome,
  reason: string,
  principalKind: string,
) {
  span.setAttribute("nlqdb.gate.outcome", outcome);
  span.setAttribute("nlqdb.gate.bypass_reason", reason);
  gateChecksTotal().add(1, {
    outcome,
    bypass_reason: reason,
    principal_kind: principalKind,
  });
}

export type GateDeps = {
  kv: KVNamespace;
  eventsQueue: Queue | undefined;
};

// Auth-source-agnostic view: `requirePrincipal` sets `principal`,
// `requireSession` sets `session`. The gate reads whichever is present.
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
        const subject = subjectFromContext(c);
        const principalKind = subject?.kind ?? "unknown";
        span.setAttribute("nlqdb.principal.kind", principalKind);

        // E2E staging bypass: `--var GATE_OPEN:1` in `_e2e-staging.yml`.
        // MUST remain unset in production (GLOBAL-027 / SK-GATE-003).
        if ((c.env as Cloudflare.Env | undefined)?.GATE_OPEN === "1") {
          recordOutcome(span, "pass", "env_bypass", principalKind);
          return await next();
        }

        const state = gateState(EVAL_BASELINE);
        setLaneAttrs(span, "bird", state.bird);
        setLaneAttrs(span, "spider", state.spider);

        if (state.kind === "open") {
          recordOutcome(span, "pass", "open", principalKind);
          return await next();
        }

        const inviteHeader = c.req.header(INVITE_CODE_HEADER) ?? null;
        const inviteAttempted = (inviteHeader ?? "").trim().length > 0;
        const [allowlistOutcome, inviteOutcome] = await Promise.all([
          isUserAllowlisted(deps.kv, subject?.allowlistKey ?? null),
          isInviteValid(deps.kv, inviteHeader),
        ]);

        // Surface KV trouble on the span so operators can distinguish
        // a real pre-alpha block from a KV outage masquerading as one.
        if (allowlistOutcome.error || inviteOutcome.error) {
          span.setAttribute(
            "nlqdb.gate.kv_error",
            allowlistOutcome.error ?? inviteOutcome.error ?? "",
          );
        }

        if (allowlistOutcome.hit) {
          recordOutcome(span, "pass", "allowlist", principalKind);
          return await next();
        }
        if (inviteOutcome.hit) {
          recordOutcome(span, "pass", "invite_code", principalKind);
          return await next();
        }

        // `invite_invalid` is the brute-force-guess signature; operators
        // can alert on a spike per principal.
        recordOutcome(
          span,
          "block",
          inviteAttempted ? "invite_invalid" : "none",
          principalKind,
        );

        // `SK-GATE-006`. `executionCtx` is absent in unit-test contexts.
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
