const { call, getEffectiveRestVersion } = require("./apiCore");
const {
  getCommerceProcess,
  getCommerceDocument,
  getSettings,
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

function formatCommerceAttribute(item, menuOptions = null) {
  if (!item) return null;
  const varName = item.variableName || item.name || item.id || "";
  const label = item.label || item.name || varName;

  // type:displayValue
  let typeDisplay = "";
  if (item.type && typeof item.type === "object") {
    typeDisplay =
      item.type.displayValue ||
      item.type.displayLabel ||
      item.type.name ||
      (item.type.value !== undefined ? String(item.type.value) : "");
  } else if (typeof item.type === "string") {
    typeDisplay = item.type;
  } else if (item.dataType && typeof item.dataType === "object") {
    typeDisplay =
      item.dataType.displayValue ||
      item.dataType.displayLabel ||
      item.dataType.name ||
      (item.dataType.value !== undefined ? String(item.dataType.value) : "");
  } else if (typeof item.dataType === "string") {
    typeDisplay = item.dataType;
  }
  if (!typeDisplay) {
    typeDisplay = normalizeAttributeDataType(item.type || item.dataType);
  }

  const attr = {
    label,
    variableName: varName,
    type: typeDisplay,
    required: item.required !== undefined ? !!item.required : false,
    userDefault: item.userDefault !== undefined ? item.userDefault : null,
    description: item.description || "",
    additional: item.additional !== undefined ? item.additional : null,
    defaultDataType: item.defaultDataType !== undefined ? item.defaultDataType : null,
    // Backwards-compatibility aliases
    name: label,
    dataType: typeDisplay,
  };

  if (Array.isArray(menuOptions) && menuOptions.length > 0) {
    const formattedOptions = menuOptions.map((m) => ({
      displayValue:
        m.displayValue ||
        m.label ||
        m.name ||
        (m.value !== undefined ? String(m.value) : "") ||
        (m.id !== undefined ? String(m.id) : ""),
      value: m.value !== undefined ? m.value : (m.id !== undefined ? m.id : ""),
    }));
    attr.menuOptions = formattedOptions;
    attr.menuItems = formattedOptions.map((m) => ({
      id: m.value,
      value: m.value,
      name: m.displayValue,
    }));
  }

  return attr;
}

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
    fields = "label,variableName,type,required,userDefault,description,additional,defaultDataType",
  } = {},
  transport,
) {
  const effectiveVersion = getEffectiveRestVersion(vscode, 19);
  const effectiveProcess = process || getCommerceProcess(vscode) || "oraclecpqo";
  const effectiveDocument = document || getCommerceDocument(vscode) || "transaction";

  const queryParams = { offset, limit };
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

  const queryParams = { offset, limit };
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

  const queryParams = { offset, limit };
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

  const queryParams = { offset, limit };
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

  const queryParams = { offset, limit };
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

  const queryParams = { offset, limit };
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
    {
      process: effectiveProcess,
      document: effectiveDocument,
      limit: 1000,
      fields: "label,variableName,type,required,userDefault,description,additional,defaultDataType",
    },
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
    const typeStr = (
      item.type && typeof item.type === "object"
        ? item.type.displayValue || item.type.displayLabel || item.type.name || (item.type.value !== undefined ? String(item.type.value) : "")
        : typeof item.type === "string"
          ? item.type
          : item.dataType && typeof item.dataType === "object"
            ? item.dataType.displayValue || item.dataType.displayLabel || item.dataType.name || (item.dataType.value !== undefined ? String(item.dataType.value) : "")
            : typeof item.dataType === "string"
              ? item.dataType
              : ""
    ).toLowerCase();
    const displayTypeLower =
      typeof item.displayType === "string" ? item.displayType.toLowerCase() : "";
    const isMenu =
      typeStr.includes("menu") ||
      typeStr.includes("select") ||
      displayTypeLower.includes("menu") ||
      displayTypeLower.includes("select");

    let menuOptions = null;
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
      } catch (e) {
        // Ignore individual menu fetch error and continue
      }
    }

    attributes.push(formatCommerceAttribute(item, menuOptions));
  }

  // Fetch systemAttributes
  const systemAttributes = [];
  try {
    const sysRes = await listCommerceSystemAttributes(
      context,
      vscode,
      {
        limit: 1000,
        fields: "variableName,name,label,type,dataType,description",
      },
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

  // Fetch arraySets
  const arraySets = [];
  try {
    const arrayRes = await listCommerceArraySets(
      context,
      vscode,
      {
        process: effectiveProcess,
        document: effectiveDocument,
        limit: 1000,
        fields: "variableName,name,label,description",
      },
      transport,
    );
    const rawArrayItems =
      arrayRes && arrayRes.body
        ? Array.isArray(arrayRes.body)
          ? arrayRes.body
          : Array.isArray(arrayRes.body.items)
            ? arrayRes.body.items
            : []
        : [];

    for (const item of rawArrayItems) {
      const varName = item.variableName || item.name || item.id;
      arraySets.push({
        variableName: varName,
        name: item.label || item.name || varName,
        label: item.label || item.name || varName,
        dataType: "Array Set",
        type: "Array Set",
        description: item.description || "",
        scope: "Array Set",
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
        { process: effectiveProcess, fields: "lookupType,name" },
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

      const lookupTypes = new Set(["transaction", "transactionLine", "systemVariables"]);
      for (const item of rawLookups) {
        const type = item.lookupType || item.id || item.name;
        if (type) {
          lookupTypes.add(type);
        }
      }

      for (const type of lookupTypes) {
        try {
          const valRes = await listCommerceAttributeLookupValues(
            context,
            vscode,
            {
              process: effectiveProcess,
              lookupType: type,
              limit: 1000,
              fields: "name,variableName,displayLabel,label,dataType,type,description,isMenuType,availableElements",
            },
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
            lookups[type] = rawVals.map((v) => {
              const item = {
                variableName: v.name || v.variableName || v.id,
                name: v.displayLabel || v.label || v.name || v.variableName || v.id,
                dataType: normalizeAttributeDataType(v.dataType || v.type),
                description: v.description || "",
              };
              if (v.isMenuType) {
                item.isMenuType = true;
              }
              if (Array.isArray(v.availableElements) && v.availableElements.length > 0) {
                item.availableElements = v.availableElements;
              }
              return item;
            });
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
    arraySets,
    lookups,
  };

  if (wsRoot) {
    const configSettings = typeof getSettings === "function" ? getSettings(vscode) : null;
    saveWorkspaceAttributes(wsRoot, cacheData, configSettings);
  }

  return cacheData;
}

module.exports = {
  commerceDocumentsPath,
  getTransactions,
  listTransactions: getTransactions,
  runPipelineViewer,
  formatCommerceAttribute,
  getCommerceAttribute,
  listCommerceAttributes,
  listCommerceAttributeMenuItems,
  listCommerceArraySets,
  listCommerceSystemAttributes,
  listCommerceAttributeLookups,
  listCommerceAttributeLookupValues,
  syncCommerceAttributes,
};

