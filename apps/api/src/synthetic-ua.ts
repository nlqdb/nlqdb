// SK-ONBOARD-007 — recognise nlqdb's own synthetic walker traffic so it
// never pollutes the first-10-queries onboarding KPI (GLOBAL-025).
//
// The stranger-test browser walkers (flows 001–003, `tools/stranger-test`)
// drive the *real* anonymous `/v1/ask` path with a fixed User-Agent
// (`nlqdb-stranger-test/<v> (+https://nlqdb.com; …)`, set in
// `tools/stranger-test/src/runner.ts`). Those anonymous walker DBs carry no
// `user` row, so the KPI read-side join `databases.tenant_id → user.email`
// cannot tell a walker from a genuine stranger — only the request UA can.
// The /daily loop defines the funnel KPIs as excluding this bot traffic, so
// the `/v1/ask` handler skips the first-10 counter bump when it sees the UA.
//
// Match the stable product token (version-independent) rather than the full
// UA string so a walker version bump doesn't silently re-pollute the counter.
export const SYNTHETIC_UA_TOKEN = "nlqdb-stranger-test";

export function isSyntheticUserAgent(ua: string | null | undefined): boolean {
  return !!ua && ua.toLowerCase().includes(SYNTHETIC_UA_TOKEN);
}
