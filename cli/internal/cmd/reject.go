package cmd

import "github.com/spf13/cobra"

func rejectCmd(g *globalFlags) *cobra.Command {
	var reason string
	cmd := decideCmd(g, &cobra.Command{
		Use:   "reject <proposal-id>",
		Short: "Decline a proposal, optionally saying why",
	}, "reject", &reason)
	cmd.Flags().StringVar(&reason, "reason", "", "why — the DBA learns from it")
	return cmd
}
