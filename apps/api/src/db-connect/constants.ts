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

// Sentinel `connection_blob` value for a Supabase database connected via the
// OAuth / Management-API transport (`SK-DBCONN-003`, Option B). Unlike a pasted
// BYO row, a mgmt-connected row stores NO sealed DSN — its query credential is
// the OAuth token sealed in `db_oauth_grants` (AAD `dboauth:<dbId>`), and every
// query runs over `POST /v1/projects/{ref}/database/query` read-only. The
// sentinel lets the query-time dispatcher (`ask/build-deps.ts`) route to the
// mgmt transport with a cheap string check — never a real blob to open, never
// mistaken for a hosted (blob-less) Neon row. Writer: `connect-supabase-mgmt.ts`.
export const SUPABASE_MGMT_BLOB_SENTINEL = "__supabase_mgmt__";
