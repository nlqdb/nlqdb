import type { GateProgress } from "../lib/api";
import { emit } from "../lib/logsnag";

// `GLOBAL-027` 403 envelope renderer — shared by CreateForm and ChatPanel so the gate UX stays consistent.

interface Props {
  message: string;
  gate: GateProgress;
  waitlistUrl: string;
  surface: "createform" | "chat";
}

export function FeatureGatedView({ message, gate, waitlistUrl, surface }: Props) {
  return (
    <div className="feature-gate" role="status" aria-live="polite">
      <p className="feature-gate__message">{message}</p>
      <p className="feature-gate__lanes-caption" aria-hidden="true">
        evals
      </p>
      <dl className="feature-gate__lanes" aria-label="NL-to-SQL accuracy evals">
        <GateLane label="BIRD" accuracy={gate.bird_accuracy} target={gate.bird_target} />
        <GateLane label="Spider" accuracy={gate.spider_accuracy} target={gate.spider_target} />
      </dl>
      <a
        className="btn btn--accent feature-gate__cta"
        href={waitlistUrl}
        target="_blank"
        rel="noreferrer"
        onClick={() => emit("home.gate_cta_clicked", { surface })}
      >
        Join the waitlist
      </a>
    </div>
  );
}

function GateLane({
  label,
  accuracy,
  target,
}: {
  label: string;
  accuracy: number | null;
  target: number;
}) {
  const met = accuracy !== null && accuracy >= target;
  const pct = accuracy === null ? 0 : Math.min(100, (accuracy / target) * 100);
  return (
    <div className={`feature-gate__lane${met ? " feature-gate__lane--met" : ""}`}>
      <dt className="feature-gate__lane-label">{label}</dt>
      <dd className="feature-gate__lane-value">
        {accuracy === null
          ? "not yet measured"
          : `${(accuracy * 100).toFixed(1)}% / ${(target * 100).toFixed(0)}%`}
      </dd>
      <div className="feature-gate__bar" aria-hidden="true">
        <div className="feature-gate__bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
