const { call, getEffectiveRestVersion } = require("@/lang/rest/apiCore");
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

function commerceDocumentsPath(vscode, process = "oraclecpqo", document = "transaction") {
  const effectiveVersion = getEffectiveRestVersion(vscode, 19);
  const proc = process ? process.charAt(0).toUpperCase() + process.slice(1) : "Oraclecpqo";
  const doc = document ? document.charAt(0).toUpperCase() + document.slice(1) : "Transaction";
  return `/rest/${effectiveVersion}/commerceDocuments${proc}${doc}`;
}

// GET /rest/<version>/commerceDocuments<Process><Document>
// Minimal response for transaction filtering and debugging: _id, transactionID_t, no href links.
async function getTransactions(
  context,
  vscode,
  {
    process,
    document,
    q,
    query,
    offset = 0,
    limit = 25,
    fields = "_id,transactionID_t",
    excludeFieldTypes = "yes",
    orderby,
    totalResults = true,
  } = {},
  transport,
) {
  const effectiveProcess = process || getCommerceProcess(vscode) || "oraclecpqo";
  const effectiveDocument = document || getCommerceDocument(vscode) || "transaction";
  const wsRoot = getWorkspaceRoot(vscode);

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

  const basePath = commerceDocumentsPath(vscode, effectiveProcess, effectiveDocument);
  let result = await call(
    context,
    vscode,
    {
      path: basePath,
      method: "GET",
      query: queryParams,
    },
    transport,
  );


  // Sanitize items so no href links are ever returned, keeping minimal _id and transactionID_t
  if (result && result.body && typeof result.body === "object") {
    delete result.body.links;
    if (Array.isArray(result.body.items)) {
      result.body.items = result.body.items.map((item) => {
        const clean = {
          _id: item._id !== undefined ? String(item._id) : undefined,
          transactionID_t:
            item.transactionID_t !== undefined
              ? String(item.transactionID_t)
              : (item.transactionId !== undefined ? String(item.transactionId) : undefined),
        };
        for (const [k, v] of Object.entries(item)) {
          if (k !== "links" && k !== "href" && clean[k] === undefined) {
            clean[k] = v;
          }
        }
        return clean;
      });
    }
  }

  return result;
}

// GET /rest/<version>/commerceDocuments<Process><Document>/<id>
async function getTransaction(
  context,
  vscode,
  transactionId,
  { process, document, timeoutMs } = {},
  transport,
) {
  const effectiveProcess = process || getCommerceProcess(vscode) || "oraclecpqo";
  const effectiveDocument = document || getCommerceDocument(vscode) || "transaction";
  return call(
    context,
    vscode,
    {
      path: `${commerceDocumentsPath(vscode, effectiveProcess, effectiveDocument)}/${transactionId}`,
      method: "GET",
      timeoutMs: timeoutMs || 60000,
    },
    transport,
  );
}

// GET /rest/<version>/commerceProcesses/<process>/documents/<document>/actionDefs
async function listCommerceActions(
  context,
  vscode,
  { process, document, offset = 0, limit = 1000, q } = {},
  transport,
) {
  const effectiveProcess = process || getCommerceProcess(vscode) || "oraclecpqo";
  const effectiveDocument = document || getCommerceDocument(vscode) || "transaction";
  const effectiveVersion = getEffectiveRestVersion(vscode, 19);

  const query = { limit };
  if (offset > 0) query.offset = offset;
  if (q) query.q = q;

  return call(
    context,
    vscode,
    {
      path: `/rest/${effectiveVersion}/commerceProcesses/${effectiveProcess}/documents/${effectiveDocument}/actionDefs`,
      method: "GET",
      query,
    },
    transport,
  );
}

// GET /rest/<version>/commerceProcesses/<process>/documents/<document>/actionDefs/<actionVarName>
async function getCommerceAction(
  context,
  vscode,
  actionVarName,
  { process, document } = {},
  transport,
) {
  const effectiveProcess = process || getCommerceProcess(vscode) || "oraclecpqo";
  const effectiveDocument = document || getCommerceDocument(vscode) || "transaction";
  const effectiveVersion = getEffectiveRestVersion(vscode, 19);

  return call(
    context,
    vscode,
    {
      path: `/rest/${effectiveVersion}/commerceProcesses/${effectiveProcess}/documents/${effectiveDocument}/actionDefs/${actionVarName}`,
      method: "GET",
    },
    transport,
  );
}

