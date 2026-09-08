const fs = require("fs");
const path = require("path");

const CPQ_DIR = ".cpq";
const COMMERCE_DIR = "commerce";
const SYSTEM_DIR = "system";
const CONFIG_DIR = "config";

const README_CPQ = `# Oracle CPQ Workspace Directory (.cpq)

This directory contains metadata, configuration, and schemas synchronized from your Oracle CPQ instance.

> **DO NOT REMOVE**
> This directory and its contents are used by **MCP** and **IntelliSense (preferred)**. Do not remove.
> Removing this folder will cause IntelliSense and MCP to lose instance-specific Commerce and Configuration attribute definitions, dropdown menus, and array sets.

## Structure
- \`commerce/\`: Minified JSON schemas for Commerce transactions (\`transaction.min.json\`), line items (\`transaction-line.min.json\`), and array sets (\`array-sets.min.json\`).
- \`system/\`: Minified JSON schema for system variables (\`variables.min.json\`).
- \`config/\`: Minified JSON schemas for Configuration domain metadata: attributes (\`attributes.min.json\`), product families (\`product-families.min.json\`), and models (\`models.min.json\`).
`;

// In-memory cache singleton
let bundledAttributesIndex = null;
let workspaceAttributesCache = {};

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

        // Normalize variable name itself (e.g. "status_t" -> "statust", "status")
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

        // Extract human readable labels from notes
        if (meta.notes) {
          bundledAttributesIndex.labelToVarName.set(
            normalizeKey(meta.notes),
            varName,
          );
          // If notes start with a concise label like "Status of the transaction" -> "status"
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

  // Common standard CPQ aliases
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
            const items = Array.isArray(raw)
              ? raw
              : Array.isArray(raw.attributes)
                ? raw.attributes
                : Array.isArray(raw.items)
                  ? raw.items
                  : [];
            const scope = file.includes("line")
              ? "Line Item"
              : file.includes("array")
                ? "Array Set"
                : "Transaction";
            addItems(items, scope);
          } catch (e) {}
        }
      }

      if (hasNewSystem) {
        const files = fs.readdirSync(systemDir);
        for (const file of files) {
          if (!file.endsWith(".min.json")) continue;
          try {
            const raw = JSON.parse(
              fs.readFileSync(path.join(systemDir, file), "utf8"),
            );
            const items = Array.isArray(raw)
              ? raw
              : Array.isArray(raw.attributes)
                ? raw.attributes
                : Array.isArray(raw.items)
                  ? raw.items
                  : [];
            addItems(items, "System");
          } catch (e) {}
        }
      }

      if (fs.existsSync(configDir)) {
        const files = fs.readdirSync(configDir);
        for (const file of files) {
          if (!file.endsWith(".min.json") || file === "config.min.json")
            continue;
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
  if (!workspaceRoot || !data) return;

  try {
    const cpqDir = path.join(workspaceRoot, CPQ_DIR);
    const commerceDir = path.join(cpqDir, COMMERCE_DIR);
    const systemDir = path.join(cpqDir, SYSTEM_DIR);
    const configDir = path.join(cpqDir, CONFIG_DIR);

    fs.mkdirSync(commerceDir, { recursive: true });
    fs.mkdirSync(systemDir, { recursive: true });
    fs.mkdirSync(configDir, { recursive: true });

    // Write .cpq/README.md
    fs.writeFileSync(path.join(cpqDir, "README.md"), README_CPQ, "utf8");

    // 1. Save .cpq/commerce/transaction.min.json
    const txnItems =
      data.lookups &&
      Array.isArray(data.lookups.transaction) &&
      data.lookups.transaction.length > 0
        ? data.lookups.transaction
        : Array.isArray(data.attributes) && data.attributes.length > 0
          ? data.attributes
          : [];
    if (txnItems.length > 0) {
      fs.writeFileSync(
        path.join(commerceDir, "transaction.min.json"),
        JSON.stringify({
          lookupType: "transaction",
          process: data.process || "oraclecpqo",
          document: data.document || "transaction",
          updatedAt: data.updatedAt || new Date().toISOString(),
          count: txnItems.length,
          items: txnItems,
        }),
        "utf8",
      );
    }

    // Clean up obsolete commerce/attributes.min.json if present
    const obsoleteCommerceAttr = path.join(commerceDir, "attributes.min.json");
    if (fs.existsSync(obsoleteCommerceAttr)) {
      try {
        fs.unlinkSync(obsoleteCommerceAttr);
      } catch (e) {}
    }

    // 2. Save .cpq/commerce/transaction-line.min.json
    if (
      data.lookups &&
      Array.isArray(data.lookups.transactionLine) &&
      data.lookups.transactionLine.length > 0
    ) {
      fs.writeFileSync(
        path.join(commerceDir, "transaction-line.min.json"),
        JSON.stringify({
          lookupType: "transactionLine",
          count: data.lookups.transactionLine.length,
          items: data.lookups.transactionLine,
        }),
        "utf8",
      );
    }

    // 3. Save .cpq/commerce/array-sets.min.json
    const arrSets =
      Array.isArray(data.arraySets) && data.arraySets.length > 0
        ? data.arraySets
        : data.lookups && Array.isArray(data.lookups.arraySets)
          ? data.lookups.arraySets
          : [];
    if (arrSets.length > 0) {
      fs.writeFileSync(
        path.join(commerceDir, "array-sets.min.json"),
        JSON.stringify({
          lookupType: "arraySets",
          count: arrSets.length,
          items: arrSets,
        }),
        "utf8",
      );
    }

    for (const [type, items] of Object.entries(data.lookups || {})) {
      if (
        type !== "transaction" &&
        type !== "transactionLine" &&
        type !== "systemVariables" &&
        type !== "arraySets" &&
        Array.isArray(items)
      ) {
        fs.writeFileSync(
          path.join(commerceDir, `${type}.min.json`),
          JSON.stringify({ lookupType: type, count: items.length, items }),
          "utf8",
        );
      }
    }

    // 4. Save system variables in .cpq/system/variables.min.json
    const sysItems =
      data.lookups &&
      Array.isArray(data.lookups.systemVariables) &&
      data.lookups.systemVariables.length > 0
        ? data.lookups.systemVariables
        : Array.isArray(data.systemAttributes) &&
            data.systemAttributes.length > 0
          ? data.systemAttributes
          : [];
    if (sysItems.length > 0) {
      fs.writeFileSync(
        path.join(systemDir, "variables.min.json"),
        JSON.stringify({
          lookupType: "systemVariables",
          count: sysItems.length,
          items: sysItems,
        }),
        "utf8",
      );
    }

    // Clean up obsolete system/attributes.min.json if present
    const obsoleteSysAttr = path.join(systemDir, "attributes.min.json");
    if (fs.existsSync(obsoleteSysAttr)) {
      try {
        fs.unlinkSync(obsoleteSysAttr);
      } catch (e) {}
    }

    // 6. Save configuration attributes in .cpq/config/attributes.min.json
    if (
      Array.isArray(data.configAttributes) &&
      data.configAttributes.length > 0
    ) {
      fs.writeFileSync(
        path.join(configDir, "attributes.min.json"),
        JSON.stringify({
          count: data.configAttributes.length,
          attributes: data.configAttributes,
        }),
        "utf8",
      );
    }
    if (
      Array.isArray(data.productFamilies) &&
      data.productFamilies.length > 0
    ) {
      fs.writeFileSync(
        path.join(configDir, "product-families.min.json"),
        JSON.stringify({
          count: data.productFamilies.length,
          items: data.productFamilies,
        }),
        "utf8",
      );
    }
    if (Array.isArray(data.models) && data.models.length > 0) {
      fs.writeFileSync(
        path.join(configDir, "models.min.json"),
        JSON.stringify({
          count: data.models.length,
          items: data.models,
        }),
        "utf8",
      );
    }

    // Remove obsolete connection settings from .cpq/config if present
    const obsoleteConfigMin = path.join(configDir, "config.min.json");
    if (fs.existsSync(obsoleteConfigMin)) {
      try {
        fs.unlinkSync(obsoleteConfigMin);
      } catch (e) {}
    }
    const obsoleteConfigJson = path.join(configDir, "config.json");
    if (fs.existsSync(obsoleteConfigJson)) {
      try {
        fs.unlinkSync(obsoleteConfigJson);
      } catch (e) {}
    }

    // Clean up any non-minified .json files in .cpq/commerce, .cpq/system, .cpq/config
    const cleanNonMinJson = (dir) => {
      if (!fs.existsSync(dir)) return;
      try {
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
          if (entry.endsWith(".json") && !entry.endsWith(".min.json")) {
            fs.unlinkSync(path.join(dir, entry));
          }
        }
      } catch (e) {}
    };
    cleanNonMinJson(commerceDir);
    cleanNonMinJson(systemDir);
    cleanNonMinJson(configDir);

    delete workspaceAttributesCache[workspaceRoot];
  } catch (e) {
    console.error("CPQ-BML: Failed to write commerce attribute cache:", e);
  }
}

