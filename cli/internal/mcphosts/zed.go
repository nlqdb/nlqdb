package mcphosts

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
)

type Zed struct{}

func (Zed) Name() string { return "zed" }

func (Zed) ConfigPath() (string, error) {
	switch runtime.GOOS {
	case "darwin":
		base, err := appSupport("Zed")
		if err != nil {
			return "", err
		}
		return filepath.Join(base, "settings.json"), nil
	default:
		home, err := userHome()
		if err != nil {
			return "", err
		}
		return filepath.Join(home, ".config", "zed", "settings.json"), nil
	}
}

func (h Zed) Detect() (Detection, error) {
	p, err := h.ConfigPath()
	if err != nil {
		return Detection{}, err
	}
	if _, err := os.Stat(filepath.Dir(p)); err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return Detection{Present: false, ConfigPath: p}, nil
		}
		return Detection{}, err
	}
	return Detection{Present: true, ConfigPath: p}, nil
}

func (h Zed) Install(name string, server ServerStanza) error {
	p, err := h.ConfigPath()
	if err != nil {
		return err
	}
	return writeMcpServersField(p, name, server)
}
