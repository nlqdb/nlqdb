// ModelPicker (SK-PREMIUM-013) — the "which model am I on / pick another"
// control in the chat header. Answers the first question with a pill showing
// the active model; answers the second with a popover: the built-in Free
// chain plus the named frontier models. Frontier entries are BYOLLM
// (bring-your-own-key) per GLOBAL-026 — selecting one you have no key for
// opens a gentle inline key form (never a wall), and storing it routes every
// later ask through your key. The "subscribe for included credits" door is the
// hosted-premium lane (SK-PREMIUM-009), surfaced as "coming soon" until §6.
//
// The model *strings* never live here: the catalog arrives over the wire from
// `GET /v1/models` (SK-PREMIUM-003), so this file only ever renders labels and
// passes catalog-provided provider/model back to `setByollm`.

import type { ByollmStatusResponse, CatalogModel, ModelCatalog } from "@nlqdb/sdk";
import { NlqdbApiError } from "@nlqdb/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { getChatClient } from "../../lib/chat-client";

interface ModelPickerProps {
  apiBase: string;
  // The model that answered the most recent reply (from the trace, SK-TRUST-002).
  // Shown inside the popover as the honest "last answer used X" line — distinct
  // from the *configured* selection the pill reflects.
  lastModel?: string | null;
}

