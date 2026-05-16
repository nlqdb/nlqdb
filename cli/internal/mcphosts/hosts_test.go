package mcphosts

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestRegistryStableOrder(t *testing.T) {
	hs := Registry()
	if len(hs) < 4 {
		t.Fatalf("registry shrank: %d", len(hs))
	}
	names := []string{}
	for _, h := range hs {
		names = append(names, h.Name())
	}
	// First two slots are load-bearing for the SK-CLI-011 prompt order
	// (Claude Desktop → Cursor) — auto-detect prompts in this order.
	if names[0] != "claude-desktop" || names[1] != "cursor" {
		t.Errorf("expected Claude first then Cursor, got %v", names)
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
