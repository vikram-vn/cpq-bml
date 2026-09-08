const fs = require("fs");
const path = require("path");
const {
  CPQ_DIR,
  COMMERCE_DIR,
  SYSTEM_DIR,
  CONFIG_DIR,
  README_CPQ,
  saveWorkspaceAttributes: writeWorkspaceAttributes,
} = require("./commerceAttributesWriter");
const { createResolver } = require("./commerceAttributesResolver");

// In-memory cache singleton
let bundledAttributesIndex = null;
let workspaceAttributesCache = {};

function clearAttributesCache(workspaceRoot) {
  if (workspaceRoot) {
    delete workspaceAttributesCache[workspaceRoot];
  } else {
    workspaceAttributesCache = {};
    bundledAttributesIndex = null;
  }
}

function getWorkspaceRoot(vscode) {
  if (
    vscode &&
    vscode.workspace &&
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders.length > 0
  ) {
    return vscode.workspace.workspaceFolders[0].uri.fsPath;
  }
  return null;
}

function normalizeKey(str) {
  if (!str || typeof str !== "string") return "";
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeAttributeDataType(raw) {
  if (typeof raw === "string") {
    return raw;
  }
  if (raw && typeof raw === "object") {
    const val =
      raw.displayValue ||
      raw.displayLabel ||
      raw.name ||
      raw.label ||
      raw.type ||
      raw.value;
    if (val !== undefined && val !== null) {
      return String(val);
    }
  }
  if (raw !== undefined && raw !== null) {
    return String(raw);
  }
  return "String";
}

function loadBundledAttributes() {
  if (bundledAttributesIndex) return bundledAttributesIndex;

  bundledAttributesIndex = {
    varNameToMeta: new Map(),
    labelToVarName: new Map(),
  };

  try {
    const bundledPath = path.join(
      __dirname,
      "..",
      "intellisense",
      "bml-attributes-api-usage.json",
    );
    if (fs.existsSync(bundledPath)) {
      const raw = JSON.parse(fs.readFileSync(bundledPath, "utf8"));
      for (const [varName, meta] of Object.entries(raw)) {
        if (!meta) continue;
        const entry = {
          variableName: varName,
          name: meta.notes || varName,
          dataType: meta.dataType || "String",
          scope: meta.scope || "Transaction",
          notes: meta.notes || "",
          values: meta.values || null,
        };
        bundledAttributesIndex.varNameToMeta.set(varName, entry);

        bundledAttributesIndex.labelToVarName.set(
          normalizeKey(varName),
          varName,
        );
        if (varName.endsWith("_t")) {
          bundledAttributesIndex.labelToVarName.set(
            normalizeKey(varName.slice(0, -2)),
            varName,
          );
        }

        if (meta.notes) {
          bundledAttributesIndex.labelToVarName.set(
            normalizeKey(meta.notes),
            varName,
          );
          const firstWord = meta.notes.split(/\s+/)[0];
          if (firstWord && firstWord.length > 2) {
            const normFirst = normalizeKey(firstWord);
            if (!bundledAttributesIndex.labelToVarName.has(normFirst)) {
              bundledAttributesIndex.labelToVarName.set(normFirst, varName);
            }
          }
        }
      }
    }
  } catch (e) {
    // Ignore bundled load errors
  }

  const commonAliases = {
    status: "status_t",
    quotestatus: "status_t",
    transactionstatus: "status_t",
    id: "transactionID_t",
    transactionid: "transactionID_t",
    quoteid: "transactionID_t",
    docnumber: "_transaction_document_number",
    documentnumber: "_transaction_document_number",
    total: "totalAmount_t",
    grandtotal: "totalAmount_t",
    totalamount: "totalAmount_t",
    customer: "_customer_t_company_name",
    customername: "_customer_t_company_name",
    company: "_customer_t_company_name",
    companyname: "_customer_t_company_name",
    createdby: "createdBy_t",
    datecreated: "createdDate_t",
    createddate: "createdDate_t",
    datemodified: "dateModified_t",
    lastmodifieddate: "dateModified_t",
  };

  for (const [alias, varName] of Object.entries(commonAliases)) {
    bundledAttributesIndex.labelToVarName.set(alias, varName);
  }

  return bundledAttributesIndex;
}

function getCacheFilePath(workspaceRoot) {
  if (!workspaceRoot) return null;
  const txnMin = path.join(
    workspaceRoot,
    CPQ_DIR,
    COMMERCE_DIR,
    "transaction.min.json",
  );
  if (fs.existsSync(txnMin)) return txnMin;
  const commerceMin = path.join(
    workspaceRoot,
    CPQ_DIR,
    COMMERCE_DIR,
    "attributes.min.json",
  );
  if (fs.existsSync(commerceMin)) return commerceMin;
  const legacyMin = path.join(
    workspaceRoot,
    CPQ_DIR,
    "cache",
    "commerce-attributes.min.json",
  );
  if (fs.existsSync(legacyMin)) return legacyMin;
  const legacyJson = path.join(
    workspaceRoot,
    CPQ_DIR,
    "cache",
    "commerce-attributes.json",
  );
  if (fs.existsSync(legacyJson)) return legacyJson;
  return txnMin;
}

function loadWorkspaceAttributes(workspaceRoot) {
  if (!workspaceRoot) return null;
  if (workspaceAttributesCache[workspaceRoot]) {
    return workspaceAttributesCache[workspaceRoot];
  }

  const cpqDir = path.join(workspaceRoot, CPQ_DIR);
  const commerceDir = path.join(cpqDir, COMMERCE_DIR);
  const systemDir = path.join(cpqDir, SYSTEM_DIR);
  const configDir = path.join(cpqDir, CONFIG_DIR);

  const index = {
    data: {},
    varNameToMeta: new Map(),
    labelToVarName: new Map(),
  };

  const addItems = (items, defaultScope) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      const varName = item.variableName || item.name || item.id;
      if (!varName) continue;

      const scope = item.scope || defaultScope;
      const entry = {
        ...item,
        variableName: varName,
        name: item.name || item.label || item.displayLabel || varName,
        label: item.label || item.displayLabel || item.name || varName,
        scope,
        dataType: normalizeAttributeDataType(item.dataType || item.type),
        source: "workspace-cache",
      };

      index.varNameToMeta.set(varName, entry);
      index.labelToVarName.set(normalizeKey(varName), varName);

      const label = entry.label;
      if (label) {
        index.labelToVarName.set(normalizeKey(label), varName);
      }

      if (varName.endsWith("_t")) {
        index.labelToVarName.set(normalizeKey(varName.slice(0, -2)), varName);
      }
    }
  };

  const hasNewCommerce = fs.existsSync(commerceDir);
  const hasNewSystem = fs.existsSync(systemDir);
  const hasNewConfig = fs.existsSync(configDir);

  if (hasNewCommerce || hasNewSystem || hasNewConfig) {
    try {
      if (hasNewCommerce) {
        const files = fs.readdirSync(commerceDir);
        for (const file of files) {
          if (!file.endsWith(".min.json")) continue;
          try {
            const raw = JSON.parse(
              fs.readFileSync(path.join(commerceDir, file), "utf8"),
            );
            if (file === "transaction.min.json") {
              if (raw.standardProcess && raw.standardProcess.attributes) {
                addItems(raw.standardProcess.attributes, "Transaction");
              }
              if (raw.processes && typeof raw.processes === "object") {
                for (const procData of Object.values(raw.processes)) {
                  if (procData && procData.attributes) {
                    addItems(procData.attributes, "Transaction");
                  }
                }
              }
              if (raw.lookups) {
                if (Array.isArray(raw.lookups.transaction)) {
                  addItems(raw.lookups.transaction, "Transaction");
                }
                if (Array.isArray(raw.lookups.transactionLine)) {
                  addItems(raw.lookups.transactionLine, "Line Item");
                }
                if (Array.isArray(raw.lookups.arraySets)) {
                  addItems(raw.lookups.arraySets, "Array Set");
                }
                if (raw.lookups.custom && typeof raw.lookups.custom === "object") {
                  for (const cAttrs of Object.values(raw.lookups.custom)) {
                    if (Array.isArray(cAttrs)) addItems(cAttrs, "Transaction");
                  }
                }
              }
              if (Array.isArray(raw.attributes)) {
                addItems(raw.attributes, "Transaction");
              }
              if (Array.isArray(raw.items)) {
                addItems(raw.items, "Transaction");
              }
            } else if (file === "transaction-line.min.json") {
              const lineItems = Array.isArray(raw)
                ? raw
                : Array.isArray(raw.attributes)
                  ? raw.attributes
                  : [];
              addItems(lineItems, "Line Item");
            } else if (file === "array-sets.min.json") {
              const arrayItems = Array.isArray(raw)
                ? raw
                : Array.isArray(raw.items)
                  ? raw.items
                  : [];
              addItems(arrayItems, "Array Set");
            }
          } catch (e) {}
        }
      }

      if (hasNewSystem) {
        const varsFile = path.join(systemDir, "variables.min.json");
        if (fs.existsSync(varsFile)) {
          try {
            const raw = JSON.parse(fs.readFileSync(varsFile, "utf8"));
            const items = Array.isArray(raw)
              ? raw
              : Array.isArray(raw.items)
                ? raw.items
                : [];
            addItems(items, "System");
          } catch (e) {}
        }
      }

      if (hasNewConfig) {
        const files = fs.readdirSync(configDir);
        for (const file of files) {
          if (!file.endsWith(".min.json")) continue;
          try {
            const raw = JSON.parse(
              fs.readFileSync(path.join(configDir, file), "utf8"),
            );
            const items = Array.isArray(raw)
              ? raw
              : Array.isArray(raw.attributes)
                ? raw.attributes
                : Array.isArray(raw.items)
                  ? raw.items
                  : [];
            const scope = file.includes("model") ? "Model" : "Configuration";
            addItems(items, scope);
          } catch (e) {}
        }
      }

      if (index.varNameToMeta.size > 0) {
        workspaceAttributesCache[workspaceRoot] = index;
        return index;
      }
    } catch (e) {}
  }

  // Fallback: Legacy .cpq/cache/ structure
  const legacyCacheMin = path.join(
    workspaceRoot,
    CPQ_DIR,
    "cache",
    "commerce-attributes.min.json",
  );
  const legacyCacheJson = path.join(
    workspaceRoot,
    CPQ_DIR,
    "cache",
    "commerce-attributes.json",
  );
  const legacyPath = fs.existsSync(legacyCacheMin)
    ? legacyCacheMin
    : fs.existsSync(legacyCacheJson)
      ? legacyCacheJson
      : null;

  if (legacyPath && fs.existsSync(legacyPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(legacyPath, "utf8"));
      index.data = data;
      addItems(data.attributes, "Transaction");
      addItems(data.systemAttributes, "System");
      addItems(data.arraySets, "Array Set");
      if (data.lookups && typeof data.lookups === "object") {
        addItems(data.lookups.transaction, "Transaction");
        addItems(data.lookups.transactionLine, "Line Item");
        addItems(data.lookups.systemVariables, "System");
        addItems(data.lookups.arraySets, "Array Set");
      }
      workspaceAttributesCache[workspaceRoot] = index;
      return index;
    } catch (e) {}
  }

  return null;
}

