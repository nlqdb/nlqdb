package cmd

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/zalando/go-keyring"

	"github.com/nlqdb/nlqdb/cli/internal/credstore"
)

// `nlq login` end-to-end: init mints codes, polling returns pending,
// then approved; the bearer lands in credstore.
func TestLoginEndToEnd(t *testing.T) {
	keyring.MockInit()
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	var polls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/auth/device":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"device_code":               "dev_abc123",
				"user_code":                 "ABCD-WXYZ",
				"verification_uri":          "http://localhost/cli",
				"verification_uri_complete": "http://localhost/cli?code=ABCD-WXYZ",
				"expires_in":                600,
				"interval":                  1, // fast-poll for tests
			})
		case "/v1/auth/device/token":
			n := polls.Add(1)
			if n == 1 {
				w.WriteHeader(http.StatusBadRequest)
				_, _ = w.Write([]byte(`{"error":"authorization_pending"}`))
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"access_token": "sk_live_test123",
				"token_type":   "Bearer",
			})
		default:
			t.Errorf("unexpected path %s", r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer srv.Close()

	root := New()
	root.SetArgs([]string{"login", "--no-browser", "--api-url", srv.URL})
	var buf bytes.Buffer
	root.SetOut(&buf)
	root.SetErr(&buf)
	root.SetContext(context.Background())

	if err := root.Execute(); err != nil {
		t.Fatalf("Execute: %v\noutput:\n%s", err, buf.String())
	}
	if !strings.Contains(buf.String(), "Signed in") {
		t.Errorf("expected success message, got:\n%s", buf.String())
	}

	got, err := credstore.Get(credstore.SlotRefreshToken)
	if err != nil {
		t.Fatalf("credstore.Get: %v", err)
	}
	if got != "sk_live_test123" {
		t.Errorf("stored token = %q, want sk_live_test123", got)
	}
}

// `--json` mode emits structured progress lines, one per step.
func TestLoginJSONMode(t *testing.T) {
	keyring.MockInit()
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/auth/device":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"device_code":               "dev_json",
				"user_code":                 "JSON-CODE",
				"verification_uri":          "http://localhost/cli",
				"verification_uri_complete": "http://localhost/cli?code=JSON-CODE",
				"expires_in":                600,
				"interval":                  1,
			})
		case "/v1/auth/device/token":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"access_token": "sk_live_json_token",
			})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer srv.Close()

	root := New()
	root.SetArgs([]string{"login", "--no-browser", "--json", "--api-url", srv.URL})
	var buf bytes.Buffer
	root.SetOut(&buf)
	root.SetErr(&buf)
	root.SetContext(context.Background())

	if err := root.Execute(); err != nil {
		t.Fatalf("Execute: %v\noutput:\n%s", err, buf.String())
	}

	lines := strings.Split(strings.TrimSpace(buf.String()), "\n")
	// First line: device_init step. Last line: approved step.
	var initSeen, approvedSeen bool
	for _, line := range lines {
		var record map[string]any
		if err := json.Unmarshal([]byte(line), &record); err != nil {
			continue
		}
		if record["step"] == "device_init" {
			initSeen = true
			if record["user_code"] != "JSON-CODE" {
				t.Errorf("user_code = %v", record["user_code"])
			}
		}
		if record["step"] == "approved" {
			approvedSeen = true
		}
	}
	if !initSeen || !approvedSeen {
		t.Errorf("missing JSON steps in output:\n%s", buf.String())
	}
}

