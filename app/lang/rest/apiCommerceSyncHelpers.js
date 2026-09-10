const { normalizeAttributeDataType } = require("@/lang/rest/commerceAttributes");

function formatCommerceAttribute(item, menuOptions = null) {
  if (!item) return null;
  const varName = item.variableName || item.name || item.id || "";
  const label = item.label || item.name || varName;

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
    variableName: varName,
    label,
    name: label,
    dataType: typeDisplay,
    type: typeDisplay,
  };
  if (item.required) {
    attr.required = true;
  }
  if (item.description && typeof item.description === "string" && item.description.trim()) {
    attr.description = item.description.trim();
  }

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

async function fetchSystemAttributes({
  listCommerceSystemAttributes,
  context,
  vscode,
  transport,
  signal,
  onProgress,
}) {
  const systemAttributes = [];
  if (typeof listCommerceSystemAttributes !== "function") return systemAttributes;

  try {
    let sysOffset = 0;
    let totalSysAttrs = null;
    while (true) {
      if (signal && signal.aborted) throw new Error("Request aborted");
      const sysRes = await listCommerceSystemAttributes(
        context,
        vscode,
        {
          offset: sysOffset,
          limit: 1000,
          fields: "variableName,name,label,type,dataType,description",
          signal,
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
          scope: "System",
        });
      }

      if (totalSysAttrs === null && sysRes && sysRes.body && typeof sysRes.body.totalResults === "number") {
        totalSysAttrs = sysRes.body.totalResults;
      }

      if (onProgress && typeof onProgress === "function") {
        if (totalSysAttrs && totalSysAttrs > 0) {
          const pct = Math.min(100, Math.round((systemAttributes.length / totalSysAttrs) * 100));
          onProgress({
            message: `Fetched ${systemAttributes.length} of ${totalSysAttrs} system attributes (${pct}%)...`,
            current: systemAttributes.length,
            total: totalSysAttrs,
            percent: pct,
            stage: "system",
          });
        } else {
          onProgress({
            message: `Fetched ${systemAttributes.length} system attributes...`,
            current: systemAttributes.length,
            stage: "system",
          });
        }
      }

      const sysHasMore =
        sysRes &&
        sysRes.body &&
        (sysRes.body.hasMore === true || (sysRes.body.items && sysRes.body.items.length === 1000));
      if (!sysHasMore || rawSysItems.length === 0 || systemAttributes.length >= 10000) {
        break;
      }
      sysOffset += 1000;
    }
  } catch (e) {}

  return systemAttributes;
}

async function fetchArraySets({
  listCommerceArraySets,
  context,
  vscode,
  effectiveProcess,
  effectiveDocument,
  transport,
}) {
  const arraySets = [];
  if (typeof listCommerceArraySets !== "function") return arraySets;

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

  return arraySets;
}

async function fetchAttributeLookups({
  listCommerceAttributeLookups,
  listCommerceAttributeLookupValues,
  context,
  vscode,
  effectiveProcess,
  transport,
  signal,
}) {
  const lookups = {};
  if (typeof listCommerceAttributeLookups !== "function" || typeof listCommerceAttributeLookupValues !== "function") {
    return lookups;
  }

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
        let lookupOffset = 0;
        const lookupLimit = 1000;
        const rawVals = [];
        while (true) {
          if (signal && signal.aborted) throw new Error("Request aborted");
          const valRes = await listCommerceAttributeLookupValues(
            context,
            vscode,
            {
              process: effectiveProcess,
              lookupType: type,
              offset: lookupOffset,
              limit: lookupLimit,
              fields: "name,variableName,displayLabel,label,dataType,type,description,isMenuType,availableElements",
              signal,
            },
            transport,
          );
          const pageItems =
            valRes && valRes.body
              ? Array.isArray(valRes.body)
                ? valRes.body
                : Array.isArray(valRes.body.items)
                  ? valRes.body.items
                  : []
              : [];
          rawVals.push(...pageItems);

          const hasMore =
            valRes &&
            valRes.body &&
            (valRes.body.hasMore !== undefined
              ? valRes.body.hasMore === true
              : Array.isArray(valRes.body.items) && valRes.body.items.length === lookupLimit);

          if (!hasMore || pageItems.length === 0 || rawVals.length >= 50000) {
            break;
          }
          lookupOffset += lookupLimit;
        }

        if (rawVals.length > 0) {
          const scope = type === "transactionLine" ? "Line Item" : type === "systemVariables" ? "System" : "Transaction";
          lookups[type] = rawVals.map((v) => {
            const item = {
              variableName: v.name || v.variableName || v.id,
              name: v.displayLabel || v.label || v.name || v.variableName || v.id,
              dataType: normalizeAttributeDataType(v.dataType || v.type),
              description: v.description || "",
              scope,
            };
            if (v.isMenuType) {
              item.isMenuType = true;
            }
            if (Array.isArray(v.availableElements) && v.availableElements.length > 0) {
              item.availableElements = v.availableElements;
              item.menuOptions = v.availableElements.map((el) => ({
                value: el.value !== undefined ? el.value : (el.id !== undefined ? el.id : ""),
                displayValue: el.displayValue || el.label || el.name || (el.value !== undefined ? String(el.value) : ""),
              }));
            }
            return item;
          });
        }
      } catch (e) {}
    }
  } catch (e) {}

  return lookups;
}

module.exports = {
  formatCommerceAttribute,
  fetchSystemAttributes,
  fetchArraySets,
  fetchAttributeLookups,
};
