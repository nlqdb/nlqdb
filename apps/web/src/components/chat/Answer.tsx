// Answer — the prose half of the three-part chat reply
// (SK-WEB-005). Streaming summaries land here token-at-a-time;
// while the LLM hop is in flight we render a skeleton so the
// pipeline's progress is honest (GLOBAL-011).

interface AnswerProps {
  summary: string | undefined;
  pending: boolean;
}

export default function Answer({ summary, pending }: AnswerProps) {
  if (summary) {
    return (
      <p className="chat-answer" data-pending={pending || undefined}>
        {summary}
      </p>
    );
  }
  if (pending) {
    return (
      <p className="chat-answer chat-answer--skeleton" aria-busy="true">
        <span className="chat-answer__skeleton-line" />
      </p>
    );
  }
  return null;
}
