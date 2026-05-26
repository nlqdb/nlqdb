// Output schema for the stranger-test walker. Consumed by `runner.ts`
// and by future §1.2 KPI dashboard tiles that ingest the JSON shape.

export type FlowId = "flow-001" | "flow-002" | "flow-003";
export type PersonaId = "P1" | "P2" | "P3" | "P6";

export type StepStatus = "ok" | "fail" | "skip";

export type StepResult = {
  step: number;
  description: string;
  status: StepStatus;
  detail?: string;
};

export type RunState = "passed" | "failed";

export type FlowRun = {
  prompt: string;
  state: RunState;
  failedStep: number | null;
  // Time from submit to first POST /v1/ask response. When the response is the
  // gate 403 this is honestly "time-to-gate-block", not "time-to-value" — the
  // §1.2 dashboard's status-split surfaces the distinction.
  ttfvMs: number | null;
  durationMs: number;
  steps: StepResult[];
  consoleErrors: string[];
  httpErrors: string[];
};

export type FlowResult = {
  id: FlowId;
  persona: PersonaId;
  runs: FlowRun[];
  passed: number;
  failed: number;
};

export type WalkResult = {
  baseUrl: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  // True when the walker prepended `?invite=<c>` to the navigation URL
  // (SK-STRG-004). The §1.2 dashboard reads this to split TTFV by mode —
  // the gate-403 path and the invite-200 path are different distributions.
  inviteBearing: boolean;
  flows: FlowResult[];
  summary: {
    totalRuns: number;
    passed: number;
    failed: number;
    ttfvP50Ms: number | null;
    ttfvP95Ms: number | null;
  };
};
