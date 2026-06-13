package cmd

import (
	"encoding/json"
	"errors"

	"github.com/spf13/cobra"
)

func registerLogin(root *cobra.Command, g *globalFlags) {
	cmd := &cobra.Command{
		Use:   "login",
		Short: "Sign in via OAuth device-code flow (ships in the next slice)",
		Long: `nlq login runs the OAuth 2.0 Device Authorization Grant per
SK-CLI-006. The server-side endpoints (` + "`POST /v1/auth/device`," + `
` + "`POST /v1/auth/device/token`" + `) land in a follow-up slice; until
then, set NLQDB_API_KEY or use anonymous mode (default).`,
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			// Non-zero exit so scripts that gate on `$?` don't proceed
			// thinking sign-in succeeded; mirrors `nlq mcp install`. In
			// `--json` mode emit the same `not_implemented` envelope shape
			// `nlq mcp install` uses so agents can tell "not yet shipped"
			// from "broke" without substring-matching stderr.
			if g.json {
				enc := json.NewEncoder(cmd.OutOrStdout())
				enc.SetIndent("", "  ")
				_ = enc.Encode(map[string]any{
					"status": "not_implemented",
					"reason": "device_flow_login_required",
					"hint":   "set NLQDB_API_KEY=<sk_live_…> or use anonymous mode (default) until `nlq login` ships",
				})
				return errors.New("login not yet implemented")
			}
			printErr(cmd, "nlq login: device-flow ships in the next slice — set NLQDB_API_KEY=<sk_live_…> or use anonymous mode (default).")
			return errors.New("login not yet implemented")
		},
	}
	root.AddCommand(cmd)
}
