package mcphosts

import (
	"path/filepath"
)

type ContinueDev struct{}

func (ContinueDev) Name() string { return "continue" }

func (ContinueDev) ConfigPath() (string, error) {
	home, err := userHome()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".continue", "config.json"), nil
}

func (h ContinueDev) Detect() (Detection, error) {
	p, err := h.ConfigPath()
	if err != nil {
		return Detection{}, err
	}
	return detectByDirExists(p)
}

func (h ContinueDev) Install(name string, server ServerStanza) error {
	p, err := h.ConfigPath()
	if err != nil {
		return err
	}
	return writeMcpServersField(p, name, server)
}
