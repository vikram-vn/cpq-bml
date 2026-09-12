const z = require("zod");
const { jsonResult } = require("@/lang/mcp/jsonResult");

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

  const transactionInputSchema = {
    q: z
      .string()
      .optional()
      .describe("Filtering criteria query, e.g. \"{status_t:'CREATED'}\" or \"{_customer_t_company_name:'TestCo1'}\"."),
    query: z.string().optional().describe("Alias for q filter criteria."),
    offset: z.number().int().min(0).optional().default(25).describe("Pagination offset (default 25)."),
    limit: z.number().int().min(1).max(1000).optional().default(25).describe("Maximum transactions to return (default 25)."),
    fields: z
      .string()
      .optional()
      .default("_id,transactionID_t")
      .describe("Comma-delimited fields to return. Defaults to '_id,transactionID_t'."),
    excludeFieldTypes: z
      .union([z.boolean(), z.string()])
      .optional()
      .default(true)
      .describe("Exclude field types to minimize payload size (default true/yes)."),
    commerceProcess: z
      .string()
      .optional()
      .describe("Commerce process name (defaults to configured process, e.g. 'oraclecpqo')."),
    commerceDocument: z
      .string()
      .optional()
      .describe("Commerce document name (defaults to configured document, e.g. 'transaction')."),
    orderby: z
      .string()
      .optional()
      .describe("Optional comma-separated list of pairs for ordering results."),
  };

  server.registerTool(
    "get_transactions",
    {
      description:
        "Retrieve commerce transactions from Oracle CPQ (GET /rest/v19/commerceDocuments<Process><Document>). " +
        "Returns a minimal response containing only _id and transactionID_t (no href links) for use in debugging commerce functions. " +
        "Supports user filters via q/query, offset (default 25), limit (default 25), and excludeFieldTypes (default yes).",
      inputSchema: transactionInputSchema,
    },
    async (args) => jsonResult(await tools.getTransactions(context, vscode, args)),
  );

  server.registerTool(
    "list_transactions",
    {
      description:
        "Alias for get_transactions: Retrieve commerce transactions from Oracle CPQ for debugging.",
      inputSchema: transactionInputSchema,
    },
    async (args) => jsonResult(await tools.getTransactions(context, vscode, args)),
  );

  server.registerTool(
    "lookup_commerce_attribute",
    {
      description:
        "Look up commerce, system, or configuration attributes by name or human-readable label (e.g. 'Status', 'Grand Total', 'status_t', 'ram_size'). " +
        "Returns matching attributes, data types, product families, models, and dropdown menu items (if any). Reads from local workspace metadata (cpq/) and bundled CPQ catalog with zero network calls.",
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe("Attribute label or variable name to look up (case-insensitive)."),
      },
    },
    async (args) => jsonResult(await tools.lookupCommerceAttribute(context, vscode, args)),
  );

  server.registerTool(
    "lookup_attribute",
    {
      description:
        "Alias for lookup_commerce_attribute: Search attributes across Commerce, System, and Configuration domains from local workspace (cpq/).",
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe("Attribute label or variable name to look up (case-insensitive)."),
      },
    },
    async (args) => jsonResult(await tools.lookupCommerceAttribute(context, vscode, args)),
  );

  server.registerTool(
    "sync_commerce_attributes",
    {
      description:
        "Pull and cache commerce attributes, transaction line attributes, and dropdown menu options from Oracle CPQ for the active process/document into the local workspace (cpq/commerce/<process>/attributes.min.json). " +
        "Enables smart query resolution and offline attribute lookups with zero network calls.",
      inputSchema: {
        commerceProcess: z
          .string()
          .optional()
          .describe("Commerce process name (defaults to configured process, e.g. 'oraclecpqo')."),
        commerceDocument: z
          .string()
          .optional()
          .describe("Commerce document name (defaults to configured document, e.g. 'transaction')."),
      },
    },
    async (args) => jsonResult(await tools.syncCommerceAttributes(context, vscode, args)),
  );

  server.registerTool(
    "sync_configuration_attributes",
    {
      description:
        "Pull and cache Configuration attributes, product families, product lines, and models dynamically from Oracle CPQ into the local workspace (cpq/config/<productFamily>/attributes.min.json). " +
        "Enables offline intellisense and AI attribute lookups for Configuration BML scripts.",
      inputSchema: {
        productFamily: z
          .string()
          .optional()
          .describe("Optional Product Family variable name to sync (e.g. 'servers', 'telecom'). Leave blank or omit to sync all product families."),
      },
    },
    async (args) => jsonResult(await tools.syncConfigurationAttributes(context, vscode, args)),
  );

  server.registerTool(
    "list_datatables",
    {
      description:
        "List all available Oracle CPQ Data Tables on the active environment. Useful for discovering tables before writing BMQL queries.",
      inputSchema: {},
    },
    async (args) => jsonResult(await tools.listDataTables(context, vscode, args)),
  );

  server.registerTool(
    "get_datatable_schema",
    {
      description:
        "Fetch column names, data types, and primary key status for a specific Oracle CPQ Data Table. Enables writing precise BMQL SELECT queries with accurate column names.",
      inputSchema: {
        tableName: z.string().describe("The name of the Data Table to inspect."),
      },
    },
    async (args) => jsonResult(await tools.getDataTableSchema(context, vscode, args)),
  );
}

module.exports = { register };

