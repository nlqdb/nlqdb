package mcphosts

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
)

type ClaudeDesktop struct{}

func (ClaudeDesktop) Name() string { return "claude-desktop" }

func (ClaudeDesktop) ConfigPath() (string, error) {
	switch runtime.GOOS {
	case "darwin":
		base, err := appSupport("Claude")
		if err != nil {
			return "", err
		}
		return filepath.Join(base, "claude_desktop_config.json"), nil
	case "windows":
		base, err := appSupport("Claude")
		if err != nil {
			return "", err
		}
		return filepath.Join(base, "claude_desktop_config.json"), nil
	default:
		home, err := userHome()
		if err != nil {
			return "", err
		}
		return filepath.Join(home, ".config", "Claude", "claude_desktop_config.json"), nil
	}
}

func (h ClaudeDesktop) Detect() (Detection, error) {
	p, err := h.ConfigPath()
	if err != nil {
		return Detection{}, err
	}
	if _, err := os.Stat(p); err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return Detection{Present: false, ConfigPath: p}, nil
		}
		return Detection{}, err
	}
	return Detection{Present: true, ConfigPath: p}, nil
}

func (h ClaudeDesktop) Install(name string, server ServerStanza) error {
	p, err := h.ConfigPath()
	if err != nil {
		return err
	}
	return writeMcpServersField(p, name, server)
}
