const https = require("https");

// Builds the path + query string for a request, e.g.
//   buildPath('/rest/v18/bml/library/functions', { offset: 0, limit: 1000 })
//   -> '/rest/v18/bml/library/functions?offset=0&limit=1000'
function buildPath(path, query) {
  if (!query) return path;
  const params = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  if (params.length === 0) return path;
  return `${path}?${params.join("&")}`;
}

// The default transport, talking real HTTPS via Node's built-in module. Tests
// inject a fake transport instead so no real network call is ever made.
function defaultTransport({ hostname, port, path, method, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname, port, path, method, headers },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            text: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    req.on("error", reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

// Redacts secrets before anything gets written to the on-disk debug log
// (cpqBml.connection.debugLog): the Authorization header is the username/
// password or bearer token in plain (or trivially reversible base64) form,
// and a Set-Cookie can carry a live, replayable session token - neither
// should ever land in a plaintext file.
function redactHeadersForLog(headers) {
  if (!headers) return headers;
  const redacted = { ...headers };
  if (redacted.Authorization) redacted.Authorization = "[REDACTED]";
  if (redacted["set-cookie"]) redacted["set-cookie"] = "[REDACTED]";
  return redacted;
}

// Performs one REST call. Never throws on an HTTP-level 4xx/5xx response -
// callers (api.js) decide what a given status code means for that endpoint
// (e.g. a 4xx from "validate" is an expected, meaningful outcome, not an
// exceptional one). Only rejects on a transport/network-level failure.
//
// Returns { statusCode, body } where body is the parsed JSON if the response
// looks like JSON, otherwise the raw response text (which may be empty, e.g.
// for a 204 No Content response).
async function request({
  baseUrl,
  path,
  method = "GET",
  query,
  body,
  authHeader,
  logFilePath,
  transport = defaultTransport,
}) {
  if (!baseUrl) {
    throw new Error("CPQ-BML: cpqBml.connection.siteUrl is not configured.");
  }

  const url = new URL(baseUrl);
  const fullPath = buildPath(path, query);

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (authHeader) headers.Authorization = authHeader;

  let serializedBody;
  if (body !== undefined) {
    serializedBody = JSON.stringify(body);
    headers["Content-Length"] = Buffer.byteLength(serializedBody);
  }

  if (logFilePath) {
    const fs = require("fs");
    const requestInfo = {
      url: `${baseUrl}${fullPath}`,
      method,
      headers: redactHeadersForLog(headers),
      body: body,
    };
    try {
      fs.writeFileSync(logFilePath, `REQUEST:\n${JSON.stringify(requestInfo, null, 2)}\n\n`);
    } catch (e) {}
  }

  const response = await transport({
    hostname: url.hostname,
    port: url.port || 443,
    path: fullPath,
    method,
    headers,
    body: serializedBody,
  });

  if (logFilePath) {
    const fs = require("fs");
    const responseInfo = {
      statusCode: response.statusCode,
      headers: redactHeadersForLog(response.headers),
      text: response.text,
    };
    try {
      fs.appendFileSync(logFilePath, `RESPONSE:\n${JSON.stringify(responseInfo, null, 2)}\n\n-------------------------\n\n`);
    } catch (e) {}
  }

  let parsedBody = response.text;
  const contentType =
    (response.headers && response.headers["content-type"]) || "";
  if (response.text && contentType.includes("application/json")) {
    try {
      parsedBody = JSON.parse(response.text);
    } catch (e) {
      // Leave parsedBody as the raw text if it claims to be JSON but isn't.
    }
  }

  return { statusCode: response.statusCode, body: parsedBody };
}

module.exports = { request, buildPath, defaultTransport };
