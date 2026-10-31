package cmd

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

// fakeDBA mirrors the API's attach → ledger → verbs on five Tier 0 proposals,
// with the response shapes of POST /v1/attach, GET /v1/databases/:id/changes
// and POST /v1/proposals/:id/apply|reject (GLOBAL-043).
func fakeDBA(t *testing.T) (*httptest.Server, map[int64]string, *[]string) {
	t.Helper()
	var mu sync.Mutex
	status := map[int64]string{}
	var bodies []string
	tables := []string{"posts", "comments", "likes", "follows", "sessions"}
	ddl := func(i int) string {
		return fmt.Sprintf("CREATE INDEX CONCURRENTLY nlqdb_%s_user_id_idx ON public.%s (user_id)", tables[i], tables[i])
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		b, _ := io.ReadAll(r.Body)
		bodies = append(bodies, string(b))
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/v1/db/connect":
			var ps []map[string]any
			for i := range tables {
				id := int64(i + 1)
				status[id] = "proposed"
				ps = append(ps, map[string]any{
					"id": id, "kind": "create_index", "tier": 0, "schema": "public",
					"table": tables[i], "columns": []string{"user_id"}, "ddl": ddl(i),
					"inverse": "DROP INDEX CONCURRENTLY x", "reason": "foreign key without an index",
					"evidence": map[string]any{"rowEstimate": 1000, "tableBytes": 8192},
				})
			}
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"dbId": "db_attach_1", "name": "app", "engine": "postgres",
				"schemaPreview": "posts(id, user_id)", "pkLive": nil, "proposals": ps,
			})
		case r.Method == http.MethodGet && r.URL.Path == "/v1/databases/db_attach_1/changes":
			var rows []map[string]any
			for i := len(tables) - 1; i >= 0; i-- {
				id := int64(i + 1)
				row := map[string]any{
					"id": id, "origin": "attach", "status": status[id], "kind": "create_index",
					"table": tables[i], "ddl": ddl(i), "inverse": "DROP INDEX CONCURRENTLY x",
					"reason": "foreign key without an index", "createdAt": 1,
				}
				if status[id] == "applied" {
					row["verification"] = map[string]any{"verdict": "keep", "fingerprint": "f", "beforeP95Ms": 2.0, "afterP95Ms": 0.1}
				}
				rows = append(rows, row)
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"changes": rows})
		case r.Method == http.MethodPost && strings.HasPrefix(r.URL.Path, "/v1/proposals/"):
			var id int64
			var verb string
			_, _ = fmt.Sscanf(strings.ReplaceAll(strings.TrimPrefix(r.URL.Path, "/v1/proposals/"), "/", " "), "%d %s", &id, &verb)
			want := map[string]string{"apply": "applied", "reject": "rejected"}[verb]
			cur, ok := status[id]
			if !ok {
				w.WriteHeader(http.StatusNotFound)
				_ = json.NewEncoder(w).Encode(map[string]any{"error": map[string]any{"status": "proposal_not_found", "message": "No proposal with that id."}})
				return
			}
			if cur != "proposed" && cur != want {
				w.WriteHeader(http.StatusConflict)
				_ = json.NewEncoder(w).Encode(map[string]any{"error": map[string]any{"status": "proposal_decided", "message": "That proposal was already " + cur + "."}})
				return
			}
			status[id] = want
			_ = json.NewEncoder(w).Encode(map[string]any{
				"proposal": map[string]any{"id": id, "dbId": "db_attach_1", "status": want, "decidedBy": "sk_live:k", "decidedAt": 1, "rejectReason": nil},
				"replayed": cur == want,
			})
		default:
			t.Errorf("unexpected %s %s", r.Method, r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)
	return srv, status, &bodies
}

// nlq runs one CLI invocation against apiURL; config/state persist across
// calls within a test (the active DB carries from attach to proposals).
func nlq(t *testing.T, apiURL, stdin string, args ...string) (string, string, error) {
	t.Helper()
	root := New()
	var out, errBuf bytes.Buffer
	root.SetOut(&out)
	root.SetErr(&errBuf)
	root.SetIn(strings.NewReader(stdin))
	root.SetArgs(append(args, "--api-url", apiURL, "--no-update-check"))
	err := root.Execute()
	return out.String(), errBuf.String(), err
}

// TestAttachDoorWalk walks the CLI door end to end: attach prints the five
// proposals with ids, every one is decided from the CLI, and the list shows
// each decision with verify's verdict.
func TestAttachDoorWalk(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	t.Setenv("NLQDB_API_KEY", "sk_live_test")
	srv, status, bodies := fakeDBA(t)

	const secret = "postgres://app:s3cret@db.example.com:5432/app" //nolint:gosec // test fixture, not a credential
	out, errBuf, err := nlq(t, srv.URL, secret+"\n", "attach")
	if err != nil {
		t.Fatalf("attach: %v (stderr=%q)", err, errBuf)
	}
	if !strings.Contains((*bodies)[0], `"engine":"postgres"`) {
		t.Errorf("attach body = %s", (*bodies)[0])
	}
	for _, want := range []string{"db_attach_1", "5 proposals", "#1  CREATE INDEX CONCURRENTLY", "#5  ", "nlq apply 1"} {
		if !strings.Contains(out, want) {
			t.Errorf("attach stdout missing %q; got %q", want, out)
		}
	}
	if strings.Contains(out+errBuf, secret) {
		t.Fatal("connection string leaked to output")
	}

	for id := 1; id <= 5; id++ {
		args := []string{"apply", fmt.Sprint(id)}
		if id > 3 {
			args = []string{"reject", fmt.Sprint(id), "--reason", "write-heavy table"}
		}
		if _, e, err := nlq(t, srv.URL, "", args...); err != nil {
			t.Fatalf("%v: %v (stderr=%q)", args, err, e)
		}
	}
	decided := 0
	for _, s := range status {
		if s != "proposed" {
			decided++
		}
	}
	if decided != 5 {
		t.Fatalf("decided from the CLI = %d/5", decided)
	}
	if !strings.Contains((*bodies)[len(*bodies)-1], `"reason":"write-heavy table"`) {
		t.Errorf("reject reason not sent: %s", (*bodies)[len(*bodies)-1])
	}
	t.Logf("proposals decided from the CLI: %d/5", decided)

	// Replaying a verb is a no-op; the opposite verb surfaces the server copy.
	if out, _, err := nlq(t, srv.URL, "", "apply", "1"); err != nil || !strings.Contains(out, "#1 applied") {
		t.Errorf("replayed apply: %v %q", err, out)
	}
	if _, e, err := nlq(t, srv.URL, "", "reject", "1"); err == nil || !strings.Contains(e, "already applied") {
		t.Errorf("reject of an applied proposal: %v %q", err, e)
	}

	out, errBuf, err = nlq(t, srv.URL, "", "proposals")
	if err != nil {
		t.Fatalf("proposals: %v (stderr=%q)", err, errBuf)
	}
	for _, want := range []string{"#1  applied, verify: keep", "#5  rejected"} {
		if !strings.Contains(out, want) {
			t.Errorf("proposals stdout missing %q; got %q", want, out)
		}
	}
}

func TestDecideRejectsNonNumericID(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	_, errBuf, err := nlq(t, "http://127.0.0.1:0", "", "apply", "abc")
	if err == nil || !strings.Contains(errBuf, "must be a number") {
		t.Fatalf("err=%v stderr=%q", err, errBuf)
	}
}
