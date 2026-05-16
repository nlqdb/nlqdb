package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

func registerLogin(root *cobra.Command, _ *globalFlags) {
	cmd := &cobra.Command{
		Use:   "login",
		Short: "Sign in via OAuth device-code flow (ships in the next slice)",
		Long: `nlq login runs the OAuth 2.0 Device Authorization Grant per
SK-CLI-006. The server-side endpoints (` + "`POST /v1/auth/device`," + `
` + "`POST /v1/auth/device/token`" + `) land in a follow-up slice; until
then, set NLQDB_API_KEY or use anonymous mode (default).`,
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Fprintln(cmd.OutOrStdout(),
				"nlq login: device-flow ships in the next slice. "+
					"For now: set NLQDB_API_KEY=<sk_live_…> or use anonymous mode (default).")
			return nil
		},
	}
	root.AddCommand(cmd)
}
