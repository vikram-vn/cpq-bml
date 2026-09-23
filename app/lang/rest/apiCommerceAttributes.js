const {
  call,
  getEffectiveRestVersion,
  normalizeArgs,
} = require("@/lang/rest/apiCore");
const {
  getCommerceProcess,
  getCommerceDocument,
} = require("@/lang/rest/config");
const {
  formatCommerceAttribute,
  syncCommerceAttributes: syncCommerceAttributesImpl,
} = require("@/lang/rest/apiCommerceSync");

// GET /rest/<version>/commerceProcesses/<process>/documents/<document>/attributes
async function listCommerceAttributes(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const {
    process,
    document,
    offset = 0,
    limit = 1000,
    q,
    fields,
  } = opts;

  const effectiveVersion = getEffectiveRestVersion(null, 19);
  const effectiveProcess = process || getCommerceProcess() || "oraclecpqo";
  const effectiveDocument = document || getCommerceDocument() || "transaction";

  const queryParams = { offset, limit, totalResults: true };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

  return call(
    {
      path: `/commerceProcesses/${effectiveProcess}/documents/${effectiveDocument}/attributes`,
      method: "GET",
      query: queryParams,
      version: effectiveVersion,
    },
    tr,
  );
}

// GET /rest/<version>/commerceProcesses/<process>/documents
async function listCommerceDocuments(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const { process, offset = 0, limit = 100, signal } = opts;
  const effectiveVersion = getEffectiveRestVersion(null, 19);
  const effectiveProcess = process || getCommerceProcess() || "oraclecpqo";
  return call(
    {
      path: `/commerceProcesses/${effectiveProcess}/documents`,
      method: "GET",
      query: { offset, limit, totalResults: true },
      signal,
      version: effectiveVersion,
    },
    tr,
  );
}

// GET /rest/<version>/commerceProcesses/<process>/documents/<document>/attributes/<attributeVarName>/menuItems
async function listCommerceAttributeMenuItems(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const {
    process,
    document,
    attributeVarName,
    offset = 0,
    limit = 1000,
    q,
    fields = "value,displayValue,label,name,id",
  } = opts;

  const effectiveVersion = getEffectiveRestVersion(null, 19);
  const effectiveProcess = process || getCommerceProcess() || "oraclecpqo";
  const effectiveDocument = document || getCommerceDocument() || "transaction";

  const queryParams = { offset, limit, totalResults: true };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

  return call(
    {
      path: `/commerceProcesses/${effectiveProcess}/documents/${effectiveDocument}/attributes/${attributeVarName}/menuItems`,
      method: "GET",
      query: queryParams,
      version: effectiveVersion,
    },
    tr,
  );
}

