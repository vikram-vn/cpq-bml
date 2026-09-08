const { call, getEffectiveRestVersion } = require("./apiCore");
const { getWorkspaceRoot, saveWorkspaceAttributes } = require("./commerceAttributes");

function formatConfigurationAttribute(raw) {
  if (!raw || typeof raw !== "object") return raw;
  const varName = raw.variableName || raw.name || raw.id;
  let dataType = "Text";
  if (raw.dataType) {
    dataType =
      typeof raw.dataType === "object"
        ? raw.dataType.displayValue || raw.dataType.lookupCode || "Text"
        : String(raw.dataType);
  } else if (raw.inputTypeCode) {
    dataType = raw.inputTypeCode;
  }

  const categoryStr =
    raw.category && typeof raw.category === "object"
      ? raw.category.displayValue || ""
      : typeof raw.category === "string"
        ? raw.category
        : "";

  return {
    variableName: varName,
    label: raw.label || raw.displayLabel || raw.name || varName,
    name: raw.name || raw.label || varName,
    type: dataType,
    dataType,
    required: Boolean(raw.required),
    defaultValue: raw.defaultValue !== undefined ? raw.defaultValue : null,
    description: raw.description || "",
    category: categoryStr,
    scope: "Configuration",
  };
}

// GET /rest/<version>/allProductFamilySetups/_allProductFamilies/attributes
async function listConfigurationAttributes(
  context,
  vscode,
  {
    offset = 0,
    limit = 1000,
    fields = "variableName,label,dataType,required,defaultValue,description,category,inputTypeCode",
  } = {},
  transport,
) {
  const version = getEffectiveRestVersion(vscode, 18);
  const queryParams = { offset, limit };
  if (fields) queryParams.fields = fields;

  return call(
    context,
    vscode,
    {
      path: `/rest/${version}/allProductFamilySetups/_allProductFamilies/attributes`,
      method: "GET",
      query: queryParams,
    },
    transport,
  );
}

// GET /rest/<version>/allProductFamilySetups
async function listProductFamilies(
  context,
  vscode,
  { offset = 0, limit = 100, fields = "variableName,label" } = {},
  transport,
) {
  const version = getEffectiveRestVersion(vscode, 18);
  const queryParams = { offset, limit };
  if (fields) queryParams.fields = fields;

  return call(
    context,
    vscode,
    {
      path: `/rest/${version}/allProductFamilySetups`,
      method: "GET",
      query: queryParams,
    },
    transport,
  );
}

// GET /rest/<version>/allProductFamilySetups/_allProductFamilies/productFamilies/{family}/attributes
async function listProductFamilyAttributes(
  context,
  vscode,
  {
    productFamily = "defaultFamily",
    offset = 0,
    limit = 1000,
    fields = "variableName,label,dataType,required,defaultValue,description,category,inputTypeCode",
  } = {},
  transport,
) {
  const version = getEffectiveRestVersion(vscode, 18);
  const queryParams = { offset, limit };
  if (fields) queryParams.fields = fields;

  return call(
    context,
    vscode,
    {
      path: `/rest/${version}/allProductFamilySetups/_allProductFamilies/productFamilies/${productFamily}/attributes`,
      method: "GET",
      query: queryParams,
    },
    transport,
  );
}

// GET /rest/<version>/allProductFamilySetups/_allProductFamilies/productFamilies/{family}/productLines
async function listProductLines(
  context,
  vscode,
  { productFamily, offset = 0, limit = 100, fields = "variableName,label,name" } = {},
  transport,
) {
  const version = getEffectiveRestVersion(vscode, 18);
  const queryParams = { offset, limit };
  if (fields) queryParams.fields = fields;

  return call(
    context,
    vscode,
    {
      path: `/rest/${version}/allProductFamilySetups/_allProductFamilies/productFamilies/${productFamily}/productLines`,
      method: "GET",
      query: queryParams,
    },
    transport,
  );
}

