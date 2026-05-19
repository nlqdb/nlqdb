package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/nlqdb/nlqdb/cli/internal/auth"
)

func TestAskSendsBearerAndUserAgent(t *testing.T) {
	var seenAuth, seenUA string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seenAuth = r.Header.Get("Authorization")
		seenUA = r.Header.Get("User-Agent")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"status":   "ok",
			"rows":     []map[string]any{{"n": 1}},
			"rowCount": 1,
			"trace": map[string]any{
				"sql": "SELECT 1", "plan_id": "p1", "confidence": 0.9, "model": "m", "cache_hit": false,
			},
		})
	}))
	defer srv.Close()

	c := New(srv.URL, auth.Identity{Kind: auth.KindEnvKey, Token: "sk_live_abc"})
	resp, err := c.Ask(context.Background(), AskRequest{Goal: "hello"})
	if err != nil {
		t.Fatalf("Ask: %v", err)
	}
	if resp.Status != "ok" {
		t.Errorf("Status = %q", resp.Status)
	}
	if seenAuth != "Bearer sk_live_abc" {
		t.Errorf("Authorization = %q", seenAuth)
	}
	if !strings.HasPrefix(seenUA, "nlq/") {
		t.Errorf("User-Agent = %q (want nlq/… prefix)", seenUA)
	}
}

func TestRetriesOnTransient5xx(t *testing.T) {
	var hits atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := hits.Add(1)
		if n < 3 {
			w.WriteHeader(http.StatusBadGateway)
			_, _ = w.Write([]byte(`{"error":{"status":"upstream_error"}}`))
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"status":   "ok",
			"rows":     []map[string]any{},
			"rowCount": 0,
			"trace":    map[string]any{"sql": "", "plan_id": "p", "confidence": 1, "model": "m", "cache_hit": true},
		})
	}))
	defer srv.Close()

	c := New(srv.URL, auth.Identity{Kind: auth.KindAnonymous, Token: "anon_x"})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, err := c.Ask(ctx, AskRequest{Goal: "x"}); err != nil {
		t.Fatalf("expected success after retries, got %v", err)
	}
	if got := hits.Load(); got != 3 {
		t.Errorf("expected 3 hits, got %d", got)
	}
}

func TestDoesNotRetry4xx(t *testing.T) {
	var hits atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":{"status":"goal_required"}}`))
	}))
	defer srv.Close()

	c := New(srv.URL, auth.Identity{Kind: auth.KindEnvKey, Token: "sk_live_x"})
	_, err := c.Ask(context.Background(), AskRequest{Goal: "x"})
	if err == nil {
		t.Fatalf("expected error")
	}
	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("expected APIError, got %T", err)
	}
	if apiErr.Status != "goal_required" {
		t.Errorf("Status = %q", apiErr.Status)
	}
	if got := hits.Load(); got != 1 {
		t.Errorf("expected 1 hit (no retry on 4xx), got %d", got)
	}
}

func TestParsesStringErrorEnvelope(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":"invalid_json"}`))
	}))
	defer srv.Close()

	c := New(srv.URL, auth.Identity{Kind: auth.KindEnvKey, Token: "sk_live_x"})
	_, err := c.Ask(context.Background(), AskRequest{Goal: "x"})
	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("expected APIError, got %T", err)
	}
	if apiErr.Status != "invalid_json" {
		t.Errorf("Status = %q", apiErr.Status)
	}
}