// GET /rest/<version>/commerceProcesses/<process>/documents/<document>/attributes/<attributeVarName>
async function getCommerceAttribute(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const {
    process,
    document,
    attributeVarName,
    fields = "label,variableName,type,required,userDefault,description,additional,defaultDataType,dependencies,ajaxSensitive,attributeSet,systemDefault",
    fetchMenuOptions = true,
  } = opts;

  const effectiveVersion = getEffectiveRestVersion(null, 19);
  const effectiveProcess = process || getCommerceProcess() || "oraclecpqo";
  const effectiveDocument = document || getCommerceDocument() || "transaction";

  const queryParams = {};
  if (fields) queryParams.fields = fields;

  const res = await call(
    {
      path: `/commerceProcesses/${effectiveProcess}/documents/${effectiveDocument}/attributes/${attributeVarName}`,
      method: "GET",
      query: queryParams,
      version: effectiveVersion,
    },
    tr,
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
        {
          process: effectiveProcess,
          document: effectiveDocument,
          attributeVarName,
          limit: 500,
          fields: "value,displayValue,label,name,id",
        },
        tr,
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
async function listCommerceArraySets(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const {
    process,
    document,
    offset = 0,
    limit = 1000,
    q,
    fields = "variableName,name,label,description",
  } = opts;

  const effectiveVersion = getEffectiveRestVersion(null, 19);
  const effectiveProcess = process || getCommerceProcess() || "oraclecpqo";
  const effectiveDocument = document || getCommerceDocument() || "transaction";

  const queryParams = { offset, limit, totalResults: true };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

  return call(
    {
      path: `/commerceProcesses/${effectiveProcess}/documents/${effectiveDocument}/arraySets`,
      method: "GET",
      query: queryParams,
      version: effectiveVersion,
    },
    tr,
  );
}

// GET /rest/<version>/commerceProcessSetups/<process>/documents/<document>/attributes/<attributeVarName>/references
async function listCommerceAttributeReferences(attributeVarName, options = {}, transport) {
  const [attrName, opts = {}, tr] = normalizeArgs(arguments);
  const {
    process,
    document,
    offset = 0,
    limit = 1000,
    q,
    fields,
  } = opts;

  const effectiveVersion = getEffectiveRestVersion(null, 19);
  const effectiveProcess = process || getCommerceProcess() || "oraclecpqo";
  const effectiveDocument = document || getCommerceDocument() || "transaction";

  const queryParams = { offset, limit, totalResults: true };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

  const encodedAttr = encodeURIComponent(attrName);
  return call(
    {
      path: `/commerceProcessSetups/${effectiveProcess}/documents/${effectiveDocument}/attributes/${encodedAttr}/references`,
      method: "GET",
      query: queryParams,
      version: effectiveVersion,
    },
    tr,
  );
}

// GET /rest/<version>/commerceProcessSetups/systemAttributes
async function listCommerceSystemAttributes(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const { offset = 0, limit = 1000, q, fields } = opts;
  const effectiveVersion = getEffectiveRestVersion(null, 19);

  const queryParams = { offset, limit, totalResults: true };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

  return call(
    {
      path: "/commerceProcessSetups/systemAttributes",
      method: "GET",
      query: queryParams,
      version: effectiveVersion,
    },
    tr,
  );
}

// GET /rest/<version>/commerceProcessSetups/<process>/bml/attributeLookups
async function listCommerceAttributeLookups(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const { process, offset = 0, limit = 100, fields = "lookupType,name" } = opts;
  const effectiveVersion = getEffectiveRestVersion(null, 18);
  const effectiveProcess = process || getCommerceProcess() || "oraclecpqo";

  const queryParams = { offset, limit, totalResults: true };
  if (fields) queryParams.fields = fields;

  return call(
    {
      path: `/commerceProcessSetups/${effectiveProcess}/bml/attributeLookups`,
      method: "GET",
      query: queryParams,
      version: effectiveVersion,
    },
    tr,
  );
}

// GET /rest/<version>/commerceProcessSetups/<process>/bml/attributeLookups/<lookupType>/lookupValues
async function listCommerceAttributeLookupValues(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  const {
    process,
    lookupType,
    offset = 0,
    limit = 1000,
    href,
    fields = "name,displayLabel,dataType,description,isMenuType,availableElements",
  } = opts;

  const effectiveVersion = getEffectiveRestVersion(null, 18);
  const effectiveProcess = process || getCommerceProcess() || "oraclecpqo";

  let path = `/commerceProcessSetups/${effectiveProcess}/bml/attributeLookups/${lookupType}/lookupValues`;
  if (href && typeof href === "string") {
    const match = href.match(/\/rest\/.*$/i);
    if (match) {
      path = match[0];
    }
  }

  const queryParams = { offset, limit, totalResults: true };
  if (fields) queryParams.fields = fields;

  return call(
    {
      path,
      method: "GET",
      query: queryParams,
      version: effectiveVersion,
    },
    tr,
  );
}

async function syncCommerceAttributes(options = {}, transport) {
  const [opts = {}, tr] = normalizeArgs(arguments);
  return syncCommerceAttributesImpl(null, null, opts, tr, {
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
  listCommerceAttributeReferences,
  syncCommerceAttributes,
};
