// Package output renders responses. Format is selected only by `--json`,
// never by isatty(stdout), so piping into `tee` doesn't switch shapes
// (SK-CLI-004).
package output

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"text/tabwriter"
	"time"

	"github.com/nlqdb/nlqdb/cli/internal/api"
)

type Format string

const (
	FormatHuman Format = "human"
	FormatJSON  Format = "json"
)

// Writer splits results to stdout and conversational chrome to stderr
// so `--json` consumers see a single JSON document on stdout.
type Writer struct {
	Out    io.Writer
	Err    io.Writer
	Format Format
}

func New(out, errw io.Writer, format Format) *Writer {
	return &Writer{Out: out, Err: errw, Format: format}
}

func (w *Writer) JSON(v any) error {
	enc := json.NewEncoder(w.Out)
	enc.SetIndent("", "  ")
	return enc.Encode(v)
}

func (w *Writer) WriteAsk(resp *api.AskResponse) error {
	if w.Format == FormatJSON {
		return w.JSON(resp)
	}
	switch resp.Kind {
	case "create":
		return w.writeCreateHuman(resp)
	default:
		return w.writeAskHuman(resp)
	}
}

// WriteKeys renders the inventory from `nlq keys list`. Mirrors the
// dashboard layout: type, last-4, label (sk_live name or
// "<host> on <device>" for sk_mcp), last-used, status.
func (w *Writer) WriteKeys(rows []api.KeyRecord) error {
	if w.Format == FormatJSON {
		return w.JSON(map[string]any{"keys": rows})
	}
	if len(rows) == 0 {
		_, err := fmt.Fprintln(w.Err, "No keys yet. Mint one from app.nlqdb.com/app/keys.")
		return err
	}
	tw := tabwriter.NewWriter(w.Out, 0, 0, 2, ' ', 0)
	fmt.Fprintln(tw, "ID\tTYPE\tLAST4\tLABEL\tLAST USED\tSTATUS")
	for _, r := range rows {
		last := "—"
		if r.LastUsedAt != nil {
			last = formatRelative(*r.LastUsedAt)
		}
		status := "active"
		if r.RevokedAt != nil {
			status = "revoked " + formatRelative(*r.RevokedAt)
		}
		fmt.Fprintf(tw, "%s\t%s\t%s\t%s\t%s\t%s\n",
			r.ID, r.KeyType, r.Last4, keyLabel(r), last, status)
	}
	return tw.Flush()
}

func keyLabel(r api.KeyRecord) string {
	if r.MCPHost != nil && r.DeviceID != nil {
		return fmt.Sprintf("%s on %s", *r.MCPHost, *r.DeviceID)
	}
	if r.Name != nil && *r.Name != "" {
		return *r.Name
	}
	if r.DBID != nil {
		return "db " + *r.DBID
	}
	return "—"
}

// WriteRun renders `/v1/run` responses with the same `─ trace ─` separator as `nlq ask` (`SK-TRUST-002`).
func (w *Writer) WriteRun(resp *api.RunResponse) error {
	if w.Format == FormatJSON {
		return w.JSON(resp)
	}
	if len(resp.Rows) > 0 {
		writeRowsTable(w.Out, resp.Rows)
	} else {
		fmt.Fprintf(w.Out, "✓ %d row(s) affected.\n", resp.RowCount)
	}
	if resp.Trace != nil {
		fmt.Fprintln(w.Out, "─ trace ─")
		fmt.Fprintln(w.Out, indent(strings.TrimSpace(resp.Trace.SQL), "  "))
		fmt.Fprintf(w.Out, "  plan=%s model=%s\n", resp.Trace.PlanID, resp.Trace.Model)
	}
	return nil
}

// WriteRemember renders `/v1/memory/remember` responses (E-02). Human
// mode confirms the materialised row + any expiry; JSON mode passes the
// envelope straight through for programmatic callers.
func (w *Writer) WriteRemember(resp *api.RememberResult) error {
	if w.Format == FormatJSON {
		return w.JSON(resp)
	}
	fmt.Fprintf(w.Out, "✓ Remembered %s #%s.\n", resp.Kind, resp.IDString())
	if resp.ExpiresAt != "" {
		fmt.Fprintf(w.Out, "  expires %s\n", resp.ExpiresAt)
	}
	return nil
}

func (w *Writer) WriteDatabases(rows []api.DatabaseSummary) error {
	if w.Format == FormatJSON {
		return w.JSON(map[string]any{"databases": rows})
	}
	if len(rows) == 0 {
		_, err := fmt.Fprintln(w.Out, "No databases yet. Try: nlq \"<what you're building>\"")
		return err
	}
	tw := tabwriter.NewWriter(w.Out, 0, 0, 2, ' ', 0)
	fmt.Fprintln(tw, "SLUG\tENGINE\tCREATED\tLAST QUERY")
	for _, r := range rows {
		created := formatRelative(r.CreatedAt)
		last := "—"
		if r.LastQueriedAt != nil {
			last = formatRelative(*r.LastQueriedAt)
		}
		fmt.Fprintf(tw, "%s\t%s\t%s\t%s\n", r.Slug, r.Engine, created, last)
	}
	return tw.Flush()
}

