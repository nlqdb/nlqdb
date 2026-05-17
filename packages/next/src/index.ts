// @nlqdb/next — Next.js 15 App Router wrapper.
//
// The component surface is re-exported from `@nlqdb/react`; this
// package adds a Next-aware <NlqScript /> using `next/script` and a
// server-only sdk factory for `sk_live_*`-keyed Route Handlers.

export type { NlqDataErrorDetail, NlqDataLoadDetail } from "@nlqdb/react";
export { NlqData, type NlqDataProps, type NlqDataTemplate } from "@nlqdb/react";
export { NlqScript, type NlqScriptProps } from "./script.tsx";
