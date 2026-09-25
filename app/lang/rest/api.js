const {
  call,
  setApiContext,
  getApiContext,
  sanitizeRestResponse,
  functionsPath,
  getEffectiveRestVersion,
  normalizeArgs,
} = require("@/lang/rest/apiCore");
const { getRestVersion, getSettings } = require("@/lang/rest/config");
const apiCommerce = require("@/lang/rest/apiCommerce");
const apiConfig = require("@/lang/rest/apiConfig");
const apiParts = require("@/lang/rest/apiParts");
const apiMigration = require("@/lang/rest/apiMigration");

// GET /rest/<version>/bml/library/functions?offset=&limit= -> { items, offset, limit, count, hasMore }
function listLibraryFunctions(options = {}, transport, metadata) {
  const [opts = {}, tr, meta] = normalizeArgs(arguments);
  const { offset = 0, limit = 1000 } = opts;
  return call(
    {
      path: functionsPath(null, meta),
      method: "GET",
      query: { offset, limit },
    },
    tr,
  );
}

// GET /rest/<version>/bml/library/folders
function listLibraryFolders(transport) {
  const [tr] = normalizeArgs(arguments);
  return call(
    { path: "/bml/library/folders", method: "GET" },
    tr,
  );
}

// GET /rest/<version>/bml/library/functions/{namespace.variableName} -> full function object (scriptText, parameters, ...)
function getLibraryFunction(namespaceVariableName, transport, metadata) {
  const [name, tr, meta] = normalizeArgs(arguments);
  return call(
    {
      path: `${functionsPath(null, meta)}/${name}`,
      method: "GET",
    },
    tr,
  );
}

// PATCH /rest/<version>/bml/library/functions/{namespace.variableName}
function updateLibraryFunction(namespaceVariableName, payload, transport) {
  const [name, body, tr] = normalizeArgs(arguments);
  return call(
    {
      path: `${functionsPath(null, body)}/${name}`,
      method: "PATCH",
      body,
    },
    tr,
  );
}

// POST /rest/<version>/bml/library/functions
function createLibraryFunction(payload, transport) {
  const [body, tr] = normalizeArgs(arguments);
  return call(
    {
      path: functionsPath(null, body),
      method: "POST",
      body,
    },
    tr,
  );
}

// POST /rest/<version>/bml/library/functions/actions/validate -> 204 on success
function validateLibraryFunction(payload, transport) {
  const [body, tr] = normalizeArgs(arguments);
  return call(
    {
      path: `${functionsPath(null, body)}/actions/validate`,
      method: "POST",
      body,
    },
    tr,
  );
}

// POST /rest/<version>/bml/library/functions/actions/deploy, body: { items: [{ namespace, type, variableName }] }.
// Accepts one or more items so multiple util functions can be deployed in a single call.
function deployLibraryFunctions(items, transport, metadata, options = {}) {
  const [deployItems, tr, meta, opts = {}] = normalizeArgs(arguments);
  const timeoutMs = (opts && opts.timeoutMs) || (getSettings && getSettings().deployTimeoutMs) || 120000;
  return call(
    {
      path: `${functionsPath(null, meta)}/actions/deploy`,
      method: "POST",
      body: { items: deployItems },
      timeoutMs,
    },
    tr,
  );
}

// POST /rest/<version>/bml/library/functions/actions/debug -> { returnData, scriptSize }
function debugLibraryFunction(payload, transport) {
  const [body, tr] = normalizeArgs(arguments);
  return call(
    {
      path: `${functionsPath(null, body)}/actions/debug`,
      method: "POST",
      body,
    },
    tr,
  );
}

// POST /rest/<version>/.../bml/library/functions/actions/loadTransactionData
function loadTransactionData(payload, queryParams, transport) {
  const [body, query, tr] = normalizeArgs(arguments);
  return call(
    {
      path: `${functionsPath(null, body)}/actions/loadTransactionData`,
      method: "POST",
      body,
      query,
    },
    tr,
  );
}

// POST /rest/<version>/.../bml/library/functions/actions/dependentAttributes
function getDependentAttributes(payload, transport) {
  const [body, tr] = normalizeArgs(arguments);
  return call(
    {
      path: `${functionsPath(null, body)}/actions/dependentAttributes`,
      method: "POST",
      body,
    },
    tr,
  );
}

// Commerce: PATCH { isOverridden }. Util: POST to .../actions/override or removeOverride instead.
function setOverride(
  namespaceVariableName,
  isOverridden,
  metadata,
  transport,
) {
  const [name, overrideFlag, meta, tr] = normalizeArgs(arguments);
  const isCommerce = meta && meta.commerceDocument;
  if (isCommerce) {
    return call(
      {
        path: `${functionsPath(null, meta)}/${name}`,
        method: "PATCH",
        // call() strips commerceProcess/commerceDocument from the body, they're only used for routing.
        body: {
          isOverridden: overrideFlag,
          commerceProcess: meta.commerceProcess,
          commerceDocument: meta.commerceDocument,
        },
      },
      tr,
    );
  } else {
    const action = overrideFlag ? "override" : "removeOverride";
    return call(
      {
        path: `${functionsPath(null, meta)}/${name}/actions/${action}`,
        method: "POST",
        body: {},
      },
      tr,
    );
  }
}

