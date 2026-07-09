const z = require("zod");
const { jsonResult } = require("../jsonResult");

function register(server, context, vscode, tools) {
  server.registerTool(
    "format_bml",
    {
      description:
        "Beautifies the local AI working copy's current file content (reindents, normalizes spacing) " +
        "using the same formatter behind the editor's own \"Format Document\" command, and writes the " +
        "result back to that file. Useful right before save_function/validate_function, after editing " +
        "the .bml file directly. Returns { changed, formattedText }.",
      inputSchema: { variableName: z.string() },
    },
    async (args) => jsonResult(await tools.formatBmlFunction(context, vscode, args)),
  );
}

module.exports = { register };
