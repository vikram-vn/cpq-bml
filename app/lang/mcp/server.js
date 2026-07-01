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
        "Validate the local .bml file for a function against Oracle's live BML compiler, without saving it.",
      inputSchema: { variableName: z.string() },
    },
    async (args) =>
      jsonResult(await tools.validateFunction(context, vscode, args)),
  );

  server.registerTool(
    "debug_function",
    {
      description:
        "Run the local .bml file for a function on CPQ with the given inputs and return its output and print statements.",
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
}


let httpServer = null;
let boundPort = null;
let mcpServer = null;

// Binds 127.0.0.1 only - access is restricted to processes on this machine.
// A fresh transport is created per request; the SDK throws if a StreamableHTTPServerTransport is reused.
async function startMcpServer(context, vscode, port) {
  if (httpServer) return { port: boundPort };

  mcpServer = new McpServer({ name: "cpq-bml", version: "1.1.1" });
  registerTools(mcpServer, context, vscode);

  httpServer = http.createServer((req, res) => {
    const path = (req.url || "").split("?")[0];
    if (path !== "/mcp") {
      res.writeHead(404).end();
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    mcpServer
      .connect(transport)
      .then(() => transport.handleRequest(req, res))
      .catch(() => {
        if (!res.headersSent) res.writeHead(500).end();
      });
  });

  return new Promise((resolve, reject) => {
    httpServer.once("error", (err) => {
      httpServer = null;
      mcpServer = null;
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
  if (mcpServer) {
    mcpServer.close().catch(() => {});
    mcpServer = null;
  }
}

function getMcpServerStatus() {
  return { running: !!httpServer, port: boundPort };
}

module.exports = { startMcpServer, stopMcpServer, getMcpServerStatus };
