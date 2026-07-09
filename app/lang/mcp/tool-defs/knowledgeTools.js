const z = require("zod");
const { jsonResult } = require("../jsonResult");

function register(server, context, vscode, tools) {
  server.registerTool(
    "list_local_functions",
    {
      description:
        "Enumerates every function already pulled locally (from the configured pull folder), without " +
        "needing to already know a variableName. Use this to get oriented in a workspace before " +
        "guessing names for explain_function/lint_function/etc. Returns { functions: " +
        "[{variableName, name, type, commerceProcess?, commerceDocument?, canonicalPath}] }.",
      inputSchema: {},
    },
    async () => jsonResult(await tools.listLocalFunctions(context, vscode)),
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
    "lint_all_functions",
    {
      description:
        "Runs lint_function across every locally pulled function and returns an aggregate summary - " +
        "totalErrors, totalWarnings, worstOffenders (top 10 by combined error+warning count) - " +
        "alongside each function's full diagnostics. A workspace-wide health check instead of one " +
        "function at a time. No CPQ connection needed.",
      inputSchema: {},
    },
    async () => jsonResult(await tools.lintAllFunctions(context, vscode)),
  );
}

module.exports = { register };
