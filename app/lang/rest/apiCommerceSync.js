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
    label,
    variableName: varName,
    type: typeDisplay,
    required: item.required !== undefined ? !!item.required : false,
    userDefault: item.userDefault !== undefined ? item.userDefault : null,
    description: item.description || "",
    additional: item.additional !== undefined ? item.additional : null,
    defaultDataType: item.defaultDataType !== undefined ? item.defaultDataType : null,
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

/**
 * Pulls and caches remote attributes, menu items, systemAttributes, and attributeLookups into local cache.
 */
async function syncCommerceAttributes(
  context,
  vscode,
  { process, document, fetchMenuItems = true, fetchLookups = true } = {},
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
        // Ignore individual menu fetch error
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
