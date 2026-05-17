// Package mcphosts is the registry of MCP host integrations.
// Adding a new host is one new file implementing Host plus a Registry()
// entry (SK-CLI-011).
package mcphosts

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
)

type Host interface {
	Name() string
	ConfigPath() (string, error)
	Install(name string, server ServerStanza) error
	Detect() (Detection, error)
}

type Detection struct {
	Present    bool
	ConfigPath string
}

// ServerStanza is the JSON object every host expects under
// `mcpServers` — `URL` for hosted, `Command`+`Args` for stdio.
type ServerStanza struct {
	URL     string            `json:"url,omitempty"`
	Command string            `json:"command,omitempty"`
	Args    []string          `json:"args,omitempty"`
	Env     map[string]string `json:"env,omitempty"`
}

// Registry order is the canonical SK-CLI-011 prompt order on a
// multi-host machine.
func Registry() []Host {
	return []Host{
		ClaudeDesktop{},
		Cursor{},
		Zed{},
		Windsurf{},
		VSCode{},
		ContinueDev{},
	}
}

func Lookup(name string) (Host, error) {
	name = strings.ToLower(strings.TrimSpace(name))
	for _, h := range Registry() {
		if strings.ToLower(h.Name()) == name {
			return h, nil
		}
	}
	known := []string{}
	for _, h := range Registry() {
		known = append(known, h.Name())
	}
	sort.Strings(known)
	return nil, fmt.Errorf("unknown host %q (known: %s)", name, strings.Join(known, ", "))
}

func DetectInstalled() []Detection {
	out := []Detection{}
	for _, h := range Registry() {
		d, err := h.Detect()
		if err != nil || !d.Present {
			continue
		}
		out = append(out, d)
	}
	return out
}

// writeMcpServersField is atomic (temp + rename) so a crash mid-write
// can't corrupt the host's config; siblings of `mcpServers` are
// preserved verbatim.
func writeMcpServersField(path, key string, stanza ServerStanza) error {
	root := map[string]json.RawMessage{}
	data, err := os.ReadFile(path) //nolint:gosec // path is computed by ConfigPath()
	switch {
	case errors.Is(err, fs.ErrNotExist):
	case err != nil:
		return fmt.Errorf("read %s: %w", path, err)
	default:
		if len(data) > 0 {
			if err := json.Unmarshal(data, &root); err != nil {
				return fmt.Errorf("parse %s: %w", path, err)
			}
		}
	}

	var servers map[string]ServerStanza
	if raw, ok := root["mcpServers"]; ok && len(raw) > 0 {
		if err := json.Unmarshal(raw, &servers); err != nil {
			return fmt.Errorf("parse mcpServers in %s: %w", path, err)
		}
	}
	if servers == nil {
		servers = map[string]ServerStanza{}
	}
	servers[key] = stanza

	encoded, err := json.MarshalIndent(servers, "", "  ")
	if err != nil {
		return fmt.Errorf("encode mcpServers: %w", err)
	}
	root["mcpServers"] = encoded

	out, err := json.MarshalIndent(root, "", "  ")
	if err != nil {
		return fmt.Errorf("encode config: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return fmt.Errorf("mkdir %s: %w", filepath.Dir(path), err)
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".mcp-cfg-*.json")
	if err != nil {
		return fmt.Errorf("create tmp: %w", err)
	}
	tmpName := tmp.Name()
	defer func() { _ = os.Remove(tmpName) }()
	if _, err := tmp.Write(out); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("write tmp: %w", err)
	}
	// Explicit 0600 — `sk_mcp_*` keys land in this file once the
	// install slice wires the mint call; matching `state.go` /
	// `fallback.go` posture keeps every CLI-written file at the
	// same permissions regardless of umask.
	if err := tmp.Chmod(0o600); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("chmod tmp: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("close tmp: %w", err)
	}
	return os.Rename(tmpName, path)
}

// detectByDirExists is shared by hosts whose presence we infer from
// the existence of a parent directory (Cursor, Zed, Windsurf, Continue).
// Claude Desktop / VS Code use a different probe because their config
// path is nested deeper.
func detectByDirExists(p string) (Detection, error) {
	if _, err := os.Stat(filepath.Dir(p)); err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return Detection{Present: false, ConfigPath: p}, nil
		}
		return Detection{}, err
	}
	return Detection{Present: true, ConfigPath: p}, nil
}

func userHome() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("resolve home: %w", err)
	}
	return home, nil
}

func appSupport(folder string) (string, error) {
	switch runtime.GOOS {
	case "darwin":
		home, err := userHome()
		if err != nil {
			return "", err
		}
		return filepath.Join(home, "Library", "Application Support", folder), nil
	case "windows":
		if v := os.Getenv("APPDATA"); v != "" {
			return filepath.Join(v, folder), nil
		}
		return "", errors.New("APPDATA not set")
	default:
		if v := os.Getenv("XDG_CONFIG_HOME"); v != "" {
			return filepath.Join(v, folder), nil
		}
		home, err := userHome()
		if err != nil {
			return "", err
		}
		return filepath.Join(home, ".config", folder), nil
	}
}