// POST /rest/<version>/commerceDocuments<Process><Document>/<id>/actions/_pipelineViewer
// Executes the CPQ Commerce Pipeline Viewer for a transaction (rules sequence, attribute changes, timings).
async function runPipelineViewer(
  context,
  vscode,
  { id, process, document } = {},
  transport,
) {
  const effectiveVersion = getEffectiveRestVersion(vscode, 19);
  const effectiveProcess = process || getCommerceProcess(vscode) || "oraclecpqo";
  const effectiveDocument = document || getCommerceDocument(vscode) || "transaction";
  const proc = effectiveProcess ? effectiveProcess.charAt(0).toUpperCase() + effectiveProcess.slice(1) : "Oraclecpqo";
  const doc = effectiveDocument ? effectiveDocument.charAt(0).toUpperCase() + effectiveDocument.slice(1) : "Transaction";
  return call(
    context,
    vscode,
    {
      path: `/rest/${effectiveVersion}/commerceDocuments${proc}${doc}/${id}/actions/_pipelineViewer`,
      method: "POST",
      body: {},
    },
    transport,
  );
}

// GET /rest/<version>/commerceProcesses
async function listCommerceProcesses(
  context,
  vscode,
  { offset = 0, limit = 100, q, fields, signal } = {},
  transport,
) {
  const effectiveVersion = getEffectiveRestVersion(vscode, 19);
  const queryParams = { limit, totalResults: true };
  if (offset > 0) queryParams.offset = offset;
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

  return call(
    context,
    vscode,
    {
      path: `/rest/${effectiveVersion}/commerceProcesses`,
      method: "GET",
      query: queryParams,
      signal,
    },
    transport,
  );
}

// GET /rest/<version>/commerceProcessSetups/<process>/integrations
async function listCommerceIntegrations(
  context,
  vscode,
  { process, offset = 0, limit = 100, q, signal } = {},
  transport,
) {
  const effectiveProcess = process || getCommerceProcess(vscode) || "oraclecpqo";
  const effectiveVersion = getEffectiveRestVersion(vscode, 19);
  const queryParams = { limit, totalResults: true };
  if (offset > 0) queryParams.offset = offset;
  if (q) queryParams.q = q;

  try {
    const res = await call(
      context,
      vscode,
      {
        path: `/rest/${effectiveVersion}/commerceProcessSetups/${effectiveProcess}/integrations`,
        method: "GET",
        query: queryParams,
        signal,
      },
      transport,
    );
    if (res && res.statusCode >= 200 && res.statusCode < 300) {
      return res;
    }
  } catch (err) {
    // Fallback below
  }

  // Fallback to /commerceProcesses/<process>/integrations
  return call(
    context,
    vscode,
    {
      path: `/rest/${effectiveVersion}/commerceProcesses/${effectiveProcess}/integrations`,
      method: "GET",
      query: queryParams,
      signal,
    },
    transport,
  );
}

// GET /rest/<version>/commerceProcessSetups/<process>/integrations/<integrationVarName>
async function getCommerceIntegration(
  context,
  vscode,
  { process, integrationVarName, signal } = {},
  transport,
) {
  if (!integrationVarName) {
    throw new Error("integrationVarName is required.");
  }
  const effectiveProcess = process || getCommerceProcess(vscode) || "oraclecpqo";
  const effectiveVersion = getEffectiveRestVersion(vscode, 19);

  try {
    const res = await call(
      context,
      vscode,
      {
        path: `/rest/${effectiveVersion}/commerceProcessSetups/${effectiveProcess}/integrations/${encodeURIComponent(integrationVarName)}`,
        method: "GET",
        signal,
      },
      transport,
    );
    if (res && res.statusCode >= 200 && res.statusCode < 300) {
      return res;
    }
  } catch (err) {
    // Fallback below
  }

  return call(
    context,
    vscode,
    {
      path: `/rest/${effectiveVersion}/commerceProcesses/${effectiveProcess}/integrations/${encodeURIComponent(integrationVarName)}`,
      method: "GET",
      signal,
    },
    transport,
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
  listCommerceIntegrations,
  getCommerceIntegration,
  runPipelineViewer,
  ...attributesApi,
};


