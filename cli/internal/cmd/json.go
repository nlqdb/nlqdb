package cmd

import (
	"encoding/json"

	"github.com/spf13/cobra"
)

func jsonEncoder(cmd *cobra.Command) *json.Encoder {
	enc := json.NewEncoder(cmd.OutOrStdout())
	enc.SetIndent("", "  ")
	return enc
}
