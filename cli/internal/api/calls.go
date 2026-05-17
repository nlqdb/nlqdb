package api

import (
	"context"
	"net/http"
	"net/url"
)

// Ask hits POST /v1/ask. Returns either the OK envelope (rows + trace)
// or the create envelope (db + sampleRows). Callers narrow on
// `Kind == "create"`.
func (c *Client) Ask(ctx context.Context, req AskRequest) (*AskResponse, error) {
	var out AskResponse
	if err := c.do(ctx, http.MethodPost, "/v1/ask", req, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// ListDatabases hits GET /v1/databases. Empty list means a fresh tenant
// — the create-path will fire on the next `nlq ask` per SK-ASK-009.
func (c *Client) ListDatabases(ctx context.Context) ([]DatabaseSummary, error) {
	var out DatabasesResponse
	if err := c.do(ctx, http.MethodGet, "/v1/databases", nil, &out); err != nil {
		return nil, err
	}
	return out.Databases, nil
}

// ListKeys hits GET /v1/keys (SK-APIKEYS-010). Session-only on the
// server side; this call resolves a signed-in identity from the
// keychain (`auth.Resolve(true)`) — anon callers cannot enumerate
// keys. Returns active and revoked rows; consumers filter on
// `RevokedAt != nil` if they want only one slice.
func (c *Client) ListKeys(ctx context.Context) ([]KeyRecord, error) {
	var out KeysResponse
	if err := c.do(ctx, http.MethodGet, "/v1/keys", nil, &out); err != nil {
		return nil, err
	}
	return out.Keys, nil
}

// RevokeKey hits DELETE /v1/keys/:id (SK-APIKEYS-011). Idempotent —
// re-DELETE on a revoked key returns `AlreadyRevoked: true` instead
// of an error, so retried calls don't have to special-case it.
// `key_not_found` (HTTP 404) surfaces as an `*APIError` from `c.do`.
func (c *Client) RevokeKey(ctx context.Context, keyID string) (*RevokeKeyResult, error) {
	var out RevokeKeyResult
	if err := c.do(ctx, http.MethodDelete, "/v1/keys/"+url.PathEscape(keyID), nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}
