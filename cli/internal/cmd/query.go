package cmd

import (
	"context"
	"time"

	"github.com/spf13/cobra"
)

func registerQuery(root *cobra.Command, g *globalFlags) {
	cmd := &cobra.Command{
		// `nlq query <db> <goal>` is the explicit form of `nlq ask --db`
		// (SK-CLI-003) — decision id kept here, out of the user-facing help.
		Use:   "query <db> <goal>",
		Short: "Ask a question against an explicit database",
		Long: `Pinned ask: ` + "`nlq query <db> \"<goal>\"`" + ` is the explicit form
that errors when the database doesn't exist. Same wire shape as
` + "`nlq ask --db=<id>`" + `.`,
		Args: cobra.MinimumNArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			db := args[0]
			goal := joinArgs(args[1:])
			ctx, cancel := context.WithTimeout(cmd.Context(), 120*time.Second)
			defer cancel()
			return doAsk(ctx, cmd, g, askParams{
				goal: goal,
				dbID: db,
			})
		},
	}
	root.AddCommand(cmd)
}
