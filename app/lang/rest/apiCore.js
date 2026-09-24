const fs = require("fs");
const pathLib = require("path");
const { request } = require("@/lang/rest/client");
const {
  getBaseUrl,
  getRestVersion,
  getEffectiveRestVersion,
  getCommerceProcess,
  getAuthHeader,
  getSettings,
} = require("@/lang/rest/config");

// Never emit instance links, hypermedia links (hrefs), or user credentials in REST API responses
const SENSITIVE_KEY_REGEX =
  /^(?:password|token|authHeader|authorization|cookie|set-cookie|sessionId|_user_session_id|webSvcsPassword)$/i;

function sanitizeRestResponse(data, baseUrl) {
  if (data === null || data === undefined) return data;

  if (typeof data === "string") {
    let text = data;
    if (baseUrl) {
      text = text.split(baseUrl).join("");
    }
    text = text.replace(
      /https?:\/\/[a-zA-Z0-9.-]+(?:\.bigmachines|\.oracle(?:cloud)?)\.com(?::\d+)?/gi,
      "",
    );
    return text;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeRestResponse(item, baseUrl));
  }

  if (typeof data === "object") {
    const cleaned = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === "links" || key === "href" || key === "referencesUrl") {
        continue;
      }
      if (SENSITIVE_KEY_REGEX.test(key)) {
        continue;
      }
      cleaned[key] = sanitizeRestResponse(value, baseUrl);
    }
    return cleaned;
  }

  return data;
}

const { setExtensionContext, getExtensionContext, isContextOrVscode } = require("@/extensionContext");
const setApiContext = setExtensionContext;
const getApiContext = getExtensionContext;

function normalizeArgs(args) {
  if (args && args.length >= 2) {
    if (isContextOrVscode(args[0]) || isContextOrVscode(args[1])) {
      setApiContext(args[0], args[1]);
      return Array.prototype.slice.call(args, 2);
    }
    if (args[0] == null && args[1] == null && args.length >= 3) {
      return Array.prototype.slice.call(args, 2);
    }
  }
  return Array.prototype.slice.call(args || []);
}

function functionsPath(vscode, metadata) {
  const extVsc = getExtensionContext().vscode;
  let effectiveVscode = vscode || extVsc;
  let effectiveMeta = metadata;
  if (!metadata && vscode && !isContextOrVscode(vscode)) {
    effectiveMeta = vscode;
    effectiveVscode = extVsc;
  }
  const version = getRestVersion(effectiveVscode);
  if (effectiveMeta && effectiveMeta.commerceDocument) {
    const process =
      effectiveMeta.commerceProcess || getCommerceProcess(effectiveVscode) || "oraclecpqo";
    return `/rest/${version}/commerceProcessSetups/${process}/documents/${effectiveMeta.commerceDocument}/bml/library/functions`;
  }
  return `/rest/${version}/bml/library/functions`;
}

let last401NotificationTime = 0;

function notifyUnauthorized(vscode) {
  const now = Date.now();
  if (now - last401NotificationTime < 10000) return;
  last401NotificationTime = now;
  if (vscode && vscode.window && typeof vscode.window.showErrorMessage === "function") {
    vscode.window
      .showErrorMessage(
        "CPQ-BML: Authentication failed (401 Unauthorized). Check your credentials or active environment.",
        "Open Settings",
      )
      .then((selection) => {
        if (
          selection === "Open Settings" &&
          vscode.commands &&
          typeof vscode.commands.executeCommand === "function"
        ) {
          vscode.commands.executeCommand("workbench.action.openSettings", "cpqBml");
        }
      });
  }
}

async function call(arg1, arg2, arg3, arg4) {
  let context;
  let vscode;
  let options;
  let transport;

  if (
    arg1 &&
    typeof arg1 === "object" &&
    (arg1.path !== undefined ||
      arg1.uri !== undefined ||
      arg1.method !== undefined ||
      arg1.query !== undefined ||
      arg1.body !== undefined ||
      (arg2 && typeof arg2 === "function") ||
      arguments.length <= 2)
  ) {
    const extCtx = getExtensionContext();
    options = arg1;
    transport = arg2;
    context = (options && options.context) || extCtx.context;
    vscode = (options && options.vscode) || extCtx.vscode;
  } else {
    const extCtx = getExtensionContext();
    context = arg1 || extCtx.context;
    vscode = arg2 || extCtx.vscode;
    options = arg3 || {};
    transport = arg4;
  }

  if (!vscode) {
    try {
      vscode = require("vscode");
    } catch (e) {}
  }

  const { path, uri, method, query, body, signal, timeoutMs, version } = options || {};
  let cleanedBody = body;
  if (body && typeof body === "object") {
    const { commerceProcess, commerceDocument, ...rest } = body;
    cleanedBody = rest;
  }

  const baseUrl = getBaseUrl(vscode);
  const authHeader = await getAuthHeader(context, vscode);
  const settings = getSettings(vscode);

  // Keep /rest/version only in call; everywhere else passes URI after rest version
  const effectiveVersion = version || getRestVersion(vscode) || "v18";
  let resolvedPath = path || uri || "";
  if (!resolvedPath.startsWith("/rest/")) {
    const cleanSub = resolvedPath.startsWith("/") ? resolvedPath : `/${resolvedPath}`;
    resolvedPath = `/rest/${effectiveVersion}${cleanSub}`;
  }

  let logFilePath;
  if (
    settings.debugLog &&
    vscode &&
    vscode.workspace &&
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders.length > 0
  ) {
    const logsDir = pathLib.join(
      vscode.workspace.workspaceFolders[0].uri.fsPath,
      "logs",
      "rest-api-logs",
    );
    try {
      fs.mkdirSync(logsDir, { recursive: true });
    } catch (e) {}

    let txnId = "";
    if (body && typeof body === "object") {
      if (body.transactionId) txnId = String(body.transactionId);
      else if (body.transactionID) txnId = String(body.transactionID);
      else if (body.transactionID_t) txnId = String(body.transactionID_t);
    }
    if (!txnId && query && typeof query === "object") {
      if (query.transactionId) txnId = String(query.transactionId);
      else if (query.transactionID) txnId = String(query.transactionID);
      else if (query.transactionID_t) txnId = String(query.transactionID_t);
    }
    if (!txnId && resolvedPath && typeof resolvedPath === "string") {
      const match = resolvedPath.match(
        /\/(?:documents|transaction(?:Setup)?s?)\/(\d+)/i,
      );
      if (match) txnId = match[1];
    }

    const logFileName = txnId
      ? `bml_rest_api_${txnId}.log`
      : "bml_rest_api.log";
    logFilePath = pathLib.join(logsDir, logFileName);
  }

  const response = await request({
    baseUrl,
    path: resolvedPath,
    method,
    query,
    body: cleanedBody,
    authHeader,
    timeoutMs: timeoutMs || settings.requestTimeoutMs,
    signal,
    transport,
    logFilePath,
  });

  if (response && response.statusCode === 401) {
    notifyUnauthorized(vscode);
  }

  const cleanedBodyResp = sanitizeRestResponse(response.body, baseUrl);

  return {
    ...response,
    body: cleanedBodyResp,
  };
}

module.exports = {
  call,
  setApiContext,
  getApiContext,
  normalizeArgs,
  isContextOrVscode,
  sanitizeRestResponse,
  functionsPath,
  getEffectiveRestVersion,
};
