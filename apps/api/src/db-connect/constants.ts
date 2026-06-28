// Sentinel `connection_secret_ref` value for BYO ("connect your own")
// databases. Hosted rows carry an env-var name here (e.g. "DATABASE_URL")
// that the live-query path resolves against the Worker env; BYO rows have
// no such env var — their connection rides the AES-GCM `connection_blob`
// (GLOBAL-031). The sentinel keeps the NOT NULL column (migration 0001)
// satisfied while signalling "open the blob, don't read env".
//
// Written by the connect path (`db-connect/connect.ts`) and read by the
// query-time dispatcher (`ask/build-deps.ts`); both import this one const
// so the writer and reader can never drift.
export const BYO_SECRET_REF_SENTINEL = "__byo_blob__";
