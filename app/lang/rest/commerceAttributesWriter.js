const fs = require("fs");
const path = require("path");

const CPQ_DIR = "cpq";
const COMMERCE_DIR = "commerce";
const SYSTEM_DIR = "system";
const CONFIG_DIR = "config";

const COMMERCE_ATTRS_FILE = "commerce.attributes.min.json";
const CONFIG_ATTRS_FILE = "config.attributes.min.json";
const SYSTEM_ATTRS_FILE = "system.attributes.min.json";

const README_CPQ = `# Oracle CPQ Backend Metadata Directory

This directory contains metadata, configuration, and schemas synchronized from your Oracle CPQ instance.

> **DO NOT REMOVE**
> This directory and its contents are used by **MCP** and **IntelliSense (preferred)**. Do not remove.
> Removing this folder will cause IntelliSense and MCP to lose instance-specific Commerce and Configuration attribute definitions, dropdown menus, and array sets.

## Structure
- \`commerce/<process>/attributes.min.json\`: Commerce attributes scoped per process (transactions, line items, array sets).
- \`config/<productFamily>/attributes.min.json\`: Configuration attributes scoped per product family.
- \`config/general.attributes.min.json\`: Global configuration attributes, product families, and models.
- \`system/variables.min.json\`: Unified System variables metadata.
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

    // 1. Save commerce metadata in commerce/<process>/attributes.min.json
    const commDir = path.join(storageDir, COMMERCE_DIR);
    fs.mkdirSync(commDir, { recursive: true });

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
      const standardProc = ct.process || (configSettings && configSettings.commerceProcess) || "oraclecpqo";
      const stdProcDir = path.join(commDir, standardProc);
      fs.mkdirSync(stdProcDir, { recursive: true });

      const prunedCT = {
        lookupType: ct.lookupType || "commerce",
        process: standardProc,
        updatedAt: ct.updatedAt || new Date().toISOString(),
        processes: ct.processes,
        standardCounts: ct.standardCounts,
        customCounts: ct.customCounts,
        count: ct.count || ((prunedLookups.transaction?.length || 0) + (prunedLookups.transactionLine?.length || 0)),
        attributes: prunedLookups.transaction || [],
        items: prunedLookups.transaction || [],
        lineAttributes: prunedLookups.transactionLine || [],
        lookups: prunedLookups,
      };
      fs.writeFileSync(
        path.join(stdProcDir, "attributes.min.json"),
        JSON.stringify(prunedCT),
        "utf8",
      );

      // Write custom processes to their respective folders
      if (prunedLookups.custom && typeof prunedLookups.custom === "object") {
        for (const [cProc, cAttrs] of Object.entries(prunedLookups.custom)) {
          if (Array.isArray(cAttrs) && cAttrs.length > 0 && cProc !== standardProc) {
            const cProcDir = path.join(commDir, cProc);
            fs.mkdirSync(cProcDir, { recursive: true });
            fs.writeFileSync(
              path.join(cProcDir, "attributes.min.json"),
              JSON.stringify({
                process: cProc,
                updatedAt: ct.updatedAt || new Date().toISOString(),
                count: cAttrs.length,
                attributes: cAttrs,
                items: cAttrs,
                lookups: { transaction: cAttrs },
              }),
              "utf8",
            );
          }
        }
      }
    } else {
      // 1. Transaction attributes: Merge data.attributes and data.lookups.transaction
      const txnMap = new Map();
      if (Array.isArray(data.attributes)) {
        for (const a of data.attributes) {
          if (!a) continue;
          const varName = a.variableName || a.name || a.id;
          if (varName) txnMap.set(varName, { ...a });
        }
      }
      if (data.lookups && Array.isArray(data.lookups.transaction)) {
        for (const a of data.lookups.transaction) {
          if (!a) continue;
          const varName = a.variableName || a.name || a.id;
          if (!varName) continue;
          if (txnMap.has(varName)) {
            const existing = txnMap.get(varName);
            txnMap.set(varName, {
              ...existing,
              ...a,
              menuOptions: existing.menuOptions || existing.menuItems || a.menuOptions || a.availableElements,
              description: existing.description || a.description,
            });
          } else {
            txnMap.set(varName, { ...a });
          }
        }
      }
      const txnAttrs = Array.from(txnMap.values()).map(a => pruneAttribute(a, "Transaction"));

      // 2. Line Item attributes: Merge data.lineAttributes and data.lookups.transactionLine
      const lineMap = new Map();
      if (Array.isArray(data.lineAttributes)) {
        for (const a of data.lineAttributes) {
          if (!a) continue;
          const varName = a.variableName || a.name || a.id;
          if (varName) lineMap.set(varName, { ...a });
        }
      }
      if (data.lookups && Array.isArray(data.lookups.transactionLine)) {
        for (const a of data.lookups.transactionLine) {
          if (!a) continue;
          const varName = a.variableName || a.name || a.id;
          if (!varName) continue;
          if (lineMap.has(varName)) {
            const existing = lineMap.get(varName);
            lineMap.set(varName, {
              ...existing,
              ...a,
              menuOptions: existing.menuOptions || existing.menuItems || a.menuOptions || a.availableElements,
              description: existing.description || a.description,
            });
          } else {
            lineMap.set(varName, { ...a });
          }
        }
      }
      const lineAttrs = Array.from(lineMap.values()).map(a => pruneAttribute(a, "Line Item"));

      // 3. Array sets: Merge data.arraySets and data.lookups.arraySets
      const arraySetMap = new Map();
      if (Array.isArray(data.arraySets)) {
        for (const a of data.arraySets) {
          if (!a) continue;
          const varName = a.variableName || a.name || a.id;
          if (varName) arraySetMap.set(varName, { ...a });
        }
      }
      if (data.lookups && Array.isArray(data.lookups.arraySets)) {
        for (const a of data.lookups.arraySets) {
          if (!a) continue;
          const varName = a.variableName || a.name || a.id;
          if (!varName) continue;
          if (arraySetMap.has(varName)) {
            const existing = arraySetMap.get(varName);
            arraySetMap.set(varName, { ...existing, ...a });
          } else {
            arraySetMap.set(varName, { ...a });
          }
        }
      }
      const arraySets = Array.from(arraySetMap.values()).map(a => pruneAttribute(a, "Array Set"));

      const targetProc = data.process || (configSettings && configSettings.commerceProcess) || "oraclecpqo";
      const targetProcDir = path.join(commDir, targetProc);
      fs.mkdirSync(targetProcDir, { recursive: true });

      if (txnAttrs.length > 0 || lineAttrs.length > 0 || arraySets.length > 0) {
        fs.writeFileSync(
          path.join(targetProcDir, "attributes.min.json"),
          JSON.stringify({
            updatedAt: new Date().toISOString(),
            process: targetProc,
            count: txnAttrs.length + lineAttrs.length,
            attributes: txnAttrs,
            items: txnAttrs,
            lineAttributes: lineAttrs,
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

      if (data.lookups && data.lookups.custom && typeof data.lookups.custom === "object") {
        for (const [cProc, cAttrs] of Object.entries(data.lookups.custom)) {
          if (Array.isArray(cAttrs) && cAttrs.length > 0 && cProc !== targetProc) {
            const cProcDir = path.join(commDir, cProc);
            fs.mkdirSync(cProcDir, { recursive: true });
            const prunedCustom = cAttrs.map(a => pruneAttribute(a, "Transaction"));
            fs.writeFileSync(
              path.join(cProcDir, "attributes.min.json"),
              JSON.stringify({
                process: cProc,
                updatedAt: new Date().toISOString(),
                count: prunedCustom.length,
                attributes: prunedCustom,
                items: prunedCustom,
                lookups: { transaction: prunedCustom },
              }),
              "utf8",
            );
          }
        }
      }
    }

    // 2. Save system variables in system/variables.min.json
    const sysDir = path.join(storageDir, SYSTEM_DIR);
    fs.mkdirSync(sysDir, { recursive: true });

    const sysMap = new Map();
    if (Array.isArray(data.systemAttributes)) {
      for (const a of data.systemAttributes) {
        if (!a) continue;
        const varName = a.variableName || a.name || a.id;
        if (varName) sysMap.set(varName, { ...a });
      }
    }
    if (data.lookups && Array.isArray(data.lookups.systemVariables)) {
      for (const a of data.lookups.systemVariables) {
        if (!a) continue;
        const varName = a.variableName || a.name || a.id;
        if (!varName) continue;
        if (sysMap.has(varName)) {
          const existing = sysMap.get(varName);
          sysMap.set(varName, {
            ...existing,
            ...a,
            description: existing.description || a.description,
          });
        } else {
          sysMap.set(varName, { ...a });
        }
      }
    }
    const sysItems = Array.from(sysMap.values()).map(a => pruneAttribute(a, "System"));
    if (sysItems.length > 0) {
      fs.writeFileSync(
        path.join(sysDir, "variables.min.json"),
        JSON.stringify({
          lookupType: "systemVariables",
          count: sysItems.length,
          items: sysItems,
          attributes: sysItems,
        }),
        "utf8",
      );
    }

    // 3. Save configuration metadata in config/<productFamily>/attributes.min.json
    const cfgDir = path.join(storageDir, CONFIG_DIR);
    fs.mkdirSync(cfgDir, { recursive: true });

    const hasConfigAttrs =
      Array.isArray(data.configAttributes) && data.configAttributes.length > 0;
    const hasProductFamilies =
      Array.isArray(data.productFamilies) && data.productFamilies.length > 0;
    const hasModels =
      Array.isArray(data.models) && data.models.length > 0;

    if (hasConfigAttrs || hasProductFamilies || hasModels) {
      const byFamily = new Map();
      const generalAttrs = [];

      if (hasConfigAttrs) {
        for (const a of data.configAttributes) {
          const pruned = pruneAttribute(a, "Configuration");
          if (!pruned) continue;
          const fam = pruned.productFamily;
          if (fam) {
            if (!byFamily.has(fam)) byFamily.set(fam, []);
            byFamily.get(fam).push(pruned);
          } else {
            generalAttrs.push(pruned);
          }
        }
      }

      for (const [fam, famAttrs] of byFamily.entries()) {
        const famDir = path.join(cfgDir, fam);
        fs.mkdirSync(famDir, { recursive: true });
        fs.writeFileSync(
          path.join(famDir, "attributes.min.json"),
          JSON.stringify({
            productFamily: fam,
            updatedAt: new Date().toISOString(),
            count: famAttrs.length,
            attributes: famAttrs,
            items: famAttrs,
          }),
          "utf8",
        );
      }

      if (generalAttrs.length > 0 || hasProductFamilies || hasModels) {
        fs.writeFileSync(
          path.join(cfgDir, "general.attributes.min.json"),
          JSON.stringify({
            updatedAt: new Date().toISOString(),
            count: generalAttrs.length,
            productFamilies: hasProductFamilies ? data.productFamilies : [],
            models: hasModels ? data.models : [],
            attributes: generalAttrs,
            items: generalAttrs,
          }),
          "utf8",
        );
      }
    }

    // Clean up any legacy flat files directly in storageDir to prevent monolithic duplicates
    const legacyFlatFiles = [
      COMMERCE_ATTRS_FILE,
      CONFIG_ATTRS_FILE,
      SYSTEM_ATTRS_FILE,
      "commerce.attributes.json",
      "config.attributes.json",
      "system.attributes.json",
    ];
    for (const lf of legacyFlatFiles) {
      const lp = path.join(storageDir, lf);
      if (fs.existsSync(lp)) {
        try { fs.unlinkSync(lp); } catch (e) {}
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