/**
 * Resolves any attribute label, alias, or variable name to its canonical variableName.
 */
function resolveAttributeName(inputName, workspaceRoot) {
  if (!inputName || typeof inputName !== "string") return inputName;
  const trimmed = inputName.trim();

  // Special CPQ system fields should never be aliased
  if (trimmed === "_id" || trimmed === "_bsys_id") {
    return trimmed;
  }

  // 1. Check workspace cache
  const wsIndex = loadWorkspaceAttributes(workspaceRoot);
  if (wsIndex) {
    if (wsIndex.varNameToMeta.has(trimmed)) return trimmed;
    const wsVar = wsIndex.labelToVarName.get(normalizeKey(trimmed));
    if (wsVar) return wsVar;
  }

  // 2. Check bundled attributes
  const bundled = loadBundledAttributes();
  if (bundled.varNameToMeta.has(trimmed)) return trimmed;
  const bundledVar = bundled.labelToVarName.get(normalizeKey(trimmed));
  if (bundledVar) return bundledVar;

  // Fallback: return as-is
  return trimmed;
}

/**
 * Resolves a menu item label to its internal code/value.
 */
function resolveMenuValue(variableName, inputValue, workspaceRoot) {
  if (inputValue === null || inputValue === undefined) return inputValue;
  if (typeof inputValue !== "string") return inputValue;

  const wsIndex = loadWorkspaceAttributes(workspaceRoot);
  if (wsIndex && wsIndex.varNameToMeta.has(variableName)) {
    const attr = wsIndex.varNameToMeta.get(variableName);
    const menuList =
      attr &&
      (Array.isArray(attr.menuOptions)
        ? attr.menuOptions
        : Array.isArray(attr.menuItems)
          ? attr.menuItems
          : null);
    if (menuList) {
      const normVal = normalizeKey(inputValue);
      for (const item of menuList) {
        const itemVal = item.value || item.id;
        const itemLabel = item.displayValue || item.name || item.label;
        if (itemVal && normalizeKey(itemVal) === normVal) {
          return itemVal;
        }
        if (itemLabel && normalizeKey(itemLabel) === normVal) {
          return itemVal || itemLabel;
        }
      }
    }
  }

  return inputValue;
}

