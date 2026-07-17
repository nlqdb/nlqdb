// src/App.tsx — Vite + React 19 SPA.
//
// The @nlqdb/react wrapper gives <NlqData> the JSX-native prop names
// (camelCase, typed event handlers) without giving up the custom
// element — under the hood it just renders <nlq-data>. <NlqScript>
// injects the elements.nlqdb.com loader once per page.
//
// This is the solo-builder's alternative to the Next.js example:
// same persona (P1 Maya), same goal ("upcoming meals this week"),
// different runtime (no SSR, no app router — just Vite).

import { NlqData, NlqScript, type NlqDataLoadDetail } from "@nlqdb/react";

const apiKey = import.meta.env.VITE_NLQDB_KEY ?? "pk_live_REPLACE_ME";

export default function App() {
  return (
    <>
      <NlqScript />
      <main>
        <h1>Upcoming meals this week</h1>
        <NlqData
          goal="upcoming meals this week, soonest first"
          apiKey={apiKey}
          template="table"
          refresh="30s"
          onLoad={({ rows, cached }: NlqDataLoadDetail) =>
            console.info("nlq-data loaded", { rows, cached })
          }
        />
      </main>
    </>
  );
}
