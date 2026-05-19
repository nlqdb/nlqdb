import type { GateProgress } from "../lib/api";

// `GLOBAL-027` pre-alpha gate progress UI — friendly 403 envelope with
// the eval-baseline snapshot and a waitlist CTA. Rendered by every
// surface that calls `/v1/ask` (CreateForm, ChatPanel).

interface Props {
  message: string;
  gate: GateProgress;
  waitlistUrl: string;
}

export function FeatureGatedView({ message, gate, waitlistUrl }: Props) {
  return (
    <div className="feature-gate">
      <p className="feature-gate__message">{message}</p>
      <dl className="feature-gate__lanes">
        <GateLane label="BIRD" accuracy={gate.bird_accuracy} target={gate.bird_target} />
        <GateLane label="Spider" accuracy={gate.spider_accuracy} target={gate.spider_target} />
      </dl>
      <a
        className="btn btn--accent feature-gate__cta"
        href={waitlistUrl}
        target="_blank"
        rel="noreferrer"
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