// POST /rest/<version>/commerceProcessSetups/{processVarName}/deploymentCenter/actions
// scheduledTime must be ISO 8601 — the "MM/DD/YYYY h:mm AM/PM" format from Oracle's own docs is rejected live.
function deployCommerceProcess(processVarName, transport, options = {}) {
  const [processName, tr, opts = {}] = normalizeArgs(arguments);
  const timeoutMs = (opts && opts.timeoutMs) || (getSettings && getSettings().deployTimeoutMs) || 120000;
  return call(
    {
      path: `/commerceProcessSetups/${processName}/deploymentCenter/actions`,
      method: "POST",
      body: {
        category: "DEPLOY_PROCESS",
        scheduledTime: new Date().toISOString(),
        sendEmail: false,
      },
      timeoutMs,
    },
    tr,
  );
}

// GET /rest/<version>/tasks/{taskId} -> { id, name, status, detailStatus, ... }
// Used to poll the async task a Deployment Center action (e.g. deployCommerceProcess) queues.
function getTask(taskId, transport) {
  const [id, tr] = normalizeArgs(arguments);
  return call(
    { path: `/tasks/${id}`, method: "GET" },
    tr,
  );
}

// GET /rest/<version>/tasks
// Per Oracle CPQ Swagger spec: '?q={category:{$in:[ ]}}' is required.
// Supported categories: 13 (DT Import), 17 (DT Deploy), 26 (DT Export), 51 (Package Import), 52 (Package Export)
function listTasks(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const { offset = 0, limit = 50, orderby = "dateModified:desc", q } = opts;
  const defaultQ = "{category:{$in:[13,17,26,51,52]}}";
  const queryParams = { offset, limit, totalResults: true, q: q || defaultQ };
  if (orderby) queryParams.orderby = orderby;
  return call(
    { path: "/tasks", method: "GET", query: queryParams },
    tr,
  );
}

// GET /rest/<version>/bml/scripts?q={'scriptText':{$contains:'<query>', $options:'I'}}
// BML Global Search introduced in Oracle CPQ 26A (/rest/v19/bml/scripts).
function searchBmlScripts(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const {
    query,
    caseSensitive = false,
    offset = 0,
    limit = 100,
    fields,
    orderby,
    totalResults = true,
    q: rawQ,
  } = opts;

  const effectiveVersion = getEffectiveRestVersion(null, 19);

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
    {
      path: "/bml/scripts",
      method: "GET",
      query: queryParams,
      version: effectiveVersion,
    },
    tr,
  );
}

// GET /rest/<version>/datatables
async function listDataTables(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const { offset = 0, limit = 1000 } = opts;
  return call(
    {
      path: "/datatables",
      method: "GET",
      query: { offset, limit, totalResults: true },
    },
    tr,
  );
}

// GET /rest/<version>/datatables/{tableName}/fields
async function getDataTableSchema(tableName, transport) {
  const [name, tr] = normalizeArgs(arguments);
  const encTable = encodeURIComponent(name);
  return call(
    {
      path: `/datatables/${encTable}/fields`,
      method: "GET",
    },
    tr,
  );
}

// GET /rest/<version>/custom{tableName}
async function getDataTableRows(tableName, options = {}, transport) {
  const [name, opts = {}, tr] = normalizeArgs(arguments);
  const { limit = 200, offset = 0, q } = opts;
  const encTable = encodeURIComponent(name);
  const queryParams = { limit, offset };
  if (q) queryParams.q = q;

  return call(
    {
      path: `/custom${encTable}`,
      method: "GET",
      query: queryParams,
    },
    tr,
  );
}

function dispatch(method, subPath, query, body, transport) {
  const [m, sPath, q, b, tr] = normalizeArgs(arguments);
  const cleanSubPath = (sPath || '').startsWith('/') ? sPath : `/${sPath}`;
  return call(
    {
      path: cleanSubPath,
      method: m || 'GET',
      query: q,
      body: b,
    },
    tr,
  );
}

module.exports = {
  call,
  dispatch,
  setApiContext,
  getApiContext,
  functionsPath,
  listLibraryFunctions,
  listLibraryFolders,
  getLibraryFunction,
  getUtilFunction: getLibraryFunction,
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
  ...apiParts,
  ...apiMigration,
  apiCommerce,
  apiConfig,
  apiParts,
  apiMigration,
};
