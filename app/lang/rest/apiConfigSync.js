const { getWorkspaceRoot, saveWorkspaceAttributes } = require("@/lang/rest/commerceAttributes");

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

// Pulls and caches remote configuration attributes into cpq/config/<productFamily>/attributes.min.json
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
  endpoints = {},
) {
  const wsRoot = getWorkspaceRoot(vscode);

  const {
    listConfigurationAttributes,
    listProductFamilies,
    listProductFamilyAttributes,
    listProductLines,
    listProductLineAttributes,
    listModels,
  } = endpoints;

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
        const pct = Math.min(95, Math.round((rawItems.length / totalConfigAttrs) * 100));
        onProgress({
          message: `Fetched ${rawItems.length} of ${totalConfigAttrs} config attributes (${pct}%)...`,
          current: rawItems.length,
          total: totalConfigAttrs,
          percent: pct,
          stage: "config",
        });
      } else {
        onProgress({
          message: `Fetched ${rawItems.length} config attributes...`,
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

  const attributes = rawItems.map((r) => formatConfigurationAttribute(r)).filter(Boolean);

  let productFamilies = [];
  let models = [];

  if (fetchProductFamilies && typeof listProductFamilies === "function") {
    try {
      let famOffset = 0;
      const famPageSize = 100;
      const rawFam = [];
      while (true) {
        if (signal && signal.aborted) throw new Error("Request aborted");
        const famRes = await listProductFamilies(
          context,
          vscode,
          { offset: famOffset, limit: famPageSize, signal },
          transport,
        );
        const pageItems =
          famRes && famRes.body
            ? Array.isArray(famRes.body)
              ? famRes.body
              : Array.isArray(famRes.body.items)
                ? famRes.body.items
                : []
            : [];
        rawFam.push(...pageItems);

        const hasMore =
          famRes &&
          famRes.body &&
          (famRes.body.hasMore !== undefined
            ? famRes.body.hasMore === true
            : Array.isArray(famRes.body.items) && famRes.body.items.length === famPageSize);
        if (!hasMore || pageItems.length === 0 || rawFam.length >= 10000) {
          break;
        }
        famOffset += famPageSize;
      }

      productFamilies = rawFam.map((f) => ({
        variableName: f.variableName || f.id || f.name,
        label: f.label || f.name || f.variableName,
      }));

      await Promise.all(
        productFamilies.map(async (fam) => {
          if (signal && signal.aborted) throw new Error("Request aborted");
          if (typeof listProductFamilyAttributes === "function") {
            try {
              let attrOffset = 0;
              const attrPageSize = 1000;
              const rawFamAttrs = [];
              while (true) {
                if (signal && signal.aborted) throw new Error("Request aborted");
                const famAttrRes = await listProductFamilyAttributes(
                  context,
                  vscode,
                  { productFamily: fam.variableName, offset: attrOffset, limit: attrPageSize, signal },
                  transport,
                );
                const pageItems =
                  famAttrRes && famAttrRes.body
                    ? Array.isArray(famAttrRes.body)
                      ? famAttrRes.body
                      : Array.isArray(famAttrRes.body.items)
                        ? famAttrRes.body.items
                        : []
                    : [];
                rawFamAttrs.push(...pageItems);

                const hasMore =
                  famAttrRes &&
                  famAttrRes.body &&
                  (famAttrRes.body.hasMore !== undefined
                    ? famAttrRes.body.hasMore === true
                    : Array.isArray(famAttrRes.body.items) && famAttrRes.body.items.length === attrPageSize);
                if (!hasMore || pageItems.length === 0 || rawFamAttrs.length >= 50000) {
                  break;
                }
                attrOffset += attrPageSize;
              }

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
          }

          if (fetchModels && typeof listProductLines === "function" && typeof listModels === "function") {
            try {
              let lineOffset = 0;
              const linePageSize = 100;
              const rawLines = [];
              while (true) {
                if (signal && signal.aborted) throw new Error("Request aborted");
                const lineRes = await listProductLines(
                  context,
                  vscode,
                  { productFamily: fam.variableName, offset: lineOffset, limit: linePageSize, signal },
                  transport,
                );
                const pageItems =
                  lineRes && lineRes.body
                    ? Array.isArray(lineRes.body)
                      ? lineRes.body
                      : Array.isArray(lineRes.body.items)
                        ? lineRes.body.items
                        : []
                    : [];
                rawLines.push(...pageItems);

                const hasMore =
                  lineRes &&
                  lineRes.body &&
                  (lineRes.body.hasMore !== undefined
                    ? lineRes.body.hasMore === true
                    : Array.isArray(lineRes.body.items) && lineRes.body.items.length === linePageSize);
                if (!hasMore || pageItems.length === 0 || rawLines.length >= 10000) {
                  break;
                }
                lineOffset += linePageSize;
              }

              await Promise.all(
                rawLines.map(async (line) => {
                  if (signal && signal.aborted) throw new Error("Request aborted");
                  const lineVar = line.variableName || line.id || line.name;
                  if (typeof listProductLineAttributes === "function") {
                    try {
                      const lineAttrRes = await listProductLineAttributes(
                        context,
                        vscode,
                        { productFamily: fam.variableName, productLine: lineVar, signal },
                        transport,
                      );
                      const pageItems = lineAttrRes && lineAttrRes.body
                        ? (Array.isArray(lineAttrRes.body) ? lineAttrRes.body : (Array.isArray(lineAttrRes.body.items) ? lineAttrRes.body.items : []))
                        : [];
                      for (const item of pageItems) {
                        const formatted = formatConfigurationAttribute(item, fam.variableName);
                        if (formatted) {
                          formatted.productLine = lineVar;
                          const existingIdx = attributes.findIndex((a) => a.variableName === formatted.variableName);
                          if (existingIdx === -1) {
                            attributes.push(formatted);
                          }
                        }
                      }
                    } catch (e) {}
                  }
                  try {
                    let modOffset = 0;
                    const modPageSize = 100;
                    const rawMods = [];
                    while (true) {
                      if (signal && signal.aborted) throw new Error("Request aborted");
                      const modRes = await listModels(
                        context,
                        vscode,
                        { productFamily: fam.variableName, productLine: lineVar, offset: modOffset, limit: modPageSize, signal },
                        transport,
                      );
                      const pageItems =
                        modRes && modRes.body
                          ? Array.isArray(modRes.body)
                            ? modRes.body
                            : Array.isArray(modRes.body.items)
                              ? modRes.body.items
                              : []
                          : [];
                      rawMods.push(...pageItems);

                      const hasMore =
                        modRes &&
                        modRes.body &&
                        (modRes.body.hasMore !== undefined
                          ? modRes.body.hasMore === true
                          : Array.isArray(modRes.body.items) && modRes.body.items.length === modPageSize);
                      if (!hasMore || pageItems.length === 0 || rawMods.length >= 10000) {
                        break;
                      }
                      modOffset += modPageSize;
                    }

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
  syncConfigurationAttributes,
};
