// Package useragent renders the `User-Agent` header — the only signal
// the CLI emits per SK-CLI-014 (no separate event pipeline).
package useragent

import (
	"fmt"

	"github.com/nlqdb/nlqdb/cli/internal/version"
)

func String() string {
	i := version.Current()
	return fmt.Sprintf("nlq/%s (%s; %s/%s)", i.Version, i.InstallMethod, i.OS, i.Arch)
}
