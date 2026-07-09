const http = require("http");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const {
  StreamableHTTPServerTransport,
} = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const tools = require("./tools");
const statusTools = require("./toolDefs/statusTools");
const lookupTools = require("./toolDefs/lookupTools");
const lifecycleTools = require("./toolDefs/lifecycleTools");
const knowledgeTools = require("./toolDefs/knowledgeTools");
const referenceTools = require("./toolDefs/referenceTools");
const testingTools = require("./toolDefs/testingTools");
const formattingTools = require("./toolDefs/formattingTools");

function registerTools(server, context, vscode) {
  statusTools.register(server, context, vscode, tools);
  lookupTools.register(server, context, vscode, tools);
  lifecycleTools.register(server, context, vscode, tools);
  knowledgeTools.register(server, context, vscode, tools);
  referenceTools.register(server, context, vscode, tools);
  testingTools.register(server, context, vscode, tools);
  formattingTools.register(server, context, vscode, tools);
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
