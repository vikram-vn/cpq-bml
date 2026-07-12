const https = require("https");
const fs = require("fs");

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
    req.setTimeout(30000, () => {
      req.destroy(new Error("Request timeout after 30 seconds"));
    });
    req.on("error", reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

// Never write Authorization or Set-Cookie to the plaintext debug log — both carry live credentials.
function redactHeadersForLog(headers) {
  if (!headers) return headers;
  const redacted = { ...headers };
  if (redacted.Authorization) redacted.Authorization = "[REDACTED]";
  if (redacted["set-cookie"]) redacted["set-cookie"] = "[REDACTED]";
  return redacted;
}

// Never throws on an HTTP 4xx/5xx response — callers decide what a status code means for their endpoint. Only rejects on a transport/network failure.
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
    const requestInfo = {
      url: `${baseUrl}${fullPath}`,
      method,
      headers: redactHeadersForLog(headers),
      body: body,
    };
    try {
      const timestamp = new Date().toISOString();
      fs.appendFileSync(logFilePath, `[${timestamp}] REQUEST:\n${JSON.stringify(requestInfo, null, 2)}\n\n`);
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
    const responseInfo = {
      statusCode: response.statusCode,
      headers: redactHeadersForLog(response.headers),
      text: response.text,
    };
    try {
      const timestamp = new Date().toISOString();
      fs.appendFileSync(logFilePath, `[${timestamp}] RESPONSE:\n${JSON.stringify(responseInfo, null, 2)}\n\n-------------------------\n\n`);
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
