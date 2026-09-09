const {
  getWorkspaceRoot,
  saveWorkspaceAttributes,
  getCommerceProcess,
  getCommerceDocument,
} = require("./commerceAttributes");
const { getSettings } = require("../settings-panel/state");
const {
  formatCommerceAttribute,
  fetchSystemAttributes,
  fetchArraySets,
  fetchAttributeLookups,
} = require("./apiCommerceSyncHelpers");

/**
 * Pulls and caches remote attributes, menu items, systemAttributes, and attributeLookups into local cache.
 */
async function syncCommerceAttributes(
  context,
  vscode,
  {
    process,
    document,
    includeSubDocuments = false,
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
    listCommerceDocuments,
    listCommerceAttributes,
    listCommerceAttributeMenuItems,
    listCommerceSystemAttributes,
    listCommerceArraySets,
    listCommerceAttributeLookups,
    listCommerceAttributeLookupValues,
  } = apiEndpoints;

  // 1. Discover all documents in the process (header, lines/sub-documents)
  let discoveredDocuments = [];
  if (typeof listCommerceDocuments === "function") {
    try {
      const docRes = await listCommerceDocuments(
        context,
        vscode,
        { process: effectiveProcess, limit: 100, signal },
        transport,
      );
      if (docRes && docRes.body) {
        discoveredDocuments = Array.isArray(docRes.body)
          ? docRes.body
          : Array.isArray(docRes.body.items)
            ? docRes.body.items
            : [];
      }
    } catch (e) {
      // Ignore if listCommerceDocuments is unsupported or unavailable
    }
  }

  let lineDocument = null;
  if (discoveredDocuments.length > 0) {
    const foundLine = discoveredDocuments.find(
      (d) =>
        d &&
        (d.documentType === "subDocument" ||
          d.isSubDocument === true ||
          (d.variableName && (d.variableName === "transactionLine" || d.variableName.toLowerCase().includes("line")))) &&
        d.variableName !== effectiveDocument,
    );
    if (foundLine) {
      lineDocument = foundLine.variableName || foundLine.id || foundLine.name;
    }
  } else if (includeSubDocuments && effectiveDocument === "transaction") {
    lineDocument = "transactionLine";
  }

  // Helper to fetch and paginate attributes + menu items for any document
  async function fetchAttributesForDocument(docName, isLineDoc = false) {
    let offset = 0;
    const pageSize = 1000;
    const rawAttrItems = [];
    let totalCommerceAttrs = null;

    while (true) {
      if (signal && signal.aborted) throw new Error("Request aborted");
      let res;
      try {
        res = await listCommerceAttributes(
          context,
          vscode,
          {
            process: effectiveProcess,
            document: docName,
            offset,
            limit: pageSize,
            fields: "label,variableName,type,required,userDefault,description,additional,defaultDataType",
            signal,
          },
          transport,
        );
      } catch (err) {
        break;
      }

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
        const stageName = isLineDoc ? "line" : "commerce";
        const docLabel = isLineDoc ? "line item" : "commerce";
        if (totalCommerceAttrs && totalCommerceAttrs > 0) {
          const pct = Math.min(95, Math.round((rawAttrItems.length / totalCommerceAttrs) * 100));
          onProgress({
            message: `Fetched ${rawAttrItems.length} of ${totalCommerceAttrs} ${docLabel} attributes (${pct}%)...`,
            current: rawAttrItems.length,
            total: totalCommerceAttrs,
            percent: pct,
            stage: stageName,
          });
        } else {
          onProgress({
            message: `Fetched ${rawAttrItems.length} ${docLabel} attributes...`,
            current: rawAttrItems.length,
            stage: stageName,
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
        message: `Syncing ${isLineDoc ? "line " : ""}menu options (0/${totalMenus})...`,
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
              document: docName,
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
            message: `Syncing ${isLineDoc ? "line " : ""}menu options (${completedMenus}/${totalMenus}, ${pct}%)...`,
            current: completedMenus,
            total: totalMenus,
            stage: "menu",
            percent: pct,
          });
        }
      }

      const formatted = formatCommerceAttribute(item, menuOptions);
      if (formatted) {
        formatted.scope = isLineDoc ? "Line Item" : "Transaction";
      }
      return formatted;
    });

    return (await Promise.all(menuFetchPromises)).filter(Boolean);
  }

  // 2. Fetch header attributes
  const attributes = await fetchAttributesForDocument(effectiveDocument, false);

  // 3. Fetch line attributes if document identified
  let lineAttributes = [];
  if (lineDocument && lineDocument !== effectiveDocument) {
    try {
      lineAttributes = await fetchAttributesForDocument(lineDocument, true);
    } catch (e) {
      // Ignore if line document fetch fails
    }
  }

  // 4. Fetch systemAttributes
  const systemAttributes = await fetchSystemAttributes({
    listCommerceSystemAttributes,
    context,
    vscode,
    transport,
    signal,
    onProgress,
  });

  // 5. Fetch arraySets
  const arraySets = await fetchArraySets({
    listCommerceArraySets,
    context,
    vscode,
    effectiveProcess,
    effectiveDocument,
    transport,
  });

  // 6. Fetch BML attributeLookups (transaction, transactionLine, systemVariables)
  const lookups = fetchLookups
    ? await fetchAttributeLookups({
        listCommerceAttributeLookups,
        listCommerceAttributeLookupValues,
        context,
        vscode,
        effectiveProcess,
        transport,
        signal,
      })
    : {};

  const totalCount = attributes.length + lineAttributes.length;
  const cacheData = {
    process: effectiveProcess,
    document: effectiveDocument,
    documents: discoveredDocuments,
    updatedAt: new Date().toISOString(),
    count: totalCount,
    attributes,
    lineAttributes,
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
