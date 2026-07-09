const z = require("zod");
const { jsonResult } = require("../jsonResult");

function register(server, context, vscode, tools) {
  server.registerTool(
    "run_bml_tests",
    {
      description:
        "Runs every case in <variableName>.bmltest.json (an array of " +
        "{ description?, params?, expected?, transactionId? }) against the local AI working copy, " +
        "comparing each actual debug return value to its expected one. Returns { results: " +
        "[{description, passed, expected, actual}], passedCount, failedCount }. Create the " +
        ".bmltest.json file alongside the .bml file if it doesn't exist yet.",
      inputSchema: { variableName: z.string() },
    },
    async (args) => jsonResult(await tools.runBmlTests(context, vscode, args)),
  );

  server.registerTool(
    "update_snapshot",
    {
      description:
        "Runs the local AI working copy with the given parameters and saves the return value to " +
        "<variableName>.snap.json alongside the .bml file, for compare_snapshot to check against later - " +
        "use this once you're confident the current behavior is correct.",
      inputSchema: {
        variableName: z.string(),
        parameters: z
          .record(z.string(), z.string())
          .optional()
          .describe("Parameter name -> value, for util functions that take parameters."),
        transactionId: z
          .string()
          .optional()
          .describe("Required to snapshot a commerce function."),
      },
    },
    async (args) => jsonResult(await tools.updateSnapshot(context, vscode, args)),
  );

  server.registerTool(
    "compare_snapshot",
    {
      description:
        "Reruns the local AI working copy with the saved snapshot's parameters and reports whether the " +
        "return value still matches - a regression check for changes made since update_snapshot. Returns " +
        "{ matches, expected, actual }.",
      inputSchema: { variableName: z.string() },
    },
    async (args) => jsonResult(await tools.compareSnapshot(context, vscode, args)),
  );
}

module.exports = { register };
