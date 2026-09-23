const {
  call,
  getEffectiveRestVersion,
  setApiContext,
  getApiContext,
  normalizeArgs,
  isContextOrVscode,
} = require("@/lang/rest/apiCore");
const {
  getCommerceProcess,
  getCommerceDocument,
} = require("@/lang/rest/config");
const {
  resolveAttributeName,
  resolveQueryFilter,
  getWorkspaceRoot,
} = require("@/lang/rest/commerceAttributes");
const attributesApi = require("@/lang/rest/apiCommerceAttributes");

function commerceDocumentsPath(arg1, arg2, arg3) {
  let vscode, process, document;
  if (isContextOrVscode(arg1)) {
    vscode = arg1;
    process = arg2 || "oraclecpqo";
    document = arg3 || "transaction";
  } else {
    process = arg1 || "oraclecpqo";
    document = arg2 || "transaction";
  }
  const effectiveVscode = vscode || (typeof getApiContext === "function" ? getApiContext().vscode : null);
  const effectiveVersion = getEffectiveRestVersion(effectiveVscode, 19);
  const proc = process ? process.charAt(0).toUpperCase() + process.slice(1) : "Oraclecpqo";
  const doc = document ? document.charAt(0).toUpperCase() + document.slice(1) : "Transaction";
  return `/rest/${effectiveVersion}/commerceDocuments${proc}${doc}`;
}

// GET /rest/<version>/commerceDocuments<Process><Document>
// Minimal response for transaction filtering and debugging: _id, transactionID_t, no href links.
async function getTransactions(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const {
    process,
    document,
    q,
    query,
    offset = 0,
    limit = 25,
    fields,
    excludeFieldTypes = "yes",
    orderby,
    totalResults = true,
  } = opts;

  const effectiveProcess = process || getCommerceProcess() || "oraclecpqo";
  const effectiveDocument = document || getCommerceDocument() || "transaction";
  const wsRoot = getWorkspaceRoot();

  let queryFilter = q || query;
  if (queryFilter) {
    queryFilter = resolveQueryFilter(queryFilter, wsRoot);
  }
  if (queryFilter && typeof queryFilter === "object") {
    queryFilter = JSON.stringify(queryFilter);
  }

  let resolvedFields = fields;
  if (resolvedFields && typeof resolvedFields === "string") {
    resolvedFields = resolvedFields
      .split(",")
      .map((f) => resolveAttributeName(f.trim(), wsRoot))
      .join(",");
  }

  let resolvedOrderby = orderby;
  if (resolvedOrderby && typeof resolvedOrderby === "string") {
    resolvedOrderby = resolvedOrderby
      .split(",")
      .map((pair) => {
        const [f, dir] = pair.split(":");
        let resolvedF = resolveAttributeName(f.trim(), wsRoot);
        const lower = resolvedF.toLowerCase();
        if (lower === "datemodified_t" || lower === "datemodified" || lower === "lastmodifieddate") {
          resolvedF = "_date_modified";
        }
        return dir ? `${resolvedF}:${dir.trim()}` : resolvedF;
      })
      .join(",");
  }

  const queryParams = {};
  if (offset !== undefined) queryParams.offset = offset;
  if (limit !== undefined) queryParams.limit = limit;
  if (resolvedFields) {
    queryParams.fields = resolvedFields;
  } else if (excludeFieldTypes !== undefined && excludeFieldTypes !== false && excludeFieldTypes !== null) {
    queryParams.excludeFieldTypes = excludeFieldTypes === true ? "yes" : String(excludeFieldTypes);
  }
  if (queryFilter) queryParams.q = queryFilter;
  if (resolvedOrderby) queryParams.orderby = resolvedOrderby;
  if (totalResults !== undefined) queryParams.totalResults = totalResults;

  const basePath = commerceDocumentsPath(effectiveProcess, effectiveDocument);
  let result = await call(
    {
      path: basePath,
      method: "GET",
      query: queryParams,
    },
    tr,
  );

  // Sanitize items so no href links are ever returned, preserving all query fields
  if (result && result.body && typeof result.body === "object") {
    delete result.body.links;
    const rawList = result.body.items || result.body.records || result.body.results;
    if (Array.isArray(rawList)) {
      const sanitized = rawList.map((item) => {
        const clean = {};
        for (const [k, v] of Object.entries(item)) {
          if (k !== "links" && k !== "href") {
            clean[k] = v;
          }
        }
        if (clean._id !== undefined) clean._id = String(clean._id);
        if (clean.bs_id !== undefined && clean._id === undefined) clean._id = String(clean.bs_id);
        if (clean.transactionID_t !== undefined) clean.transactionID_t = String(clean.transactionID_t);
        else if (clean.transactionId !== undefined) clean.transactionID_t = String(clean.transactionId);
        return clean;
      });
      result.body.items = sanitized;
      if (result.body.records) result.body.records = sanitized;
      if (result.body.results) result.body.results = sanitized;
    }
  }

  return result;
}

