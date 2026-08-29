const fs = require("fs");
const pathLib = require("path");
const { request } = require("./client");
const { getBaseUrl, getRestVersion, getCommerceProcess, getAuthHeader, getSettings } = require("./config");

function functionsPath(vscode, metadata) {
  const version = getRestVersion(vscode);
  if (metadata && metadata.commerceDocument) {
    const process = metadata.commerceProcess || getCommerceProcess(vscode) || 'oraclecpqo';
    return `/rest/${version}/commerceProcessSetups/${process}/documents/${metadata.commerceDocument}/bml/library/functions`;
  }
  return `/rest/${version}/bml/library/functions`;
}

// transport lets tests intercept the call instead of making a real HTTPS request.
async function call(context, vscode, { path, method, query, body }, transport) {
  let cleanedBody = body;
  if (body && typeof body === 'object') {
    const { commerceProcess, commerceDocument, ...rest } = body;
    cleanedBody = rest;
  }
  const baseUrl = getBaseUrl(vscode);
  const authHeader = await getAuthHeader(context, vscode);
  const settings = getSettings(vscode);
  let logFilePath;
  if (settings.debugLog && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    const logsDir = pathLib.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'logs', 'rest-api-logs');
    try {
      fs.mkdirSync(logsDir, { recursive: true });
    } catch (e) {}
    
    let txnId = '';
    if (body && typeof body === 'object') {
      if (body.transactionId) txnId = String(body.transactionId);
      else if (body.transactionID) txnId = String(body.transactionID);
      else if (body.transactionID_t) txnId = String(body.transactionID_t);
    }
    if (!txnId && query && typeof query === 'object') {
      if (query.transactionId) txnId = String(query.transactionId);
      else if (query.transactionID) txnId = String(query.transactionID);
      else if (query.transactionID_t) txnId = String(query.transactionID_t);
    }
    if (!txnId && path && typeof path === 'string') {
      const match = path.match(/\/(?:documents|transaction(?:Setup)?s?)\/(\d+)/i);
      if (match) txnId = match[1];
    }
    
    const logFileName = txnId ? `bml_rest_api_${txnId}.log` : 'bml_rest_api.log';
    logFilePath = pathLib.join(logsDir, logFileName);
  }

  return request({
    baseUrl,
    path,
    method,
    query,
    body: cleanedBody,
    authHeader,
    logFilePath,
    ...(transport ? { transport } : {}),
  });
}

// GET /rest/<version>/bml/library/functions?offset=&limit= -> { items, offset, limit, count, hasMore }
function listLibraryFunctions(
  context,
  vscode,
  { offset = 0, limit = 1000 } = {},
  transport,
  metadata,
) {
  return call(
    context,
    vscode,
    { path: functionsPath(vscode, metadata), method: "GET", query: { offset, limit } },
    transport,
  );
}

// GET /rest/<version>/bml/library/folders
function listLibraryFolders(context, vscode, transport) {
  const version = getRestVersion(vscode);
  return call(
    context,
    vscode,
    { path: `/rest/${version}/bml/library/folders`, method: "GET" },
    transport,
  );
}

// GET /rest/<version>/bml/library/functions/{namespace.variableName} -> full function object (scriptText, parameters, ...)
function getLibraryFunction(context, vscode, namespaceVariableName, transport, metadata) {
  return call(
    context,
    vscode,
    { path: `${functionsPath(vscode, metadata)}/${namespaceVariableName}`, method: "GET" },
    transport,
  );
}

// PATCH /rest/<version>/bml/library/functions/{namespace.variableName}
function updateLibraryFunction(
  context,
  vscode,
  namespaceVariableName,
  payload,
  transport,
) {
  return call(
    context,
    vscode,
    {
      path: `${functionsPath(vscode, payload)}/${namespaceVariableName}`,
      method: "PATCH",
      body: payload,
    },
    transport,
  );
}

// POST /rest/<version>/bml/library/functions
function createLibraryFunction(
  context,
  vscode,
  payload,
  transport,
) {
  return call(
    context,
    vscode,
    {
      path: functionsPath(vscode, payload),
      method: "POST",
      body: payload,
    },
    transport,
  );
}

