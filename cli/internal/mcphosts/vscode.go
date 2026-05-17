package mcphosts

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
)

type VSCode struct{}

func (VSCode) Name() string { return "vscode" }

func (VSCode) ConfigPath() (string, error) {
	switch runtime.GOOS {
	case "darwin":
		base, err := appSupport("Code")
		if err != nil {
			return "", err
		}
		return filepath.Join(base, "User", "mcp.json"), nil
	case "windows":
		base, err := appSupport("Code")
		if err != nil {
			return "", err
		}
		return filepath.Join(base, "User", "mcp.json"), nil
	default:
		home, err := userHome()
		if err != nil {
			return "", err
		}
		return filepath.Join(home, ".config", "Code", "User", "mcp.json"), nil
	}
}

func (h VSCode) Detect() (Detection, error) {
	p, err := h.ConfigPath()
	if err != nil {
		return Detection{}, err
	}
	if _, err := os.Stat(filepath.Dir(filepath.Dir(p))); err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return Detection{Present: false, ConfigPath: p}, nil
		}
		return Detection{}, err
	}
	return Detection{Present: true, ConfigPath: p}, nil
}

func (h VSCode) Install(name string, server ServerStanza) error {
	p, err := h.ConfigPath()
	if err != nil {
		return err
	}
	return writeMcpServersField(p, name, server)
}
