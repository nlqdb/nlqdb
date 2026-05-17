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
