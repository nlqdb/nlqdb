package cmd

import (
	"errors"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/spf13/cobra"
	"golang.org/x/term"

	"github.com/nlqdb/nlqdb/cli/internal/byollm"
	"github.com/nlqdb/nlqdb/cli/internal/credstore"
	"github.com/nlqdb/nlqdb/cli/internal/output"
)

// registerByollm wires `nlq byollm set|status|clear` (SK-CLI-016) — the
// CLI half of the BYOLLM surface-parity gap tracked in
// premium-tier/FEATURE.md (GLOBAL-003). A stored credential makes every
// `nlq ask` dispatch through the user's own provider key at 0% markup
// (GLOBAL-026); `nlq run` is raw SQL with no LLM, so it never carries it.
// One stored credential, not a per-call flag — the key is a persistent
// secret, not a routing hint (one way to do each thing, GLOBAL-017).
func registerByollm(root *cobra.Command, g *globalFlags) {
	cmd := &cobra.Command{
		Use:   "byollm",
		Short: "Bring your own LLM provider key (0% markup)",
		Long: `Route ` + "`nlq ask`" + ` through your own LLM provider key at 0% markup.
The key is stored in your OS keychain (never config.toml) and sent only
on ` + "`nlq ask`" + ` — never on ` + "`nlq run`" + `, ` + "`nlq keys`" + `, or any other call.
The lane is signed-in only, so it activates once you run ` + "`nlq login`" + `.`,
	}
	cmd.AddCommand(byollmSetCmd(g))
	cmd.AddCommand(byollmStatusCmd(g))
	cmd.AddCommand(byollmClearCmd(g))
	root.AddCommand(cmd)
}

func byollmSetCmd(g *globalFlags) *cobra.Command {
	var key string
	cmd := &cobra.Command{
		Use:   "set <provider> <model>",
		Short: "Store a provider key (openai|anthropic|google-ai-studio)",
		Long: `Store a BYOLLM credential. The key is read from --key, else from
stdin — prefer stdin so the secret never lands in your shell history:

  echo "$OPENAI_API_KEY" | nlq byollm set openai gpt-5.2

Run interactively, the key is prompted for without echo. Provider is one
of openai, anthropic, or google-ai-studio; model is the raw upstream id
(e.g. gpt-5.2, claude-sonnet-4-6).`,
		Args: cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			raw, err := readByollmKey(cmd, key)
			if err != nil {
				return err
			}
			cred, err := byollm.Parse(args[0], args[1], raw)
			if err != nil {
				printErr(cmd, "byollm: %v.", err)
				return err
			}
			if err := credstore.Set(credstore.SlotByollm, cred.Header()); err != nil {
				printErr(cmd, "byollm: could not store key — %v.", err)
				return err
			}
			w := output.New(cmd.OutOrStdout(), cmd.ErrOrStderr(), formatFor(g))
			if w.Format == output.FormatJSON {
				return w.JSON(map[string]any{"byollm": "set", "provider": cred.Provider, "model": cred.Model})
			}
			fmt.Fprintf(cmd.OutOrStdout(), "✓ BYOLLM set: %s. `nlq ask` will use it once you're signed in.\n", cred.Redacted())
			return nil
		},
	}
	cmd.Flags().StringVar(&key, "key", "", "provider API key (omit to read from stdin / prompt)")
	return cmd
}

func byollmStatusCmd(g *globalFlags) *cobra.Command {
	return &cobra.Command{
		Use:   "status",
		Short: "Show the stored BYOLLM credential (key redacted)",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			w := output.New(cmd.OutOrStdout(), cmd.ErrOrStderr(), formatFor(g))
			cred, ok := loadByollm()
			if !ok {
				if w.Format == output.FormatJSON {
					return w.JSON(map[string]any{"byollm": "unset"})
				}
				fmt.Fprintln(cmd.OutOrStdout(), "No BYOLLM key set. Add one with `nlq byollm set <provider> <model>`.")
				return nil
			}
			if w.Format == output.FormatJSON {
				return w.JSON(map[string]any{"byollm": "set", "provider": cred.Provider, "model": cred.Model})
			}
			fmt.Fprintf(cmd.OutOrStdout(), "BYOLLM: %s\n", cred.Redacted())
			return nil
		},
	}
}

func byollmClearCmd(g *globalFlags) *cobra.Command {
	return &cobra.Command{
		Use:   "clear",
		Short: "Remove the stored BYOLLM credential",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			if err := credstore.Delete(credstore.SlotByollm); err != nil {
				printErr(cmd, "byollm: could not clear key — %v.", err)
				return err
			}
			w := output.New(cmd.OutOrStdout(), cmd.ErrOrStderr(), formatFor(g))
			if w.Format == output.FormatJSON {
				return w.JSON(map[string]any{"byollm": "cleared"})
			}
			fmt.Fprintln(cmd.OutOrStdout(), "✓ BYOLLM key cleared. `nlq ask` now uses the built-in models.")
			return nil
		},
	}
}

// byollmNeedsSession is the one-sentence next action (GLOBAL-012) shared by
// the local pre-emption in doAsk and the server's `byollm_requires_session`
// envelope, so the two paths can't drift.
const byollmNeedsSession = "run `nlq byollm clear` to use the built-in models — your own LLM key needs a signed-in session (ships with `nlq login` soon; an `sk_live_` key can't reach this lane)."

// loadByollm returns the stored credential, or false when none is set or
// the stored value is unreadable/corrupt — a corrupt slot is treated as
// "unset" so the ask path falls through to the built-in models rather
// than dispatching a guaranteed-400 header.
func loadByollm() (byollm.Credential, bool) {
	raw, err := credstore.Get(credstore.SlotByollm)
	if err != nil || raw == "" {
		return byollm.Credential{}, false
	}
	return byollm.FromStored(raw)
}

// readByollmKey resolves the key: --key wins; else stdin (piped is read
// verbatim, an interactive TTY prompts without echo). Keeping the key off
// argv by default is the secure path — process lists and shell history
// both expose positional args.
func readByollmKey(cmd *cobra.Command, flagKey string) (string, error) {
	if flagKey != "" {
		return flagKey, nil
	}
	in, ok := cmd.InOrStdin().(*os.File)
	if ok && term.IsTerminal(int(in.Fd())) {
		fmt.Fprint(cmd.ErrOrStderr(), "Paste your provider key: ")
		b, err := term.ReadPassword(int(in.Fd()))
		fmt.Fprintln(cmd.ErrOrStderr())
		if err != nil {
			return "", fmt.Errorf("read key: %w", err)
		}
		return strings.TrimSpace(string(b)), nil
	}
	b, err := io.ReadAll(cmd.InOrStdin())
	if err != nil {
		return "", fmt.Errorf("read key from stdin: %w", err)
	}
	out := strings.TrimSpace(string(b))
	if out == "" {
		printErr(cmd, "no key given — pass --key or pipe it on stdin.")
		return "", errors.New("empty byollm key")
	}
	return out, nil
}
