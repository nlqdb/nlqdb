package cmd

import (
	"fmt"
	"time"

	"github.com/spf13/cobra"

	"github.com/nlqdb/nlqdb/cli/internal/state"
)

func registerUse(root *cobra.Command, _ *globalFlags) {
	cmd := &cobra.Command{
		Use:   "use <db>",
		Short: "Switch the active database for bare-form `nlq \"<goal>\"` calls",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			db := args[0]
			if err := state.Update(func(s *state.State) {
				s.ActiveDB = db
				s.LastUsedAt = time.Now().Unix()
			}); err != nil {
				return err
			}
			fmt.Fprintf(cmd.OutOrStdout(), "✓ active database: %s\n", db)
			return nil
		},
	}
	root.AddCommand(cmd)
}
