// Sean-Ellis Q1 PMF survey card (SK-GTM-006) — one question, one click,
// asked once per account ever. Self-contained (the FreeModelNudge
// pattern): it fetches its own eligibility on mount and renders nothing
// unless the server says this is an eligible return visit, so the
// ChatPanel diff stays two lines. Anon visitors 401 on the status GET
// and never see it; a dismissal snoozes 7 days client-side.

import { useEffect, useState } from "react";
import {
  SEAN_ELLIS_OPTIONS,
  SEAN_ELLIS_QUESTION,
  type SeanEllisResponse,
  fetchPmfSurveyStatus,
  pmfSnoozed,
  snoozePmfSurvey,
  submitPmfSurveyResponse,
} from "../../lib/pmf-survey";

type Phase = "hidden" | "asking" | "thanks";

export default function PmfSurveyCard({ apiBase }: { apiBase: string }) {
  const [phase, setPhase] = useState<Phase>("hidden");

  useEffect(() => {
    if (pmfSnoozed(window.localStorage, Date.now())) return;
    let cancelled = false;
    fetchPmfSurveyStatus(apiBase).then((status) => {
      if (!cancelled && status?.eligible) setPhase("asking");
    });
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  if (phase === "hidden") return null;

  if (phase === "thanks") {
    // role="status" so a screen-reader hears the acknowledgement (the
    // run-95/96 live-region parity rule for async confirmations).
    return (
      <div className="chat-pmf" role="status">
        <p className="chat-pmf__thanks">Thanks — this directly shapes what we build next.</p>
      </div>
    );
  }

  const answer = (value: SeanEllisResponse) => {
    // Optimistic: the row is PK-deduped server-side and the answer is
    // fire-and-forget UX — a network blip must not resurface the form.
    setPhase("thanks");
    snoozePmfSurvey(window.localStorage, Date.now());
    void submitPmfSurveyResponse(apiBase, value);
  };

  const dismiss = () => {
    snoozePmfSurvey(window.localStorage, Date.now());
    setPhase("hidden");
  };

  return (
    <fieldset className="chat-pmf">
      <legend className="chat-pmf__question">{SEAN_ELLIS_QUESTION}</legend>
      <button
        type="button"
        className="chat-notice__dismiss chat-pmf__dismiss"
        aria-label="Dismiss survey"
        onClick={dismiss}
      >
        &times;
      </button>
      <div className="chat-pmf__options">
        {SEAN_ELLIS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className="btn chat-pmf__option"
            onClick={() => answer(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
