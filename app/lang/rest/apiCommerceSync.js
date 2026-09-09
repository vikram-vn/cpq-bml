const {
  getCommerceProcess,
  getCommerceDocument,
  getSettings,
} = require("./config");
const {
  getWorkspaceRoot,
  saveWorkspaceAttributes,
  normalizeAttributeDataType,
} = require("./commerceAttributes");

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

/**
 * Pulls and caches remote attributes, menu items, systemAttributes, and attributeLookups into local cache.
 */
async function syncCommerceAttributes(
  context,
  vscode,
  {
    process,
    document,
    fetchMenuItems = true,
    fetchLookups = true,
    signal,
    onProgress,
  } = {},
  transport,
  apiEndpoints,
) {
  const effectiveProcess = process || getCommerceProcess(vscode) || "oraclecpqo";
  const effectiveDocument = document || getCommerceDocument(vscode) || "transaction";
  const wsRoot = getWorkspaceRoot(vscode);

  const {
    listCommerceAttributes,
    listCommerceAttributeMenuItems,
    listCommerceSystemAttributes,
    listCommerceArraySets,
    listCommerceAttributeLookups,
    listCommerceAttributeLookupValues,
  } = apiEndpoints;

  let offset = 0;
  const pageSize = 1000;
  const rawAttrItems = [];
  let totalCommerceAttrs = null;

  while (true) {
    if (signal && signal.aborted) throw new Error("Request aborted");
    const res = await listCommerceAttributes(
      context,
      vscode,
      {
        process: effectiveProcess,
        document: effectiveDocument,
        offset,
        limit: pageSize,
        fields: "label,variableName,type,required,userDefault,description,additional,defaultDataType",
        signal,
      },
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
    rawAttrItems.push(...pageItems);

    if (totalCommerceAttrs === null && res && res.body && typeof res.body.totalResults === "number") {
      totalCommerceAttrs = res.body.totalResults;
    }

    if (onProgress && typeof onProgress === "function") {
      if (totalCommerceAttrs && totalCommerceAttrs > 0) {
        const pct = Math.min(95, Math.round((rawAttrItems.length / totalCommerceAttrs) * 100));
        onProgress({
          message: `Fetched ${rawAttrItems.length} of ${totalCommerceAttrs} commerce attributes (${pct}%)...`,
          current: rawAttrItems.length,
          total: totalCommerceAttrs,
          percent: pct,
          stage: "commerce",
        });
      } else {
        onProgress({
          message: `Fetched ${rawAttrItems.length} commerce attributes...`,
          current: rawAttrItems.length,
          stage: "commerce",
        });
      }
    }

    const hasMore =
      res &&
      res.body &&
      (res.body.hasMore !== undefined
        ? res.body.hasMore === true
        : Array.isArray(res.body.items) && res.body.items.length === pageSize);

    if (!hasMore || pageItems.length === 0 || rawAttrItems.length >= 50000) {
      break;
    }
    offset += pageSize;
  }

  const menuItemsToFetch = fetchMenuItems
    ? rawAttrItems.filter((item) => {
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
        return (
          typeStr.includes("menu") ||
          typeStr.includes("select") ||
          displayTypeLower.includes("menu") ||
          displayTypeLower.includes("select")
        );
      })
    : [];

  const totalMenus = menuItemsToFetch.length;
  if (fetchMenuItems && totalMenus > 0 && onProgress && typeof onProgress === "function") {
    onProgress({
      message: `Syncing menu options (0/${totalMenus})...`,
      current: 0,
      total: totalMenus,
      stage: "menu",
      percent: 0,
    });
  }

  let completedMenus = 0;
  const menuFetchPromises = rawAttrItems.map(async (item) => {
    if (signal && signal.aborted) throw new Error("Request aborted");
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
            signal,
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
        // Ignore individual menu fetch error
      }
      completedMenus++;
      if (onProgress && typeof onProgress === "function" && (completedMenus % 5 === 0 || completedMenus === totalMenus)) {
        const pct = Math.round((completedMenus / totalMenus) * 100);
        onProgress({
          message: `Syncing menu options (${completedMenus}/${totalMenus}, ${pct}%)...`,
          current: completedMenus,
          total: totalMenus,
          stage: "menu",
          percent: pct,
        });
      }
    }

    return formatCommerceAttribute(item, menuOptions);
  });

  const attributes = await Promise.all(menuFetchPromises);

  // Fetch systemAttributes
  const systemAttributes = [];
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
      // Ignore lookups failure
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
  formatCommerceAttribute,
  syncCommerceAttributes,
};
