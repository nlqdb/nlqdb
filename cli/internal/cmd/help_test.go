package cmd

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
)

func TestHelpJSONShape(t *testing.T) {
	root := New()
	var buf bytes.Buffer
	if err := emitHelpJSON(root, &buf); err != nil {
		t.Fatalf("emitHelpJSON: %v", err)
	}

	var node cmdNode
	if err := json.Unmarshal(buf.Bytes(), &node); err != nil {
		t.Fatalf("decode: %v\n%s", err, buf.String())
	}

	if node.Name != "nlq" {
		t.Errorf("root name = %q, want %q", node.Name, "nlq")
	}
	if node.Path != "nlq" {
		t.Errorf("root path = %q, want %q", node.Path, "nlq")
	}
	if len(node.Subcommands) == 0 {
		t.Fatalf("root has no subcommands; gen-cli would emit an empty reference")
	}

	want := map[string]bool{"ask": true, "run": true, "new": true, "db": true, "keys": true}
	seen := map[string]bool{}
	for _, sub := range node.Subcommands {
		seen[sub.Name] = true
		if sub.Path == "" {
			t.Errorf("subcommand %q has empty path", sub.Name)
		}
	}
	for verb := range want {
		if !seen[verb] {
			t.Errorf("missing verb %q in help --json output", verb)
		}
	}

	for _, f := range node.Flags {
		if f.Name == "json" && !f.Persistent {
			t.Error("root --json flag should be marked persistent")
		}
	}
}

func TestHelpJSONSkipsHidden(t *testing.T) {
	root := New()
	var buf bytes.Buffer
	if err := emitHelpJSON(root, &buf); err != nil {
		t.Fatalf("emitHelpJSON: %v", err)
	}
	out := buf.String()
	if strings.Contains(out, `"hidden":true`) {
		t.Error("emitHelpJSON should not include hidden:true subcommands")
	}
}
