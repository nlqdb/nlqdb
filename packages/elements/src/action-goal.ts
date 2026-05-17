// Appends form values to the goal text so the planner sees them in
// the same prompt — keeps `/v1/ask` to one field per `SK-ELEM-013`.

export type FormEntry = readonly [key: string, value: string];

export function appendFormContext(goal: string, entries: readonly FormEntry[]): string {
  const trimmedGoal = goal.trim();
  const lines: string[] = [];
  for (const [rawKey, value] of entries) {
    const key = rawKey.trim();
    if (!key) continue;
    lines.push(`- ${key}: ${value}`);
  }
  if (lines.length === 0) return trimmedGoal;
  if (!trimmedGoal) return `Form data:\n${lines.join("\n")}`;
  return `${trimmedGoal}\n\nForm data:\n${lines.join("\n")}`;
}