// GET /rest/<version>/commerceDocuments<Process><Document>/<id>
async function getTransaction(transactionId, options = {}, transport) {
  const [id, opts = {}, tr] = normalizeArgs(arguments);
  const { process, document, timeoutMs } = opts;
  const effectiveProcess = process || getCommerceProcess() || "oraclecpqo";
  const effectiveDocument = document || getCommerceDocument() || "transaction";
  return call(
    {
      path: `${commerceDocumentsPath(effectiveProcess, effectiveDocument)}/${id}`,
      method: "GET",
      timeoutMs: timeoutMs || 60000,
    },
    tr,
  );
}

// GET /rest/<version>/commerceProcesses/<process>/documents/<document>/actionDefs
async function listCommerceActions(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const { process, document, offset = 0, limit = 1000, q } = opts;
  const effectiveProcess = process || getCommerceProcess() || "oraclecpqo";
  const effectiveDocument = document || getCommerceDocument() || "transaction";

  const query = { limit };
  if (offset > 0) query.offset = offset;
  if (q) query.q = q;

  return call(
    {
      path: `/commerceProcesses/${effectiveProcess}/documents/${effectiveDocument}/actionDefs`,
      method: "GET",
      query,
    },
    tr,
  );
}

// GET /rest/<version>/commerceProcesses/<process>/documents/<document>/actionDefs/<actionVarName>
async function getCommerceAction(actionVarName, options = {}, transport) {
  const [actionName, opts = {}, tr] = normalizeArgs(arguments);
  const { process, document } = opts;
  const effectiveProcess = process || getCommerceProcess() || "oraclecpqo";
  const effectiveDocument = document || getCommerceDocument() || "transaction";

  return call(
    {
      path: `/commerceProcesses/${effectiveProcess}/documents/${effectiveDocument}/actionDefs/${actionName}`,
      method: "GET",
    },
    tr,
  );
}

// POST /rest/<version>/commerceDocuments<Process><Document>/<id>/actions/_pipelineViewer
// Executes the CPQ Commerce Pipeline Viewer for a transaction (rules sequence, attribute changes, timings).
async function runPipelineViewer(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const { id, process, document } = opts;
  const effectiveVersion = getEffectiveRestVersion(null, 19);
  const effectiveProcess = process || getCommerceProcess() || "oraclecpqo";
  const effectiveDocument = document || getCommerceDocument() || "transaction";
  const proc = effectiveProcess ? effectiveProcess.charAt(0).toUpperCase() + effectiveProcess.slice(1) : "Oraclecpqo";
  const doc = effectiveDocument ? effectiveDocument.charAt(0).toUpperCase() + effectiveDocument.slice(1) : "Transaction";
  return call(
    {
      path: `/commerceDocuments${proc}${doc}/${id}/actions/_pipelineViewer`,
      method: "POST",
      body: {},
      version: effectiveVersion,
    },
    tr,
  );
}

// GET /rest/<version>/commerceProcesses
async function listCommerceProcesses(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const { offset = 0, limit = 100, q, fields, signal } = opts;
  const queryParams = { limit, totalResults: true };
  if (offset > 0) queryParams.offset = offset;
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

  return call(
    {
      path: "/commerceProcesses",
      method: "GET",
      query: queryParams,
      signal,
    },
    tr,
  );
}

// GET /rest/<version>/commerceProcessSetups/<process>/integrations
async function listCommerceIntegrations(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const { process, offset = 0, limit = 100, q, signal } = opts;
  const effectiveProcess = process || getCommerceProcess() || "oraclecpqo";
  const queryParams = { limit, totalResults: true };
  if (offset > 0) queryParams.offset = offset;
  if (q) queryParams.q = q;

  return call(
    {
      path: `/commerceProcessSetups/${effectiveProcess}/integrations`,
      method: "GET",
      query: queryParams,
      signal,
    },
    tr,
  );
}

