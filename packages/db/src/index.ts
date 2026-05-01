export type { PostgresAdapterOptions, PostgresQueryFn } from "./postgres.ts";
export { createPostgresAdapter } from "./postgres.ts";
export type {
  Agg,
  Column,
  ColumnType,
  DatabaseAdapter,
  Dimension,
  Engine,
  ForeignKey,
  Identifier,
  Metric,
  OnDelete,
  QueryResult,
  SampleRow,
  SchemaPlan,
  Table,
} from "./types.ts";
// SchemaPlan family — typed-plan output of the db.create pipeline
// (`.claude/skills/hosted-db-create/SKILL.md` SK-HDC-002). Canonical
// home is `./types.ts`; re-exported from the package root so
// consumers can `import { SchemaPlan } from "@nlqdb/db"` without
// the subpath. Both styles work; root is the recommended import.
export {
  AggSchema,
  ColumnSchema,
  ColumnTypeSchema,
  DimensionSchema,
  ForeignKeySchema,
  IdentifierSchema,
  MetricSchema,
  OnDeleteSchema,
  SampleRowSchema,
  SchemaPlanSchema,
  TableSchema,
} from "./types.ts";
