const {
  call,
  sanitizeRestResponse,
  functionsPath,
  getEffectiveRestVersion,
} = require("@/lang/rest/apiCore");
const { getRestVersion } = require("@/lang/rest/config");
const apiCommerce = require("@/lang/rest/apiCommerce");
const apiConfig = require("@/lang/rest/apiConfig");

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
    {
      path: functionsPath(vscode, metadata),
      method: "GET",
      query: { offset, limit },
    },
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
function getLibraryFunction(
  context,
  vscode,
  namespaceVariableName,
  transport,
  metadata,
) {
  return call(
    context,
    vscode,
    {
      path: `${functionsPath(vscode, metadata)}/${namespaceVariableName}`,
      method: "GET",
    },
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
function createLibraryFunction(context, vscode, payload, transport) {
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
    {
      path: `${functionsPath(vscode, payload)}/actions/debug`,
      method: "POST",
      body: payload,
    },
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
      query: queryParams,
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
      body: payload,
    },
    transport,
  );
}

// Commerce: PATCH { isOverridden }. Util: POST to .../actions/override or removeOverride instead.
function setOverride(
  context,
  vscode,
  namespaceVariableName,
  isOverridden,
  metadata,
  transport,
) {
  const isCommerce = metadata && metadata.commerceDocument;
  if (isCommerce) {
    return call(
      context,
      vscode,
      {
        path: `${functionsPath(vscode, metadata)}/${namespaceVariableName}`,
        method: "PATCH",
        // call() strips commerceProcess/commerceDocument from the body, they're only used for routing.
        body: {
          isOverridden,
          commerceProcess: metadata.commerceProcess,
          commerceDocument: metadata.commerceDocument,
        },
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

// GET /rest/<version>/tasks
// Per Oracle CPQ Swagger spec: '?q={category:{$in:[ ]}}' is required.
// Supported categories: 13 (DT Import), 17 (DT Deploy), 26 (DT Export), 51 (Package Import), 52 (Package Export)
function listTasks(
  context,
  vscode,
  { offset = 0, limit = 50, orderby = "dateModified:desc", q } = {},
  transport,
) {
  const version = getRestVersion(vscode);
  const defaultQ = "{category:{$in:[13,17,26,51,52]}}";
  const queryParams = { offset, limit, totalResults: true, q: q || defaultQ };
  if (orderby) queryParams.orderby = orderby;
  return call(
    context,
    vscode,
    { path: `/rest/${version}/tasks`, method: "GET", query: queryParams },
    transport,
  );
}

// GET /rest/<version>/bml/scripts?q={'scriptText':{$contains:'<query>', $options:'I'}}
// BML Global Search introduced in Oracle CPQ 26A (/rest/v19/bml/scripts).
function searchBmlScripts(
  context,
  vscode,
  {
    query,
    caseSensitive = false,
    offset = 0,
    limit = 100,
    fields,
    orderby,
    totalResults = true,
    q: rawQ,
  } = {},
  transport,
) {
  const effectiveVersion = getEffectiveRestVersion(vscode, 19);

  let q = rawQ;
  if (!q && query) {
    const escaped = String(query).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    q = caseSensitive
      ? `{'scriptText':{$contains:'${escaped}'}}`
      : `{'scriptText':{$contains:'${escaped}',$options:'I'}}`;
  }

  const queryParams = { offset, limit, totalResults };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;
  if (orderby) queryParams.orderby = orderby;

  return call(
    context,
    vscode,
    {
      path: `/rest/${effectiveVersion}/bml/scripts`,
      method: "GET",
      query: queryParams,
    },
    transport,
  );
}

// GET /rest/<version>/datatables
async function listDataTables(context, vscode, { offset = 0, limit = 1000 } = {}, transport) {
  const version = getRestVersion(vscode);
  return call(
    context,
    vscode,
    {
      path: `/rest/${version}/datatables`,
      method: "GET",
      query: { offset, limit, totalResults: true },
    },
    transport,
  );
}

// GET /rest/<version>/datatables/{tableName}/fields
async function getDataTableSchema(context, vscode, tableName, transport) {
  const version = getRestVersion(vscode);
  return call(
    context,
    vscode,
    {
      path: `/rest/${version}/datatables/${tableName}/fields`,
      method: "GET",
    },
    transport,
  );
}

// GET /rest/<version>/custom{tableName}
async function getDataTableRows(context, vscode, tableName, { limit = 200, offset = 0, q } = {}, transport) {
  const version = getRestVersion(vscode);
  const queryParams = { limit, offset };
  if (q) queryParams.q = q;

  return call(
    context,
    vscode,
    {
      path: `/rest/${version}/custom${tableName}`,
      method: "GET",
      query: queryParams,
    },
    transport,
  );
}

function dispatch(context, vscode, method, subPath, query, body, transport) {
  const version = getRestVersion(vscode);
  const cleanSubPath = (subPath || '').startsWith('/') ? subPath : `/${subPath}`;
  return call(
    context,
    vscode,
    {
      path: `/rest/${version}${cleanSubPath}`,
      method: method || 'GET',
      query,
      body,
    },
    transport,
  );
}

module.exports = {
  call,
  dispatch,
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
  listTasks,
  searchBmlScripts,
  listDataTables,
  getDataTableSchema,
  getDataTableRows,
  getEffectiveRestVersion,
  sanitizeRestResponse,
  ...apiCommerce,
  ...apiConfig,
  apiCommerce,
  apiConfig,
};

