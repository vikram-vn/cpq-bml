const z = require("zod");
const { jsonResult } = require("../jsonResult");

function register(server, context, vscode, tools) {
  server.registerTool(
    "save_function",
    {
      description:
        "Save the local .bml file for a function to CPQ (PATCH; for util functions this also deploys it). The function must already have been pulled locally.",
      inputSchema: { variableName: z.string() },
    },
    async (args) => jsonResult(await tools.saveFunction(context, vscode, args)),
  );

  server.registerTool(
    "validate_function",
    {
      description:
        "Validate the local .bml file for a function against Oracle's live BML compiler, without saving it. " +
        "On failure returns error (the compiler message) and errorLine (parsed line number, when the message " +
        "includes one) directly - no need to parse the log array.",
      inputSchema: { variableName: z.string() },
    },
    async (args) =>
      jsonResult(await tools.validateFunction(context, vscode, args)),
  );

  server.registerTool(
    "debug_function",
    {
      description:
        "Run the local .bml file for a function on CPQ with the given inputs. Returns structured fields: " +
        "returnValue (the raw return), printOutput (an array of print-statement lines), scriptSize, elapsedMs, " +
        "and on failure error/errorLine. If returnValue is a \"documentNumber~variableName~value\" pipe-delimited " +
        "transaction dump, table.header (transaction-level attributes) and table.lines (one row per transaction " +
        "line, keyed by variableName) are also populated - use those instead of parsing returnValue yourself.",
      inputSchema: {
        variableName: z.string(),
        parameters: z
          .record(z.string(), z.string())
          .optional()
          .describe(
            "Parameter name -> value, for util functions that take parameters.",
          ),
        transactionId: z
          .string()
          .optional()
          .describe("Required to debug a commerce function."),
      },
    },
    async (args) =>
      jsonResult(await tools.debugFunction(context, vscode, args)),
  );

  server.registerTool(
    "deploy_function",
    {
      description:
        "Deploy a single util function on CPQ without saving it first (the local script content must already be saved).",
      inputSchema: { variableName: z.string() },
    },
    async (args) =>
      jsonResult(await tools.deployFunction(context, vscode, args)),
  );

  server.registerTool(
    "mass_deploy_util_functions",
    {
      description:
        "Deploy multiple util functions on CPQ in a single batch call.",
      inputSchema: { variableNames: z.array(z.string()).min(1) },
    },
    async (args) =>
      jsonResult(await tools.massDeployUtilFunctions(context, vscode, args)),
  );

  server.registerTool(
    "deploy_commerce_process",
    {
      description:
        "Deploy a commerce process setup on CPQ and wait for the deployment task to finish.",
      inputSchema: {
        processVarName: z
          .string()
          .optional()
          .describe("Defaults to cpqBml.connection.commerceProcess."),
      },
    },
    async (args) =>
      jsonResult(await tools.deployCommerceProcess(context, vscode, args)),
  );

  server.registerTool(
    "create_util_function",
    {
      description:
        "Create a new util library function on CPQ and save it locally.",
      inputSchema: {
        variableName: z.string(),
        name: z.string(),
        description: z.string().optional(),
        returnType: z
          .string()
          .describe(
            'e.g. "String", "Integer", "Boolean", "Float", "Date", "Json"',
          ),
        parameters: z
          .array(z.object({ name: z.string(), dataType: z.string() }))
          .optional(),
        scriptText: z.string().optional(),
      },
    },
    async (args) =>
      jsonResult(await tools.createUtilFunction(context, vscode, args)),
  );

  server.registerTool(
    "create_override",
    {
      description:
        "Create an editable override of a standard (system) BML function on CPQ. Required before that function can be validated, saved, or deployed - standard functions are read-only until overridden. The function must already have been pulled locally.",
      inputSchema: { variableName: z.string() },
    },
    async (args) =>
      jsonResult(await tools.createOverride(context, vscode, args)),
  );

  server.registerTool(
    "remove_override",
    {
      description:
        "Remove an override on a standard BML function, reverting it to CPQ's system version and discarding local override customizations. Destructive - requires confirm:true.",
      inputSchema: {
        variableName: z.string(),
        confirm: z
          .boolean()
          .default(false)
          .describe("Must be true to proceed; this discards local override customizations."),
      },
    },
    async (args) =>
      jsonResult(await tools.removeOverride(context, vscode, args)),
  );

  server.registerTool(
    "reset_ai_copy",
    {
      description:
        "Discards all edits made to the AI working copy and recreates it fresh from the canonical " +
        "pulled file. Use this when an edit went sideways and needs a clean restart. Destructive - " +
        "requires confirm:true.",
      inputSchema: {
        variableName: z.string(),
        confirm: z
          .boolean()
          .default(false)
          .describe("Must be true to proceed; this discards all AI working copy edits."),
      },
    },
    async (args) =>
      jsonResult(await tools.resetAiCopy(context, vscode, args)),
  );
}

module.exports = { register };
