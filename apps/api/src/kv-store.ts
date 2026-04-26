// Structural KV-shape used by every module under `src/ask/` that
// stores small string values. `KVNamespace` from workers-types
// satisfies it directly; tests pass an in-memory Map stub. Sharing
// this one type across plan-cache, first-query (and any future
// KV-backed bookkeeping) prevents the same `{ get, put }` triple
// from being declared four times.

export type KVPutOptions = { expirationTtl?: number };

export type KVStore = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: KVPutOptions): Promise<void>;
};
