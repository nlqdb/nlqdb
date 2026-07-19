// Browser-side half of the Sean-Ellis Q1 PMF survey (SK-GTM-006).
// `PmfSurveyCard` in the chat is the only consumer; the fetch wrappers
// follow `lib/billing.ts` (null / false on any failure — the survey is
// a progressive enhancement and must never break the chat), and the
// snooze helpers keep a dismissal client-side so "ask again later"
// costs no server state. Answered-ever is server truth (`answered` on
// the GET); the snooze only spaces out re-asks after a dismissal.

export type PmfSurveyStatus = { answered: boolean; eligible: boolean };

export type SeanEllisResponse =
  | "very_disappointed"
  | "somewhat_disappointed"
  | "not_disappointed"
  | "na";

// Wording verbatim from founder-playbook §2 / acquisition tracker §4.1.
export const SEAN_ELLIS_QUESTION = "How would you feel if you could no longer use nlqdb?";
export const SEAN_ELLIS_OPTIONS: ReadonlyArray<{ value: SeanEllisResponse; label: string }> = [
  { value: "very_disappointed", label: "Very disappointed" },
  { value: "somewhat_disappointed", label: "Somewhat disappointed" },
  { value: "not_disappointed", label: "Not disappointed" },
  { value: "na", label: "N/A — I no longer use it" },
];

const trimBase = (apiBase: string) => apiBase.replace(/\/$/, "");

export async function fetchPmfSurveyStatus(apiBase: string): Promise<PmfSurveyStatus | null> {
  try {
    const res = await fetch(`${trimBase(apiBase)}/v1/pmf-survey`, { credentials: "include" });
    return res.ok ? ((await res.json()) as PmfSurveyStatus) : null;
  } catch {
    return null;
  }
}

export async function submitPmfSurveyResponse(
  apiBase: string,
  response: SeanEllisResponse,
): Promise<boolean> {
  try {
    const res = await fetch(`${trimBase(apiBase)}/v1/pmf-survey`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ response }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Dismissal snooze — 7 days, per device. Storage is injected so the
// logic is unit-testable without a DOM.
export const PMF_SNOOZE_KEY = "nlqdb.pmf.snoozedUntil";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export function pmfSnoozed(storage: Pick<Storage, "getItem">, nowMs: number): boolean {
  try {
    const until = Number(storage.getItem(PMF_SNOOZE_KEY));
    return Number.isFinite(until) && until > nowMs;
  } catch {
    return false;
  }
}

export function snoozePmfSurvey(storage: Pick<Storage, "setItem">, nowMs: number): void {
  try {
    storage.setItem(PMF_SNOOZE_KEY, String(nowMs + SNOOZE_MS));
  } catch {
    // Storage unavailable (private mode) — the card just re-asks next load.
  }
}
