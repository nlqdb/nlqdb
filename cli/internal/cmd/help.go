package cmd

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
)

// Wire shape for `nlq help --json`; consumed by apps/docs/scripts/gen-cli.ts. Additive changes only — removing or renaming a field breaks the doc build until both ends ship.
type cmdNode struct {
	Name        string     `json:"name"`
	Use         string     `json:"use,omitempty"`
	Path        string     `json:"path"`
	Short       string     `json:"short,omitempty"`
	Long        string     `json:"long,omitempty"`
	Example     string     `json:"example,omitempty"`
	Aliases     []string   `json:"aliases,omitempty"`
	Hidden      bool       `json:"hidden,omitempty"`
	Flags       []flagNode `json:"flags,omitempty"`
	Subcommands []cmdNode  `json:"subcommands,omitempty"`
}

type flagNode struct {
	Name       string `json:"name"`
	Shorthand  string `json:"shorthand,omitempty"`
	Type       string `json:"type"`
	Default    string `json:"default,omitempty"`
	Usage      string `json:"usage"`
	Persistent bool   `json:"persistent,omitempty"`
}

// installHelp replaces Cobra's built-in help command so `nlq help --json` emits the command tree consumed by apps/docs/scripts/gen-cli.ts.
func installHelp(root *cobra.Command, g *globalFlags) {
	helpCmd := &cobra.Command{
		Use:   "help [command]",
		Short: "Help about any command",
		Long: `Help renders the command's docs.

Pass --json to emit the full command tree as machine-readable JSON
(consumed by apps/docs/scripts/gen-cli.ts to regenerate
docs.nlqdb.com/cli/).`,
		Run: func(c *cobra.Command, args []string) {
			target, _, err := root.Find(args)
			if err != nil || target == nil {
				target = root
			}
			if g.json {
				if err := emitHelpJSON(root, c.OutOrStdout()); err != nil {
					fmt.Fprintf(c.ErrOrStderr(), "✗ help: %v\n", err)
				}
				return
			}
			_ = target.Help()
		},
	}
	root.SetHelpCommand(helpCmd)
}

func emitHelpJSON(root *cobra.Command, out io.Writer) error {
	enc := json.NewEncoder(out)
	enc.SetIndent("", "  ")
	return enc.Encode(walkCommand(root))
}

func walkCommand(c *cobra.Command) cmdNode {
	node := cmdNode{
		Name:    nameOf(c),
		Use:     c.Use,
		Path:    c.CommandPath(),
		Short:   c.Short,
		Long:    strings.TrimSpace(c.Long),
		Example: strings.TrimSpace(c.Example),
		Aliases: c.Aliases,
		Hidden:  c.Hidden,
	}
	node.Flags = collectFlags(c)
	for _, sub := range c.Commands() {
		if sub.Hidden {
			continue
		}
		node.Subcommands = append(node.Subcommands, walkCommand(sub))
	}
	return node
}

func collectFlags(c *cobra.Command) []flagNode {
	persistent := map[string]bool{}
	c.PersistentFlags().VisitAll(func(f *pflag.Flag) { persistent[f.Name] = true })

	flags := []flagNode{}
	c.Flags().VisitAll(func(f *pflag.Flag) {
		if f.Hidden {
			return
		}
		flags = append(flags, flagNode{
			Name:       f.Name,
			Shorthand:  f.Shorthand,
			Type:       f.Value.Type(),
			Default:    f.DefValue,
			Usage:      f.Usage,
			Persistent: persistent[f.Name],
		})
	})
	return flags
}

// First token of `Use` is the bare verb; fall back to Cobra's `Name()` when `Use` is empty (e.g. the root).
func nameOf(c *cobra.Command) string {
	fields := strings.Fields(c.Use)
	if len(fields) == 0 {
		return c.Name()
	}
	return fields[0]
}
