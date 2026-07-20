// /app/admin island (SK-GTM-004, GLOBAL-038) — the founder's GTM/PMF
// read. Single-series visuals only (the calm system has one accent,
// SK-WEB-020): strangers are the signal and wear the accent; totals
// live in text, tooltips, and the table views.

import { useEffect, useState } from "react";
import { type AdminMetricsResult, fetchAdminMetrics, type GtmMetrics } from "../../lib/admin";
import ErrorBoundary from "../ErrorBoundary";
import { fillDays, fmtDateTime, fmtPct, funnelStages, sparkPoints, trendSeries } from "./format";

interface AdminDashboardProps {
  apiBase: string;
}

type LoadState = { kind: "loading" } | AdminMetricsResult;

export default function AdminDashboard(props: AdminDashboardProps) {
  // SK-WEB-001 — every island ships behind ErrorBoundary.
  return (
    <ErrorBoundary surface="AdminDashboard">
      <AdminDashboardInner {...props} />
    </ErrorBoundary>
  );
}

function AdminDashboardInner({ apiBase }: AdminDashboardProps) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      const result = await fetchAdminMetrics(apiBase, ac.signal);
      if (!ac.signal.aborted) setState(result);
    })();
    return () => ac.abort();
  }, [apiBase]);

  if (state.kind === "loading") {
    return <p className="admin__status">Loading metrics…</p>;
  }
  if (state.kind === "unauthorized") {
    return (
      <p className="admin__status">
        Session expired — <a href="/auth/sign-in/?return_to=/app/admin/">sign in again</a>.
      </p>
    );
  }
  if (state.kind === "forbidden") {
    return (
      <p className="admin__status" data-testid="admin-forbidden">
        This page is for the nlqdb team. <a href="/app/">Back to the app →</a>
      </p>
    );
  }
  if (state.kind === "error") {
    return <p className="admin__status">{state.message}</p>;
  }
  return <Metrics m={state.metrics} />;
}

