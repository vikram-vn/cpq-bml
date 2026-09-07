const fs = require("fs");
const path = require("path");

const CACHE_DIR = ".cpq";
const CACHE_SUBDIR = "cache";
const CACHE_FILE = "commerce-attributes.json";

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
        bundledAttributesIndex.labelToVarName.set(normalizeKey(varName), varName);
        if (varName.endsWith("_t")) {
          bundledAttributesIndex.labelToVarName.set(
            normalizeKey(varName.slice(0, -2)),
            varName,
          );
        }

        // Extract human readable labels from notes
        if (meta.notes) {
          bundledAttributesIndex.labelToVarName.set(normalizeKey(meta.notes), varName);
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
  return path.join(workspaceRoot, CACHE_DIR, CACHE_SUBDIR, CACHE_FILE);
}

function loadWorkspaceAttributes(workspaceRoot) {
  if (!workspaceRoot) return null;
  if (workspaceAttributesCache[workspaceRoot]) {
    return workspaceAttributesCache[workspaceRoot];
  }

  const cachePath = getCacheFilePath(workspaceRoot);
  if (cachePath && fs.existsSync(cachePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(cachePath, "utf8"));
      const index = {
        data,
        varNameToMeta: new Map(),
        labelToVarName: new Map(),
      };

      const collections = [
        data.attributes,
        data.arraySets,
        data.actionDefs,
        data.systemAttributes,
      ];
      for (const coll of collections) {
        if (Array.isArray(coll)) {
          for (const item of coll) {
            const varName = item.variableName || item.id;
            if (!varName) continue;

            index.varNameToMeta.set(varName, item);
            index.labelToVarName.set(normalizeKey(varName), varName);

            const label = item.name || item.label;
            if (label) {
              index.labelToVarName.set(normalizeKey(label), varName);
            }

            if (varName.endsWith("_t")) {
              index.labelToVarName.set(normalizeKey(varName.slice(0, -2)), varName);
            }
          }
        }
      }

      workspaceAttributesCache[workspaceRoot] = index;
      return index;
    } catch (e) {
      // Return null on corrupt cache
    }
  }

  return null;
}

function isCommerceSynced(workspaceRoot) {
  const cachePath = getCacheFilePath(workspaceRoot);
  try {
    return !!(cachePath && fs.existsSync(cachePath) && fs.statSync(cachePath).size > 0);
  } catch (e) {
    return false;
  }
}

function saveWorkspaceAttributes(workspaceRoot, data) {
  if (!workspaceRoot || !data) return;
  const cachePath = getCacheFilePath(workspaceRoot);
  if (!cachePath) return;

  try {
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), "utf8");
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
    if (attr && Array.isArray(attr.menuItems)) {
      const normVal = normalizeKey(inputValue);
      for (const item of attr.menuItems) {
        const itemVal = item.value || item.id;
        const itemLabel = item.name || item.label;
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
                const resolvedVal = resolveMenuValue(resolvedKey, opVal, workspaceRoot);
                if (resolvedVal !== opVal) changed = true;
                operatorObj[op] = resolvedVal;
              } else {
                operatorObj[op] = transformNode(opVal);
              }
            }
            result[resolvedKey] = operatorObj;
          } else if (typeof val === "string") {
            // Direct equality like { status: "Approved" }
            const resolvedVal = resolveMenuValue(resolvedKey, val, workspaceRoot);
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
          dataType: meta.dataType || meta.type || "String",
          menuItems: meta.menuItems || null,
          source: "remote-cache",
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
        dataType: meta.dataType || "String",
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
