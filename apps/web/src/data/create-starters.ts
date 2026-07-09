// Starter goals for the anonymous create surface (`CreateForm`).
//
// The anon device gets exactly ONE `/v1/ask` create call before the
// SK-ANON-012 device cap sends it to sign-in, so a stranger's first
// goal is their only shot — a vague first goal burns it on a weak
// schema. A blank "What are you building?" field is the classic
// first-query paralysis point; these are one-click, proven-good build
// goals that each produce a clean multi-table schema, so the first
// (and only free) anon call lands on a legible payoff.
//
// Build goals only — this field CREATES a database from a sentence
// (SK-WEB-002 goal-first hero), it is not the chat query box. Keep the
// list short (the strongest few, not exhaustive — every chip competes
// for the same fold) and each entry self-standing. Clicking a chip only
// fills the input; it never auto-submits, so the one-shot anon cap is
// never spent on a mis-click (the user still presses "Create the DB").
//
// `id` is stable (funnel key for the `home.starter_clicked`
// GLOBAL-024 event); `goal` is the exact text dropped into the input.

export interface CreateStarter {
  id: string;
  goal: string;
}

export const CREATE_STARTERS: CreateStarter[] = [
  { id: "orders", goal: "an orders tracker" },
  { id: "crm", goal: "a customer CRM" },
  { id: "habits", goal: "a habit tracker with daily streaks" },
  { id: "bugs", goal: "a bug tracker for my team" },
  { id: "expenses", goal: "a personal expense log" },
  { id: "bookings", goal: "a bookings calendar for a barber shop" },
];
