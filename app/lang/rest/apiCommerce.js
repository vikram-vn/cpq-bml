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
  normalizeAttributeDataType,
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

// GET /rest/<version>/commerceProcessSetups/<process>/bml/attributeLookups
async function listCommerceAttributeLookups(
  context,
  vscode,
  { process, offset = 0, limit = 100 } = {},
  transport,
) {
  const effectiveVersion = getEffectiveRestVersion(vscode, 18);
  const effectiveProcess = process || getCommerceProcess(vscode) || "oraclecpqo";

  return call(
    context,
    vscode,
    {
      path: `/rest/${effectiveVersion}/commerceProcessSetups/${effectiveProcess}/bml/attributeLookups`,
      method: "GET",
      query: { offset, limit },
    },
    transport,
  );
}

// GET /rest/<version>/commerceProcessSetups/<process>/bml/attributeLookups/<lookupType>/lookupValues
async function listCommerceAttributeLookupValues(
  context,
  vscode,
  { process, lookupType, offset = 0, limit = 1000, href } = {},
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

  return call(
    context,
    vscode,
    {
      path,
      method: "GET",
      query: { offset, limit },
    },
    transport,
  );
}

// Pulls and caches remote attributes, menu items, systemAttributes, and attributeLookups into local cache
async function syncCommerceAttributes(
  context,
  vscode,
  { process, document, fetchMenuItems = true, fetchLookups = true } = {},
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
  const rawAttrItems =
    res && res.body
      ? Array.isArray(res.body)
        ? res.body
        : Array.isArray(res.body.items)
          ? res.body.items
          : []
      : [];

  for (const item of rawAttrItems) {
    const varName = item.variableName || item.name || item.id;
    const attr = {
      variableName: varName,
      name: item.label || item.name || varName,
      dataType: normalizeAttributeDataType(item.type || item.dataType),
      description: item.description || "",
    };

    const dtLower = (typeof attr.dataType === "string" ? attr.dataType : "").toLowerCase();
    const typeLower = typeof item.type === "string" ? item.type.toLowerCase() : "";
    const displayTypeLower =
      typeof item.displayType === "string" ? item.displayType.toLowerCase() : "";
    const isMenu =
      dtLower.includes("menu") ||
      dtLower.includes("select") ||
      typeLower.includes("menu") ||
      typeLower.includes("select") ||
      displayTypeLower.includes("menu") ||
      displayTypeLower.includes("select");

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
        const rawMenuItems =
          menuRes && menuRes.body
            ? Array.isArray(menuRes.body)
              ? menuRes.body
              : Array.isArray(menuRes.body.items)
                ? menuRes.body.items
                : []
            : [];
        if (rawMenuItems.length > 0) {
          attr.menuItems = rawMenuItems.map((m) => ({
            id: m.id || m.value,
            value: m.value || m.id,
            name: m.label || m.name || m.value || m.id,
          }));
        }
      } catch (e) {
        // Ignore individual menu fetch error and continue
      }
    }

    attributes.push(attr);
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
    const rawSysItems =
      sysRes && sysRes.body
        ? Array.isArray(sysRes.body)
          ? sysRes.body
          : Array.isArray(sysRes.body.items)
            ? sysRes.body.items
            : []
        : [];

    for (const item of rawSysItems) {
      systemAttributes.push({
        variableName: item.variableName || item.name || item.id,
        name: item.label || item.name || item.variableName || item.id,
        dataType: normalizeAttributeDataType(item.type || item.dataType),
        description: item.description || "",
      });
    }
  } catch (e) {}

  // Fetch BML attributeLookups (transaction, transactionLine, systemVariables)
  const lookups = {};
  if (fetchLookups) {
    try {
      const lookupsRes = await listCommerceAttributeLookups(
        context,
        vscode,
        { process: effectiveProcess },
        transport,
      );
      const rawLookups =
        lookupsRes && lookupsRes.body
          ? Array.isArray(lookupsRes.body)
            ? lookupsRes.body
            : Array.isArray(lookupsRes.body.items)
              ? lookupsRes.body.items
              : []
          : [];

      const lookupTypes = new Map();
      const standardTypes = ["transaction", "transactionLine", "systemVariables"];
      for (const t of standardTypes) {
        lookupTypes.set(t, null);
      }
      for (const item of rawLookups) {
        const type = item.lookupType || item.id || item.name;
        if (type) {
          let childHref = null;
          if (Array.isArray(item.links)) {
            const childLink = item.links.find((l) => l.rel === "child" || (l.href && l.href.includes("lookupValues")));
            if (childLink && childLink.href) childHref = childLink.href;
          }
          lookupTypes.set(type, childHref);
        }
      }

      for (const [type, childHref] of lookupTypes.entries()) {
        try {
          const valRes = await listCommerceAttributeLookupValues(
            context,
            vscode,
            { process: effectiveProcess, lookupType: type, href: childHref, limit: 1000 },
            transport,
          );
          const rawVals =
            valRes && valRes.body
              ? Array.isArray(valRes.body)
                ? valRes.body
                : Array.isArray(valRes.body.items)
                  ? valRes.body.items
                  : []
              : [];
          if (rawVals.length > 0) {
            lookups[type] = rawVals.map((v) => ({
              variableName: v.name || v.variableName || v.id,
              name: v.displayLabel || v.label || v.name || v.variableName || v.id,
              displayLabel: v.displayLabel || v.label || v.name || v.variableName || v.id,
              dataType: normalizeAttributeDataType(v.dataType || v.type),
              description: v.description || "",
              isMenuType: !!v.isMenuType,
              availableElements: Array.isArray(v.availableElements) ? v.availableElements : null,
            }));
          }
        } catch (e) {
          // Ignore individual lookup type failure
        }
      }
    } catch (e) {
      // Ignore lookups failure and continue with attributes
    }
  }

  const cacheData = {
    process: effectiveProcess,
    document: effectiveDocument,
    updatedAt: new Date().toISOString(),
    count: attributes.length,
    attributes,
    systemAttributes,
    lookups,
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
  listCommerceAttributeLookups,
  listCommerceAttributeLookupValues,
  syncCommerceAttributes,
};
