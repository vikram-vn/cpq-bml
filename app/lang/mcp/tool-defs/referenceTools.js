const z = require("zod");
const { jsonResult } = require("../jsonResult");

function register(server, context, vscode, tools) {
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

module.exports = { register };
