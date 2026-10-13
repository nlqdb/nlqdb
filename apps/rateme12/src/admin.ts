// The operator boards: `/admin/{duplicates,merges,pipelines}`. Each is gated to
// administrators, and no account can exist until §5b, so each shows the live
// signed-out card — the true state, as on `/fleet`.

import { html, type View } from "./layout.ts";

const signedOut = (title: string, board: string): View => ({
  title: `${title} — rateme12`,
  body: html`<div class="notice">
  <h2>Sign in to view ${board}</h2>
  <p>This board is for administrators.</p>
  <a class="btn" href="/submit">Sign in</a>
</div>`,
});

const BOARDS: Record<string, View> = {
  duplicates: signedOut("Near-duplicates", "the near-duplicate queue"),
  merges: signedOut("Merge log", "the merge log"),
  pipelines: signedOut("Pipeline health", "pipeline health"),
};

// Own keys only, so `/admin/toString` is a 404 like any other unknown board.
export const adminBoard = (board: string): View | undefined =>
  Object.hasOwn(BOARDS, board) ? BOARDS[board] : undefined;