/**
 * Recursively resolves keys and values in a MongoDB-style query object or string.
 */
function resolveQueryFilter(queryInput, workspaceRoot) {
  if (!queryInput) return queryInput;

  let isString = false;
  let parsed = queryInput;

  if (typeof queryInput === "string") {
    isString = true;
    const trimmed = queryInput.trim();
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        // Try strict JSON parse first, or loose JSON key parsing
        parsed = JSON.parse(trimmed);
      } catch (e) {
        try {
          // Replace unquoted or single quoted keys/values for parsing
          const jsonLike = trimmed
            .replace(/'/g, '"')
            .replace(/([{,]\s*)([a-zA-Z0-9_$-]+)\s*:/g, '$1"$2":');
          parsed = JSON.parse(jsonLike);
        } catch (e2) {
          // Could not parse as structured JSON, return as-is
          return queryInput;
        }
      }
    } else {
      return queryInput;
    }
  }

  let changed = false;

  function transformNode(node) {
    if (Array.isArray(node)) {
      return node.map((item) => transformNode(item));
    }
    if (node && typeof node === "object") {
      const result = {};
      for (const [key, val] of Object.entries(node)) {
        if (key.startsWith("$")) {
          // Operator like $and, $or, $eq
          result[key] = transformNode(val);
        } else {
          // Attribute key - resolve label to variable name
          const resolvedKey = resolveAttributeName(key, workspaceRoot);
          if (resolvedKey !== key) {
            changed = true;
          }

          if (val && typeof val === "object" && !Array.isArray(val)) {
            // Operator wrapper like { $eq: "Approved" }
            const operatorObj = {};
            for (const [op, opVal] of Object.entries(val)) {
              if (op.startsWith("$")) {
                const resolvedVal = resolveMenuValue(
                  resolvedKey,
                  opVal,
                  workspaceRoot,
                );
                if (resolvedVal !== opVal) changed = true;
                operatorObj[op] = resolvedVal;
              } else {
                operatorObj[op] = transformNode(opVal);
              }
            }
            result[resolvedKey] = operatorObj;
          } else if (typeof val === "string") {
            // Direct equality like { status: "Approved" }
            const resolvedVal = resolveMenuValue(
              resolvedKey,
              val,
              workspaceRoot,
            );
            if (resolvedVal !== val) changed = true;
            result[resolvedKey] = resolvedVal;
          } else {
            result[resolvedKey] = transformNode(val);
          }
        }
      }
      return result;
    }
    return node;
  }

  const resolved = transformNode(parsed);
  if (isString && !changed) {
    return queryInput;
  }
  return isString ? JSON.stringify(resolved) : resolved;
}

