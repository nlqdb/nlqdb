package cmd

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// runGrants executes `nlq grants <args>` against a fresh root pointed at
// `apiURL`. State/config land in a temp dir and auth resolves to a fixed env
// key so the call never touches the real keychain or mints an anon token.
func runGrants(t *testing.T, apiURL string, args ...string) (string, string, error) {
	t.Helper()
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	t.Setenv("NLQDB_API_KEY", "sk_live_test")

	root := New()
	var out, errBuf bytes.Buffer
	root.SetOut(&out)
	root.SetErr(&errBuf)
	full := append([]string{"grants", "--api-url", apiURL, "--no-update-check"}, args...)
	root.SetArgs(full)
	err := root.Execute()
	return out.String(), errBuf.String(), err
}

func TestGrantsListRendersBothRoles(t *testing.T) {
	var gotMethod, gotPath, gotAuth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod, gotPath, gotAuth = r.Method, r.URL.Path, r.Header.Get("Authorization")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"grants": []map[string]any{
				{
					"id": "g_owned", "role": "owner", "dbId": "db_tutor",
					"ownerTenantId": "me", "granteeTenantId": "buyer_co",
					"scope": []string{"errors", "lessons"}, "status": "active",
					"createdAt": 1_700_000_000, "revokedAt": nil,
				},
				{
					"id": "g_held", "role": "grantee", "dbId": "db_seller",
					"ownerTenantId": "seller_co", "granteeTenantId": "me",
					"scope": []string{"facts"}, "status": "revoked",
					"createdAt": 1_600_000_000, "revokedAt": 1_650_000_000,
				},
			},
		})
	}))
	defer srv.Close()

	out, errBuf, err := runGrants(t, srv.URL, "list")
	if err != nil {
		t.Fatalf("list: %v (stderr=%q)", err, errBuf)
	}
	if gotMethod != http.MethodGet || gotPath != "/v1/grants" {
		t.Errorf("request = %s %s, want GET /v1/grants", gotMethod, gotPath)
	}
	if gotAuth != "Bearer sk_live_test" {
		t.Errorf("Authorization = %q", gotAuth)
	}
	// Both roles, the granted DB, the counterparty, and the scope render;
	// revoked status shows on the held row.
	for _, want := range []string{
		"g_owned", "owner", "db_tutor", "buyer_co", "errors,lessons",
		"g_held", "grantee", "seller_co", "revoked",
	} {
		if !strings.Contains(out, want) {
			t.Errorf("stdout missing %q; got %q", want, out)
		}
	}
}

func TestGrantsListEmpty(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"grants": []any{}})
	}))
	defer srv.Close()

	out, errBuf, err := runGrants(t, srv.URL, "list")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if strings.TrimSpace(out) != "" {
		t.Errorf("empty list should print nothing to stdout; got %q", out)
	}
	if !strings.Contains(errBuf, "No grants yet") {
		t.Errorf("empty hint missing from stderr; got %q", errBuf)
	}
}

func TestGrantsListJSON(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"grants": []map[string]any{
				{
					"id": "g1", "role": "owner", "dbId": "db1",
					"ownerTenantId": "me", "granteeTenantId": "buyer",
					"scope": []string{"t"}, "priceModel": "per_query_v1",
					"status": "active", "createdAt": 1_700_000_000, "revokedAt": nil,
				},
			},
		})
	}))
	defer srv.Close()

	out, _, err := runGrants(t, srv.URL, "list", "--json")
	if err != nil {
		t.Fatalf("list --json: %v", err)
	}
	var parsed struct {
		Grants []map[string]any `json:"grants"`
	}
	if err := json.Unmarshal([]byte(out), &parsed); err != nil {
		t.Fatalf("stdout is not valid JSON: %v\n%s", err, out)
	}
	if len(parsed.Grants) != 1 || parsed.Grants[0]["id"] != "g1" {
		t.Errorf("unexpected JSON grants: %v", parsed.Grants)
	}
	// The opaque priceModel tag rides through --json for programmatic
	// consumers even though human output omits it.
	if parsed.Grants[0]["priceModel"] != "per_query_v1" {
		t.Errorf("priceModel not carried through --json: %v", parsed.Grants[0]["priceModel"])
	}
}

func TestGrantsRevokeHappyPath(t *testing.T) {
	var gotMethod, gotPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod, gotPath = r.Method, r.URL.Path
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "alreadyRevoked": false})
	}))
	defer srv.Close()

	out, errBuf, err := runGrants(t, srv.URL, "revoke", "g_abc")
	if err != nil {
		t.Fatalf("revoke: %v (stderr=%q)", err, errBuf)
	}
	if gotMethod != http.MethodDelete || gotPath != "/v1/grants/g_abc" {
		t.Errorf("request = %s %s, want DELETE /v1/grants/g_abc", gotMethod, gotPath)
	}
	if !strings.Contains(out, "Revoked grant g_abc") {
		t.Errorf("confirmation missing; got %q", out)
	}
}

func TestGrantsRevokeIdempotent(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "alreadyRevoked": true})
	}))
	defer srv.Close()

	out, _, err := runGrants(t, srv.URL, "revoke", "g_abc")
	if err != nil {
		t.Fatalf("revoke: %v", err)
	}
	if !strings.Contains(out, "already revoked") {
		t.Errorf("idempotent confirmation missing; got %q", out)
	}
}

func TestGrantsRevokeNotFound(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]any{"error": "grant_not_found"})
	}))
	defer srv.Close()

	out, errBuf, err := runGrants(t, srv.URL, "revoke", "g_missing")
	if err == nil {
		t.Fatalf("expected error on 404; got out=%q", out)
	}
	if !strings.Contains(errBuf, "grant not found") {
		t.Errorf("expected friendly not-found message; got stderr=%q", errBuf)
	}
}