// GET /rest/<version>/commerceProcessSetups/<process>/integrations/<integrationVarName>
async function getCommerceIntegration(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const { process, integrationVarName, signal } = opts;
  if (!integrationVarName) {
    throw new Error("integrationVarName is required.");
  }
  const effectiveProcess = process || getCommerceProcess() || "oraclecpqo";

  return call(
    {
      path: `/commerceProcessSetups/${effectiveProcess}/integrations/${encodeURIComponent(integrationVarName)}`,
      method: "GET",
      signal,
    },
    tr,
  );
}

// GET /rest/<version>/commerceProcesses/<process>/documents/<document>/arraySets
async function listCommerceArraySets(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const { process, document, offset = 0, limit = 1000 } = opts;
  const effectiveProcess = process || getCommerceProcess() || "oraclecpqo";
  const effectiveDocument = document || getCommerceDocument() || "transaction";
  return call(
    {
      path: `/commerceProcesses/${effectiveProcess}/documents/${effectiveDocument}/arraySets`,
      method: "GET",
      query: { offset, limit, totalResults: true },
    },
    tr,
  );
}

// GET /rest/<version>/commerceProcesses/<process>/documents/<document>/arraySets/<arraySetVarName>
async function getCommerceArraySet(arraySetVarName, options = {}, transport) {
  const [varName, opts = {}, tr] = normalizeArgs(arguments);
  const { process, document } = opts;
  const effectiveProcess = process || getCommerceProcess() || "oraclecpqo";
  const effectiveDocument = document || getCommerceDocument() || "transaction";
  return call(
    {
      path: `/commerceProcesses/${effectiveProcess}/documents/${effectiveDocument}/arraySets/${varName}`,
      method: "GET",
    },
    tr,
  );
}

// GET /rest/<version>/commerceProcesses/<process>/documents/<document>/arraySets/<arraySetVarName>/attributes
async function listArraySetAttributes(arraySetVarName, options = {}, transport) {
  const [varName, opts = {}, tr] = normalizeArgs(arguments);
  const { process, document, offset = 0, limit = 1000 } = opts;
  const effectiveProcess = process || getCommerceProcess() || "oraclecpqo";
  const effectiveDocument = document || getCommerceDocument() || "transaction";
  return call(
    {
      path: `/commerceProcesses/${effectiveProcess}/documents/${effectiveDocument}/arraySets/${varName}/attributes`,
      method: "GET",
      query: { offset, limit, totalResults: true },
    },
    tr,
  );
}

// GET /rest/<version>/commerceProcessSetups/<process>/documents/<document>/modifyTab
async function getCommerceDocumentModifyTab(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const { process, document } = opts;
  const effectiveProcess = process || getCommerceProcess() || "oraclecpqo";
  const effectiveDocument = document || getCommerceDocument() || "transaction";

  return call(
    {
      path: `/commerceProcessSetups/${effectiveProcess}/documents/${effectiveDocument}/modifyTab`,
      method: "GET",
    },
    tr,
  );
}

// PATCH /rest/<version>/commerceProcessSetups/<process>/documents/<document>/modifyTab
async function updateCommerceDocumentModifyTab(items, options = {}, transport) {
  const [bodyItems, opts = {}, tr] = normalizeArgs(arguments);
  const { process, document } = opts;
  const effectiveProcess = process || getCommerceProcess() || "oraclecpqo";
  const effectiveDocument = document || getCommerceDocument() || "transaction";
  const body = Array.isArray(bodyItems) ? { items: bodyItems } : bodyItems;

  return call(
    {
      path: `/commerceProcessSetups/${effectiveProcess}/documents/${effectiveDocument}/modifyTab`,
      method: "PATCH",
      body,
    },
    tr,
  );
}

module.exports = {
  commerceDocumentsPath,
  getTransactions,
  listTransactions: getTransactions,
  getTransaction,
  listCommerceProcesses,
  listCommerceActions,
  getCommerceAction,
  getCommerceDocumentModifyTab,
  updateCommerceDocumentModifyTab,
  listCommerceArraySets,
  getCommerceArraySet,
  listArraySetAttributes,
  listCommerceIntegrations,
  getCommerceIntegration,
  runPipelineViewer,
  ...attributesApi,
};