/**
 * Searches metadata for attributes matching a query string (matches variableName or label).
 */
function searchAttributes(query, workspaceRoot) {
  const normQuery = normalizeKey(query);
  const results = [];
  const seen = new Set();

  // 1. Workspace cache
  const wsIndex = loadWorkspaceAttributes(workspaceRoot);
  if (wsIndex) {
    for (const [varName, meta] of wsIndex.varNameToMeta.entries()) {
      const label = meta.name || meta.label || "";
      if (
        !normQuery ||
        normalizeKey(varName).includes(normQuery) ||
        normalizeKey(label).includes(normQuery)
      ) {
        results.push({
          variableName: varName,
          label: label || varName,
          dataType: normalizeAttributeDataType(meta.dataType || meta.type),
          scope: meta.scope || "Transaction",
          description: meta.description || "",
          menuItems: meta.menuItems || meta.availableElements || null,
          productFamily: meta.productFamily || undefined,
          productLine: meta.productLine || undefined,
          model: meta.model || undefined,
          source: "workspace-cache",
        });
        seen.add(varName);
      }
    }
  }

  // 2. Bundled attributes
  const bundled = loadBundledAttributes();
  for (const [varName, meta] of bundled.varNameToMeta.entries()) {
    if (seen.has(varName)) continue;
    const label = meta.notes || "";
    if (
      !normQuery ||
      normalizeKey(varName).includes(normQuery) ||
      normalizeKey(label).includes(normQuery)
    ) {
      results.push({
        variableName: varName,
        label: label || varName,
        dataType: normalizeAttributeDataType(meta.dataType),
        scope: meta.scope,
        notes: meta.notes,
        source: "bundled",
      });
      seen.add(varName);
    }
  }

  return results.slice(0, 50);
}

module.exports = {
  normalizeKey,
  normalizeAttributeDataType,
  getWorkspaceRoot,
  loadBundledAttributes,
  loadWorkspaceAttributes,
  saveWorkspaceAttributes,
  isCommerceSynced,
  resolveAttributeName,
  resolveMenuValue,
  resolveQueryFilter,
  searchAttributes,
};
