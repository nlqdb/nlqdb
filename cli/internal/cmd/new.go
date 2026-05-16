package cmd

import (
	"context"
	"time"

	"github.com/spf13/cobra"
)

func registerNew(root *cobra.Command, g *globalFlags) {
	var engine string
	cmd := &cobra.Command{
		Use:   "new <goal>",
		Short: "Create a database from a goal and run the first query",
		Long: `Create a fresh DB from the goal, overwrite the active DB pointer
in ~/.config/nlqdb/state.json, and immediately ask the goal against it.

This is sugar for the create branch of /v1/ask (SK-CLI-003).`,
		Args: cobra.MinimumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx, cancel := context.WithTimeout(cmd.Context(), 120*time.Second)
			defer cancel()
			return doAsk(ctx, cmd, g, askParams{
				goal:         joinArgs(args),
				engine:       engine,
				alwaysCreate: true,
			})
		},
	}
	cmd.Flags().StringVar(&engine, "engine", "", "engine override (postgres|clickhouse)")
	root.AddCommand(cmd)
}