function isCommerceSynced(workspaceRoot) {
  if (!workspaceRoot) return false;
  const txnMin = path.join(
    workspaceRoot,
    CPQ_DIR,
    COMMERCE_DIR,
    "transaction.min.json",
  );
  const commerceMin = path.join(
    workspaceRoot,
    CPQ_DIR,
    COMMERCE_DIR,
    "attributes.min.json",
  );
  const legacyMin = path.join(
    workspaceRoot,
    CPQ_DIR,
    "cache",
    "commerce-attributes.min.json",
  );
  const legacyJson = path.join(
    workspaceRoot,
    CPQ_DIR,
    "cache",
    "commerce-attributes.json",
  );
  try {
    return (
      (fs.existsSync(txnMin) && fs.statSync(txnMin).size > 0) ||
      (fs.existsSync(commerceMin) && fs.statSync(commerceMin).size > 0) ||
      (fs.existsSync(legacyMin) && fs.statSync(legacyMin).size > 0) ||
      (fs.existsSync(legacyJson) && fs.statSync(legacyJson).size > 0)
    );
  } catch (e) {
    return false;
  }
}

function saveWorkspaceAttributes(workspaceRoot, data, configSettings) {
  return writeWorkspaceAttributes(
    workspaceRoot,
    data,
    configSettings,
    (root) => {
      delete workspaceAttributesCache[root];
    },
  );
}

const resolver = createResolver({
  loadWorkspaceAttributes,
  loadBundledAttributes,
  normalizeKey,
  normalizeAttributeDataType,
});

module.exports = {
  CPQ_DIR,
  COMMERCE_DIR,
  SYSTEM_DIR,
  CONFIG_DIR,
  README_CPQ,
  normalizeKey,
  normalizeAttributeDataType,
  getWorkspaceRoot,
  loadBundledAttributes,
  loadWorkspaceAttributes,
  saveWorkspaceAttributes,
  clearAttributesCache,
  isCommerceSynced,
  resolveAttributeName: resolver.resolveAttributeName,
  resolveMenuValue: resolver.resolveMenuValue,
  resolveQueryFilter: resolver.resolveQueryFilter,
  searchAttributes: resolver.searchAttributes,
};
