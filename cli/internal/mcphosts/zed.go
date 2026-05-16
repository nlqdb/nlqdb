package mcphosts

import (
	"path/filepath"
	"runtime"
)

type Zed struct{}

func (Zed) Name() string { return "zed" }

func (Zed) ConfigPath() (string, error) {
	if runtime.GOOS == "darwin" {
		base, err := appSupport("Zed")
		if err != nil {
			return "", err
		}
		return filepath.Join(base, "settings.json"), nil
	}
	home, err := userHome()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".config", "zed", "settings.json"), nil
}

func (h Zed) Detect() (Detection, error) {
	p, err := h.ConfigPath()
	if err != nil {
		return Detection{}, err
	}
	return detectByDirExists(p)
}

func (h Zed) Install(name string, server ServerStanza) error {
	p, err := h.ConfigPath()
	if err != nil {
		return err
	}
	return writeMcpServersField(p, name, server)
}
