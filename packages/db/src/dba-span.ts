// The spans every step of the DBA loop runs under, on any engine (`GLOBAL-014`).

import { dbDurationMs } from "@nlqdb/otel";
import { type Span, SpanStatusCode, trace } from "@opentelemetry/api";
import type { Proposal } from "./dba-proposal.ts";

// The one `db.observe` span every observer runs under: its proposal count and
// any extra attributes the observer sets.
export function withObserveSpan(
  operation: string,
  schema: string,
  observe: (span: Span) => Promise<Proposal[]>,
  system: "postgresql" | "sqlite" = "postgresql",
): Promise<Proposal[]> {
  return withDbaSpan(
    "db.observe",
    operation,
    schema,
    async (span) => {
      const proposals = await observe(span);
      span.setAttribute("nlqdb.dba.proposals", proposals.length);
      return proposals;
    },
    system,
  );
}

// The span every step of the DBA loop runs under (`GLOBAL-014`):
// its duration and the error it throws (`GLOBAL-012`).
export function withDbaSpan<T>(
  name: "db.observe" | "db.apply" | "db.verify",
  operation: string,
  schema: string,
  run: (span: Span) => Promise<T>,
  system: "postgresql" | "sqlite" = "postgresql",
): Promise<T> {
  return trace.getTracer("@nlqdb/db").startActiveSpan(
    name,
    {
      attributes: {
        "db.system": system,
        "db.operation.name": operation,
        "db.namespace": schema,
      },
    },
    async (span) => {
      const startedAt = performance.now();
      try {
        return await run(span);
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw err;
      } finally {
        dbDurationMs().record(performance.now() - startedAt, { operation });
        span.end();
      }
    },
  );
}
