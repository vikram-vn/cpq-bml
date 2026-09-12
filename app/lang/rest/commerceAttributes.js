const fs = require("fs");
const path = require("path");
const {
  CPQ_DIR,
  COMMERCE_DIR,
  SYSTEM_DIR,
  CONFIG_DIR,
  COMMERCE_ATTRS_FILE,
  CONFIG_ATTRS_FILE,
  SYSTEM_ATTRS_FILE,
  README_CPQ,
  saveWorkspaceAttributes: writeWorkspaceAttributes,
} = require("@/lang/rest/commerceAttributesWriter");
const { createResolver } = require("@/lang/rest/commerceAttributesResolver");
const {
  loadAttributesFromDir,
  inspectMetadataStatus,
  removeMetadataFromDirs,
} = require("@/lang/rest/commerceMetadataLoader");
const {
  getCommerceProcess,
  getCommerceDocument,
  getWorkspaceRoot,
} = require("@/lang/rest/config");

// In-memory cache singleton
let extensionContext = null;
let bundledAttributesIndex = null;
let workspaceAttributesCache = {};

function setExtensionContext(ctx) {
  extensionContext = ctx;
}

function getExtensionContext() {
  return extensionContext;
}

function clearAttributesCache(workspaceRoot) {
  if (workspaceRoot) {
    delete workspaceAttributesCache[workspaceRoot];
  } else {
    workspaceAttributesCache = {};
    bundledAttributesIndex = null;
  }
}

function getMetadataStorageDir(context, workspaceRoot) {
  const ctx = context || extensionContext;
  if (ctx && ctx.storageUri && ctx.storageUri.fsPath) {
    return ctx.storageUri.fsPath;
  }
  if (ctx && ctx.globalStorageUri && ctx.globalStorageUri.fsPath) {
    return path.join(ctx.globalStorageUri.fsPath, "metadata");
  }
  if (workspaceRoot) {
    return path.join(workspaceRoot, CPQ_DIR);
  }
  return null;
}

function normalizeKey(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeAttributeDataType(raw) {
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object") {
    const val =
      raw.displayValue ||
      raw.displayLabel ||
      raw.name ||
      raw.label ||
      raw.dataType ||
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

function getCacheFilePath(workspaceRoot, context) {
  const backendDir = getMetadataStorageDir(context, workspaceRoot);
  const dirs = [];
  if (backendDir) dirs.push(backendDir);
  if (workspaceRoot) {
    const wsCpq = path.join(workspaceRoot, CPQ_DIR);
    if (wsCpq !== backendDir) dirs.push(wsCpq);
  }

  for (const dir of dirs) {
    const commDir = path.join(dir, COMMERCE_DIR);
    if (fs.existsSync(commDir)) {
      const defaultProc = (typeof getCommerceProcess === "function" && vscode) ? getCommerceProcess(vscode) : "oraclecpqo";
      const defaultPath = path.join(commDir, defaultProc, "attributes.min.json");
      if (fs.existsSync(defaultPath)) return defaultPath;

      try {
        for (const entry of fs.readdirSync(commDir, { withFileTypes: true })) {
          if (entry.isDirectory()) {
            const p = path.join(commDir, entry.name, "attributes.min.json");
            if (fs.existsSync(p)) return p;
          } else if (entry.isFile() && entry.name.endsWith(".min.json")) {
            return path.join(commDir, entry.name);
          }
        }
      } catch (e) {}
    }

    const flatCommerce = path.join(dir, COMMERCE_ATTRS_FILE);
    if (fs.existsSync(flatCommerce)) return flatCommerce;
  }
  return backendDir ? path.join(backendDir, COMMERCE_DIR, "oraclecpqo", "attributes.min.json") : null;
}

function loadWorkspaceAttributes(workspaceRoot, context) {
  const cacheKey = workspaceRoot || "global";
  if (workspaceAttributesCache[cacheKey]) {
    return workspaceAttributesCache[cacheKey];
  }

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
      if (entry.label) index.labelToVarName.set(normalizeKey(entry.label), varName);
      if (varName.endsWith("_t")) index.labelToVarName.set(normalizeKey(varName.slice(0, -2)), varName);
    }
  };

  const backendDir = getMetadataStorageDir(context, workspaceRoot);
  const dirs = [];
  if (backendDir) dirs.push(backendDir);
  if (workspaceRoot) {
    const wsCpq = path.join(workspaceRoot, CPQ_DIR);
    if (wsCpq !== backendDir) dirs.push(wsCpq);
  }

  for (const dir of dirs) {
    if (loadAttributesFromDir(dir, index, addItems)) {
      if (index.varNameToMeta.size > 0) {
        workspaceAttributesCache[cacheKey] = index;
        return index;
      }
    }
  }

  return null;
}

