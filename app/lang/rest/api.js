const { request } = require("./client");
const { getBaseUrl, getRestVersion, getCommerceProcess, getAuthHeader, getSettings } = require("./config");

// REST version is configurable (cpqBml.rest.restVersion, default v18),
// so the path has to be built per-call rather than once at module load time.
function functionsPath(vscode, metadata) {
  const version = getRestVersion(vscode);
  if (metadata && metadata.commerceDocument) {
    const process = metadata.commerceProcess || getCommerceProcess(vscode) || 'oraclecpqo';
    return `/rest/${version}/commerceProcessSetups/${process}/documents/${metadata.commerceDocument}/bml/library/functions`;
  }
  return `/rest/${version}/bml/library/functions`;
}

// transport is an optional override (see client.js's request()) used only by
// tests to intercept the call instead of making a real HTTPS request.
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
    const pathLib = require('path');
    logFilePath = pathLib.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'bml_rest_api.log');
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

// PATCH .../bml/library/functions/{namespace.variableName}  body: { isOverridden }
// Used for Create Override (true) and Remove Override (false) on standard functions.
// The path is routed via the metadata arg (commerce vs util), not the minimal body.
// For utility libraries, it POSTs to /rest/<version>/bml/library/functions/{namespace.variableName}/actions/override or removeOverride.
function setOverride(context, vscode, namespaceVariableName, isOverridden, metadata, transport) {
  const isCommerce = metadata && metadata.commerceDocument;
  if (isCommerce) {
    return call(
      context,
      vscode,
      {
        path: `${functionsPath(vscode, metadata)}/${namespaceVariableName}`,
        method: "PATCH",
        // include routing fields so call() strips them and uses them only for the path
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
// scheduledTime must be an ISO 8601 timestamp - the "MM/DD/YYYY h:mm AM/PM"
// format from Oracle's own docs is rejected by the live API as an invalid value.
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
