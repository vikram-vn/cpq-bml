const { call, getEffectiveRestVersion } = require("./apiCore");
const {
  getCommerceProcess,
  getCommerceDocument,
} = require("./config");
const {
  resolveAttributeName,
  resolveQueryFilter,
  getWorkspaceRoot,
  saveWorkspaceAttributes,
} = require("./commerceAttributes");

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

  let queryFilter = q;
  if (!queryFilter && query) {
    queryFilter = query;
  }
  // Automatically resolve labels (e.g. "Status" -> "status_t") and menu values in queryFilter
  if (queryFilter) {
    queryFilter = resolveQueryFilter(queryFilter, wsRoot);
  }
  if (queryFilter && typeof queryFilter === "object") {
    queryFilter = JSON.stringify(queryFilter);
  }

  // Automatically resolve labels in comma-separated fields list
  let resolvedFields = fields;
  if (resolvedFields && typeof resolvedFields === "string") {
    resolvedFields = resolvedFields
      .split(",")
      .map((f) => resolveAttributeName(f.trim(), wsRoot))
      .join(",");
  }

  // Automatically resolve labels in orderby
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
  if (resolvedFields) queryParams.fields = resolvedFields;
  if (excludeFieldTypes !== undefined && excludeFieldTypes !== false && excludeFieldTypes !== null) {
    queryParams.excludeFieldTypes = excludeFieldTypes === true ? "yes" : String(excludeFieldTypes);
  }
  if (queryFilter) queryParams.q = queryFilter;
  if (resolvedOrderby) queryParams.orderby = resolvedOrderby;
  if (totalResults !== undefined) queryParams.totalResults = totalResults;

  const result = await call(
    context,
    vscode,
    {
      path: commerceDocumentsPath(vscode, effectiveProcess, effectiveDocument),
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

// GET /rest/<version>/commerceProcesses/<process>/documents/<document>/attributes
async function listCommerceAttributes(
  context,
  vscode,
  { process, document, offset = 0, limit = 1000, q } = {},
  transport,
) {
  const effectiveVersion = getEffectiveRestVersion(vscode, 19);
  const effectiveProcess = process || getCommerceProcess(vscode) || "oraclecpqo";
  const effectiveDocument = document || getCommerceDocument(vscode) || "transaction";

  const queryParams = { offset, limit };
  if (q) queryParams.q = q;

  return call(
    context,
    vscode,
    {
      path: `/rest/${effectiveVersion}/commerceProcesses/${effectiveProcess}/documents/${effectiveDocument}/attributes`,
      method: "GET",
      query: queryParams,
    },
    transport,
  );
}

// GET /rest/<version>/commerceProcesses/<process>/documents/<document>/attributes/<attributeVarName>/menuItems
async function listCommerceAttributeMenuItems(
  context,
  vscode,
  { process, document, attributeVarName, offset = 0, limit = 1000, q } = {},
  transport,
) {
  const effectiveVersion = getEffectiveRestVersion(vscode, 19);
  const effectiveProcess = process || getCommerceProcess(vscode) || "oraclecpqo";
  const effectiveDocument = document || getCommerceDocument(vscode) || "transaction";

  const queryParams = { offset, limit };
  if (q) queryParams.q = q;

  return call(
    context,
    vscode,
    {
      path: `/rest/${effectiveVersion}/commerceProcesses/${effectiveProcess}/documents/${effectiveDocument}/attributes/${attributeVarName}/menuItems`,
      method: "GET",
      query: queryParams,
    },
    transport,
  );
}

// GET /rest/<version>/commerceProcesses/<process>/documents/<document>/arraySets
async function listCommerceArraySets(
  context,
  vscode,
  { process, document, offset = 0, limit = 1000, q } = {},
  transport,
) {
  const effectiveVersion = getEffectiveRestVersion(vscode, 19);
  const effectiveProcess = process || getCommerceProcess(vscode) || "oraclecpqo";
  const effectiveDocument = document || getCommerceDocument(vscode) || "transaction";

  const queryParams = { offset, limit };
  if (q) queryParams.q = q;

  return call(
    context,
    vscode,
    {
      path: `/rest/${effectiveVersion}/commerceProcesses/${effectiveProcess}/documents/${effectiveDocument}/arraySets`,
      method: "GET",
      query: queryParams,
    },
    transport,
  );
}

// GET /rest/<version>/commerceProcessSetups/systemAttributes
async function listCommerceSystemAttributes(
  context,
  vscode,
  { offset = 0, limit = 1000, q } = {},
  transport,
) {
  const effectiveVersion = getEffectiveRestVersion(vscode, 19);

  const queryParams = { offset, limit };
  if (q) queryParams.q = q;

  return call(
    context,
    vscode,
    {
      path: `/rest/${effectiveVersion}/commerceProcessSetups/systemAttributes`,
      method: "GET",
      query: queryParams,
    },
    transport,
  );
}

// Pulls and caches remote attributes, menu items, and systemAttributes into local cache
async function syncCommerceAttributes(
  context,
  vscode,
  { process, document, fetchMenuItems = true } = {},
  transport,
) {
  const effectiveProcess = process || getCommerceProcess(vscode) || "oraclecpqo";
  const effectiveDocument = document || getCommerceDocument(vscode) || "transaction";
  const wsRoot = getWorkspaceRoot(vscode);

  const res = await listCommerceAttributes(
    context,
    vscode,
    { process: effectiveProcess, document: effectiveDocument, limit: 1000 },
    transport,
  );

  const attributes = [];
  if (res && res.body && Array.isArray(res.body.items)) {
    for (const item of res.body.items) {
      const varName = item.variableName || item.id;
      const attr = {
        variableName: varName,
        name: item.name || item.label || varName,
        dataType: item.dataType || item.type || "String",
        description: item.description || "",
      };

      const isMenu =
        attr.dataType &&
        (attr.dataType.toLowerCase().includes("menu") ||
          attr.dataType.toLowerCase().includes("select"));

      if (fetchMenuItems && isMenu) {
        try {
          const menuRes = await listCommerceAttributeMenuItems(
            context,
            vscode,
            {
              process: effectiveProcess,
              document: effectiveDocument,
              attributeVarName: varName,
              limit: 500,
            },
            transport,
          );
          if (menuRes && menuRes.body && Array.isArray(menuRes.body.items)) {
            attr.menuItems = menuRes.body.items.map((m) => ({
              id: m.id || m.value,
              value: m.value || m.id,
              name: m.name || m.label || m.value || m.id,
            }));
          }
        } catch (e) {
          // Ignore individual menu fetch error and continue
        }
      }

      attributes.push(attr);
    }
  }

  // Fetch systemAttributes
  const systemAttributes = [];
  try {
    const sysRes = await listCommerceSystemAttributes(
      context,
      vscode,
      { limit: 1000 },
      transport,
    );
    if (sysRes && sysRes.body && Array.isArray(sysRes.body.items)) {
      for (const item of sysRes.body.items) {
        systemAttributes.push({
          variableName: item.variableName || item.id,
          name: item.name || item.label || item.variableName || item.id,
          dataType: item.dataType || item.type || "String",
          description: item.description || "",
        });
      }
    }
  } catch (e) {}

  const cacheData = {
    process: effectiveProcess,
    document: effectiveDocument,
    updatedAt: new Date().toISOString(),
    count: attributes.length,
    attributes,
    systemAttributes,
  };

  if (wsRoot) {
    saveWorkspaceAttributes(wsRoot, cacheData);
  }

  return cacheData;
}

module.exports = {
  commerceDocumentsPath,
  getTransactions,
  listTransactions: getTransactions,
  runPipelineViewer,
  listCommerceAttributes,
  listCommerceAttributeMenuItems,
  listCommerceArraySets,
  listCommerceSystemAttributes,
  syncCommerceAttributes,
};
