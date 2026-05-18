// Eval-side event emitter (SK-QUAL-002). Posts the full `EvalReport`
// (plus baseline diff if present) to the API's POST /v1/events/eval
// endpoint; the API computes the typed event fanout and enqueues onto
// the Cloudflare Queue → events-worker → LogSnag pipeline. The harness
// itself never holds the LogSnag token; it only knows the API token.

import type { EvalReport } from "./types.ts";

export type EmitOptions = {
  // Target API URL — e.g. https://app.nlqdb.com. Required.
  apiUrl: string;
  // Bearer token; must match `EVAL_INGEST_TOKEN` on the API worker.
  token: string;
  // Test-injection point; production callers leave this unset.
  fetchImpl?: typeof fetch;
};

export type EmitResult = {
  accepted: boolean;
  // Echoed count of events the API enqueued. Surfaced in the GH-Actions
  // step summary so an operator can verify the regression fanout matched
  // the expected lane × trigger product.
  emitted?: number;
  status: number;
  errorBody?: string;
};

export async function emitEvalReport(report: EvalReport, opts: EmitOptions): Promise<EmitResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  // Trim trailing slash to make `${apiUrl}/v1/events/eval` deterministic
  // whether the operator passed "https://api.example.com" or ".../".
  const base = opts.apiUrl.replace(/\/+$/, "");
  const res = await fetchImpl(`${base}/v1/events/eval`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${opts.token}`,
    },
    body: JSON.stringify({ report }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "<no body>");
    return { accepted: false, status: res.status, errorBody: body.slice(0, 240) };
  }
  const parsed = (await res.json().catch(() => ({}))) as { accepted?: boolean; emitted?: number };
  return {
    accepted: Boolean(parsed.accepted),
    emitted: typeof parsed.emitted === "number" ? parsed.emitted : undefined,
    status: res.status,
  };
}