// POST /rest/<version>/bml/library/functions/actions/validate -> 204 on success
function validateLibraryFunction(context, vscode, payload, transport) {
  return call(
    context,
    vscode,
    {
      path: `${functionsPath(vscode, payload)}/actions/validate`,
      method: "POST",
      body: payload,
    },
    transport,
  );
}

// POST /rest/<version>/bml/library/functions/actions/deploy, body: { items: [{ namespace, type, variableName }] }.
// Accepts one or more items so multiple util functions can be deployed in a single call.
function deployLibraryFunctions(context, vscode, items, transport, metadata) {
  return call(
    context,
    vscode,
    {
      path: `${functionsPath(vscode, metadata)}/actions/deploy`,
      method: "POST",
      body: { items },
    },
    transport,
  );
}

// POST /rest/<version>/bml/library/functions/actions/debug -> { returnData, scriptSize }
function debugLibraryFunction(context, vscode, payload, transport) {
  return call(
    context,
    vscode,
    { path: `${functionsPath(vscode, payload)}/actions/debug`, method: "POST", body: payload },
    transport,
  );
}

// POST /rest/<version>/.../bml/library/functions/actions/loadTransactionData
function loadTransactionData(context, vscode, payload, queryParams, transport) {
  return call(
    context,
    vscode,
    {
      path: `${functionsPath(vscode, payload)}/actions/loadTransactionData`,
      method: "POST",
      body: payload,
      query: queryParams
    },
    transport,
  );
}

// POST /rest/<version>/.../bml/library/functions/actions/dependentAttributes
function getDependentAttributes(context, vscode, payload, transport) {
  return call(
    context,
    vscode,
    {
      path: `${functionsPath(vscode, payload)}/actions/dependentAttributes`,
      method: "POST",
      body: payload
    },
    transport,
  );
}

// Commerce: PATCH { isOverridden }. Util: POST to .../actions/override or removeOverride instead.
function setOverride(context, vscode, namespaceVariableName, isOverridden, metadata, transport) {
  const isCommerce = metadata && metadata.commerceDocument;
  if (isCommerce) {
    return call(
      context,
      vscode,
      {
        path: `${functionsPath(vscode, metadata)}/${namespaceVariableName}`,
        method: "PATCH",
        // call() strips commerceProcess/commerceDocument from the body, they're only used for routing.
        body: { isOverridden, commerceProcess: metadata.commerceProcess, commerceDocument: metadata.commerceDocument },
      },
      transport,
    );
  } else {
    const action = isOverridden ? "override" : "removeOverride";
    return call(
      context,
      vscode,
      {
        path: `${functionsPath(vscode, metadata)}/${namespaceVariableName}/actions/${action}`,
        method: "POST",
        body: {},
      },
      transport,
    );
  }
}

// POST /rest/<version>/commerceProcessSetups/{processVarName}/deploymentCenter/actions
// scheduledTime must be ISO 8601 — the "MM/DD/YYYY h:mm AM/PM" format from Oracle's own docs is rejected live.
function deployCommerceProcess(context, vscode, processVarName, transport) {
  const version = getRestVersion(vscode);
  return call(
    context,
    vscode,
    {
      path: `/rest/${version}/commerceProcessSetups/${processVarName}/deploymentCenter/actions`,
      method: "POST",
      body: {
        category: "DEPLOY_PROCESS",
        scheduledTime: new Date().toISOString(),
        sendEmail: false,
      },
    },
    transport,
  );
}

// GET /rest/<version>/tasks/{taskId} -> { id, name, status, detailStatus, ... }
// Used to poll the async task a Deployment Center action (e.g. deployCommerceProcess) queues.
function getTask(context, vscode, taskId, transport) {
  const version = getRestVersion(vscode);
  return call(
    context,
    vscode,
    { path: `/rest/${version}/tasks/${taskId}`, method: "GET" },
    transport,
  );
}

module.exports = {
  functionsPath,
  listLibraryFunctions,
  listLibraryFolders,
  getLibraryFunction,
  updateLibraryFunction,
  createLibraryFunction,
  validateLibraryFunction,
  deployLibraryFunctions,
  debugLibraryFunction,
  loadTransactionData,
  getDependentAttributes,
  setOverride,
  deployCommerceProcess,
  getTask,
};
