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
}

module.exports = { register };
