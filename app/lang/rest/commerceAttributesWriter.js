const fs = require("fs");
const path = require("path");

const CPQ_DIR = ".cpq";
const COMMERCE_DIR = "commerce";
const SYSTEM_DIR = "system";
const CONFIG_DIR = "config";

const COMMERCE_ATTRS_FILE = "commerce.attributes.min.json";
const CONFIG_ATTRS_FILE = "config.attributes.min.json";
const SYSTEM_ATTRS_FILE = "system.attributes.min.json";
const OBSOLETE_DIRS = ["commerce", "system", "config", "cache"];

const README_CPQ = `# Oracle CPQ Backend Metadata Directory

This directory contains metadata, configuration, and schemas synchronized from your Oracle CPQ instance.

> **DO NOT REMOVE**
> This directory and its contents are used by **MCP** and **IntelliSense (preferred)**. Do not remove.
> Removing this folder will cause IntelliSense and MCP to lose instance-specific Commerce and Configuration attribute definitions, dropdown menus, and array sets.

## Structure
- \`commerce.attributes.min.json\`: Unified Commerce metadata (transactions, line items, array sets, and custom processes).
- \`config.attributes.min.json\`: Unified Configuration metadata (attributes, product families, and models).
- \`system.attributes.min.json\`: Unified System variables metadata.
`;

function pruneAttribute(attr, defaultScope) {
  if (!attr) return null;
  const varName = attr.variableName || attr.name || attr.id;
  const label = attr.label || attr.name || varName || '';
  const clean = {
    variableName: varName,
    label,
    name: label,
    dataType: attr.dataType || attr.type || 'String',
    scope: attr.scope || defaultScope || 'Transaction'
  };
  if (attr.required) clean.required = true;
  if (attr.description && typeof attr.description === 'string' && attr.description.trim()) {
    clean.description = attr.description.trim();
  }
  if (Array.isArray(attr.menuOptions) && attr.menuOptions.length > 0) {
    clean.menuOptions = attr.menuOptions.map(m => ({
      value: m.value !== undefined ? m.value : (m.id !== undefined ? m.id : ''),
      label: m.displayValue || m.label || m.name || String(m.value || m.id || '')
    }));
  } else if (Array.isArray(attr.menuItems) && attr.menuItems.length > 0) {
    clean.menuOptions = attr.menuItems.map(m => ({
      value: m.value !== undefined ? m.value : (m.id !== undefined ? m.id : ''),
      label: m.displayValue || m.label || m.name || String(m.value || m.id || '')
    }));
  }
  if (attr.productFamily) clean.productFamily = attr.productFamily;
  if (attr.category && typeof attr.category === 'string' && attr.category.trim()) {
    clean.category = attr.category.trim();
  }
  if (attr.process && attr.process !== 'oraclecpqo') {
    clean.process = attr.process;
  }
  return clean;
}

function resolveStorageDirectory(targetDir) {
  if (!targetDir) return null;
  if (
    targetDir.endsWith(CPQ_DIR) ||
    targetDir.includes("metadata") ||
    targetDir.includes("storage") ||
    targetDir.includes("globalStorage") ||
    targetDir.includes("workspaceStorage")
  ) {
    return targetDir;
  }
  return path.join(targetDir, CPQ_DIR);
}

