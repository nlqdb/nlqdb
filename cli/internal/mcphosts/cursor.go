package mcphosts

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
)

type Cursor struct{}

func (Cursor) Name() string { return "cursor" }

func (Cursor) ConfigPath() (string, error) {
	home, err := userHome()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".cursor", "mcp.json"), nil
}

func (h Cursor) Detect() (Detection, error) {
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

func (h Cursor) Install(name string, server ServerStanza) error {
	p, err := h.ConfigPath()
	if err != nil {
		return err
	}
	return writeMcpServersField(p, name, server)
}
