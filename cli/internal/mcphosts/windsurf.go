package mcphosts

import (
	"path/filepath"
)

type Windsurf struct{}

func (Windsurf) Name() string { return "windsurf" }

func (Windsurf) ConfigPath() (string, error) {
	home, err := userHome()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".codeium", "windsurf", "mcp_config.json"), nil
}

func (h Windsurf) Detect() (Detection, error) {
	p, err := h.ConfigPath()
	if err != nil {
		return Detection{}, err
	}
	return detectByDirExists(p)
}

func (h Windsurf) Install(name string, server ServerStanza) error {
	p, err := h.ConfigPath()
	if err != nil {
		return err
	}
	return writeMcpServersField(p, name, server)
}
