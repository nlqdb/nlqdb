// Package version is the canonical source of build metadata; the
// variables below are overridden at link time via `-X` ldflags so one
// codebase produces install-method-tagged binaries (SK-CLI-014).
package version

import (
	"fmt"
	"runtime"
)

// Default values mark a dev build so a forgotten ldflag is loud.
var (
	Version       = "0.0.0-dev"
	Commit        = "unknown"
	InstallMethod = "dev"
)

type Info struct {
	Version       string `json:"version"`
	Commit        string `json:"commit"`
	InstallMethod string `json:"install_method"`
	GoVersion     string `json:"go_version"`
	OS            string `json:"os"`
	Arch          string `json:"arch"`
}

func Current() Info {
	return Info{
		Version:       Version,
		Commit:        Commit,
		InstallMethod: InstallMethod,
		GoVersion:     runtime.Version(),
		OS:            runtime.GOOS,
		Arch:          runtime.GOARCH,
	}
}

func (i Info) Short() string {
	return fmt.Sprintf("nlq %s (%s, %s/%s, %s)", i.Version, i.InstallMethod, i.OS, i.Arch, i.Commit)
}
