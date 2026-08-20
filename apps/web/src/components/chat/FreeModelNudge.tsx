// FreeModelNudge (SK-PREMIUM-004) — a short, blunt nudge rendered below a
// free-chain reply that either errored on a model-quality code or came back
// under the confidence floor. It is NOT shown on every reply (that's the
// banner-blindness failure SK-PREMIUM-004 rejects) — only when the free model
// actually struggled, and only when the user is on the free chain (a BYOLLM
// user is already on a frontier model, so the copy would be wrong for them).
//
// When we know which free model produced the struggled answer (SK-TRUST-002's
// `trace.model`, or the model an `llm_failed` envelope attempted), we name it in
// a muted attribution line — transparency the AI-error-state UX pattern calls
// for: don't collapse failures into one generic message, tell the user which
// model produced it, and offer a recovery path (the "Switch model" CTA) that
// matches the real failure mode.
//
// The CTA opens the header ModelPicker (which owns "open me") via a window
// event rather than reaching across the tree.

import { MODEL_PICKER_OPEN_EVENT } from "./ModelPicker";

export default function FreeModelNudge({ model }: { model?: string | null }) {
  return (
    <div className="chat-reply__free-nudge" role="note">
      <div className="chat-reply__free-nudge-body">
        <p className="chat-reply__free-nudge-text">
          The free model sucks — use a frontier model for better answers.
        </p>
        {model ? (
          <p className="chat-reply__free-nudge-model">
            Answered by <code>{model}</code>
          </p>
        ) : null}
      </div>
      <button
        type="button"
        className="btn btn--accent chat-reply__free-nudge-cta"
        onClick={() => window.dispatchEvent(new CustomEvent(MODEL_PICKER_OPEN_EVENT))}
      >
        Switch model
      </button>
    </div>
  );
}