function saveWorkspaceAttributes(targetDir, data, configSettings, onCacheInvalidated, workspaceRoot) {
  if (!targetDir || !data) return;

  try {
    const storageDir = resolveStorageDirectory(targetDir);
    fs.mkdirSync(storageDir, { recursive: true });

    // Always write and keep README.md fresh on sync
    const readmePath = path.join(storageDir, "README.md");
    fs.writeFileSync(readmePath, README_CPQ, "utf8");

    // 1. Save consolidated commerce metadata in commerce.attributes.min.json
    if (data.consolidatedTransaction) {
      const ct = data.consolidatedTransaction;
      const prunedLookups = {};
      if (ct.lookups) {
        if (Array.isArray(ct.lookups.transaction)) {
          prunedLookups.transaction = ct.lookups.transaction.map(a => pruneAttribute(a, "Transaction"));
        }
        if (Array.isArray(ct.lookups.transactionLine)) {
          prunedLookups.transactionLine = ct.lookups.transactionLine.map(a => pruneAttribute(a, "Line Item"));
        }
        if (Array.isArray(ct.lookups.arraySets)) {
          prunedLookups.arraySets = ct.lookups.arraySets.map(a => pruneAttribute(a, "Array Set"));
        }
        if (ct.lookups.custom && typeof ct.lookups.custom === "object") {
          prunedLookups.custom = {};
          for (const [proc, cAttrs] of Object.entries(ct.lookups.custom)) {
            if (Array.isArray(cAttrs)) {
              prunedLookups.custom[proc] = cAttrs.map(a => pruneAttribute(a, "Transaction"));
            }
          }
        }
      }
      const prunedCT = {
        lookupType: ct.lookupType || "commerce",
        process: ct.process || (configSettings && configSettings.commerceProcess) || "oraclecpqo",
        updatedAt: ct.updatedAt || new Date().toISOString(),
        processes: ct.processes,
        standardCounts: ct.standardCounts,
        customCounts: ct.customCounts,
        count: ct.count || ((prunedLookups.transaction?.length || 0) + (prunedLookups.transactionLine?.length || 0)),
        attributes: prunedLookups.transaction || [],
        items: prunedLookups.transaction || [],
        lookups: prunedLookups,
      };
      fs.writeFileSync(
        path.join(storageDir, COMMERCE_ATTRS_FILE),
        JSON.stringify(prunedCT),
        "utf8",
      );
    } else {
      const rawTxnAttrs =
        data.lookups &&
        Array.isArray(data.lookups.transaction) &&
        data.lookups.transaction.length > 0
          ? data.lookups.transaction
          : Array.isArray(data.attributes) && data.attributes.length > 0
            ? data.attributes
            : [];
      const txnAttrs = rawTxnAttrs.map(a => pruneAttribute(a, "Transaction"));

      const rawLineAttrs =
        data.lookups &&
        Array.isArray(data.lookups.transactionLine) &&
        data.lookups.transactionLine.length > 0
          ? data.lookups.transactionLine
          : [];
      const lineAttrs = rawLineAttrs.map(a => pruneAttribute(a, "Line Item"));

      const rawArraySets =
        Array.isArray(data.arraySets) && data.arraySets.length > 0
          ? data.arraySets
          : data.lookups &&
              Array.isArray(data.lookups.arraySets) &&
              data.lookups.arraySets.length > 0
            ? data.lookups.arraySets
            : [];
      const arraySets = rawArraySets.map(a => pruneAttribute(a, "Array Set"));

      if (txnAttrs.length > 0 || lineAttrs.length > 0 || arraySets.length > 0) {
        fs.writeFileSync(
          path.join(storageDir, COMMERCE_ATTRS_FILE),
          JSON.stringify({
            updatedAt: new Date().toISOString(),
            process: (configSettings && configSettings.commerceProcess) || "oraclecpqo",
            count: txnAttrs.length + lineAttrs.length,
            attributes: txnAttrs,
            items: txnAttrs,
            lookups: {
              transaction: txnAttrs,
              transactionLine: lineAttrs,
              arraySets: arraySets,
            },
            arraySets: arraySets,
            processes: Array.isArray(data.processes) ? data.processes : [],
          }),
          "utf8",
        );
      }
    }

    // 2. Save system variables in system.attributes.min.json
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
        path.join(storageDir, SYSTEM_ATTRS_FILE),
        JSON.stringify({
          lookupType: "systemVariables",
          count: sysItems.length,
          items: sysItems,
          attributes: sysItems,
        }),
        "utf8",
      );
    }

    // 3. Save unified configuration metadata in config.attributes.min.json
    const hasConfigAttrs =
      Array.isArray(data.configAttributes) && data.configAttributes.length > 0;
    const hasProductFamilies =
      Array.isArray(data.productFamilies) && data.productFamilies.length > 0;
    const hasModels =
      Array.isArray(data.models) && data.models.length > 0;

    if (hasConfigAttrs || hasProductFamilies || hasModels) {
      const configAttrs = hasConfigAttrs
        ? data.configAttributes.map(a => pruneAttribute(a, "Configuration"))
        : [];
      const configPayload = {
        updatedAt: new Date().toISOString(),
        count: configAttrs.length,
        productFamilies: hasProductFamilies ? data.productFamilies : [],
        models: hasModels ? data.models : [],
        items: configAttrs,
        attributes: configAttrs,
      };
      fs.writeFileSync(
        path.join(storageDir, CONFIG_ATTRS_FILE),
        JSON.stringify(configPayload),
        "utf8",
      );
    }

    // Clean up obsolete subfolders if present in storageDir
    for (const sub of OBSOLETE_DIRS) {
      const subPath = path.join(storageDir, sub);
      if (fs.existsSync(subPath)) {
        try {
          fs.rmSync(subPath, { recursive: true, force: true });
        } catch (e) {}
      }
    }

    // Clean up any non-minified .json files directly in storageDir
    try {
      const entries = fs.readdirSync(storageDir);
      for (const entry of entries) {
        if (entry.endsWith(".json") && !entry.endsWith(".min.json")) {
          fs.unlinkSync(path.join(storageDir, entry));
        }
      }
    } catch (e) {}

    // Clean up legacy .cpq folder from user workspace if storageDir is outside workspace
    if (workspaceRoot) {
      const wsCpq = path.join(workspaceRoot, CPQ_DIR);
      if (wsCpq !== storageDir && fs.existsSync(wsCpq)) {
        try {
          fs.rmSync(wsCpq, { recursive: true, force: true });
        } catch (e) {}
      }
    }

    if (typeof onCacheInvalidated === "function") {
      onCacheInvalidated(storageDir);
      if (workspaceRoot) onCacheInvalidated(workspaceRoot);
    }
  } catch (e) {
    console.error("CPQ-BML: Failed to write commerce attribute cache:", e);
  }
}

module.exports = {
  CPQ_DIR,
  COMMERCE_DIR,
  SYSTEM_DIR,
  CONFIG_DIR,
  COMMERCE_ATTRS_FILE,
  CONFIG_ATTRS_FILE,
  SYSTEM_ATTRS_FILE,
  README_CPQ,
  saveWorkspaceAttributes,
};
