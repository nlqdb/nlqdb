package cmd

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/spf13/cobra"

	"github.com/nlqdb/nlqdb/cli/internal/api"
	"github.com/nlqdb/nlqdb/cli/internal/auth"
	"github.com/nlqdb/nlqdb/cli/internal/output"
)

func applyCmd(g *globalFlags) *cobra.Command {
	return decideCmd(g, &cobra.Command{
		Use:   "apply <proposal-id>",
		Short: "Run a proposal on your database; verify reverts it if it regresses",
	}, "apply", nil)
}

// decideCmd gives `nlq apply` and `nlq reject` (reject.go) — the two verbs —
// one body; reason is nil for apply.
func decideCmd(g *globalFlags, cmd *cobra.Command, verb string, reason *string) *cobra.Command {
	cmd.Args = cobra.ExactArgs(1)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		pid, err := strconv.ParseInt(args[0], 10, 64)
		if err != nil || pid <= 0 {
			printErr(cmd, "proposal id must be a number, as `nlq proposals` lists it.")
			return errors.New("invalid proposal id")
		}
		id, err := auth.Resolve(true)
		if err != nil {
			printErr(cmd, "auth: %v", err)
			return err
		}
		why := ""
		if reason != nil {
			why = *reason
		}
		ctx, cancel := context.WithTimeout(cmd.Context(), 120*time.Second)
		defer cancel()
		resp, err := api.New(g.apiURL, id).Decide(ctx, pid, verb, why)
		if err != nil {
			return renderAPIError(cmd, err)
		}
		w := output.New(cmd.OutOrStdout(), cmd.ErrOrStderr(), formatFor(g))
		if w.Format == output.FormatJSON {
			return w.JSON(resp)
		}
		fmt.Fprintf(cmd.OutOrStdout(), "✓ Proposal #%d %s.\n", resp.Proposal.ID, resp.Proposal.Status)
		if resp.Proposal.Status == "applied" {
			fmt.Fprintln(cmd.OutOrStdout(), "Verify judges it after its window and reverts it if it regressed — see `nlq proposals`.")
		}
		return nil
	}
	return cmd
}
