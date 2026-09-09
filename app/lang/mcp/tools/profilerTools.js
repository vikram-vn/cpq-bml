/**
 * MCP Profiler Tools
 * Exposes BML static performance and timeout analysis to AI agents.
 * Strictly maintains under 500 lines of code.
 */

const { BmlProfiler } = require("../../profiler/bmlProfiler");

const profileBmlPerformanceTool = {
  name: "profile_bml_performance",
  description: "Analyzes BML code for Oracle CPQ execution bottlenecks, transaction timeout risks (5s limit), BMQL in loops, and unsupported constructs.",
  inputSchema: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "The BML script content to profile.",
      },
    },
    required: ["code"],
  },
  handler: async (args) => {
    const code = args && args.code ? args.code : "";
    if (!code.trim()) {
      return {
        content: [{ type: "text", text: JSON.stringify({ issues: [], summary: "Empty code provided" }, null, 2) }],
      };
    }

    const issues = BmlProfiler.profile(code);
    const hasErrors = issues.some((i) => i.severity === "error");

    const result = {
      healthy: !hasErrors && issues.length === 0,
      totalIssues: issues.length,
      errors: issues.filter((i) => i.severity === "error").length,
      warnings: issues.filter((i) => i.severity === "warning").length,
      info: issues.filter((i) => i.severity === "info").length,
      issues,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
};

module.exports = {
  profileBmlPerformanceTool,
};
