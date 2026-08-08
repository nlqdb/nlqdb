// The shared "reply-level action prompt": a prompt line plus a row of choice
// chips, each firing a handler. This is the single presentational rail behind
// every reply that offers the user a set of choices — the SK-ASK-009 DB
// picker, the SK-ASK-014 create/cancel clarify, and the SK-ASK-026
// destructive-clarify options — and the home for the SK-TRUST-003
// `low_confidence` alternatives when they land.
//
// The re-send wiring stays in ChatPanel's `startSend` engine (each `onSelect`
// is a one-line delegator to it); this component owns only the chip mechanics
// (button element, variant, hover title, keys, list markup) so the next
// choice-prompt is a `choices` array, not another hand-rolled `<ul>`.

import type { ReactNode } from "react";

export type ReplyChoice = {
  label: string;
  onSelect: () => void;
  // "accent" marks the primary action (e.g. "Create new database"); the rest
  // are ghost buttons. Defaults to ghost.
  variant?: "accent" | "ghost";
  // Optional hover title — the DB picker shows the full slug behind the
  // display name.
  title?: string;
};

export default function ReplyChoices({
  prompt,
  choices,
}: {
  prompt: ReactNode;
  choices: ReplyChoice[];
}) {
  return (
    <div className="chat-reply__choices">
      <p className="chat-reply__choices-prompt">{prompt}</p>
      <ul className="chat-reply__choices-list">
        {choices.map((choice) => (
          <li key={choice.label}>
            <button
              type="button"
              className={`btn ${choice.variant === "accent" ? "btn--accent" : "btn--ghost"}`}
              onClick={choice.onSelect}
              {...(choice.title ? { title: choice.title } : {})}
            >
              {choice.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
