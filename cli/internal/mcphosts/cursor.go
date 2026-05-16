package mcphosts

import (
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
	return detectByDirExists(p)
}

func (h Cursor) Install(name string, server ServerStanza) error {
	p, err := h.ConfigPath()
	if err != nil {
		return err
	}
	return writeMcpServersField(p, name, server)
}
