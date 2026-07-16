// "Copy snippet" CTA (SK-WEB-007). Inlines the user's pk_live_
// for the active DB so they don't have to detour through the API
// keys page — the goal-first flow stays unbroken.
//
// pk_live_ resolution falls through three sources in order:
//   1. The DB the question was asked against (LeftRail-supplied).
//   2. A per-island fallback the chat passes in (mirrors the API
//      response when /v1/databases hasn't been wired yet).
//   3. The anonymous device's pk_live (`nlqdb_anon_pk` set by the
//      anon-create response, SK-ANON-006). Only meaningful when
//      the active surface is the anonymous DB.

import { useState } from "react";
import { emit } from "../../lib/logsnag";
import { type CopySnippetState, copySnippetLabel } from "./copy-snippet-label";

interface CopySnippetProps {
  goal: string;
  pkLive: string | null;
}

export default function CopySnippet({ goal, pkLive }: CopySnippetProps) {
  const [state, setState] = useState<CopySnippetState>("idle");

  async function copy() {
    const key = pkLive ?? readAnonPkLive();
    if (!key) {
      // Only here does signing in help — no pk_live_ resolved (SK-WEB-007).
      setState("no-key");
      return;
    }
    const snippet = buildSnippet(goal, key);
    try {
      await navigator.clipboard.writeText(snippet);
      setState("copied");
      emit("home.snippet_copied", { surface: "chat", goal_length: goal.length });
      // Reset after a beat so the same button can be re-pressed
      // for a different reply without a page reload.
      setTimeout(() => setState("idle"), 1600);
    } catch {
      // The key was valid; the clipboard write threw (permissions/focus).
      // Don't misdiagnose this as an auth wall.
      setState("copy-failed");
    }
  }

  return (
    <button type="button" className="copy-snippet" onClick={copy} data-state={state}>
      {copySnippetLabel(state)}
    </button>
  );
}

function buildSnippet(goal: string, pkLive: string): string {
  const safeGoal = goal.replace(/"/g, "&quot;");
  return `<nlq-data goal="${safeGoal}" api-key="${pkLive}"></nlq-data>`;
}

function readAnonPkLive(): string | null {
  if (typeof window === "undefined") return null;
  // WS02-T5 shape-check: a corrupted or legacy slot must hit the
  // "Couldn't copy" fallback, not produce a snippet whose embed 401s on
  // its first fetch.
  const stored = window.localStorage.getItem("nlqdb_anon_pk");
  return stored?.startsWith("pk_live_") ? stored : null;
}
