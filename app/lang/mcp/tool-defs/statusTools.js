const z = require("zod");
const { jsonResult } = require("../jsonResult");

function register(server, context, vscode, tools) {
  server.registerTool(
    "get_connection_status",
    {
      description:
        "Reports whether CPQ credentials are configured (never the secret values themselves), plus the " +
        "active site URL/environment/commerce settings - check this before calling a CPQ-backed tool to " +
        "avoid discovering a missing credential mid-call. Pass testConnection:true to also ping CPQ live " +
        "and confirm the credentials actually work (slower - a real network round trip).",
      inputSchema: {
        testConnection: z
          .boolean()
          .optional()
          .describe("If true, also makes a live request to CPQ to verify the credentials work."),
      },
    },
    async (args) => jsonResult(await tools.getConnectionStatus(context, vscode, args)),
  );
}

module.exports = { register };
