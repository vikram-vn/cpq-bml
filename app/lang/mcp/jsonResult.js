// Wraps a tool handler's result as the MCP CallToolResult shape; never includes request/response
// headers, so credentials never reach the AI client.
function jsonResult(data) {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

module.exports = { jsonResult };
