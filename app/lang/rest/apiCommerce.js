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
        const resolvedF = resolveAttributeName(f.trim(), wsRoot);
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

  // If initial request fails (e.g. 400 Bad Request due to custom fields/sort), retry with minimal query
  if (result.statusCode >= 400) {
    const minimalQuery = { limit: queryParams.limit || 25, offset: queryParams.offset || 0 };
    const retry = await call(
      context,
      vscode,
      {
        path: basePath,
        method: "GET",
        query: minimalQuery,
      },
      transport,
    );
    if (retry.statusCode < result.statusCode) {
      result = retry;
    }
  }

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
  { process, document, offset = 0, limit = 1000 } = {},
  transport,
) {
  const effectiveProcess = process || getCommerceProcess(vscode) || "oraclecpqo";
  const effectiveDocument = document || getCommerceDocument(vscode) || "transaction";
  const effectiveVersion = getEffectiveRestVersion(vscode, 19);

  const query = { limit };
  if (offset > 0) query.offset = offset;

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

// GET /rest/<version>/commerceProcesses/<process>/documents/<document>/rules
// or fallback to /rest/<version>/commerceProcesses/<process>/rules
async function listCommerceRules(
  context,
  vscode,
  { process, document, offset = 0, limit = 1000 } = {},
  transport,
) {
  const effectiveProcess = process || getCommerceProcess(vscode) || "oraclecpqo";
  const effectiveDocument = document || getCommerceDocument(vscode) || "transaction";
  const effectiveVersion = getEffectiveRestVersion(vscode, 19);

  const query = { limit };
  if (offset > 0) query.offset = offset;

  let res = await call(
    context,
    vscode,
    {
      path: `/rest/${effectiveVersion}/commerceProcesses/${effectiveProcess}/documents/${effectiveDocument}/rules`,
      method: "GET",
      query,
    },
    transport,
  );
  if (res.statusCode >= 400) {
    res = await call(
      context,
      vscode,
      {
        path: `/rest/${effectiveVersion}/commerceProcesses/${effectiveProcess}/rules`,
        method: "GET",
        query,
      },
      transport,
    );
  }
  return res;
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

module.exports = {
  commerceDocumentsPath,
  getTransactions,
  listTransactions: getTransactions,
  getTransaction,
  listCommerceActions,
  getCommerceAction,
  listCommerceRules,
  runPipelineViewer,
  ...attributesApi,
};

