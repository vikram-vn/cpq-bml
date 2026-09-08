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

// Global REST API concurrency limiter: at most 10 requests in flight concurrently.
const MAX_CONCURRENT_REST_REQUESTS = 10;
let activeRestRequests = 0;
const restWaitingQueue = [];

function acquireRestSlot() {
  if (activeRestRequests < MAX_CONCURRENT_REST_REQUESTS) {
    activeRestRequests++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    restWaitingQueue.push(resolve);
  });
}

function releaseRestSlot() {
  activeRestRequests--;
  if (restWaitingQueue.length > 0) {
    activeRestRequests++;
    const next = restWaitingQueue.shift();
    next();
  }
}

// Never throws on an HTTP 4xx/5xx response — callers decide what a status code means for their endpoint. Only rejects on a transport/network failure.
async function request({
  baseUrl,
  path,
  method = "GET",
  query,
  body,
  authHeader,
  headers: extraHeaders,
  includeHeaders = false,
  logFilePath,
  transport = defaultTransport,
}) {
  if (!baseUrl) {
    throw new Error("CPQ-BML: cpqBml.connection.siteUrl is not configured.");
  }

  await acquireRestSlot();
  try {

  const url = new URL(baseUrl);
  const fullPath = buildPath(path, query);

  // Content-Type only makes sense when a body is actually sent - stamping it
  // on body-less GETs is incorrect HTTP and confuses non-REST endpoints.
  // Both defaults are still overridable per call via extraHeaders, which is
  // spread last.
  const headers = {
    Accept: "application/json",
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...extraHeaders,
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
    ((response.headers && response.headers["content-type"]) || "").toLowerCase();
  const looksLikeJson =
    typeof response.text === "string" &&
    (response.text.trim().startsWith("{") || response.text.trim().startsWith("["));
  if (response.text && (contentType.includes("json") || looksLikeJson)) {
    try {
      parsedBody = JSON.parse(response.text);
    } catch (e) {
      // Leave parsedBody as the raw text if it claims to be JSON but isn't.
    }
  }

    if (includeHeaders) {
      return { statusCode: response.statusCode, headers: response.headers, body: parsedBody };
    }
    return { statusCode: response.statusCode, body: parsedBody };
  } finally {
    releaseRestSlot();
  }
}

module.exports = { request, buildPath, defaultTransport };
