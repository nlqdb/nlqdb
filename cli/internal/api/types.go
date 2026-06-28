// Wire types mirror @nlqdb/sdk shape-for-shape (GLOBAL-001). A new
// field lands here in the same PR as the SDK addition (GLOBAL-003).
package api

import (
	"encoding/json"
	"strconv"
)

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

// RunRequest mirrors @nlqdb/sdk's `RunSqlRequest` (`SK-SDK-009`).
type RunRequest struct {
	DB  string `json:"db"`
	SQL string `json:"sql"`
}

// RunResponse mirrors the SDK's `RunSqlResult`; `Trace` is always present (`SK-TRUST-002`).
type RunResponse struct {
	Status   string           `json:"status"`
	Rows     []map[string]any `json:"rows"`
	RowCount int              `json:"rowCount"`
	Trace    *Trace           `json:"trace"`
}

// RememberRequest mirrors @nlqdb/sdk's `RememberRequest` (E-02,
// SK-PIVOT-008). The scope fields ride top-level (camelCase, matching
// `validateRememberInput`); the per-kind shape rides nested `payload`.
// Built by `nlq remember`; the server composes the parameterised INSERT.
type RememberRequest struct {
	DB         string         `json:"db"`
	Kind       string         `json:"kind"`
	Payload    map[string]any `json:"payload"`
	EndUserID  string         `json:"endUserId,omitempty"`
	ThreadID   string         `json:"threadId,omitempty"`
	TTLSeconds int            `json:"ttlSeconds,omitempty"`
}

// RememberResult mirrors the SDK's `RememberResult` — the materialised
// row's identity. `ID` is `string | number` on the wire (a bigint
// identity for facts/episodes or an upserted entity id), so it rides as
// raw JSON: decoding a bare number into `any` yields a float64 that `%v`
// would print in scientific notation for large bigints. `ExpiresAt` is
// present only when the fact carried a TTL.
type RememberResult struct {
	Status         string          `json:"status"`
	ID             json.RawMessage `json:"id"`
	Kind           string          `json:"kind"`
	MaterialisedAt string          `json:"materialised_at"`
	ExpiresAt      string          `json:"expires_at,omitempty"`
}

// IDString renders the id for human output: a numeric id verbatim (no
// float rounding), a string id with its JSON quotes stripped.
func (r *RememberResult) IDString() string {
	s := string(r.ID)
	if unquoted, err := strconv.Unquote(s); err == nil {
		return unquoted
	}
	return s
}

// ConnectRequest mirrors the SDK's connect shape for POST /v1/db/connect.
// `ConnectionURL` is a credential — it rides the request body and is never
// persisted by the CLI (sent and discarded; see cmd/db.go).
type ConnectRequest struct {
	Engine        string `json:"engine"`
	ConnectionURL string `json:"connection_url"`
	Name          string `json:"name,omitempty"`
}

// ConnectResponse mirrors the 201 body of POST /v1/db/connect. None of these
// fields echo the connection URL back — the server never returns it.
type ConnectResponse struct {
	DBID          string  `json:"dbId"`
	Name          string  `json:"name"`
	Engine        string  `json:"engine"`
	SchemaPreview string  `json:"schemaPreview"`
	PKLive        *string `json:"pkLive,omitempty"`
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
