package api

import (
	"context"
	"net/http"
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
