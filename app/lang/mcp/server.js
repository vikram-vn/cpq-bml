const http = require("http");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const {
  StreamableHTTPServerTransport,
} = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const z = require("zod");
const tools = require("./tools");

// Wraps a tool handler's result as the MCP CallToolResult shape; never includes request/response headers, so credentials never reach the AI client.
function jsonResult(data) {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

function registerTools(server, context, vscode) {
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
    "explain_function",
    {
      description:
        "Return offline documentation for a locally pulled BML function: docHeader, parameter list, return type, and a code preview. No CPQ connection required.",
      inputSchema: { variableName: z.string() },
    },
    async (args) =>
      jsonResult(await tools.explainFunction(context, vscode, args)),
  );

  server.registerTool(
    "diff_function",
    {
      description:
        "Compare the local AI copy of a util function against the current remote version on CPQ. Returns a unified line diff with added/removed/unchanged counts.",
      inputSchema: {
        variableName: z.string(),
        type: z.enum(["util", "commerce"]).default("util"),
      },
    },
    async (args) =>
      jsonResult(await tools.diffFunction(context, vscode, args)),
  );

  server.registerTool(
    "search_functions",
    {
      description:
        "Full-text search across all locally pulled .bml files. Returns matching files sorted by match count.",
      inputSchema: {
        query: z.string().describe("The text to search for (case-insensitive)."),
        type: z
          .enum(["util", "commerce", "both"])
          .default("both")
          .describe("Restrict search to util, commerce, or both."),
      },
    },
    async (args) =>
      jsonResult(await tools.searchFunctions(context, vscode, args)),
  );

  server.registerTool(
    "lint_function",
    {
      description:
        "Run the extension's own local BML linter against a locally pulled function's code and return its diagnostics (errors/warnings/hints with line numbers). No CPQ connection needed - much faster than validate_function for iterating on a fix, though validate_function against Oracle's live compiler is still the authoritative check before saving/deploying.",
      inputSchema: { variableName: z.string() },
    },
    async (args) =>
      jsonResult(await tools.lintFunction(context, vscode, args)),
  );

  server.registerTool(
    "get_function_metrics",
    {
      description:
        "Code-quality metrics for a locally pulled function: cyclomatic complexity, max nesting depth, line counts, plus a diagnostic-count summary from the same linter lint_function uses. No CPQ connection needed.",
      inputSchema: { variableName: z.string() },
    },
    async (args) =>
      jsonResult(await tools.getFunctionMetrics(context, vscode, args)),
  );

  server.registerTool(
    "lookup_bml_reference",
    {
      description:
        "Look up built-in BML functions/attributes/system variables/snippets by exact name, or browse a category (optionally filtered by attribute scope) when no name is given. Reads the same generated reference data the editor's own hover/completion uses - use this to check real syntax, return types, or valid attribute names instead of guessing.",
      inputSchema: {
        name: z
          .string()
          .optional()
          .describe("Exact function/attribute/variable/snippet name to look up (case-insensitive)."),
        category: z
          .enum(["function", "cpqjs", "attribute", "utilAttribute", "variable", "snippet"])
          .optional()
          .describe("Restrict to one category. Omit to search all categories."),
        scope: z
          .string()
          .optional()
          .describe('For attributes: e.g. "Transaction", "Line Item", "System".'),
        limit: z
          .number()
          .optional()
          .describe("Max results when browsing without an exact name (default 20, max 100)."),
      },
    },
    async (args) =>
      jsonResult(await tools.lookupBmlReference(context, vscode, args)),
  );
}


let httpServer = null;
let boundPort = null;

// Binds 127.0.0.1 only - access is restricted to processes on this machine.
// Stateless mode (sessionIdGenerator: undefined) requires a fresh McpServer *and* a fresh
// transport per request: the underlying low-level Server can only be bound to one transport
// at a time, so reusing a single McpServer across concurrent requests lets one request's
// connect() clobber another's transport. Some MCP clients (Claude Code included) tend to
// serialize requests so this went unnoticed, but any client that opens concurrent requests
// (parallel tool calls, or simply initialize + a fast follow-up) would get dropped/misrouted
// responses. Creating both fresh per-request matches the SDK's own stateless-HTTP example and
// keeps every client, not just Claude Code, working correctly.
async function startMcpServer(context, vscode, port) {
  if (httpServer) return { port: boundPort };

  httpServer = http.createServer((req, res) => {
    const path = (req.url || "").split("?")[0];
    if (path !== "/mcp") {
      res.writeHead(404).end();
      return;
    }

    const requestServer = new McpServer(
      { name: "cpq-bml", version: "1.1.1" },
      {
        instructions:
          "Every tool returns { success: boolean, ... }. On failure, the reason is always in " +
          "'error' (never 'message') plus 'errorLine' when a line number could be parsed from it - " +
          "never parse 'log' for error text. On success, tools that ran a CPQ action include a " +
          "human-readable 'message' confirmation. Tools scoped to one function always echo back " +
          "'variableName' (or 'variableNames' for mass_deploy_util_functions), so the result is " +
          "self-describing without cross-referencing the original call args. Tools that run through " +
          "CPQ (save/validate/debug/deploy/override/create/pull) also include 'log', the human-readable " +
          "terminal trace of what happened - useful for context, but structured fields are authoritative.",
      },
    );
    registerTools(requestServer, context, vscode);

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on("close", () => {
      transport.close();
      requestServer.close().catch(() => {});
    });

    requestServer
      .connect(transport)
      .then(() => transport.handleRequest(req, res))
      .catch(() => {
        if (!res.headersSent) res.writeHead(500).end();
      });
  });

  return new Promise((resolve, reject) => {
    httpServer.once("error", (err) => {
      httpServer = null;
      reject(err);
    });
    httpServer.listen(port, "127.0.0.1", () => {
      boundPort = httpServer.address().port;
      resolve({ port: boundPort });
    });
  });
}

function stopMcpServer() {
  if (httpServer) {
    httpServer.close();
    httpServer = null;
    boundPort = null;
  }
}

function getMcpServerStatus() {
  return { running: !!httpServer, port: boundPort };
}

module.exports = { startMcpServer, stopMcpServer, getMcpServerStatus };
