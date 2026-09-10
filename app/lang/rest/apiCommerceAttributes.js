const { call, getEffectiveRestVersion } = require("@/lang/rest/apiCore");
const {
  getCommerceProcess,
  getCommerceDocument,
} = require("@/lang/rest/config");
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