func TestRetriesReuseIdempotencyKey(t *testing.T) {
	var seen []string
	mu := make(chan struct{}, 1)
	mu <- struct{}{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-mu
		seen = append(seen, r.Header.Get("Idempotency-Key"))
		n := len(seen)
		mu <- struct{}{}
		if n < 3 {
			w.WriteHeader(http.StatusBadGateway)
			_, _ = w.Write([]byte(`{"error":{"status":"upstream_error"}}`))
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"status":   "ok",
			"rows":     []map[string]any{},
			"rowCount": 0,
			"trace":    map[string]any{"sql": "", "plan_id": "p", "confidence": 1, "model": "m", "cache_hit": true},
		})
	}))
	defer srv.Close()

	c := New(srv.URL, auth.Identity{Kind: auth.KindEnvKey, Token: "sk_live_x"})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, err := c.Ask(ctx, AskRequest{Goal: "x"}); err != nil {
		t.Fatalf("Ask: %v", err)
	}
	if len(seen) != 3 {
		t.Fatalf("expected 3 attempts, got %d", len(seen))
	}
	if seen[0] != seen[1] || seen[1] != seen[2] {
		t.Errorf("retries must reuse the same Idempotency-Key, got %v", seen)
	}
	if seen[0] == "" {
		t.Errorf("expected non-empty Idempotency-Key, got %q", seen[0])
	}
}

func TestJitteredBackoffStaysWithinBound(t *testing.T) {
	for attempt := 1; attempt <= 3; attempt++ {
		expo := 200 * time.Millisecond * time.Duration(1<<(attempt-1))
		minD := expo / 2
		maxD := expo
		for range 100 {
			d := jitteredBackoff(attempt)
			if d < minD || d > maxD {
				t.Errorf("attempt=%d: backoff %v outside [%v, %v]", attempt, d, minD, maxD)
			}
		}
	}
}

func TestIdempotencyKeyOnMutations(t *testing.T) {
	var keys []string
	mu := make(chan struct{}, 1)
	mu <- struct{}{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-mu
		keys = append(keys, r.Header.Get("Idempotency-Key"))
		mu <- struct{}{}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"status":   "ok",
			"rows":     []map[string]any{},
			"rowCount": 0,
			"trace":    map[string]any{"sql": "", "plan_id": "p", "confidence": 1, "model": "m", "cache_hit": true},
		})
	}))
	defer srv.Close()

	c := New(srv.URL, auth.Identity{Kind: auth.KindEnvKey, Token: "sk_live_x"})
	for i := range 2 {
		if _, err := c.Ask(context.Background(), AskRequest{Goal: "x"}); err != nil {
			t.Fatalf("Ask %d: %v", i, err)
		}
	}
	if len(keys) != 2 || keys[0] == "" || keys[0] == keys[1] {
		t.Errorf("expected two distinct non-empty Idempotency-Key headers, got %v", keys)
	}
}

func TestListKeys(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/keys" || r.Method != http.MethodGet {
			t.Errorf("got %s %s, want GET /v1/keys", r.Method, r.URL.Path)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"keys": []map[string]any{
				{
					"id":         "k_1",
					"keyType":    "sk_live",
					"last4":      "a4f7",
					"name":       "CI",
					"dbId":       nil,
					"mcpHost":    nil,
					"deviceId":   nil,
					"lastUsedAt": nil,
					"createdAt":  1_700_000_000,
					"revokedAt":  nil,
				},
			},
		})
	}))
	defer srv.Close()
	c := New(srv.URL, auth.Identity{Kind: auth.KindSignedIn, Token: "session_x"})
	rows, err := c.ListKeys(context.Background())
	if err != nil {
		t.Fatalf("ListKeys: %v", err)
	}
	if len(rows) != 1 || rows[0].ID != "k_1" || rows[0].Last4 != "a4f7" {
		t.Errorf("unexpected rows: %+v", rows)
	}
}

func TestRevokeKeyPathEscapesId(t *testing.T) {
	var seenPath, seenMethod string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// EscapedPath() returns the on-the-wire form; r.URL.Path is the
		// decoded form. Asserting on the wire form confirms `/` was %2F-
		// escaped so the id can't accidentally route to /v1/keys/:hash/status.
		seenPath = r.URL.EscapedPath()
		seenMethod = r.Method
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "alreadyRevoked": false})
	}))
	defer srv.Close()
	c := New(srv.URL, auth.Identity{Kind: auth.KindSignedIn, Token: "session_x"})
	res, err := c.RevokeKey(context.Background(), "weird/id with space")
	if err != nil {
		t.Fatalf("RevokeKey: %v", err)
	}
	if seenMethod != http.MethodDelete {
		t.Errorf("method = %q, want DELETE", seenMethod)
	}
	if seenPath != "/v1/keys/weird%2Fid%20with%20space" {
		t.Errorf("path = %q (want %%2F-escaped)", seenPath)
	}
	if !res.OK || res.AlreadyRevoked {
		t.Errorf("res = %+v", res)
	}
}

