package cmd

import (
	"encoding/json"
	"testing"
)

func TestParseParams(t *testing.T) {
	got, err := parseParams(`[9007199254740993, "a", null, true]`)
	if err != nil {
		t.Fatalf("parseParams: %v", err)
	}
	body, _ := json.Marshal(got)
	// The big id keeps its digits; float64 would round it to ...992.
	if want := `[9007199254740993,"a",null,true]`; string(body) != want {
		t.Fatalf("got %s, want %s", body, want)
	}
	for _, bad := range []string{`null`, `{"a":1}`, `5`, `[1] [2]`, `[1`} {
		if _, err := parseParams(bad); err == nil {
			t.Errorf("parseParams(%q) = nil error, want one", bad)
		}
	}
	if p, err := parseParams(""); err != nil || p != nil {
		t.Errorf("empty flag: got %v, %v", p, err)
	}
}