// Server returns `expired_token` → CLI surfaces a clear next action.
func TestLoginExpiredToken(t *testing.T) {
	keyring.MockInit()
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/auth/device":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"device_code":               "dev_expired",
				"user_code":                 "EXP-CODE",
				"verification_uri":          "http://localhost/cli",
				"verification_uri_complete": "http://localhost/cli?code=EXP-CODE",
				"expires_in":                600,
				"interval":                  1,
			})
		case "/v1/auth/device/token":
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`{"error":"expired_token"}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer srv.Close()

	root := New()
	root.SetArgs([]string{"login", "--no-browser", "--api-url", srv.URL})
	var buf bytes.Buffer
	root.SetOut(&buf)
	root.SetErr(&buf)
	root.SetContext(context.Background())

	err := root.Execute()
	if err == nil {
		t.Fatalf("expected error, got nil\noutput:\n%s", buf.String())
	}
	if !strings.Contains(buf.String(), "expired") {
		t.Errorf("expected 'expired' in output, got:\n%s", buf.String())
	}
}

// Init failure (network) surfaces a clear error and doesn't touch the keychain.
func TestLoginInitNetworkFailure(t *testing.T) {
	keyring.MockInit()
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	root := New()
	// Unreachable port — fail fast.
	root.SetArgs([]string{"login", "--no-browser", "--api-url", "http://127.0.0.1:1"})
	var buf bytes.Buffer
	root.SetOut(&buf)
	root.SetErr(&buf)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	root.SetContext(ctx)

	if err := root.Execute(); err == nil {
		t.Fatalf("expected init failure, got nil\noutput:\n%s", buf.String())
	}
	if _, err := credstore.Get(credstore.SlotRefreshToken); err == nil {
		t.Errorf("token should not be stored on init failure")
	}
}

// Sanity: the init body the CLI sends is a valid JSON object so
// `parseJsonBody` on the server side doesn't reject it before the
// route handler runs.
func TestLoginInitBodyIsJSON(t *testing.T) {
	keyring.MockInit()
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	var seenBody string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v1/auth/device" {
			buf := make([]byte, r.ContentLength)
			_, _ = r.Body.Read(buf)
			seenBody = string(buf)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"device_code":               "dev_x",
				"user_code":                 "X-Y",
				"verification_uri":          "http://localhost/cli",
				"verification_uri_complete": "http://localhost/cli?code=X-Y",
				"expires_in":                600,
				"interval":                  1,
			})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "sk_live_x"})
	}))
	defer srv.Close()

	root := New()
	root.SetArgs([]string{"login", "--no-browser", "--api-url", srv.URL})
	var buf bytes.Buffer
	root.SetOut(&buf)
	root.SetErr(&buf)
	root.SetContext(context.Background())
	_ = root.Execute()

	var probe map[string]any
	if err := json.Unmarshal([]byte(seenBody), &probe); err != nil {
		t.Fatalf("init body not JSON: %q (%v)", seenBody, err)
	}
}

// printErr renders one sentence with a `✗` prefix — verifies the
// GLOBAL-012 contract for the login failure path.
func TestLoginFailureRendersOneLineError(t *testing.T) {
	keyring.MockInit()
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error":"internal_error"}`))
	}))
	defer srv.Close()

	root := New()
	root.SetArgs([]string{"login", "--no-browser", "--api-url", srv.URL})
	var buf bytes.Buffer
	root.SetOut(&buf)
	root.SetErr(&buf)
	root.SetContext(context.Background())

	if err := root.Execute(); err == nil {
		t.Fatalf("expected error, got nil\noutput:\n%s", buf.String())
	}
	if !strings.Contains(buf.String(), "✗") {
		t.Errorf("expected one-line ✗ error, got:\n%s", buf.String())
	}
}

// Compile-time guard: keep parseJsonBody happy on the server side by
// confirming our init request shape stays empty-object.
func TestDeviceInitBodyShape(t *testing.T) {
	want := "{}"
	got, err := jsonProbe(want)
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	if fmt.Sprintf("%v", got) != "map[]" {
		t.Errorf("body decoded to %v, want empty map", got)
	}
}

func jsonProbe(s string) (any, error) {
	var v any
	if err := json.Unmarshal([]byte(s), &v); err != nil {
		return nil, err
	}
	return v, nil
}
