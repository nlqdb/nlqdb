// src/App.tsx — Vite + SolidJS.
//
// The @nlqdb/solid wrapper exposes <NlqData> as a Solid component
// with JSX props that compile to fine-grained reactivity — Solid only
// patches the attributes that actually changed on the underlying
// custom element.
//
// This is the analytics engineer's real-time dashboard: refresh every
// 5 seconds, surface the trace block in the console for debugging,
// and lean on Solid's no-virtual-DOM model to keep the patch cost
// near-zero even when the row count is large.

import { NlqData, type NlqDataLoadDetail } from "@nlqdb/solid";

const apiKey = (import.meta.env["VITE_NLQDB_KEY"] as string) ?? "pk_live_REPLACE_ME";

export default function App() {
  return (
    <main>
      <h1>API errors — last 5 minutes</h1>
      <NlqData
        goal="API errors in the last 5 minutes, grouped by status_code"
        apiKey={apiKey}
        template="table"
        refresh="5s"
        onLoad={({ rows, cached }: NlqDataLoadDetail) =>
          console.info("nlq-data loaded", { rows, cached })
        }
      />
    </main>
  );
}
