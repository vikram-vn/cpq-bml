const { call, getEffectiveRestVersion } = require("@/lang/rest/apiCore");
const {
  getCommerceProcess,
  getCommerceDocument,
  getSettings,
} = require("@/lang/rest/config");
const {
  resolveAttributeName,
  resolveQueryFilter,
  getWorkspaceRoot,
  saveWorkspaceAttributes,
  normalizeAttributeDataType,
} = require("@/lang/rest/commerceAttributes");

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
const {
  formatCommerceAttribute,
  syncCommerceAttributes: syncCommerceAttributesImpl,
} = require("@/lang/rest/apiCommerceSync");

// GET /rest/<version>/commerceProcesses/<process>/documents/<document>/attributes
async function listCommerceAttributes(
  context,
  vscode,
  {
    process,
    document,
    offset = 0,
    limit = 1000,
    q,
    fields,
  } = {},
  transport,
) {
  const effectiveVersion = getEffectiveRestVersion(vscode, 19);
  const effectiveProcess = process || getCommerceProcess(vscode) || "oraclecpqo";
  const effectiveDocument = document || getCommerceDocument(vscode) || "transaction";

  const queryParams = { offset, limit, totalResults: true };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

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

// GET /rest/<version>/commerceProcesses/<process>/documents
async function listCommerceDocuments(
  context,
  vscode,
  { process, offset = 0, limit = 100, signal } = {},
  transport,
) {
  const effectiveVersion = getEffectiveRestVersion(vscode, 19);
  const effectiveProcess = process || getCommerceProcess(vscode) || "oraclecpqo";
  return call(
    context,
    vscode,
    {
      path: `/rest/${effectiveVersion}/commerceProcesses/${effectiveProcess}/documents`,
      method: "GET",
      query: { offset, limit, totalResults: true },
      signal,
    },
    transport,
  );
}

// GET /rest/<version>/commerceProcesses/<process>/documents/<document>/attributes/<attributeVarName>
async function getCommerceAttribute(
  context,
  vscode,
  {
    process,
    document,
    attributeVarName,
    fields = "label,variableName,type,required,userDefault,description,additional,defaultDataType",
    fetchMenuOptions = true,
  } = {},
  transport,
) {
  const effectiveVersion = getEffectiveRestVersion(vscode, 19);
  const effectiveProcess = process || getCommerceProcess(vscode) || "oraclecpqo";
  const effectiveDocument = document || getCommerceDocument(vscode) || "transaction";

  const queryParams = {};
  if (fields) queryParams.fields = fields;

  const res = await call(
    context,
    vscode,
    {
      path: `/rest/${effectiveVersion}/commerceProcesses/${effectiveProcess}/documents/${effectiveDocument}/attributes/${attributeVarName}`,
      method: "GET",
      query: queryParams,
    },
    transport,
  );

  if (!res || !res.body) {
    return res;
  }

  const rawItem = res.body;
  let menuOptions = null;

  const typeStr = (
    rawItem.type && typeof rawItem.type === "object"
      ? rawItem.type.displayValue || rawItem.type.value || ""
      : typeof rawItem.type === "string"
        ? rawItem.type
        : ""
  ).toLowerCase();

  const isMenu =
    typeStr.includes("menu") ||
    typeStr.includes("select") ||
    (typeof rawItem.displayType === "string" && rawItem.displayType.toLowerCase().includes("menu"));

  if (fetchMenuOptions && isMenu) {
    try {
      const menuRes = await listCommerceAttributeMenuItems(
        context,
        vscode,
        {
          process: effectiveProcess,
          document: effectiveDocument,
          attributeVarName,
          limit: 500,
          fields: "value,displayValue,label,name,id",
        },
        transport,
      );
      const rawMenuItems =
        menuRes && menuRes.body
          ? Array.isArray(menuRes.body)
            ? menuRes.body
            : Array.isArray(menuRes.body.items)
              ? menuRes.body.items
              : []
          : [];
      if (rawMenuItems.length > 0) {
        menuOptions = rawMenuItems;
      }
    } catch (e) {}
  }

  const formatted = formatCommerceAttribute(rawItem, menuOptions);
  return {
    ...res,
    body: formatted,
  };
}

// GET /rest/<version>/commerceProcesses/<process>/documents/<document>/attributes/<attributeVarName>/menuItems
async function listCommerceAttributeMenuItems(
  context,
  vscode,
  {
    process,
    document,
    attributeVarName,
    offset = 0,
    limit = 1000,
    q,
    fields = "value,displayValue,label,name,id",
  } = {},
  transport,
) {
  const effectiveVersion = getEffectiveRestVersion(vscode, 19);
  const effectiveProcess = process || getCommerceProcess(vscode) || "oraclecpqo";
  const effectiveDocument = document || getCommerceDocument(vscode) || "transaction";

  const queryParams = { offset, limit, totalResults: true };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

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
  {
    process,
    document,
    offset = 0,
    limit = 1000,
    q,
    fields = "variableName,name,label,description",
  } = {},
  transport,
) {
  const effectiveVersion = getEffectiveRestVersion(vscode, 19);
  const effectiveProcess = process || getCommerceProcess(vscode) || "oraclecpqo";
  const effectiveDocument = document || getCommerceDocument(vscode) || "transaction";

  const queryParams = { offset, limit, totalResults: true };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

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
  { offset = 0, limit = 1000, q, fields } = {},
  transport,
) {
  const effectiveVersion = getEffectiveRestVersion(vscode, 19);

  const queryParams = { offset, limit, totalResults: true };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

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

// GET /rest/<version>/commerceProcessSetups/<process>/bml/attributeLookups
async function listCommerceAttributeLookups(
  context,
  vscode,
  { process, offset = 0, limit = 100, fields = "lookupType,name" } = {},
  transport,
) {
  const effectiveVersion = getEffectiveRestVersion(vscode, 18);
  const effectiveProcess = process || getCommerceProcess(vscode) || "oraclecpqo";

  const queryParams = { offset, limit, totalResults: true };
  if (fields) queryParams.fields = fields;

  return call(
    context,
    vscode,
    {
      path: `/rest/${effectiveVersion}/commerceProcessSetups/${effectiveProcess}/bml/attributeLookups`,
      method: "GET",
      query: queryParams,
    },
    transport,
  );
}

// GET /rest/<version>/commerceProcessSetups/<process>/bml/attributeLookups/<lookupType>/lookupValues
async function listCommerceAttributeLookupValues(
  context,
  vscode,
  {
    process,
    lookupType,
    offset = 0,
    limit = 1000,
    href,
    fields = "name,displayLabel,dataType,description,isMenuType,availableElements",
  } = {},
  transport,
) {
  const effectiveVersion = getEffectiveRestVersion(vscode, 18);
  const effectiveProcess = process || getCommerceProcess(vscode) || "oraclecpqo";

  let path = `/rest/${effectiveVersion}/commerceProcessSetups/${effectiveProcess}/bml/attributeLookups/${lookupType}/lookupValues`;
  if (href && typeof href === "string") {
    const match = href.match(/\/rest\/.*$/i);
    if (match) {
      path = match[0];
    }
  }

  const queryParams = { offset, limit, totalResults: true };
  if (fields) queryParams.fields = fields;

  return call(
    context,
    vscode,
    {
      path,
      method: "GET",
      query: queryParams,
    },
    transport,
  );
}

async function syncCommerceAttributes(
  context,
  vscode,
  options = {},
  transport,
) {
  return syncCommerceAttributesImpl(context, vscode, options, transport, {
    listCommerceDocuments,
    listCommerceAttributes,
    listCommerceAttributeMenuItems,
    listCommerceSystemAttributes,
    listCommerceArraySets,
    listCommerceAttributeLookups,
    listCommerceAttributeLookupValues,
  });
}

module.exports = {
  commerceDocumentsPath,
  getTransactions,
  listTransactions: getTransactions,
  runPipelineViewer,
  formatCommerceAttribute,
  getCommerceAttribute,
  listCommerceDocuments,
  listCommerceAttributes,
  listCommerceAttributeMenuItems,
  listCommerceArraySets,
  listCommerceSystemAttributes,
  listCommerceAttributeLookups,
  listCommerceAttributeLookupValues,
  syncCommerceAttributes,
};