function Metrics({ m }: { m: GtmMetrics }) {
  const today = m.generatedAt.slice(0, 10);
  const days = fillDays(m.users.signupsByDay, 28, today);
  const maxDay = Math.max(...days.map((d) => d.total), 1);
  const stages = funnelStages(m);
  const maxStage = Math.max(...stages.map((s) => s.value), 1);
  const needed = Math.max(0, m.pmf.seanEllis.minActivated - m.pmf.seanEllis.activatedStrangers);

  return (
    <div className="admin" data-testid="admin-dashboard">
      <header className="admin__head">
        <h1>GTM / PMF</h1>
        <p className="admin__meta">
          Live from the control plane · generated {fmtDateTime(m.generatedAt)} · strangers exclude
          founder/test accounts ({m.users.internal} internal of {m.users.total} total) and tagged
          robot traffic (walker/preview, {m.funnel.anonDbsSynthetic} synthetic anon DBs)
        </p>
      </header>

      <section aria-labelledby="admin-h-north">
        <h2 id="admin-h-north">Acquisition north-star</h2>
        <div className="admin__tiles">
          <Tile
            label="Activated strangers"
            value={m.activation.activatedStrangers}
            hint="real users with ≥1 successful answer"
            hero
          />
          <Tile
            label="Real unique users"
            value={m.uniques.realUsers}
            hint={`unique stranger accounts · newest ${fmtDateTime(m.users.newestStrangerSignupAt)}`}
          />
          <Tile
            label="Anon devices (organic)"
            value={m.uniques.anonDevicesOrganic}
            hint={`distinct devices with a live DB · ${m.uniques.anonDevicesSynthetic} tagged robots excluded`}
          />
          <Tile
            label="Retained ≥7d"
            value={m.retention.strangersRetained7d}
            hint="strangers active a week after signup"
          />
          <Tile
            label="Active strangers, 7d"
            value={m.retention.strangersActive7d}
            hint="any DB/chat activity this week"
          />
        </div>
      </section>

      <section aria-labelledby="admin-h-funnel">
        <h2 id="admin-h-funnel">Funnel</h2>
        <ol className="admin__funnel">
          {stages.map((s) => (
            <li key={s.label}>
              <span className="admin__funnel-label">
                {s.label} <em>({s.unit})</em>
              </span>
              <span className="admin__funnel-track">
                <span
                  className="admin__funnel-bar"
                  style={{ width: `${Math.max((s.value / maxStage) * 100, s.value > 0 ? 2 : 0)}%` }}
                />
              </span>
              <span className="admin__funnel-value">{s.value}</span>
            </li>
          ))}
        </ol>
        <p className="admin__note">
          Real adoption rate {fmtPct(m.funnel.adoptionRateReal)} ({m.funnel.adoptionsReal} stranger
          adoptions vs {m.funnel.anonDbsTotal - m.funnel.anonDbsSynthetic} organic live anon DBs) ·
          all-traffic rate {fmtPct(m.funnel.adoptionRate)} ({m.funnel.adoptionsTotal} adoptions,{" "}
          {m.funnel.anonDbsTotal} anon DBs incl. {m.funnel.anonDbsSynthetic} synthetic) ·{" "}
          {m.funnel.dbsCreated7d} DBs created in 7d · {m.funnel.dbsTotal} total
        </p>
      </section>

      <section aria-labelledby="admin-h-signups">
        <h2 id="admin-h-signups">Signups — last 28 days</h2>
        <div className="admin__days" role="img" aria-label="Daily signups, last 28 days">
          {days.map((d) => (
            <span
              key={d.day}
              className="admin__day-slot"
              title={`${d.day}: ${d.strangers} stranger${d.strangers === 1 ? "" : "s"}, ${d.total} total`}
            >
              <span
                className="admin__day-bar"
                style={{
                  height: `${Math.max((d.strangers / maxDay) * 100, d.strangers > 0 ? 4 : 0)}%`,
                }}
              />
            </span>
          ))}
        </div>
        <p className="admin__note">
          Bars count strangers; hover a day for the total including internal accounts.
        </p>
        <details>
          <summary>Table view</summary>
          <table className="admin__table">
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Strangers</th>
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {days
                .filter((d) => d.total > 0)
                .map((d) => (
                  <tr key={d.day}>
                    <td>{d.day}</td>
                    <td>{d.strangers}</td>
                    <td>{d.total}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </details>
      </section>

      <section aria-labelledby="admin-h-sources">
        <h2 id="admin-h-sources">Acquisition sources</h2>
        {m.acquisition.dbsBySource.length === 0 ? (
          <p className="admin__note">No DBs yet — sources appear with the first create.</p>
        ) : (
          <table className="admin__table" data-testid="sources-table">
            <thead>
              <tr>
                <th scope="col">Channel</th>
                <th scope="col">DBs (all time)</th>
                <th scope="col">DBs (7d)</th>
                <th scope="col">Strangers</th>
              </tr>
            </thead>
            <tbody>
              {m.acquisition.dbsBySource.map((row) => (
                <tr key={row.source}>
                  <td>{row.source}</td>
                  <td>{row.total}</td>
                  <td>{row.last7d}</td>
                  <td>
                    {m.acquisition.strangersBySource.find((s) => s.source === row.source)
                      ?.strangers ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="admin__note">
          Channel = utm_source, else external referrer host, else “direct”; “untracked” = created
          before the instrument or via CLI/SDK/MCP. {m.acquisition.dbsWithSource} of{" "}
          {m.funnel.dbsTotal} DBs carry a source. Channel keys are canonical in
          docs/research/acquisition-channels.md.
        </p>
      </section>

      <section aria-labelledby="admin-h-quality">
        <h2 id="admin-h-quality">Activation quality</h2>
        <div className="admin__tiles">
          <Tile
            label="First-10 success"
            valueText={fmtPct(m.activation.first10SuccessRate)}
            hint="GLOBAL-025 onboarding KPI, all DBs"
          />
          <Tile
            label="DBs asked ≥2 questions"
            value={m.activation.dbsWithSecondAsk}
            hint={`of ${m.activation.dbsStarted} DBs with any ask`}
          />
          <Tile
            label="DBs active 7d"
            value={m.retention.dbsActive7d}
            hint={`${m.retention.dbsActive30d} in 30d`}
          />
        </div>
      </section>

      <section aria-labelledby="admin-h-pmf">
        <h2 id="admin-h-pmf">PMF signals</h2>
        <div className="admin__tiles">
          <Tile
            label="Premium interest"
            value={m.pmf.premiumInterest}
            hint="“Count me in” clicks, deduped"
          />
          <Tile
            label="Paying customers"
            value={m.pmf.payingCustomers}
            hint={
              Object.entries(m.pmf.customersByStatus)
                .map(([s, n]) => `${s} ${n}`)
                .join(" · ") || "no Stripe customers yet"
            }
          />
        </div>
        <p className="admin__note" data-testid="sean-ellis-gate">
          {m.pmf.seanEllis.runnable
            ? "Sean-Ellis survey is runnable — enough activated strangers to ask “how disappointed…”."
            : `Sean-Ellis survey locked: needs ${needed} more activated stranger${needed === 1 ? "" : "s"} (${m.pmf.seanEllis.activatedStrangers}/${m.pmf.seanEllis.minActivated}).`}
        </p>
      </section>

      <section aria-labelledby="admin-h-trend">
        <h2 id="admin-h-trend">Progress — daily snapshots</h2>
        {m.trend.length < 2 ? (
          <p className="admin__note">
            History starts accruing now — one snapshot per day ({m.trend.length} so far). Trends
            appear from the second day.
          </p>
        ) : (
          <div className="admin__sparks">
            <Spark
              label="Activated strangers"
              values={trendSeries(m.trend, "activatedStrangers")}
            />
            <Spark label="Real unique users" values={trendSeries(m.trend, "strangers")} />
            <Spark
              label="Anon devices (organic)"
              values={trendSeries(m.trend, "anonDevicesOrganic")}
            />
            <Spark label="DBs active 7d" values={trendSeries(m.trend, "dbsActive7d")} />
            <Spark label="Premium interest" values={trendSeries(m.trend, "premiumInterest")} />
          </div>
        )}
        {m.trend.length > 0 && (
          <details>
            <summary>Snapshot table ({m.trend.length} days)</summary>
            <table className="admin__table">
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  <th scope="col">Strangers</th>
                  <th scope="col">Activated</th>
                  <th scope="col">DBs active 7d</th>
                  <th scope="col">Premium interest</th>
                </tr>
              </thead>
              <tbody>
                {m.trend.map((row) => (
                  <tr key={row.day}>
                    <td>{row.day}</td>
                    <td>{numCell(row["strangers"])}</td>
                    <td>{numCell(row["activatedStrangers"])}</td>
                    <td>{numCell(row["dbsActive7d"])}</td>
                    <td>{numCell(row["premiumInterest"])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </section>
    </div>
  );
}

function numCell(v: unknown): string {
  return typeof v === "number" && Number.isFinite(v) ? String(v) : "—";
}

function Tile({
  label,
  value,
  valueText,
  hint,
  hero,
}: {
  label: string;
  value?: number;
  valueText?: string;
  hint?: string;
  hero?: boolean;
}) {
  return (
    <div className={hero ? "admin__tile admin__tile--hero" : "admin__tile"}>
      <span className="admin__tile-label">{label}</span>
      <span className="admin__tile-value">{valueText ?? value ?? "—"}</span>
      {hint ? <span className="admin__tile-hint">{hint}</span> : null}
    </div>
  );
}

function Spark({ label, values }: { label: string; values: number[] }) {
  const latest = values.length > 0 ? values[values.length - 1] : undefined;
  return (
    <figure className="admin__spark">
      <figcaption>
        {label} <strong>{latest ?? "—"}</strong>
      </figcaption>
      <svg
        viewBox="0 0 120 32"
        width="120"
        height="32"
        role="img"
        aria-label={`${label} trend, ${values.length} days`}
      >
        <title>{`${label}: ${values.join(", ")}`}</title>
        <polyline
          points={sparkPoints(values, 120, 32)}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </figure>
  );
}
