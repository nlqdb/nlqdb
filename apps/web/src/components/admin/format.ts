// Pure derivation/formatting logic for the admin dashboard, extracted
// from the island so it's unit-testable without a DOM (the repo's
// keys/group.ts convention).

import type { GtmMetrics } from "../../lib/admin";

export function fmtPct(rate: number | null | undefined): string {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

export function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  return `${new Date(ms).toISOString().slice(0, 16).replace("T", " ")}Z`;
}

export type DayPoint = { day: string; total: number; strangers: number };

/** Fill calendar gaps so the by-day chart shows zero-days as zeros. */
export function fillDays(series: DayPoint[], days: number, endDay: string): DayPoint[] {
  const byDay = new Map(series.map((p) => [p.day, p]));
  const endMs = Date.parse(`${endDay}T00:00:00Z`);
  const out: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(endMs - i * 86_400_000).toISOString().slice(0, 10);
    out.push(byDay.get(day) ?? { day, total: 0, strangers: 0 });
  }
  return out;
}

export type FunnelStage = { label: string; unit: "DBs" | "users"; value: number };

/**
 * The acquisition funnel, top to bottom. Stages 1–2 count DBs, 3–6
 * count users — mixed units are labeled per stage rather than hidden
 * (the funnel is a narrative, not a strict subset chain). Every stage
 * is robot-free (SK-GTM-005): tagged-synthetic anon DBs and internal
 * adoptions are excluded; the totals live in the note line below it.
 */
export function funnelStages(m: GtmMetrics): FunnelStage[] {
  return [
    {
      label: "Anonymous DBs (organic, live)",
      unit: "DBs",
      value: m.funnel.anonDbsTotal - m.funnel.anonDbsSynthetic,
    },
    { label: "Adopted by strangers", unit: "DBs", value: m.funnel.adoptionsReal },
    { label: "Real unique users", unit: "users", value: m.uniques.realUsers },
    { label: "Strangers with a DB", unit: "users", value: m.activation.strangersWithDb },
    { label: "Activated (≥1 answer)", unit: "users", value: m.activation.activatedStrangers },
    { label: "Retained ≥7 days", unit: "users", value: m.retention.strangersRetained7d },
  ];
}

/** Oldest→newest numeric series for one snapshot key; null-safe. */
export function trendSeries(trend: GtmMetrics["trend"], key: string): number[] {
  return [...trend]
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
    .map((row) => {
      const v = row[key];
      return typeof v === "number" && Number.isFinite(v) ? v : 0;
    });
}

/** SVG polyline points for a sparkline, padded so the 2px stroke isn't clipped. */
export function sparkPoints(values: number[], width: number, height: number): string {
  if (values.length === 0) return "";
  const pad = 2;
  const max = Math.max(...values, 1);
  const w = width - pad * 2;
  const h = height - pad * 2;
  const step = values.length > 1 ? w / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = pad + (values.length > 1 ? i * step : w / 2);
      const y = pad + h - (v / max) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
