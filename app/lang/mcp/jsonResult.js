// Wraps a tool handler's result as the MCP CallToolResult shape; never includes request/response
// headers, instance URLs, or user credentials, so sensitive details never reach the AI client.
const INSTANCE_URL_REGEX = /https?:\/\/[a-zA-Z0-9.-]+(?:\.bigmachines|\.oracle(?:cloud)?)\.com(?::\d+)?/gi;
const SENSITIVE_KEY_REGEX = /^(?:password|token|authHeader|authorization|cookie|set-cookie|sessionId|_user_session_id|webSvcsPassword)$/i;

function scrubForMcp(data) {
  if (data === null || data === undefined) return data;

  if (typeof data === "string") {
    return data.replace(INSTANCE_URL_REGEX, "[INSTANCE_URL]");
  }

  if (Array.isArray(data)) {
    return data.map(scrubForMcp);
  }

  if (typeof data === "object") {
    const out = {};
    for (const [key, val] of Object.entries(data)) {
      if (key === "links" || key === "href" || key === "referencesUrl") {
        continue;
      }
      if (SENSITIVE_KEY_REGEX.test(key)) {
        continue;
      }
      out[key] = scrubForMcp(val);
    }
    return out;
  }

  return data;
}

function jsonResult(data) {
  const sanitized = scrubForMcp(data);
  return { content: [{ type: "text", text: JSON.stringify(sanitized) }] };
}

module.exports = { jsonResult, scrubForMcp };

