package cmd

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/nlqdb/nlqdb/cli/internal/api"
	"github.com/nlqdb/nlqdb/cli/internal/auth"
	"github.com/nlqdb/nlqdb/cli/internal/output"
	"github.com/nlqdb/nlqdb/cli/internal/state"
)

// rememberFlags are the per-kind extras. The positional text is always
// "the thing" (fact/episode content, or the entity's canonical name);
// the required-per-kind flags fill the rest. Keeps the verb one shape:
// `nlq remember <text>` writes a fact; `--kind` switches the table.
type rememberFlags struct {
	db       string
	kind     string
	ttl      string
	subType  string // fact category OR entity type (payload.kind)
	role     string // episode role (required for episode)
	tags     []string
	endUser  string
	threadID string
}

// registerRemember wires `nlq remember` — the E-02 agent-memory write
// verb (wire contract: SK-PIVOT-008, SDK sibling `client.remember()`,
// MCP sibling `nlqdb_remember`). The CLI half of the GLOBAL-003
// surface-parity gap the E-02 worksheet tracked.
func registerRemember(root *cobra.Command, g *globalFlags) {
	f := &rememberFlags{}
	cmd := &cobra.Command{
		Use:   "remember [--db <id>] <text>",
		Short: "Write a typed memory row into an agent_memory_v1 database (no LLM)",
		Long: `Remember materialises a structured memory row via POST /v1/memory/remember.
The server composes a deterministic parameterised INSERT — the LLM is never
in the loop and you never write SQL. The target must be an ` + "`agent_memory_v1`" + `
preset database (provisioned via the SDK/MCP ` + "`db.create`" + ` preset path);
a normal DB is rejected with a wrong_preset error.

The positional <text> is the row's primary content:
  • fact     — the thing to remember (default kind)
  • episode  — the message content (use --role to set the speaker)
  • entity   — the entity's canonical name (use --type to set its type)

DB resolution mirrors ` + "`nlq ask`" + `: --db pins one, else the active DB from
~/.config/nlqdb/state.json (` + "`nlq use <db>`" + ` switches it).

Examples:
  nlq remember "user prefers dark mode"
  nlq remember --type preference --tag ui "user prefers dark mode"
  nlq remember --ttl 7d "promo code expires next week"
  nlq remember --kind episode --role user "what's my deal pipeline?"
  nlq remember --kind entity --type person "Alice Chen"

Pass --json for machine-readable output.`,
		Args: cobra.ArbitraryArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			text := strings.TrimSpace(joinArgs(args))
			if text == "" {
				printErr(cmd, "nothing to remember — pass the text as an argument.")
				return errors.New("empty text")
			}
			dbID := f.db
			if dbID == "" {
				st, _ := state.Load()
				dbID = st.ActiveDB
			}
			if dbID == "" {
				printErr(cmd, "no active database — pass `--db <id>` or run `nlq use <id>` first.")
				return errors.New("no active db")
			}
			req, err := buildRememberRequest(dbID, text, f)
			if err != nil {
				printErr(cmd, "%v", err)
				return err
			}
			ctx, cancel := context.WithTimeout(cmd.Context(), 30*time.Second)
			defer cancel()
			return doRemember(ctx, cmd, g, req)
		},
	}
	cmd.Flags().StringVar(&f.db, "db", "", "database id to write to (default: active DB)")
	cmd.Flags().StringVar(&f.kind, "kind", "fact", "row kind: fact, episode, or entity")
	cmd.Flags().StringVar(&f.ttl, "ttl", "", "fact expiry, e.g. 7d / 24h / 30m (fact only)")
	cmd.Flags().StringVar(&f.subType, "type", "", "fact category or entity type (payload.kind)")
	cmd.Flags().StringVar(&f.role, "role", "", "episode speaker role, e.g. user/assistant (episode only)")
	cmd.Flags().StringArrayVar(&f.tags, "tag", nil, "fact tag (repeatable; fact only)")
	cmd.Flags().StringVar(&f.endUser, "end-user", "", "scope the row to an end-user id")
	cmd.Flags().StringVar(&f.threadID, "thread", "", "scope the row to a thread id")
	root.AddCommand(cmd)
}

