// Wire types mirror @nlqdb/sdk shape-for-shape (GLOBAL-001). A new
// field lands here in the same PR as the SDK addition (GLOBAL-003).
package api

import "encoding/json"

type AskRequest struct {
	Goal    string `json:"goal"`
	DBID    string `json:"dbId,omitempty"`
	Engine  string `json:"engine,omitempty"`
	Confirm bool   `json:"confirm,omitempty"`
}

type Trace struct {
	SQL        string  `json:"sql"`
	PlanID     string  `json:"plan_id"`
	Confidence float64 `json:"confidence"`
	Model      string  `json:"model"`
	CacheHit   bool    `json:"cache_hit"`
}

type SelectedDB struct {
	ID         string  `json:"id"`
	Slug       string  `json:"slug"`
	Confidence float64 `json:"confidence"`
	Reason     string  `json:"reason"`
}

type AskDiff struct {
	Verb         string `json:"verb"`
	Table        string `json:"table"`
	AffectedRows int    `json:"affectedRows"`
	Summary      string `json:"summary"`
}

// AskResponse is the union of the TS SDK's AskOk + AskCreateResult.
// Callers narrow on `Kind == "create"` vs `Status == "ok"`.
type AskResponse struct {
	Status      string                       `json:"status"`
	Kind        string                       `json:"kind"`
	Rows        []map[string]any             `json:"rows"`
	RowCount    int                          `json:"rowCount"`
	Summary     string                       `json:"summary,omitempty"`
	Trace       *Trace                       `json:"trace"`
	SelectedDB  *SelectedDB                  `json:"selected_db,omitempty"`
	Diff        *AskDiff                     `json:"diff,omitempty"`
	Confirm     bool                         `json:"requires_confirm,omitempty"`
	DB          string                       `json:"db,omitempty"`
	DisplayName string                       `json:"displayName,omitempty"`
	SchemaName  string                       `json:"schemaName,omitempty"`
	Engine      string                       `json:"engine,omitempty"`
	PKLive      *string                      `json:"pkLive,omitempty"`
	Plan        json.RawMessage              `json:"plan,omitempty"`
	SampleRows  []map[string]json.RawMessage `json:"sampleRows,omitempty"`
}

// RunRequest mirrors @nlqdb/sdk's `RunSqlRequest` (SK-SDK-009).
// Power-user escape hatch (`GLOBAL-015`): same SQL allow-list as
// `/v1/ask`, DDL still rejected.
type RunRequest struct {
	DB  string `json:"db"`
	SQL string `json:"sql"`
}

// RunResponse mirrors the SDK's `RunSqlResult`. The `trace` block is
// always present (SK-TRUST-002) — `model = "raw"`, `confidence = 1.0`,
// `cache_hit = false` per the orchestrator.
type RunResponse struct {
	Status   string           `json:"status"`
	Rows     []map[string]any `json:"rows"`
	RowCount int              `json:"rowCount"`
	Trace    *Trace           `json:"trace"`
}

type DatabaseSummary struct {
	ID            string  `json:"id"`
	Slug          string  `json:"slug"`
	DisplayName   string  `json:"displayName"`
	Name          string  `json:"name,omitempty"`
	SchemaName    string  `json:"schemaName,omitempty"`
	Engine        string  `json:"engine"`
	PKLive        *string `json:"pkLive,omitempty"`
	LastQueriedAt *int64  `json:"lastQueriedAt,omitempty"`
	CreatedAt     int64   `json:"createdAt"`
}

type DatabasesResponse struct {
	Databases []DatabaseSummary `json:"databases"`
}

// KeyRecord mirrors @nlqdb/sdk's KeyRecord shape (SK-APIKEYS-010).
// Plaintext is never present — `Last4` is the only display field.
// Per-type claim columns are pointers so an absent value round-trips
// as JSON `null`, distinct from an empty string.
type KeyRecord struct {
	ID         string  `json:"id"`
	KeyType    string  `json:"keyType"`
	Last4      string  `json:"last4"`
	Name       *string `json:"name"`
	DBID       *string `json:"dbId"`
	MCPHost    *string `json:"mcpHost"`
	DeviceID   *string `json:"deviceId"`
	LastUsedAt *int64  `json:"lastUsedAt"`
	CreatedAt  int64   `json:"createdAt"`
	RevokedAt  *int64  `json:"revokedAt"`
}

type KeysResponse struct {
	Keys []KeyRecord `json:"keys"`
}

// RevokeKeyResult mirrors the SDK's `RevokeKeyResult`. `AlreadyRevoked`
// is true when the call was a no-op replay on an already-revoked key
// (SK-APIKEYS-011 — idempotent re-DELETE).
type RevokeKeyResult struct {
	OK             bool `json:"ok"`
	AlreadyRevoked bool `json:"alreadyRevoked"`
}
