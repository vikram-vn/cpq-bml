const { call, getEffectiveRestVersion } = require("./apiCore");
const { getWorkspaceRoot, saveWorkspaceAttributes } = require("./commerceAttributes");

function formatConfigurationAttribute(raw, productFamily = null) {
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

  const attr = {
    variableName: varName,
    label: raw.label || raw.displayLabel || raw.name || varName,
    name: raw.name || raw.label || varName,
    dataType,
    type: dataType,
    scope: "Configuration",
  };
  if (raw.required) attr.required = true;
  if (raw.defaultValue !== undefined && raw.defaultValue !== null && raw.defaultValue !== "") {
    attr.defaultValue = raw.defaultValue;
  }
  if (raw.description && typeof raw.description === "string" && raw.description.trim()) {
    attr.description = raw.description.trim();
  }
  if (categoryStr && categoryStr.trim()) {
    attr.category = categoryStr.trim();
  }

  const fam = productFamily || raw.productFamily;
  if (fam) {
    attr.productFamily = fam;
  }

  return attr;
}

// GET /rest/<version>/allProductFamilySetups/_allProductFamilies/attributes
async function listConfigurationAttributes(
  context,
  vscode,
  {
    offset = 0,
    limit = 1000,
    q,
    fields = "variableName,label,dataType,required,defaultValue,description,category,inputTypeCode",
    signal,
  } = {},
  transport,
) {
  const version = getEffectiveRestVersion(vscode, 18);
  const queryParams = { offset, limit };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

  return call(
    context,
    vscode,
    {
      path: `/rest/${version}/allProductFamilySetups/_allProductFamilies/attributes`,
      method: "GET",
      query: queryParams,
      signal,
    },
    transport,
  );
}

