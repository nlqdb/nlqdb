-- SK-PREMIUM-019 — per-API-key default model. A nullable `default_model`
-- column on `api_keys` holding a `/v1/ask` `model` preset ("fast" | "best";
-- "auto" is never stored — it is the same as no default and normalises to
-- NULL at the write layer). NULL = no per-key default.
--
-- Precedence (SK-PREMIUM-019): request `model` > per-key `default_model` >
-- server default (hosted-premium if eligible, else the free chain). Only the
-- account-scoped bearer keys (`sk_live_` / `sk_mcp_`) carry a resolvable key
-- id on the `/v1/ask` path, so a stored default only ever influences those
-- callers; `pk_live_` is read-only + premium-excluded (SK-PREMIUM-018) and
-- `byollm` rows are credentials, not bearer keys.
--
-- Plain `ADD COLUMN` — no CHECK to extend (unlike 0016) and no index needed:
-- the value is read by `getKeyDefaultModel` on the same indexed `id` lookup
-- the principal already resolved, never scanned. Distinct from the existing
-- `model` column (0016), which is the BYOLLM upstream model id for
-- `key_type = 'byollm'` rows — this one is a bearer-key routing preset.

ALTER TABLE api_keys ADD COLUMN default_model TEXT;
