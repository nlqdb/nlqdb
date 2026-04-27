import type { Row } from "./templates.ts";

// Fixtures backing `<nlq-data data-demo="...">`. The element renders
// these without any API call — used on apps/web until the live
// `/v1/ask` integration lands (Slice 10). Keys here are the values
// authors put in `data-demo="…"`.
const FIXTURES: Record<string, Row[]> = {
  orders: [
    { customer: "Maya", drink: "latte", total: "$5.50", time: "9:14am" },
    { customer: "Jordan", drink: "flat white", total: "$5.00", time: "9:21am" },
    { customer: "Priya", drink: "mocha", total: "$6.00", time: "9:33am" },
    { customer: "Aarav", drink: "espresso", total: "$3.00", time: "9:48am" },
  ],
  signups: [
    { email: "alice@example.com", referrer: "twitter", joined: "2026-04-26" },
    { email: "bob@example.com", referrer: "google", joined: "2026-04-26" },
    { email: "carol@example.com", referrer: "hacker news", joined: "2026-04-27" },
  ],
  preferences: [
    {
      name: "Maya",
      units: "metric",
      diet: "vegetarian",
      timezone: "Europe/Berlin",
    },
  ],
};

export function demoDataFor(key: string): Row[] {
  return FIXTURES[key] ?? [];
}

export function demoFixtureKeys(): string[] {
  return Object.keys(FIXTURES);
}
