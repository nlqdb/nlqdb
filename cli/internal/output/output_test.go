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
		Trace: &api.Trace{
			SQL: `CREATE TABLE "s"."orders" (id bigint);`, PlanID: "create:db_orders_tracker_a4f3",
			Confidence: 1, Model: "m", CacheHit: false,
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
	// SK-TRUST-002 — the create trace (compiled DDL) renders under the
	// same separator as the ask/run paths.
	if !strings.Contains(s, "─ trace ─") || !strings.Contains(s, "CREATE TABLE") {
		t.Errorf("create trace missing: %q", s)
	}
}

func TestWriteRunHumanRendersTraceAndRows(t *testing.T) {
	var out, errw bytes.Buffer
	w := New(&out, &errw, FormatHuman)
	resp := &api.RunResponse{
		Status:   "ok",
		Rows:     []map[string]any{{"name": "alice", "n": float64(3)}},
		RowCount: 1,
		Trace: &api.Trace{
			SQL: "SELECT name, n FROM t", PlanID: "p1", Confidence: 1, Model: "raw", CacheHit: false,
		},
	}
	if err := w.WriteRun(resp); err != nil {
		t.Fatalf("WriteRun: %v", err)
	}
	s := out.String()
	if !strings.Contains(s, "─ trace ─") {
		t.Errorf("trace separator missing: %q", s)
	}
	if !strings.Contains(s, "model=raw") {
		t.Errorf("raw-model marker missing: %q", s)
	}
	if !strings.Contains(s, "alice") {
		t.Errorf("row value missing: %q", s)
	}
}

func TestWriteRunHumanRendersAffectedCountWhenNoRows(t *testing.T) {
	var out bytes.Buffer
	w := New(&out, &bytes.Buffer{}, FormatHuman)
	resp := &api.RunResponse{
		Status:   "ok",
		Rows:     []map[string]any{},
		RowCount: 7,
		Trace:    &api.Trace{SQL: "UPDATE t SET x=1", PlanID: "p", Model: "raw"},
	}
	if err := w.WriteRun(resp); err != nil {
		t.Fatalf("WriteRun: %v", err)
	}
	if !strings.Contains(out.String(), "7 row(s) affected") {
		t.Errorf("affected-count line missing: %q", out.String())
	}
}

func TestWriteRunJSONIsValid(t *testing.T) {
	var out bytes.Buffer
	w := New(&out, &bytes.Buffer{}, FormatJSON)
	resp := &api.RunResponse{
		Status:   "ok",
		Rows:     []map[string]any{{"n": float64(1)}},
		RowCount: 1,
		Trace:    &api.Trace{SQL: "SELECT 1", PlanID: "p", Model: "raw"},
	}
	if err := w.WriteRun(resp); err != nil {
		t.Fatalf("WriteRun: %v", err)
	}
	var got map[string]any
	if err := json.Unmarshal(out.Bytes(), &got); err != nil {
		t.Fatalf("output is not JSON: %v\n%s", err, out.String())
	}
	if got["status"] != "ok" {
		t.Errorf("status = %v", got["status"])
	}
}

func TestWriteDatabasesEmptyHasOnboardingHint(t *testing.T) {
	var out bytes.Buffer
	w := New(&out, &bytes.Buffer{}, FormatHuman)
	if err := w.WriteDatabases(nil); err != nil {
		t.Fatalf("WriteDatabases: %v", err)
	}
	// SK-CLI-012: the empty-state points at the bare goal-first form, not
	// `nlq new` — the bare form is the documented onboarding path.
	if !strings.Contains(out.String(), `nlq "<what you're building>"`) {
		t.Errorf("expected bare-form onboarding hint, got: %q", out.String())
	}
	if strings.Contains(out.String(), "nlq new") {
		t.Errorf("empty-state should not steer to `nlq new`, got: %q", out.String())
	}
}

func TestWriteKeysHumanShowsTypeLabelStatus(t *testing.T) {
	var out bytes.Buffer
	w := New(&out, &bytes.Buffer{}, FormatHuman)
	ciName := "CI on GitHub"
	cursor := "cursor"
	device := "macbook-air"
	rows := []api.KeyRecord{
		{ID: "k_1", KeyType: "sk_live", Last4: "a4f7", Name: &ciName, CreatedAt: 1_700_000_000},
		{ID: "k_2", KeyType: "sk_mcp", Last4: "9c12", MCPHost: &cursor, DeviceID: &device, CreatedAt: 1_699_900_000},
	}
	if err := w.WriteKeys(rows); err != nil {
		t.Fatalf("WriteKeys: %v", err)
	}
	s := out.String()
	for _, want := range []string{"k_1", "k_2", "sk_live", "sk_mcp", "a4f7", "9c12", "CI on GitHub", "cursor on macbook-air", "active"} {
		if !strings.Contains(s, want) {
			t.Errorf("missing %q in keys output: %q", want, s)
		}
	}
}

func TestWriteKeysJSONIsValid(t *testing.T) {
	var out bytes.Buffer
	w := New(&out, &bytes.Buffer{}, FormatJSON)
	rows := []api.KeyRecord{{ID: "k_1", KeyType: "sk_live", Last4: "a4f7", CreatedAt: 1}}
	if err := w.WriteKeys(rows); err != nil {
		t.Fatalf("WriteKeys: %v", err)
	}
	var got map[string]any
	if err := json.Unmarshal(out.Bytes(), &got); err != nil {
		t.Fatalf("output is not JSON: %v\n%s", err, out.String())
	}
	if _, ok := got["keys"]; !ok {
		t.Errorf("expected `keys` field, got %v", got)
	}
}

func TestWriteKeysEmptyMessageGoesToStderr(t *testing.T) {
	var out, errw bytes.Buffer
	w := New(&out, &errw, FormatHuman)
	if err := w.WriteKeys(nil); err != nil {
		t.Fatalf("WriteKeys: %v", err)
	}
	if out.Len() != 0 {
		t.Errorf("stdout should be empty on empty list, got %q", out.String())
	}
	if !strings.Contains(errw.String(), "No keys yet") {
		t.Errorf("expected empty-state hint on stderr: %q", errw.String())
	}
}