// buildRememberRequest assembles the typed wire request from flags. Pure
// (no I/O) so the kind-specific validation is unit-testable.
func buildRememberRequest(dbID, text string, f *rememberFlags) (api.RememberRequest, error) {
	req := api.RememberRequest{DB: dbID, EndUserID: f.endUser, ThreadID: f.threadID}
	switch f.kind {
	case "fact":
		payload := map[string]any{"content": text}
		if f.subType != "" {
			payload["kind"] = f.subType
		}
		if len(f.tags) > 0 {
			payload["tags"] = f.tags
		}
		if f.ttl != "" {
			secs, err := parseTTL(f.ttl)
			if err != nil {
				return req, err
			}
			req.TTLSeconds = secs
		}
		req.Kind = "fact"
		req.Payload = payload
	case "episode":
		if f.role == "" {
			return req, errors.New("episode needs a speaker — pass `--role user` (or assistant/tool).")
		}
		req.Kind = "episode"
		req.Payload = map[string]any{"role": f.role, "content": text}
	case "entity":
		if f.subType == "" {
			return req, errors.New("entity needs a type — pass `--type person` (or project/...).")
		}
		req.Kind = "entity"
		req.Payload = map[string]any{"kind": f.subType, "canonical_name": text}
	default:
		return req, fmt.Errorf("unknown --kind %q — use fact, episode, or entity.", f.kind)
	}
	return req, nil
}

func doRemember(ctx context.Context, cmd *cobra.Command, g *globalFlags, req api.RememberRequest) error {
	id, err := auth.Resolve(true)
	if err != nil {
		printErr(cmd, "auth: %v", err)
		return err
	}
	client := api.New(g.apiURL, id).WithInviteCode(g.inviteCode)
	resp, err := client.Remember(ctx, req)
	if err != nil {
		return renderRememberError(cmd, err)
	}
	if err := state.Update(func(s *state.State) {
		s.LastUsedAt = time.Now().Unix()
	}); err != nil {
		fmt.Fprintf(cmd.ErrOrStderr(), "⚠ state: %v\n", err)
	}
	return output.New(cmd.OutOrStdout(), cmd.ErrOrStderr(), formatFor(g)).WriteRemember(resp)
}

// renderRememberError adds the `/v1/memory/remember`-specific surfaces on
// top of the shared `renderAPIError` mapper.
func renderRememberError(cmd *cobra.Command, err error) error {
	var apiErr *api.APIError
	if !errors.As(err, &apiErr) {
		printErr(cmd, "%v", err)
		return err
	}
	switch apiErr.Status {
	case "wrong_preset":
		printErr(cmd, "that database isn't an agent_memory_v1 preset — `nlq remember` only writes to memory-preset databases (create one via the SDK/MCP `db.create` preset).")
		return err
	case "forbidden":
		printErr(cmd, "this key is read-only — mint an `sk_live_…` key (or use an `sk_mcp_…` key) to write memory.")
		return err
	case "invalid_body":
		reason := apiErr.Message
		if reason == "" {
			reason = "the row payload was rejected"
		}
		printErr(cmd, "invalid memory row (%s).", reason)
		return err
	}
	return renderAPIError(cmd, err)
}

// parseTTL accepts a Go duration (e.g. 24h, 30m) plus the `Nd` day
// shorthand the worksheet specifies (`--ttl 7d`), returning whole
// seconds. The server multiplies `ttlSeconds` onto NOW() for expires_at.
func parseTTL(s string) (int, error) {
	s = strings.TrimSpace(s)
	if rest, ok := strings.CutSuffix(s, "d"); ok {
		days, err := strconv.ParseFloat(rest, 64)
		if err != nil || days <= 0 {
			return 0, fmt.Errorf("invalid --ttl %q — try 7d, 24h, or 30m.", s)
		}
		return int(days * 24 * 60 * 60), nil
	}
	d, err := time.ParseDuration(s)
	if err != nil || d <= 0 {
		return 0, fmt.Errorf("invalid --ttl %q — try 7d, 24h, or 30m.", s)
	}
	return int(d.Seconds()), nil
}