// Title-case a provider slug for UI copy (e.g. "google-ai-studio" → "Google AI
// Studio"). Provider slugs are not model strings, so deriving a display name
// here doesn't cross the SK-PREMIUM-003 "no model string in a surface" line.
function providerName(slug: string): string {
  if (slug === "openai") return "OpenAI";
  return slug
    .split("-")
    .map((w) => (w === "ai" ? "AI" : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

function isActive(status: ByollmStatusResponse | null, m: CatalogModel): boolean {
  if (m.lane !== "byollm") return false;
  return (
    !!status?.configured &&
    status.credential.provider === m.provider &&
    status.credential.model === m.model
  );
}

export default function ModelPicker({ apiBase, lastModel }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null);
  const [status, setStatus] = useState<ByollmStatusResponse | null>(null);
  // True when the deployment can't store BYOLLM keys (KEK unset → 503). We
  // still show the picker (Free works) but disable the add-key affordance
  // with an honest note rather than a form that always 503s.
  const [byollmDisabled, setByollmDisabled] = useState(false);
  const [keyingFor, setKeyingFor] = useState<CatalogModel | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const client = getChatClient(apiBase);

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await client.getByollmStatus());
      setByollmDisabled(false);
    } catch (err) {
      // 503 byollm_unavailable = deployment can't seal keys; treat as
      // "Free only". Anything else (e.g. unauthorized) also falls back to
      // the not-configured empty state — the pill just reads "Free".
      if (err instanceof NlqdbApiError && err.code === "byollm_unavailable") {
        setByollmDisabled(true);
      }
      setStatus({ configured: false });
    }
  }, [client]);

  // Load the catalog once and the current selection. Catalog is public;
  // status needs the session (the chat is auth-guarded, so it resolves).
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const cat = await client.getModels();
        if (live) setCatalog(cat);
      } catch {
        // Catalog fetch failed — leave the pill hidden rather than render a
        // broken control. The chat still works on the free chain.
      }
      if (live) await refreshStatus();
    })();
    return () => {
      live = false;
    };
  }, [client, refreshStatus]);

  // Stable so the close-on-outside-click effect below doesn't re-subscribe
  // every render; only setState setters (stable) are captured.
  const closePopover = useCallback(() => {
    setOpen(false);
    setKeyingFor(null);
    setKeyInput("");
    setFormError(null);
  }, []);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) closePopover();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closePopover();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, closePopover]);

  const activeLabel = (() => {
    if (status?.configured) {
      const match = catalog?.models.find(
        (m) =>
          m.lane === "byollm" &&
          m.provider === status.credential.provider &&
          m.model === status.credential.model,
      );
      return match?.label ?? `${status.credential.provider} · ${status.credential.model}`;
    }
    return "Free";
  })();

  async function selectFree() {
    if (!status?.configured) {
      closePopover();
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await client.clearByollm();
      await refreshStatus();
      closePopover();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function onPickFrontier(m: CatalogModel) {
    if (isActive(status, m)) {
      closePopover();
      return;
    }
    setFormError(null);
    setKeyInput("");
    setKeyingFor(m);
  }

  async function submitKey() {
    if (!keyingFor?.provider || !keyingFor.model) return;
    const key = keyInput.trim();
    if (!key) {
      setFormError("Paste your API key to continue.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await client.setByollm({ provider: keyingFor.provider, model: keyingFor.model, key });
      await refreshStatus();
      closePopover();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  // Catalog not loaded yet — don't render a half-built control.
  if (!catalog) return null;

  const frontier = catalog.models.filter((m) => m.lane === "byollm");

  return (
    <div className="model-picker" ref={rootRef}>
      <button
        type="button"
        className="model-picker__pill"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        title="Choose which model answers your questions"
      >
        <span className="model-picker__pill-label">Model</span>
        <span className="model-picker__pill-value">{activeLabel}</span>
        <span className="model-picker__pill-caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <div className="model-picker__panel" role="menu">
          <p className="model-picker__section">Built-in</p>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={!status?.configured}
            className="model-picker__option"
            onClick={selectFree}
            disabled={busy}
          >
            <span className="model-picker__option-main">
              <span className="model-picker__option-label">Free</span>
              <span className="model-picker__option-note">Built-in models — no key needed.</span>
            </span>
            {!status?.configured ? <span className="model-picker__active">● Active</span> : null}
          </button>

          <p className="model-picker__section">Frontier models</p>
          <ul className="model-picker__list">
            {frontier.map((m) => {
              const active = isActive(status, m);
              const keying = keyingFor?.id === m.id;
              return (
                <li key={m.id} className="model-picker__item">
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    className="model-picker__option"
                    onClick={() => onPickFrontier(m)}
                    disabled={busy}
                  >
                    <span className="model-picker__option-main">
                      <span className="model-picker__option-label">{m.label}</span>
                      <span className="model-picker__option-note">
                        {active ? "Using your own key" : m.note}
                      </span>
                    </span>
                    {active ? (
                      <span className="model-picker__active">● Active</span>
                    ) : (
                      <span className="model-picker__byok-tag">key</span>
                    )}
                  </button>

                  {keying ? (
                    byollmDisabled ? (
                      <p className="model-picker__form-note">
                        Bring-your-own-key isn't configured on this deployment yet.
                      </p>
                    ) : (
                      <div className="model-picker__form">
                        <label className="model-picker__form-label" htmlFor="model-picker-key">
                          {status?.configured && status.credential.provider === m.provider
                            ? `Re-enter your ${providerName(m.provider ?? "")} key to switch to this model`
                            : `Paste your ${providerName(m.provider ?? "")} API key`}
                        </label>
                        <input
                          id="model-picker-key"
                          type="password"
                          className="model-picker__key-input"
                          placeholder="sk-…"
                          value={keyInput}
                          onChange={(e) => setKeyInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void submitKey();
                            }
                          }}
                          spellCheck={false}
                          autoComplete="off"
                          // biome-ignore lint/a11y/noAutofocus: focus the key field the user just opened
                          autoFocus
                        />
                        <div className="model-picker__form-actions">
                          <button
                            type="button"
                            className="btn btn--accent model-picker__save"
                            onClick={() => void submitKey()}
                            disabled={submitting}
                          >
                            {submitting ? "Saving…" : "Save & use"}
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={() => {
                              setKeyingFor(null);
                              setKeyInput("");
                              setFormError(null);
                            }}
                            disabled={submitting}
                          >
                            Cancel
                          </button>
                        </div>
                        <p className="model-picker__form-hint">
                          Dispatched at 0% markup — your key, your bill, never stored in plain text.
                        </p>
                      </div>
                    )
                  ) : null}
                </li>
              );
            })}
          </ul>

          {formError ? (
            <p className="model-picker__error" role="alert">
              {formError}
            </p>
          ) : null}

          <p className="model-picker__subscribe">
            Prefer not to bring a key? A paid plan with included frontier credits is coming soon.
          </p>
          {lastModel ? <p className="model-picker__last">Last answer used {lastModel}.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function errorMessage(err: unknown): string {
  if (err instanceof NlqdbApiError) {
    if (err.code === "invalid_byollm_key")
      return err.body?.message ?? "That key looked wrong — check it and try again.";
    if (err.code === "byollm_unavailable")
      return "BYOLLM key storage isn't configured on this deployment.";
    if (err.code === "unauthorized") return "Sign in expired — sign in again to add a key.";
    return err.body?.message ?? "Couldn't save that — try again.";
  }
  return "Couldn't save that — try again.";
}
