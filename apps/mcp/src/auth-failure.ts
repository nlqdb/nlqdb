// SK-MCP-009 — `OAuthProvider.onError` shim. Without it the 401/403
// path runs pre-handler and misconfigured-key probes vanish from OTel.
//
// Contract: must be invoked inside the `nlqdb.mcp.http.request` span
// (`apps/mcp/src/index.ts`) so the span-attribute decoration lands on
// the request span. The counter is recorded unconditionally; the span
// attrs + ERROR status are best-effort — silent when no span is active
// (e.g. a future route that opts out of the wrapping span, like /health).

import { mcpAuthFailuresTotal } from "@nlqdb/otel";
import { SpanStatusCode, trace } from "@opentelemetry/api";

export type OAuthErrorPayload = {
  code: string;
  description: string;
  status: number;
  headers: Record<string, string>;
};

export function recordOAuthError({ code, description, status }: OAuthErrorPayload): void {
  mcpAuthFailuresTotal().add(1, { error_code: code, status: String(status) });
  const span = trace.getActiveSpan();
  if (!span) return;
  span.setAttributes({
    "nlqdb.mcp.auth.error_code": code,
    "nlqdb.mcp.auth.error_status": status,
    "nlqdb.mcp.auth.error_description": description,
  });
  span.setStatus({ code: SpanStatusCode.ERROR, message: code });
}
