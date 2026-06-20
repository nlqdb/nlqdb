package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/nlqdb/nlqdb/cli/internal/auth"
)

func TestRememberSendsTypedBody(t *testing.T) {
	var gotPath string
	var gotBody map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"status":          "ok",
			"id":              1,
			"kind":            "fact",
			"materialised_at": "2026-06-20T00:00:00Z",
			"expires_at":      "2026-06-27T00:00:00Z",
		})
	}))
	defer srv.Close()

	c := New(srv.URL, auth.Identity{Kind: auth.KindEnvKey, Token: "sk_live_x"})
	resp, err := c.Remember(context.Background(), RememberRequest{
		DB:         "db_agent_memory_v1_abc123",
		Kind:       "fact",
		Payload:    map[string]any{"content": "user prefers dark mode", "tags": []string{"ui"}},
		TTLSeconds: 604800,
	})
	if err != nil {
		t.Fatalf("Remember: %v", err)
	}
	if gotPath != "/v1/memory/remember" {
		t.Errorf("path = %q", gotPath)
	}
	if gotBody["kind"] != "fact" {
		t.Errorf("wire kind = %v", gotBody["kind"])
	}
	if gotBody["ttlSeconds"].(float64) != 604800 {
		t.Errorf("wire ttlSeconds = %v", gotBody["ttlSeconds"])
	}
	payload, _ := gotBody["payload"].(map[string]any)
	if payload["content"] != "user prefers dark mode" {
		t.Errorf("wire payload.content = %v", payload["content"])
	}
	if resp.Kind != "fact" || resp.ExpiresAt == "" {
		t.Errorf("resp = %+v", resp)
	}
}

// A bigint identity must render verbatim, not as a rounded float64 in
// scientific notation (the trap of decoding a JSON number into `any`).
func TestRememberIDStringPreservesBigint(t *testing.T) {
	num := &RememberResult{ID: json.RawMessage("123456789012")}
	if got := num.IDString(); got != "123456789012" {
		t.Errorf("numeric IDString() = %q", got)
	}
	str := &RememberResult{ID: json.RawMessage(`"ent_abc"`)}
	if got := str.IDString(); got != "ent_abc" {
		t.Errorf("string IDString() = %q", got)
	}
}

func TestRememberWrongPreset(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusConflict)
		_, _ = w.Write([]byte(`{"error":{"status":"wrong_preset"}}`))
	}))
	defer srv.Close()

	c := New(srv.URL, auth.Identity{Kind: auth.KindEnvKey, Token: "sk_live_x"})
	_, err := c.Remember(context.Background(), RememberRequest{
		DB:      "db_orders_xyz",
		Kind:    "fact",
		Payload: map[string]any{"content": "x"},
	})
	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("expected APIError, got %T", err)
	}
	if apiErr.Status != "wrong_preset" {
		t.Errorf("Status = %q", apiErr.Status)
	}
}