// GET /rest/<version>/allProductFamilySetups/_allProductFamilies/productFamilies/{family}/productLines/{line}/models
async function listModels(
  context,
  vscode,
  { productFamily, productLine, offset = 0, limit = 100, fields = "variableName,label,name" } = {},
  transport,
) {
  const version = getEffectiveRestVersion(vscode, 18);
  const queryParams = { offset, limit };
  if (fields) queryParams.fields = fields;

  return call(
    context,
    vscode,
    {
      path: `/rest/${version}/allProductFamilySetups/_allProductFamilies/productFamilies/${productFamily}/productLines/${productLine}/models`,
      method: "GET",
      query: queryParams,
    },
    transport,
  );
}

// GET /rest/<version>/allProductFamilySetups/_allProductFamilies/productFamilies/{family}/productLines/{line}/models/{model}/attributes
async function listModelAttributes(
  context,
  vscode,
  {
    productFamily,
    productLine,
    model,
    offset = 0,
    limit = 1000,
    fields = "variableName,label,dataType,required,defaultValue,description,category,inputTypeCode",
  } = {},
  transport,
) {
  const version = getEffectiveRestVersion(vscode, 18);
  const queryParams = { offset, limit };
  if (fields) queryParams.fields = fields;

  return call(
    context,
    vscode,
    {
      path: `/rest/${version}/allProductFamilySetups/_allProductFamilies/productFamilies/${productFamily}/productLines/${productLine}/models/${model}/attributes`,
      method: "GET",
      query: queryParams,
    },
    transport,
  );
}

// Pulls and caches remote configuration attributes into .cpq/config/attributes.min.json, product-families, and models
async function syncConfigurationAttributes(
  context,
  vscode,
  { limit = 1000, fetchProductFamilies = true, fetchModels = true } = {},
  transport,
) {
  const wsRoot = getWorkspaceRoot(vscode);

  const res = await listConfigurationAttributes(
    context,
    vscode,
    { limit },
    transport,
  );

  const rawItems =
    res && res.body
      ? Array.isArray(res.body)
        ? res.body
        : Array.isArray(res.body.items)
          ? res.body.items
          : []
      : [];

  const attributes = rawItems.map(formatConfigurationAttribute);

  let productFamilies = [];
  let models = [];

  if (fetchProductFamilies) {
    try {
      const famRes = await listProductFamilies(context, vscode, { limit: 100 }, transport);
      const rawFam =
        famRes && famRes.body
          ? Array.isArray(famRes.body)
            ? famRes.body
            : Array.isArray(famRes.body.items)
              ? famRes.body.items
              : []
          : [];
      productFamilies = rawFam.map((f) => ({
        variableName: f.variableName || f.id || f.name,
        label: f.label || f.name || f.variableName,
      }));

      if (fetchModels) {
        for (const fam of productFamilies) {
          try {
            const lineRes = await listProductLines(
              context,
              vscode,
              { productFamily: fam.variableName, limit: 50 },
              transport,
            );
            const rawLines =
              lineRes && lineRes.body
                ? Array.isArray(lineRes.body)
                  ? lineRes.body
                  : Array.isArray(lineRes.body.items)
                    ? lineRes.body.items
                    : []
                : [];

            for (const line of rawLines) {
              const lineVar = line.variableName || line.id || line.name;
              try {
                const modRes = await listModels(
                  context,
                  vscode,
                  { productFamily: fam.variableName, productLine: lineVar, limit: 50 },
                  transport,
                );
                const rawMods =
                  modRes && modRes.body
                    ? Array.isArray(modRes.body)
                      ? modRes.body
                      : Array.isArray(modRes.body.items)
                        ? modRes.body.items
                        : []
                    : [];

                for (const m of rawMods) {
                  models.push({
                    variableName: m.variableName || m.id || m.name,
                    label: m.label || m.name || m.variableName,
                    productLine: lineVar,
                    productFamily: fam.variableName,
                  });
                }
              } catch (e) {}
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
  }

  const result = {
    updatedAt: new Date().toISOString(),
    count: attributes.length,
    attributes,
    productFamilies,
    models,
  };

  if (wsRoot) {
    saveWorkspaceAttributes(wsRoot, { configAttributes: attributes, productFamilies, models });
  }

  return result;
}

module.exports = {
  formatConfigurationAttribute,
  listConfigurationAttributes,
  listProductFamilies,
  listProductFamilyAttributes,
  listProductLines,
  listModels,
  listModelAttributes,
  syncConfigurationAttributes,
};
