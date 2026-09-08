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

function saveWorkspaceAttributes(workspaceRoot, data, configSettings, onCacheInvalidated) {
  if (!workspaceRoot || !data) return;

  try {
    const cpqDir = path.join(workspaceRoot, CPQ_DIR);
    const commerceDir = path.join(cpqDir, COMMERCE_DIR);
    const systemDir = path.join(cpqDir, SYSTEM_DIR);
    const configDir = path.join(cpqDir, CONFIG_DIR);

    fs.mkdirSync(commerceDir, { recursive: true });
    fs.mkdirSync(systemDir, { recursive: true });
    fs.mkdirSync(configDir, { recursive: true });

    // Always write and keep README.md fresh on sync
    const readmePath = path.join(cpqDir, "README.md");
    fs.writeFileSync(readmePath, README_CPQ, "utf8");

    // 1. Save consolidated single transaction JSON in .cpq/commerce/transaction.min.json
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
        updatedAt: ct.updatedAt,
        processes: ct.processes,
        standardCounts: ct.standardCounts,
        customCounts: ct.customCounts,
        count: ct.count || ((prunedLookups.transaction?.length || 0) + (prunedLookups.transactionLine?.length || 0)),
        lookups: prunedLookups
      };
      fs.writeFileSync(
        path.join(commerceDir, "transaction.min.json"),
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
      if (txnAttrs.length > 0) {
        fs.writeFileSync(
          path.join(commerceDir, "transaction.min.json"),
          JSON.stringify({
            process: (configSettings && configSettings.commerceProcess) || "oraclecpqo",
            document: "transaction",
            count: txnAttrs.length,
            attributes: txnAttrs,
            items: txnAttrs,
          }),
          "utf8",
        );
      }
    }

    // Clean up obsolete commerce/attributes.min.json if present
    const obsoleteAttr = path.join(commerceDir, "attributes.min.json");
    if (fs.existsSync(obsoleteAttr)) {
      try {
        fs.unlinkSync(obsoleteAttr);
      } catch (e) {}
    }

    // 2. Save line item attributes in .cpq/commerce/transaction-line.min.json
    const rawLineAttrs =
      data.lookups &&
      Array.isArray(data.lookups.transactionLine) &&
      data.lookups.transactionLine.length > 0
        ? data.lookups.transactionLine
        : [];
    const lineAttrs = rawLineAttrs.map(a => pruneAttribute(a, "Line Item"));
    if (lineAttrs.length > 0) {
      fs.writeFileSync(
        path.join(commerceDir, "transaction-line.min.json"),
        JSON.stringify({
          process: (configSettings && configSettings.commerceProcess) || "oraclecpqo",
          document: "transactionLine",
          count: lineAttrs.length,
          attributes: lineAttrs,
        }),
        "utf8",
      );
    }

    // 3. Save array sets in .cpq/commerce/array-sets.min.json
    const rawArraySets =
      Array.isArray(data.arraySets) && data.arraySets.length > 0
        ? data.arraySets
        : data.lookups &&
            Array.isArray(data.lookups.arraySets) &&
            data.lookups.arraySets.length > 0
          ? data.lookups.arraySets
          : [];
    const arraySets = rawArraySets.map(a => pruneAttribute(a, "Array Set"));
    if (arraySets.length > 0) {
      fs.writeFileSync(
        path.join(commerceDir, "array-sets.min.json"),
        JSON.stringify({
          process: (configSettings && configSettings.commerceProcess) || "oraclecpqo",
          count: arraySets.length,
          items: arraySets,
        }),
        "utf8",
      );
    }

    // 4. Save processes list in .cpq/commerce/processes.min.json if available
    if (Array.isArray(data.processes) && data.processes.length > 0) {
      fs.writeFileSync(
        path.join(commerceDir, "processes.min.json"),
        JSON.stringify({
          count: data.processes.length,
          items: data.processes,
        }),
        "utf8",
      );
    }

    // 5. Save system variables in .cpq/system/variables.min.json
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
      const configAttrs = data.configAttributes.map(a => pruneAttribute(a, "Configuration"));
      fs.writeFileSync(
        path.join(configDir, "attributes.min.json"),
        JSON.stringify({
          count: configAttrs.length,
          attributes: configAttrs,
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

    if (typeof onCacheInvalidated === "function") {
      onCacheInvalidated(workspaceRoot);
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
  README_CPQ,
  saveWorkspaceAttributes,
};
