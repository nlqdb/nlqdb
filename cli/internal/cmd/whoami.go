package cmd

import (
	"errors"
	"fmt"

	"github.com/spf13/cobra"

	"github.com/nlqdb/nlqdb/cli/internal/auth"
	"github.com/nlqdb/nlqdb/cli/internal/output"
	"github.com/nlqdb/nlqdb/cli/internal/state"
)

func registerWhoami(root *cobra.Command, g *globalFlags) {
	cmd := &cobra.Command{
		Use:   "whoami",
		Short: "Show the resolved identity and active database",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			id, err := auth.Resolve(false)
			st, _ := state.Load()

			if g.json {
				return output.New(cmd.OutOrStdout(), cmd.ErrOrStderr(), output.FormatJSON).JSON(map[string]any{
					"kind":          identityKindOrEmpty(id, err),
					"token_display": auth.Redacted(id.Token),
					"active_db":     st.ActiveDB,
					"last_used_at":  st.LastUsedAt,
				})
			}

			if errors.Is(err, auth.ErrNoIdentity) {
				fmt.Fprintln(cmd.OutOrStdout(), "identity: (none) — run `nlq login` to sign in, or set NLQDB_API_KEY")
			} else {
				fmt.Fprintf(cmd.OutOrStdout(), "identity: %s (%s)\n", id.Kind, auth.Redacted(id.Token))
			}
			if st.ActiveDB != "" {
				fmt.Fprintf(cmd.OutOrStdout(), "active db: %s\n", st.ActiveDB)
			} else {
				fmt.Fprintln(cmd.OutOrStdout(), "active db: (none) — bare `nlq \"<goal>\"` will create one")
			}
			return nil
		},
	}
	root.AddCommand(cmd)
}

func identityKindOrEmpty(id auth.Identity, err error) string {
	if err != nil {
		return ""
	}
	return id.Kind.String()
}
