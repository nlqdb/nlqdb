package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/nlqdb/nlqdb/cli/internal/updatecheck"
	"github.com/nlqdb/nlqdb/cli/internal/version"
)

func registerUpdate(root *cobra.Command, _ *globalFlags) {
	cmd := &cobra.Command{
		Use:   "update",
		Short: "Check for and (when applicable) install the latest nlq",
		Long: `update prints the latest available version and either replaces the
curl-installed binary in place or hints at the package-manager command
for brew / npm. dev builds are inert (SK-CLI-015).`,
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			i := version.Current()
			fmt.Fprintf(cmd.OutOrStdout(), "current: %s (%s, %s/%s)\n", i.Version, i.InstallMethod, i.OS, i.Arch)
			switch i.InstallMethod {
			case "homebrew":
				fmt.Fprintln(cmd.OutOrStdout(), "Update via your package manager: `brew upgrade nlqdb/tap/nlq`.")
			case "npm-shim":
				fmt.Fprintln(cmd.OutOrStdout(), "Update via your package manager: `npm i -g @nlqdb/cli@latest`.")
			case "curl-sh":
				fmt.Fprintln(cmd.OutOrStdout(), "In-place curl-pipe-sh update lands in a follow-up slice; for now run the install script: `curl -fsSL https://nlqdb.com/install | sh`.")
			default:
				fmt.Fprintln(cmd.OutOrStdout(), "Dev build — no update path. Build from source.")
			}
			// cmd.Context() is the signal-aware ctx from main; using
			// context.Background() here would let SIGINT during the
			// fetch leak the goroutine past the user's Ctrl-C.
			updatecheck.Run(cmd.Context(), os.Stderr, updatecheck.Options{
				JSON:   false,
				NonTTY: !isTerminal(os.Stdout),
			})
			return nil
		},
	}
	root.AddCommand(cmd)
}
