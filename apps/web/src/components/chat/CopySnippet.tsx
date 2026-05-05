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

interface CopySnippetProps {
  goal: string;
  pkLive: string | null;
}

export default function CopySnippet({ goal, pkLive }: CopySnippetProps) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    const key = pkLive ?? readAnonPkLive();
    if (!key) {
      setState("failed");
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
      setState("failed");
    }
  }

  return (
    <button
      type="button"
      className="copy-snippet"
      onClick={copy}
      aria-label="Copy embed snippet"
      data-state={state}
    >
      {state === "copied"
        ? "Copied"
        : state === "failed"
          ? "Couldn't copy — sign in to load your key."
          : "Copy snippet"}
    </button>
  );
}

function buildSnippet(goal: string, pkLive: string): string {
  const safeGoal = goal.replace(/"/g, "&quot;");
  return `<nlq-data goal="${safeGoal}" api-key="${pkLive}"></nlq-data>`;
}

function readAnonPkLive(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("nlqdb_anon_pk");
}
