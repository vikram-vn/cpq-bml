const z = require("zod");
const { jsonResult } = require("../jsonResult");

function register(server, context, vscode, tools) {
  server.registerTool(
    "list_util_functions",
    {
      description:
        "List all util library functions on the configured CPQ instance.",
      inputSchema: {},
    },
    async () => jsonResult(await tools.listUtilFunctions(context, vscode, {})),
  );

  server.registerTool(
    "list_commerce_functions",
    {
      description:
        "List commerce process functions on the configured CPQ instance.",
      inputSchema: {
        commerceProcess: z
          .string()
          .optional()
          .describe("Defaults to cpqBml.connection.commerceProcess."),
        commerceDocument: z
          .string()
          .optional()
          .describe("Defaults to cpqBml.connection.commerceDocument."),
      },
    },
    async (args) =>
      jsonResult(await tools.listCommerceFunctions(context, vscode, args)),
  );

  server.registerTool(
    "pull_function",
    {
      description:
        "Fetch a function from CPQ and write it locally as a .bml file plus a metadata sidecar, so it can be edited and later saved/validated/debugged/deployed.",
      inputSchema: {
        variableName: z.string(),
        type: z.enum(["util", "commerce"]).default("util"),
        commerceProcess: z.string().optional(),
        commerceDocument: z.string().optional(),
      },
    },
    async (args) => jsonResult(await tools.pullFunction(context, vscode, args)),
  );

  server.registerTool(
    "pull_functions",
    {
      description:
        "Batch form of pull_function - fetches multiple functions from CPQ in one call, each independently " +
        "util or commerce, and writes each locally. Returns { results: [...one pull_function result per item], " +
        "successCount, failureCount } - a partial failure does not stop the rest of the batch.",
      inputSchema: {
        items: z
          .array(
            z.object({
              variableName: z.string(),
              type: z.enum(["util", "commerce"]).default("util"),
              commerceProcess: z.string().optional(),
              commerceDocument: z.string().optional(),
            }),
          )
          .min(1),
      },
    },
    async (args) => jsonResult(await tools.pullFunctions(context, vscode, args)),
  );

  server.registerTool(
    "global_search_bml",
    {
      description:
        "BML Global Search across all remote BML scripts in the Oracle CPQ instance (GET /rest/v19/bml/scripts). " +
        "Searches across util library functions, commerce process scripts, and product attributes for matching script text and returns exact location metadata and script snippets.",
      inputSchema: {
        query: z.string().describe("Text string to search for across all remote BML scripts in CPQ."),
        caseSensitive: z
          .boolean()
          .optional()
          .default(false)
          .describe("If true, performs case-sensitive search. Default is false (case-insensitive)."),
        offset: z.number().int().min(0).optional().default(0).describe("Pagination offset (default 0)."),
        limit: z.number().int().min(1).max(1000).optional().default(100).describe("Maximum results to return (default 100)."),
        fields: z.string().optional().describe("Optional comma-delimited fields to restrict the response."),
        orderby: z.string().optional().describe("Optional comma-separated list of pairs for ordering results."),
      },
    },
    async (args) => jsonResult(await tools.globalSearchBml(context, vscode, args)),
  );

  server.registerTool(
    "search_bml_scripts",
    {
      description:
        "Alias for global_search_bml: BML Global Search across all remote BML scripts in Oracle CPQ via GET /rest/v19/bml/scripts.",
      inputSchema: {
        query: z.string().describe("Text string to search for across all remote BML scripts in CPQ."),
        caseSensitive: z
          .boolean()
          .optional()
          .default(false)
          .describe("If true, performs case-sensitive search. Default is false (case-insensitive)."),
        offset: z.number().int().min(0).optional().default(0),
        limit: z.number().int().min(1).max(1000).optional().default(100),
        fields: z.string().optional(),
        orderby: z.string().optional(),
      },
    },
    async (args) => jsonResult(await tools.globalSearchBml(context, vscode, args)),
  );
}

module.exports = { register };

