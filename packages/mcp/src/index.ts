// Public exports for testing and downstream embedding. The npm bin
// (`bin/nlqdb-mcp.mjs`) imports `runStdio` directly; the rest are
// here so vitest tests and (future) the hosted Worker can compose
// the same handlers without going through stdio.

export {
  createServer,
  formatError,
  formatResult,
  type ServerOptions,
} from "./server.ts";
export { runStdio, type StdioOptions } from "./stdio.ts";
export {
  type DescribeInput,
  type DescribeOutput,
  describeInputShape,
  handleDescribe,
  handleListDatabases,
  handleQuery,
  type ListDatabasesInput,
  type ListDatabasesOutput,
  listDatabasesInputShape,
  mapSdkError,
  type QueryInput,
  type QueryOutput,
  queryInputShape,
  type ToolError,
  type ToolResult,
} from "./tools.ts";
