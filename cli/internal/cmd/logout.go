package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/nlqdb/nlqdb/cli/internal/auth"
	"github.com/nlqdb/nlqdb/cli/internal/paths"
	"github.com/nlqdb/nlqdb/cli/internal/state"
)

func registerLogout(root *cobra.Command, _ *globalFlags) {
	cmd := &cobra.Command{
		Use:   "logout",
		Short: "Clear keychain credentials and local state",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := auth.Clear(); err != nil {
				return err
			}
			if err := state.Save(state.State{}); err != nil {
				return err
			}
			p, _ := paths.ConfigDir()
			fmt.Fprintf(cmd.OutOrStdout(), "✓ Cleared anonymous + signed-in credentials (state in %s).\n", p)
			if os.Getenv("NLQDB_API_KEY") != "" {
				fmt.Fprintln(cmd.OutOrStdout(), "ℹ NLQDB_API_KEY is still set in your environment — unset it to fully sign out.")
			}
			return nil
		},
	}
	root.AddCommand(cmd)
}