// GET /rest/<version>/allProductFamilySetups
async function listProductFamilies(
  context,
  vscode,
  { offset = 0, limit = 100, q, fields = "variableName,label", signal } = {},
  transport,
) {
  const version = getEffectiveRestVersion(vscode, 18);
  const queryParams = { offset, limit };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

  return call(
    context,
    vscode,
    {
      path: `/rest/${version}/allProductFamilySetups`,
      method: "GET",
      query: queryParams,
      signal,
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
    q,
    fields = "variableName,label,dataType,required,defaultValue,description,category,inputTypeCode",
    signal,
  } = {},
  transport,
) {
  const version = getEffectiveRestVersion(vscode, 18);
  const queryParams = { offset, limit };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

  return call(
    context,
    vscode,
    {
      path: `/rest/${version}/allProductFamilySetups/_allProductFamilies/productFamilies/${productFamily}/attributes`,
      method: "GET",
      query: queryParams,
      signal,
    },
    transport,
  );
}

// GET /rest/<version>/allProductFamilySetups/_allProductFamilies/productFamilies/{family}/productLines
async function listProductLines(
  context,
  vscode,
  { productFamily, offset = 0, limit = 100, q, fields = "variableName,label,name", signal } = {},
  transport,
) {
  const version = getEffectiveRestVersion(vscode, 18);
  const queryParams = { offset, limit };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

  return call(
    context,
    vscode,
    {
      path: `/rest/${version}/allProductFamilySetups/_allProductFamilies/productFamilies/${productFamily}/productLines`,
      method: "GET",
      query: queryParams,
      signal,
    },
    transport,
  );
}

// GET /rest/<version>/allProductFamilySetups/_allProductFamilies/productFamilies/{family}/productLines/{line}/models
async function listModels(
  context,
  vscode,
  { productFamily, productLine, offset = 0, limit = 100, q, fields = "variableName,label,name", signal } = {},
  transport,
) {
  const version = getEffectiveRestVersion(vscode, 18);
  const queryParams = { offset, limit };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

  return call(
    context,
    vscode,
    {
      path: `/rest/${version}/allProductFamilySetups/_allProductFamilies/productFamilies/${productFamily}/productLines/${productLine}/models`,
      method: "GET",
      query: queryParams,
      signal,
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
    q,
    fields = "variableName,label,dataType,required,defaultValue,description,category,inputTypeCode",
    signal,
  } = {},
  transport,
) {
  const version = getEffectiveRestVersion(vscode, 18);
  const queryParams = { offset, limit };
  if (q) queryParams.q = q;
  if (fields) queryParams.fields = fields;

  return call(
    context,
    vscode,
    {
      path: `/rest/${version}/allProductFamilySetups/_allProductFamilies/productFamilies/${productFamily}/productLines/${productLine}/models/${model}/attributes`,
      method: "GET",
      query: queryParams,
      signal,
    },
    transport,
  );
}

// Pulls and caches remote configuration attributes into .cpq/config.attributes.min.json
async function syncConfigurationAttributes(
  context,
  vscode,
  {
    limit = 1000,
    fetchProductFamilies = true,
    fetchModels = true,
    signal,
    onProgress,
  } = {},
  transport,
) {
  const wsRoot = getWorkspaceRoot(vscode);

  let offset = 0;
  const pageSize = limit || 1000;
  const rawItems = [];
  let totalConfigAttrs = null;

  while (true) {
    if (signal && signal.aborted) throw new Error("Request aborted");
    const res = await listConfigurationAttributes(
      context,
      vscode,
      { offset, limit: pageSize, signal },
      transport,
    );

    const pageItems =
      res && res.body
        ? Array.isArray(res.body)
          ? res.body
          : Array.isArray(res.body.items)
            ? res.body.items
            : []
        : [];
    rawItems.push(...pageItems);

    if (totalConfigAttrs === null && res && res.body && typeof res.body.totalResults === "number") {
      totalConfigAttrs = res.body.totalResults;
    }

    if (onProgress && typeof onProgress === "function") {
      if (totalConfigAttrs && totalConfigAttrs > 0) {
        const pct = Math.min(100, Math.round((rawItems.length / totalConfigAttrs) * 100));
        onProgress({
          message: `Fetched ${rawItems.length} of ${totalConfigAttrs} configuration attributes (${pct}%)...`,
          current: rawItems.length,
          total: totalConfigAttrs,
          percent: pct,
          stage: "config",
        });
      } else {
        onProgress({
          message: `Fetched ${rawItems.length} configuration attributes...`,
          current: rawItems.length,
          stage: "config",
        });
      }
    }

    const hasMore =
      res &&
      res.body &&
      (res.body.hasMore !== undefined
        ? res.body.hasMore === true
        : Array.isArray(res.body.items) && res.body.items.length === pageSize);

    if (!hasMore || pageItems.length === 0 || rawItems.length >= 50000) {
      break;
    }
    offset += pageSize;
  }

  const attributes = rawItems.map(formatConfigurationAttribute);

  let productFamilies = [];
  let models = [];

  if (fetchProductFamilies) {
    try {
      if (signal && signal.aborted) throw new Error("Request aborted");
      const famRes = await listProductFamilies(context, vscode, { limit: 100, signal }, transport);
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

      await Promise.all(
        productFamilies.map(async (fam) => {
          if (signal && signal.aborted) throw new Error("Request aborted");
          try {
            const famAttrRes = await listProductFamilyAttributes(
              context,
              vscode,
              { productFamily: fam.variableName, limit: 1000, signal },
              transport,
            );
            const rawFamAttrs =
              famAttrRes && famAttrRes.body
                ? Array.isArray(famAttrRes.body)
                  ? famAttrRes.body
                  : Array.isArray(famAttrRes.body.items)
                    ? famAttrRes.body.items
                    : []
                : [];

            for (const item of rawFamAttrs) {
              const formatted = formatConfigurationAttribute(item, fam.variableName);
              const existingIdx = attributes.findIndex((a) => a.variableName === formatted.variableName);
              if (existingIdx >= 0) {
                if (!attributes[existingIdx].productFamily) {
                  attributes[existingIdx].productFamily = fam.variableName;
                }
              } else {
                attributes.push(formatted);
              }
            }
          } catch (e) {}

          if (fetchModels) {
            try {
              const lineRes = await listProductLines(
                context,
                vscode,
                { productFamily: fam.variableName, limit: 50, signal },
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

              await Promise.all(
                rawLines.map(async (line) => {
                  if (signal && signal.aborted) throw new Error("Request aborted");
                  const lineVar = line.variableName || line.id || line.name;
                  try {
                    const modRes = await listModels(
                      context,
                      vscode,
                      { productFamily: fam.variableName, productLine: lineVar, limit: 50, signal },
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
                }),
              );
            } catch (e) {}
          }
        }),
      );
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
