export type {
  ByoEngine,
  ValidateByoConnectionResult,
  ValidatedByoConnection,
} from "./byo-connect.ts";
export { validateByoConnection } from "./byo-connect.ts";
export type {
  ParseClickhouseUrlResult,
  ParsedClickhouseUrl,
} from "./clickhouse-connection-url.ts";
export {
  parseClickhouseUrl,
  redactClickhouseUrl,
  UNPARSEABLE_CLICKHOUSE_URL,
} from "./clickhouse-connection-url.ts";
export type {
  TinybirdAdapterOptions,
  TinybirdHttpClient,
  TinybirdRequest,
  TinybirdResponse,
} from "./clickhouse-tinybird/adapter.ts";
export {
  createTinybirdAdapter,
  TinybirdAuthError,
  TinybirdRateLimitError,
  TinybirdRequestError,
  TinybirdResponseParseError,
  TinybirdServerError,
  TinybirdValidationError,
} from "./clickhouse-tinybird/adapter.ts";
export type {
  PipeHttpClient,
  PipeHttpRequest,
  PipeHttpResponse,
  PipeManagementClient,
  PipeManagementOptions,
  PipeNode,
  PipeRecord,
} from "./clickhouse-tinybird/pipe-management.ts";
export {
  createPipe,
  createPipeManagementClient,
  dropPipe,
  getPipe,
  OP_PIPE_CREATE,
  OP_PIPE_DROP,
  OP_PIPE_GET,
  PipeAuthError,
  PipeRateLimitError,
  PipeRequestError,
  PipeServerError,
} from "./clickhouse-tinybird/pipe-management.ts";
export type {
  AskCompletedEvent,
  QueryLogEntry,
  QueryLogHttpClient,
  QueryLogRequest,
  QueryLogResponse,
  QueryLogRow,
  QueryLogWriterOptions,
  WriteQueryLogResult,
} from "./clickhouse-tinybird/query-log.ts";
export {
  createQueryLogWriter,
  QueryLogWriteError,
  writeQueryLog,
} from "./clickhouse-tinybird/query-log.ts";
export type { ParseConnectionUrlResult, ParsedConnectionUrl } from "./connection-url.ts";
export {
  parseConnectionUrl,
  redactConnectionUrl,
  UNPARSEABLE_CONNECTION_URL,
} from "./connection-url.ts";
export type { DohResolverOptions } from "./doh-resolver.ts";
export { createDohResolver } from "./doh-resolver.ts";
export type { DnsResolver, EgressGuardResult } from "./egress-guard.ts";
export { guardEgressHost, guardEgressHostResolved } from "./egress-guard.ts";
export type { PostgresAdapterOptions, PostgresQueryFn } from "./postgres.ts";
export { createPostgresAdapter } from "./postgres.ts";
export type {
  Agg,
  ClickHouseEngineMeta,
  ClickHousePlan,
  Column,
  ColumnType,
  DatabaseAdapter,
  Dimension,
  Engine,
  EngineMeta,
  EnginePlan,
  EngineResult,
  ForeignKey,
  Identifier,
  Metric,
  OnDelete,
  PostgresEngineMeta,
  PostgresPlan,
  QueryResult,
  Row,
  SampleRow,
  SchemaPlan,
  Table,
} from "./types.ts";
// SchemaPlan family — typed-plan output of the db.create pipeline
// (`docs/features/hosted-db-create/FEATURE.md` SK-HDC-002). Canonical
// home is `./types.ts`; re-exported from the package root so
// consumers can `import { SchemaPlan } from "@nlqdb/db"` without
// the subpath. Both styles work; root is the recommended import.
export {
  AggSchema,
  ALLOWED_ENGINES,
  ColumnSchema,
  ColumnTypeSchema,
  DimensionSchema,
  ForeignKeySchema,
  IdentifierSchema,
  isAllowedEngine,
  MetricSchema,
  OnDeleteSchema,
  SampleRowSchema,
  SchemaPlanSchema,
  TableSchema,
} from "./types.ts";
