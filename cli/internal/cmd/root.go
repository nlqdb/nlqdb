// Package cmd builds the cobra command tree — one verb per file so
// adding a new one is a single new file + a single register* call.
package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/nlqdb/nlqdb/cli/internal/config"
	"github.com/nlqdb/nlqdb/cli/internal/updatecheck"
	"github.com/nlqdb/nlqdb/cli/internal/version"
)

type globalFlags struct {
	json     bool
	noUpdate bool
	apiURL   string
}

func New() *cobra.Command {
	g := &globalFlags{}

	root := &cobra.Command{
		Use:           "nlq",
		Short:         "nlqdb — a database you talk to",
		Long:          "nlqdb command-line tool. Two data verbs: `ask` (NL → answer) and `run` (raw SQL).",
		SilenceUsage:  true,
		SilenceErrors: true,
		Version:       version.Current().Short(),
	}
	root.SetVersionTemplate("{{.Version}}\n")

	root.PersistentFlags().BoolVar(&g.json, "json", false, "emit JSON output (default: human)")
	root.PersistentFlags().BoolVar(&g.noUpdate, "no-update-check", false, "skip the once-per-day update check")
	root.PersistentFlags().StringVar(&g.apiURL, "api-url", "", "override the API base URL (default: from config or https://app.nlqdb.com)")

	cfg, cfgErr := config.Load()
	if cfgErr != nil {
		// A malformed config.toml must surface — running on defaults
		// silently would mask the user's broken file (config.Load
		// considers parse failures a hard error per its docstring).
		fmt.Fprintf(os.Stderr, "✗ config: %v\n", cfgErr)
	}
	if g.apiURL == "" {
		g.apiURL = cfg.APIBaseURL
	}

	root.PersistentPostRunE = func(cmd *cobra.Command, args []string) error {
		if g.noUpdate || cfg.NoUpdate {
			return nil
		}
		updatecheck.Run(cmd.Context(), os.Stderr, updatecheck.Options{
			JSON:   g.json,
			NonTTY: !isTerminal(os.Stdout),
		})
		return nil
	}

	registerAsk(root, g)
	registerRun(root, g)
	registerRemember(root, g)
	registerNew(root, g)
	registerDB(root, g)
	registerKeys(root, g)
	registerByollm(root, g)
	registerQuery(root, g)
	registerUse(root, g)
	registerWhoami(root, g)
	registerLogout(root, g)
	registerLogin(root, g)
	registerMCP(root, g)
	registerUpdate(root, g)
	installHelp(root, g)

	return root
}

// printErr is the GLOBAL-012 helper: one sentence, next action included.
func printErr(cmd *cobra.Command, format string, args ...any) {
	fmt.Fprintf(cmd.ErrOrStderr(), "✗ "+format+"\n", args...)
}
