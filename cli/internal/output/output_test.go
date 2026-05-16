package output

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	"github.com/nlqdb/nlqdb/cli/internal/api"
)

func TestWriteAskJSONIsValid(t *testing.T) {
	var out, errw bytes.Buffer
	w := New(&out, &errw, FormatJSON)
	resp := &api.AskResponse{
		Status:   "ok",
		Rows:     []map[string]any{{"n": float64(1)}},
		RowCount: 1,
		Trace: &api.Trace{
			SQL: "SELECT 1", PlanID: "p1", Confidence: 0.9, Model: "m", CacheHit: false,
		},
	}
	if err := w.WriteAsk(resp); err != nil {
		t.Fatalf("WriteAsk: %v", err)
	}

	var got map[string]any
	if err := json.Unmarshal(out.Bytes(), &got); err != nil {
		t.Fatalf("output is not JSON: %v\n%s", err, out.String())
	}
	if got["status"] != "ok" {
		t.Errorf("status = %v", got["status"])
	}
	if errw.Len() != 0 {
		t.Errorf("stderr should be empty under --json: %q", errw.String())
	}
}

func TestWriteAskHumanIncludesTrace(t *testing.T) {
	var out, errw bytes.Buffer
	w := New(&out, &errw, FormatHuman)
	resp := &api.AskResponse{
		Status: "ok",
		Rows: []map[string]any{
			{"name": "alice", "n": float64(3)},
			{"name": "bob", "n": float64(7)},
		},
		RowCount: 2,
		Trace:    &api.Trace{SQL: "SELECT name, n FROM t", PlanID: "p1", Confidence: 0.9, Model: "m", CacheHit: true},
	}
	if err := w.WriteAsk(resp); err != nil {
		t.Fatalf("WriteAsk: %v", err)
	}
	s := out.String()
	if !strings.Contains(s, "─ trace ─") {
		t.Errorf("trace separator missing: %q", s)
	}
	if !strings.Contains(s, "SELECT name, n FROM t") {
		t.Errorf("SQL missing from trace: %q", s)
	}
	if !strings.Contains(s, "alice") || !strings.Contains(s, "bob") {
		t.Errorf("row values missing: %q", s)
	}
}

func TestWriteAskCreateBranchHumanRendersDB(t *testing.T) {
	var out, errw bytes.Buffer
	w := New(&out, &errw, FormatHuman)
	resp := &api.AskResponse{
		Kind:        "create",
		DB:          "db_orders_tracker_a4f3",
		DisplayName: "orders tracker",
		Engine:      "postgres",
		SampleRows: []map[string]json.RawMessage{
			{"id": json.RawMessage(`"sample-1"`)},
		},
	}
	if err := w.WriteAsk(resp); err != nil {
		t.Fatalf("WriteAsk: %v", err)
	}
	s := out.String()
	if !strings.Contains(s, "orders tracker") {
		t.Errorf("display name missing: %q", s)
	}
	if !strings.Contains(s, "postgres") {
		t.Errorf("engine missing: %q", s)
	}
}

func TestWriteDatabasesEmptyHasOnboardingHint(t *testing.T) {
	var out bytes.Buffer
	w := New(&out, &bytes.Buffer{}, FormatHuman)
	if err := w.WriteDatabases(nil); err != nil {
		t.Fatalf("WriteDatabases: %v", err)
	}
	if !strings.Contains(out.String(), "nlq new") {
		t.Errorf("expected onboarding hint, got: %q", out.String())
	}
}
