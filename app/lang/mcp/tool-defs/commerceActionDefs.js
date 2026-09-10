const z = require("zod");
const { jsonResult } = require("@/lang/mcp/jsonResult");

function register(server, context, vscode, tools) {
  server.registerTool(
    "list_commerce_documents",
    {
      description: "List all Commerce Documents (header transaction and sub-documents like transactionLine) for a CPQ process.",
      inputSchema: {
        commerceProcess: z.string().optional().describe("Commerce process variable name. Defaults to configured process (oraclecpqo)."),
      },
    },
    async (args) => jsonResult(await tools.listCommerceDocumentsTool(context, vscode, args)),
  );

  server.registerTool(
    "list_commerce_actions",
    {
      description: "List all Commerce Document Actions defined in Oracle CPQ. By default queries both header (transaction) and sub-document (transactionLine) actions.",
      inputSchema: {
        commerceProcess: z.string().optional().describe("Commerce process variable name. Defaults to configured process (oraclecpqo)."),
        commerceDocument: z.string().optional().describe("Specific document variable name (e.g. 'transaction' or 'transactionLine'). If omitted, returns actions for both."),
        limit: z.number().optional().describe("Max number of items to return per document (default 1000)."),
        offset: z.number().optional().describe("Pagination offset (default 0)."),
      },
    },
    async (args) => jsonResult(await tools.listCommerceActionsTool(context, vscode, args)),
  );

  server.registerTool(
    "get_commerce_action",
    {
      description: "Get full action definition metadata for a specific Commerce Action (e.g. cleanSave_t, copyLineItems_t).",
      inputSchema: {
        actionVariableName: z.string().describe("Variable name of the action (e.g. 'cleanSave_t')."),
        commerceProcess: z.string().optional().describe("Commerce process variable name. Defaults to configured process (oraclecpqo)."),
        commerceDocument: z.string().optional().describe("Commerce document variable name ('transaction' or 'transactionLine'). Defaults to 'transaction'."),
      },
    },
    async (args) => jsonResult(await tools.getCommerceActionTool(context, vscode, args)),
  );
}

module.exports = {
  register,
};
