package cmd

import (
	"encoding/json"
	"testing"
)

func TestParseInsertRowsObjectAndArray(t *testing.T) {
	one, err := parseInsertRows(`{"serverId": 42, "stars": 5}`)
	if err != nil || len(one) != 1 || one[0]["serverId"] != json.Number("42") {
		t.Fatalf("object: rows=%v err=%v", one, err)
	}
	many, err := parseInsertRows(`[{"name": "fs"}, {"name": "git", "tags": ["vcs"]}]`)
	if err != nil || len(many) != 2 || many[1]["name"] != "git" {
		t.Fatalf("array: rows=%v err=%v", many, err)
	}
}

// A big integer id must reach the wire with its literal digits, not as a
// float64 rounded in scientific notation.
func TestParseInsertRowsKeepsBigIntDigits(t *testing.T) {
	rows, err := parseInsertRows(`{"id": 9007199254740993}`)
	if err != nil {
		t.Fatal(err)
	}
	b, _ := json.Marshal(rows[0])
	if string(b) != `{"id":9007199254740993}` {
		t.Errorf("wire = %s", b)
	}
}

func TestParseInsertRowsRejects(t *testing.T) {
	for _, in := range []string{"", "  ", "[]", `[1, 2]`, `"x"`, `{"a":1} {"b":2}`, `{bad`} {
		if _, err := parseInsertRows(in); err == nil {
			t.Errorf("parseInsertRows(%q) = nil error", in)
		}
	}
}
