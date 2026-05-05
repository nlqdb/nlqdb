// Trace — collapsible per-reply pipeline trace (SK-WEB-005).
// Shows each step with its model + latency; the SQL block sits
// below the steps; EXPLAIN, when present, is rendered raw.
// Toggled per-reply (`details`) and globally via Cmd+/ — the
// parent ChatPanel sets `defaultOpen` to the global state.
//
// Honest-latency posture (GLOBAL-011): every step we know about
// renders an entry, even ones that are still in flight; pending
// steps surface a skeleton so the user sees the live pipeline.

import { useEffect, useRef } from "react";

export type TraceStepName =
  | "cache_lookup"
  | "plan"
  | "validate"
  | "exec"
  | "summarize"
  | "confirm_required";

export type TraceStepRecord = {
  name: TraceStepName;
  model?: string;
  latencyMs?: number;
  status: "pending" | "ok" | "error";
  detail?: string;
};

interface TraceProps {
  steps: TraceStepRecord[];
  sql: string | null;
  explain: string | null;
  defaultOpen: boolean;
}

const STEP_LABELS: Record<TraceStepName, string> = {
  cache_lookup: "cache lookup",
  plan: "plan",
  validate: "validate",
  exec: "exec",
  summarize: "summarize",
  confirm_required: "confirm gate",
};

export default function Trace({ steps, sql, explain, defaultOpen }: TraceProps) {
  // Reflect the global Cmd+/ state into <details> open state on
  // change — uncontrolled `open` would otherwise stay stuck on
  // whatever the user last clicked.
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.open = defaultOpen;
  }, [defaultOpen]);

  if (steps.length === 0 && !sql) return null;

  return (
    <details ref={ref} className="chat-trace" open={defaultOpen}>
      <summary className="chat-trace__summary">
        <span>trace</span>
        <span className="chat-trace__hint">Cmd+/</span>
      </summary>
      <ol className="chat-trace__steps">
        {steps.map((step) => (
          <li key={step.name} className="chat-trace__step" data-status={step.status}>
            <span className="chat-trace__step-name">{STEP_LABELS[step.name]}</span>
            {step.model ? <span className="chat-trace__step-model">{step.model}</span> : null}
            <span className="chat-trace__step-latency">
              {step.status === "pending"
                ? "…"
                : step.latencyMs !== undefined
                  ? `${step.latencyMs}ms`
                  : "—"}
            </span>
            {step.detail ? <span className="chat-trace__step-detail">{step.detail}</span> : null}
          </li>
        ))}
      </ol>
      {sql ? (
        <div className="chat-trace__sql">
          <h4 className="chat-trace__heading">sql</h4>
          <pre>
            <code>{sql}</code>
          </pre>
        </div>
      ) : null}
      {explain ? (
        <div className="chat-trace__explain">
          <h4 className="chat-trace__heading">explain</h4>
          <pre>
            <code>{explain}</code>
          </pre>
        </div>
      ) : null}
    </details>
  );
}