func (w *Writer) writeAskHuman(resp *api.AskResponse) error {
	if resp.SelectedDB != nil {
		fmt.Fprintf(w.Err, "→ %s (auto-selected: %s)\n", resp.SelectedDB.Slug, resp.SelectedDB.Reason)
	}
	if resp.Confirm && resp.Diff != nil {
		// Human-mode trust diff lands on stdout so the user sees the
		// next-action right under the warning; JSON mode carries the
		// same fields under `resp.Diff` for programmatic consumers
		// (SK-TRUST-001).
		fmt.Fprintf(w.Out, "⚠ %s on `%s` affects ~%d rows — %s\n",
			resp.Diff.Verb, resp.Diff.Table, resp.Diff.AffectedRows, resp.Diff.Summary)
		fmt.Fprintln(w.Out, "  Re-run with `--confirm` to apply.")
		return nil
	}
	if resp.Summary != "" {
		fmt.Fprintln(w.Out, resp.Summary)
		fmt.Fprintln(w.Out)
	}
	if len(resp.Rows) > 0 {
		writeRowsTable(w.Out, resp.Rows)
	} else if resp.Summary == "" {
		fmt.Fprintln(w.Out, "(no rows)")
	}
	if resp.Trace != nil {
		fmt.Fprintln(w.Out, "─ trace ─")
		fmt.Fprintln(w.Out, indent(strings.TrimSpace(resp.Trace.SQL), "  "))
		fmt.Fprintf(w.Out, "  plan=%s model=%s cache_hit=%v confidence=%.2f\n",
			resp.Trace.PlanID, resp.Trace.Model, resp.Trace.CacheHit, resp.Trace.Confidence)
	}
	return nil
}

func (w *Writer) writeCreateHuman(resp *api.AskResponse) error {
	name := resp.DisplayName
	if name == "" {
		name = resp.DB
	}
	fmt.Fprintf(w.Out, "✓ Created `%s` (%s).\n", name, resp.Engine)
	if len(resp.SampleRows) > 0 {
		fmt.Fprintf(w.Out, "  Seeded with %d sample rows.\n", len(resp.SampleRows))
	}
	fmt.Fprintf(w.Out, "  Try: nlq \"<your question>\"\n")
	return nil
}

func writeRowsTable(out io.Writer, rows []map[string]any) {
	if len(rows) == 0 {
		return
	}
	cols := columnOrder(rows)
	tw := tabwriter.NewWriter(out, 0, 0, 2, ' ', 0)
	fmt.Fprintln(tw, strings.Join(upper(cols), "\t"))
	for _, r := range rows {
		vals := make([]string, len(cols))
		for i, c := range cols {
			vals[i] = stringify(r[c])
		}
		fmt.Fprintln(tw, strings.Join(vals, "\t"))
	}
	_ = tw.Flush()
}

func columnOrder(rows []map[string]any) []string {
	seen := map[string]struct{}{}
	cols := []string{}
	for _, r := range rows {
		for k := range r {
			if _, ok := seen[k]; ok {
				continue
			}
			seen[k] = struct{}{}
			cols = append(cols, k)
		}
	}
	return cols
}

func stringify(v any) string {
	if v == nil {
		return ""
	}
	switch t := v.(type) {
	case string:
		return t
	case bool, float32, float64, int, int32, int64, uint, uint32, uint64:
		return fmt.Sprintf("%v", t)
	default:
		b, err := json.Marshal(t)
		if err != nil {
			return fmt.Sprintf("%v", t)
		}
		return string(b)
	}
}

func upper(in []string) []string {
	out := make([]string, len(in))
	for i, s := range in {
		out[i] = strings.ToUpper(s)
	}
	return out
}

func indent(s, prefix string) string {
	lines := strings.Split(s, "\n")
	for i, l := range lines {
		lines[i] = prefix + l
	}
	return strings.Join(lines, "\n")
}

func formatRelative(unixSecs int64) string {
	if unixSecs == 0 {
		return "—"
	}
	d := time.Since(time.Unix(unixSecs, 0))
	switch {
	case d < 90*time.Second:
		return "just now"
	case d < time.Hour:
		return fmt.Sprintf("%dm ago", int(d.Minutes()))
	case d < 24*time.Hour:
		return fmt.Sprintf("%dh ago", int(d.Hours()))
	case d < 30*24*time.Hour:
		return fmt.Sprintf("%dd ago", int(d.Hours()/24))
	default:
		return time.Unix(unixSecs, 0).UTC().Format("2006-01-02")
	}
}