func TestRevokeKey404Surfaces(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"error":{"status":"key_not_found"}}`))
	}))
	defer srv.Close()
	c := New(srv.URL, auth.Identity{Kind: auth.KindSignedIn, Token: "session_x"})
	_, err := c.RevokeKey(context.Background(), "k_missing")
	var apiErr *APIError
	if !errors.As(err, &apiErr) || apiErr.HTTPStatus != 404 || apiErr.Status != "key_not_found" {
		t.Fatalf("expected typed 404 key_not_found, got %v", err)
	}
}

// GLOBAL-027 — the client surfaces the `feature_gated` envelope with
// its progress block and waitlist URL intact so the renderer can show
// "BIRD 31.8% / 65%" without re-parsing `Raw`.
func TestFeatureGatedSurfacesGateBlock(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Invite-Code") != "" {
			t.Errorf("client must not send X-Invite-Code when none is configured")
		}
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte(`{"error":{
			"status": "feature_gated",
			"message": "nlqdb is pre-alpha — join the waitlist for early access.",
			"action": "Join the waitlist",
			"waitlist_url": "https://nlqdb.com/#waitlist",
			"gate": {
				"bird_accuracy": 0.318,
				"spider_accuracy": null,
				"bird_target": 0.65,
				"spider_target": 0.75,
				"measured_at": "2026-05-18T22:42:29.917Z"
			}
		}}`))
	}))
	defer srv.Close()
	c := New(srv.URL, auth.Identity{Kind: auth.KindSignedIn, Token: "session_x"})
	_, err := c.Ask(context.Background(), AskRequest{Goal: "anything"})
	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("expected APIError, got %v", err)
	}
	if apiErr.Status != "feature_gated" {
		t.Errorf("Status = %q, want feature_gated", apiErr.Status)
	}
	if apiErr.WaitlistURL == "" {
		t.Error("WaitlistURL is empty — surface can't render the CTA")
	}
	if apiErr.Gate == nil {
		t.Fatal("Gate is nil — progress UI has nothing to render")
	}
	if apiErr.Gate.BirdAccuracy == nil || *apiErr.Gate.BirdAccuracy != 0.318 {
		t.Errorf("Gate.BirdAccuracy = %v, want 0.318", apiErr.Gate.BirdAccuracy)
	}
	if apiErr.Gate.SpiderAccuracy != nil {
		t.Errorf("Gate.SpiderAccuracy = %v, want nil (unmeasured)", apiErr.Gate.SpiderAccuracy)
	}
	if apiErr.Gate.BirdTarget != 0.65 || apiErr.Gate.SpiderTarget != 0.75 {
		t.Errorf("targets = (%v, %v), want (0.65, 0.75)", apiErr.Gate.BirdTarget, apiErr.Gate.SpiderTarget)
	}
}

// GLOBAL-027 — `--invite-code` flows through to the wire header.
func TestInviteCodeFlowsToXInviteCodeHeader(t *testing.T) {
	var seen string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = r.Header.Get("X-Invite-Code")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]any{"status": "ok", "rows": []any{}, "rowCount": 0, "trace": map[string]any{"sql": "", "plan_id": "", "confidence": 0, "model": "", "cache_hit": false}})
	}))
	defer srv.Close()
	c := New(srv.URL, auth.Identity{Kind: auth.KindSignedIn, Token: "session_x"}).WithInviteCode("NLQDB-EARLY-2026")
	if _, err := c.Ask(context.Background(), AskRequest{Goal: "ping"}); err != nil {
		t.Fatalf("Ask: %v", err)
	}
	if seen != "NLQDB-EARLY-2026" {
		t.Errorf("X-Invite-Code = %q, want NLQDB-EARLY-2026", seen)
	}
}
