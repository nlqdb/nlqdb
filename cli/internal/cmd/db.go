package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/spf13/cobra"

	"github.com/nlqdb/nlqdb/cli/internal/api"
	"github.com/nlqdb/nlqdb/cli/internal/auth"
	"github.com/nlqdb/nlqdb/cli/internal/output"
)

func registerDB(root *cobra.Command, g *globalFlags) {
	cmd := &cobra.Command{
		Use:   "db",
		Short: "Database management (list, create)",
	}
	cmd.AddCommand(dbListCmd(g))
	cmd.AddCommand(dbCreateCmd(g))
	root.AddCommand(cmd)
}

func dbListCmd(g *globalFlags) *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "List databases visible to the current credential",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			id, err := auth.Resolve(true)
			if err != nil {
				printErr(cmd, "auth: %v", err)
				return err
			}
			ctx, cancel := context.WithTimeout(cmd.Context(), 30*time.Second)
			defer cancel()
			rows, err := api.New(g.apiURL, id).WithInviteCode(g.inviteCode).ListDatabases(ctx)
			if err != nil {
				return renderAPIError(cmd, err)
			}
			return output.New(cmd.OutOrStdout(), cmd.ErrOrStderr(), formatFor(g)).WriteDatabases(rows)
		},
	}
}

func dbCreateCmd(g *globalFlags) *cobra.Command {
	var engine string
	cmd := &cobra.Command{
		Use:   "create [name]",
		Short: "Create a database explicitly (power-user verb)",
		Long: `Create a database from an optional name and engine. Most users
should prefer ` + "`nlq new \"<goal>\"`" + ` so the schema is inferred from
the goal — this verb is the GLOBAL-015 escape hatch.`,
		Args: cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			// Wrap a bare name as a real goal sentence so the LLM
			// schema-inference doesn't try to invent a schema for the
			// bare token (e.g. `nlq db create finance` → "create a
			// database named finance" rather than asking the LLM what
			// "finance" implies).
			goal := "create a new database"
			if len(args) == 1 && args[0] != "" {
				goal = fmt.Sprintf("create a database named %s", args[0])
			}
			ctx, cancel := context.WithTimeout(cmd.Context(), 120*time.Second)
			defer cancel()
			return doAsk(ctx, cmd, g, askParams{
				goal:         goal,
				engine:       engine,
				alwaysCreate: true,
			})
		},
	}
	cmd.Flags().StringVar(&engine, "engine", "", "engine override (postgres|clickhouse)")
	return cmd
}
