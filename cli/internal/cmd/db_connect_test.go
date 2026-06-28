package cmd

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// grepDir returns the path of the first file under dir whose contents
// contain needle, or "" if none does.
func grepDir(t *testing.T, dir, needle string) string {
	t.Helper()
	var hit string
	_ = filepath.WalkDir(dir, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() || hit != "" {
			return nil
		}
		b, readErr := os.ReadFile(path)
		if readErr == nil && strings.Contains(string(b), needle) {
			hit = path
		}
		return nil
	})
	return hit
}

// runConnect executes `nlq db connect <args>` against a fresh root pointed at
// `apiURL`, with stdin wired to `stdin`. State/config land in a temp dir and
// auth resolves to a fixed env key so the call never touches the real
// keychain or mints an anon token.
func runConnect(t *testing.T, apiURL, stdin string, args ...string) (string, string, error) {
	t.Helper()
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	t.Setenv("NLQDB_API_KEY", "sk_live_test")

	root := New()
	var out, errBuf bytes.Buffer
	root.SetOut(&out)
	root.SetErr(&errBuf)
	root.SetIn(strings.NewReader(stdin))
	full := append([]string{"db", "connect", "--api-url", apiURL, "--no-update-check"}, args...)
	root.SetArgs(full)
	err := root.Execute()
	return out.String(), errBuf.String(), err
}

func TestDBConnectHappyPath(t *testing.T) {
	var gotBody map[string]any
	var gotAuth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		b, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(b, &gotBody)
		pk := "2026-06-28T00:00:00Z"
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"dbId":          "db_conn_abc",
			"name":          "analytics",
			"engine":        "clickhouse",
			"schemaPreview": "events(id, ts, name), users(id, email)",
			"pkLive":        pk,
		})
	}))
	defer srv.Close()

	const secret = "clickhouse://user:p@ss@host:9440/db"
	out, errBuf, err := runConnect(t, srv.URL, secret+"\n", "--engine", "clickhouse", "--name", "analytics")
	if err != nil {
		t.Fatalf("connect: %v (stderr=%q)", err, errBuf)
	}
	if gotAuth != "Bearer sk_live_test" {
		t.Errorf("Authorization = %q", gotAuth)
	}
	if gotBody["engine"] != "clickhouse" || gotBody["name"] != "analytics" {
		t.Errorf("body engine/name = %v / %v", gotBody["engine"], gotBody["name"])
	}
	if gotBody["connection_url"] != secret {
		t.Errorf("connection_url not forwarded: %v", gotBody["connection_url"])
	}
	// Success confirmation must show the registered metadata + next step.
	for _, want := range []string{"db_conn_abc", "clickhouse", "analytics", "events(id", "nlq ask --db db_conn_abc"} {
		if !strings.Contains(out, want) {
			t.Errorf("stdout missing %q; got %q", want, out)
		}
	}
	// The connection URL is a secret: it must never be echoed to the user.
	if strings.Contains(out, secret) || strings.Contains(errBuf, secret) {
		t.Fatalf("connection URL leaked to output: stdout=%q stderr=%q", out, errBuf)
	}
}

func TestDBConnectErrorPassthrough(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"error": map[string]any{
				"status":  "upstream_unreachable",
				"message": "could not reach the database at host:9440 within the timeout",
			},
		})
	}))
	defer srv.Close()

	out, errBuf, err := runConnect(t, srv.URL, "postgres://u@h/db\n", "--engine", "postgres")
	if err == nil {
		t.Fatal("expected error from 502")
	}
	// GLOBAL-012: the server's message is surfaced verbatim.
	if !strings.Contains(errBuf, "could not reach the database at host:9440 within the timeout") {
		t.Fatalf("error message not surfaced verbatim; stderr=%q", errBuf)
	}
	if out != "" {
		t.Fatalf("expected no stdout on error, got %q", out)
	}
}

func TestDBConnectRejectsBadEngine(t *testing.T) {
	// No server is contacted — validation happens before any HTTP call.
	out, errBuf, err := runConnect(t, "http://127.0.0.1:0", "url\n", "--engine", "mysql")
	if err == nil {
		t.Fatal("expected error for unsupported engine")
	}
	if !strings.Contains(errBuf, "clickhouse or postgres") {
		t.Fatalf("stderr = %q", errBuf)
	}
	if out != "" {
		t.Fatalf("expected no stdout, got %q", out)
	}
}

// TestDBConnectURLNotPersisted proves the connection URL never lands in the
// config/state tree on disk, only the DB id does (SK-CLI-019).
func TestDBConnectURLNotPersisted(t *testing.T) {
	cfgDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", cfgDir)
	t.Setenv("NLQDB_API_KEY", "sk_live_test")

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"dbId": "db_conn_xyz", "name": "", "engine": "postgres", "schemaPreview": "",
		})
	}))
	defer srv.Close()

	const secret = "postgres://admin:supersecret@db.internal:5432/prod"
	root := New()
	var out, errBuf bytes.Buffer
	root.SetOut(&out)
	root.SetErr(&errBuf)
	root.SetIn(strings.NewReader(secret + "\n"))
	root.SetArgs([]string{"db", "connect", "--api-url", srv.URL, "--no-update-check", "--engine", "postgres"})
	if err := root.Execute(); err != nil {
		t.Fatalf("connect: %v (stderr=%q)", err, errBuf)
	}

	// Walk the whole config dir; no file may contain the secret.
	if leak := grepDir(t, cfgDir, "supersecret"); leak != "" {
		t.Fatalf("connection URL persisted to %s", leak)
	}
	if leak := grepDir(t, cfgDir, secret); leak != "" {
		t.Fatalf("connection URL persisted to %s", leak)
	}
}
