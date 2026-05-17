package mcphosts

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestRegistryStableOrder(t *testing.T) {
	want := []string{"claude-desktop", "cursor", "zed", "windsurf", "vscode", "continue"}
	got := []string{}
	for _, h := range Registry() {
		got = append(got, h.Name())
	}
	if len(got) != len(want) {
		t.Fatalf("registry length drift — got %d, want %d (%v)", len(got), len(want), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("registry[%d] = %q, want %q (full: %v)", i, got[i], want[i], got)
		}
	}
}

func TestLookupKnownHost(t *testing.T) {
	for _, want := range []string{"claude-desktop", "cursor", "zed", "windsurf", "vscode", "continue"} {
		h, err := Lookup(want)
		if err != nil {
			t.Errorf("Lookup(%q): %v", want, err)
			continue
		}
		if h.Name() != want {
			t.Errorf("Lookup(%q).Name() = %q", want, h.Name())
		}
	}
}

func TestLookupUnknownHost(t *testing.T) {
	if _, err := Lookup("vim-mode-emacs"); err == nil {
		t.Errorf("expected error on unknown host")
	}
}

func TestWriteMcpServersFieldPreservesSiblings(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "config.json")

	existing := map[string]any{
		"theme":     "dark",
		"telemetry": false,
		"mcpServers": map[string]any{
			"other-server": map[string]any{
				"command": "/usr/bin/other",
				"args":    []string{"--flag"},
			},
		},
	}
	encoded, _ := json.MarshalIndent(existing, "", "  ")
	if err := os.WriteFile(p, encoded, 0o600); err != nil {
		t.Fatal(err)
	}

	stanza := ServerStanza{URL: "https://mcp.nlqdb.com/mcp"}
	if err := writeMcpServersField(p, "nlqdb", stanza); err != nil {
		t.Fatalf("writeMcpServersField: %v", err)
	}

	raw, err := os.ReadFile(p) //nolint:gosec // test path under t.TempDir
	if err != nil {
		t.Fatal(err)
	}
	var got map[string]any
	if err := json.Unmarshal(raw, &got); err != nil {
		t.Fatalf("re-parse: %v", err)
	}

	if got["theme"] != "dark" {
		t.Errorf("siblings lost: theme=%v", got["theme"])
	}
	servers, ok := got["mcpServers"].(map[string]any)
	if !ok {
		t.Fatalf("mcpServers shape: %T", got["mcpServers"])
	}
	if _, ok := servers["other-server"]; !ok {
		t.Errorf("other-server stanza lost")
	}
	if _, ok := servers["nlqdb"]; !ok {
		t.Errorf("nlqdb stanza missing")
	}
}

func TestWriteMcpServersFieldCreatesFreshFile(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "fresh", "config.json")

	stanza := ServerStanza{Command: "/usr/local/bin/nlq", Args: []string{"mcp", "stdio"}}
	if err := writeMcpServersField(p, "nlqdb", stanza); err != nil {
		t.Fatalf("writeMcpServersField fresh: %v", err)
	}

	raw, err := os.ReadFile(p) //nolint:gosec // test path under t.TempDir
	if err != nil {
		t.Fatal(err)
	}
	var got map[string]any
	if err := json.Unmarshal(raw, &got); err != nil {
		t.Fatalf("re-parse: %v", err)
	}
	servers, ok := got["mcpServers"].(map[string]any)
	if !ok || servers["nlqdb"] == nil {
		t.Fatalf("nlqdb stanza missing in fresh file: %v", got)
	}
}