function isCommerceSynced(workspaceRoot, context) {
  const backendDir = getMetadataStorageDir(context, workspaceRoot);
  const dirs = [];
  if (backendDir) dirs.push(backendDir);
  if (workspaceRoot) {
    const wsCpq = path.join(workspaceRoot, CPQ_DIR);
    if (wsCpq !== backendDir) dirs.push(wsCpq);
  }

  for (const dir of dirs) {
    const commDir = path.join(dir, COMMERCE_DIR);
    if (fs.existsSync(commDir)) {
      try {
        for (const entry of fs.readdirSync(commDir, { withFileTypes: true })) {
          if (entry.isDirectory()) {
            const p = path.join(commDir, entry.name, "attributes.min.json");
            if (fs.existsSync(p) && fs.statSync(p).size > 0) return true;
          } else if (entry.isFile() && entry.name.endsWith(".min.json")) {
            const p = path.join(commDir, entry.name);
            if (fs.statSync(p).size > 0) return true;
          }
        }
      } catch (e) {}
    }
    const flatCommerce = path.join(dir, COMMERCE_ATTRS_FILE);
    if (fs.existsSync(flatCommerce) && fs.statSync(flatCommerce).size > 0) return true;
  }
  return false;
}

function saveWorkspaceAttributes(workspaceRoot, data, configSettings, context) {
  const targetDir = getMetadataStorageDir(context, workspaceRoot);
  return writeWorkspaceAttributes(
    targetDir || workspaceRoot,
    data,
    configSettings,
    (dir) => {
      clearAttributesCache(dir);
      if (workspaceRoot) clearAttributesCache(workspaceRoot);
      clearAttributesCache("global");
    },
    workspaceRoot,
  );
}

function removeMetadata(context, workspaceRoot, vscode) {
  const ctx = context || extensionContext;
  const backendDir = getMetadataStorageDir(ctx, workspaceRoot);
  const dirs = [];
  if (backendDir && !dirs.includes(backendDir)) dirs.push(backendDir);
  if (workspaceRoot) {
    const wsCpq = path.join(workspaceRoot, CPQ_DIR);
    if (!dirs.includes(wsCpq)) dirs.push(wsCpq);
  }
  if (ctx && ctx.globalStorageUri && ctx.globalStorageUri.fsPath) {
    const globalMeta = path.join(ctx.globalStorageUri.fsPath, "metadata");
    if (!dirs.includes(globalMeta)) dirs.push(globalMeta);
  }
  if (ctx && ctx.storageUri && ctx.storageUri.fsPath) {
    if (!dirs.includes(ctx.storageUri.fsPath)) dirs.push(ctx.storageUri.fsPath);
  }
  if (vscode && vscode.workspace && Array.isArray(vscode.workspace.workspaceFolders)) {
    for (const folder of vscode.workspace.workspaceFolders) {
      if (folder.uri && folder.uri.fsPath) {
        const p = path.join(folder.uri.fsPath, CPQ_DIR);
        if (!dirs.includes(p)) dirs.push(p);
      }
    }
  }

  removeMetadataFromDirs(dirs, CPQ_DIR);
  clearAttributesCache();

  try {
    const { invalidateApiData } = require("@/lang/intellisense/apiData");
    if (typeof invalidateApiData === "function") {
      invalidateApiData();
    }
  } catch (e) {}

  if (vscode && vscode.commands && typeof vscode.commands.executeCommand === "function") {
    vscode.commands.executeCommand(
      "setContext",
      "cpqBml.commerceMetadataSynced",
      false,
    );
  }
}

function getMetadataStatus(context, workspaceRoot, vscode) {
  const backendDir = getMetadataStorageDir(context, workspaceRoot);
  const dirs = [];
  if (backendDir && fs.existsSync(backendDir)) dirs.push(backendDir);
  if (workspaceRoot) {
    const wsCpq = path.join(workspaceRoot, CPQ_DIR);
    if (wsCpq !== backendDir && fs.existsSync(wsCpq)) dirs.push(wsCpq);
  }
  return inspectMetadataStatus(dirs, vscode, backendDir);
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
  COMMERCE_ATTRS_FILE,
  CONFIG_ATTRS_FILE,
  SYSTEM_ATTRS_FILE,
  README_CPQ,
  setExtensionContext,
  getExtensionContext,
  getMetadataStorageDir,
  getCacheFilePath,
  normalizeKey,
  normalizeAttributeDataType,
  getWorkspaceRoot,
  loadBundledAttributes,
  loadWorkspaceAttributes,
  saveWorkspaceAttributes,
  clearAttributesCache,
  isCommerceSynced,
  removeMetadata,
  getMetadataStatus,
  getCommerceProcess,
  getCommerceDocument,
  resolveAttributeName: resolver.resolveAttributeName,
  resolveMenuValue: resolver.resolveMenuValue,
  resolveQueryFilter: resolver.resolveQueryFilter,
  searchAttributes: resolver.searchAttributes,
};
