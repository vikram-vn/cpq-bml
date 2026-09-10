const z = require("zod");
const { jsonResult } = require("@/lang/mcp/jsonResult");

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
        "line, keyed by variableName) are also populated - use those instead of parsing returnValue yourself. " +
        "Supports printOnly (or showDebugPrintOnly) to return only debug print results (printOutput), omitting return values.",
      inputSchema: {
        variableName: z.string(),
        parameters: z
          .record(z.string(), z.string())
          .optional()
          .describe(
            "Parameter name -> value, for util functions that take parameters.",
          ),
        transactionId: z
          .union([z.string(), z.number()])
          .optional()
          .describe(
            "Transaction ID for debugging a commerce function. Can be a single ID or comma-separated list of 2 to 10 IDs.",
          ),
        transactionIds: z
          .array(z.union([z.string(), z.number()]))
          .optional()
          .describe(
            "Array of 2 to 10 transaction IDs for concurrent debugging (max 10).",
          ),
        concurrency: z
          .number()
          .int()
          .min(2)
          .max(10)
          .optional()
          .describe(
            "Max concurrent transaction debug executions (between 2 and 10, default is min(10, number of transactions)).",
          ),
        printOnly: z
          .boolean()
          .optional()
          .describe(
            "If true, returns only debug print results (printOutput) and omits returnValue and table.",
          ),
        showDebugPrintOnly: z
          .boolean()
          .optional()
          .describe(
            "Alias for printOnly: return only debug print results, omitting returnValue.",
          ),
      },
    },
    async (args) =>
      jsonResult(await tools.debugFunction(context, vscode, args)),
  );

  server.registerTool(
    "deploy_function",
    {
      description:
        "Deploy a single util function on CPQ without saving it first (the local script content must already be saved). Requires confirm:true.",
      inputSchema: {
        variableName: z.string(),
        confirm: z
          .boolean()
          .default(false)
          .describe("Must be true to proceed; deploying pushes changes directly to the live CPQ environment."),
      },
    },
    async (args) =>
      jsonResult(await tools.deployFunction(context, vscode, args)),
  );

  server.registerTool(
    "mass_deploy_util_functions",
    {
      description:
        "Deploy multiple util functions on CPQ in a single batch call. Requires confirm:true.",
      inputSchema: {
        variableNames: z.array(z.string()).min(1),
        confirm: z
          .boolean()
          .default(false)
          .describe("Must be true to proceed; deploying pushes changes directly to the live CPQ environment."),
      },
    },
    async (args) =>
      jsonResult(await tools.massDeployUtilFunctions(context, vscode, args)),
  );

  server.registerTool(
    "deploy_commerce_process",
    {
      description:
        "Deploy a commerce process setup on CPQ and wait for the deployment task to finish. Requires confirm:true.",
      inputSchema: {
        processVarName: z
          .string()
          .optional()
          .describe("Defaults to cpqBml.connection.commerceProcess."),
        confirm: z
          .boolean()
          .default(false)
          .describe("Must be true to proceed; deploying pushes changes directly to the live CPQ environment."),
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

  server.registerTool(
    "audit_bml_code",
    {
      description:
        "Audits a BML code snippet or function body for critical security vulnerabilities, BMQL injection risks, " +
        "queries in loops, memory exhaustion, and CPQ anti-patterns. Returns score (0-100), issues list with line numbers, and actionable suggestions.",
      inputSchema: {
        code: z.string().describe("The BML source code to audit."),
      },
    },
    async (args) => jsonResult(tools.auditBmlCode(args)),
  );

  server.registerTool(
    "validate_bmql_query",
    {
      description:
        "Validates a BMQL query offline against Oracle CPQ BMQL syntax standards, " +
        "detects SQL injection risks, unsupported SQL keywords (JOIN, GROUP BY, aggregates), " +
        "and extracts tables, columns, where clauses, and parameterized variables with detailed explanations.",
      inputSchema: {
        query: z.string().describe("The BMQL SELECT query string to validate."),
      },
    },
    async (args) => jsonResult(tools.validateBmqlQuery(args)),
  );

  server.registerTool(
    "evaluate_bml_logic",
    {
      description:
        "Executes a pure BML algorithm or expression offline in an isolated sandbox with standard CPQ built-ins " +
        "(string, math, array, dict, json, date functions). Captures print output, return value, and execution time.",
      inputSchema: {
        code: z.string().describe("The BML source code to evaluate."),
        timeoutMs: z.number().optional().describe("Execution timeout in milliseconds (default: 3000)."),
      },
    },
    async (args) => jsonResult(tools.evaluateBmlLogic(args)),
  );
}

module.exports = { register };
