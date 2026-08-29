const http = require("http");
const fs = require("fs");
const nodePath = require("path");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const {
  StreamableHTTPServerTransport,
} = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const tools = require("./tools");
const statusTools = require("./tool-defs/statusTools");
const lookupTools = require("./tool-defs/lookupTools");
const lifecycleTools = require("./tool-defs/lifecycleTools");
const knowledgeTools = require("./tool-defs/knowledgeTools");
const referenceTools = require("./tool-defs/referenceTools");
const testingTools = require("./tool-defs/testingTools");
const formattingTools = require("./tool-defs/formattingTools");

// Reads all SKILL.md files from app/ai/skills/ and concatenates them into a
// single string for the MCP server instructions, stripping YAML frontmatter.
function loadSkillsInstructions(extensionPath) {
  if (!extensionPath) return "";
  const skillsDir = nodePath.join(extensionPath, "app", "ai", "skills");
  let combined = "";
  try {
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillFile = nodePath.join(skillsDir, entry.name, "SKILL.md");
      try {
        let content = fs.readFileSync(skillFile, "utf8");
        // Strip YAML frontmatter
        content = content.replace(/^---[\s\S]*?---\s*\n/, "");
        combined += content + "\n\n";
      } catch { // skill file missing or unreadable - skip
      }
    }
  } catch { // skills dir missing - return empty
  }
  return combined.trim();
}

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

// Starts local stateless HTTP MCP Server bound to 127.0.0.1.
async function startMcpServer(context, vscode, port) {
  if (httpServer) return { port: boundPort };

  const extensionPath = context && context.extensionPath ? context.extensionPath : "";
  const skillsText = loadSkillsInstructions(extensionPath);

  httpServer = http.createServer((req, res) => {
    const path = (req.url || "").split("?")[0];
    if (path !== "/mcp") {
      res.writeHead(404).end();
      return;
    }

    const toolResultRules =
          "Every tool returns { success: boolean, ... }. On failure, the reason is always in " +
          "'error' (never 'message') plus 'errorLine' when a line number could be parsed from it - " +
          "never parse 'log' for error text. On success, tools that ran a CPQ action include a " +
          "human-readable 'message' confirmation. Tools scoped to one function always echo back " +
          "'variableName' (or 'variableNames' for mass_deploy_util_functions), so the result is " +
          "self-describing without cross-referencing the original call args. Tools that run through " +
          "CPQ (save/validate/debug/deploy/override/create/pull) also include 'log', the human-readable " +
          "terminal trace of what happened - useful for context, but structured fields are authoritative.";

    const requestServer = new McpServer(
      { name: "cpq-bml", version: "1.1.1" },
      {
        instructions: skillsText
          ? skillsText + "\n\n---\n\n## Tool Result Conventions\n\n" + toolResultRules
          : toolResultRules,
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
