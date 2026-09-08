/**
 * Resolves CPQ attribute names, labels, menu item values, and MongoDB-style query filters.
 */

function createResolver({
  loadWorkspaceAttributes,
  loadBundledAttributes,
  normalizeKey,
  normalizeAttributeDataType,
}) {
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
          parsed = JSON.parse(trimmed);
        } catch (e) {
          try {
            const jsonLike = trimmed
              .replace(/'/g, '"')
              .replace(/([{,]\s*)([a-zA-Z0-9_$-]+)\s*:/g, '$1"$2":');
            parsed = JSON.parse(jsonLike);
          } catch (e2) {
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
            result[key] = transformNode(val);
          } else {
            const resolvedKey = resolveAttributeName(key, workspaceRoot);
            if (resolvedKey !== key) {
              changed = true;
            }

            if (val && typeof val === "object" && !Array.isArray(val)) {
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
   * Searches metadata for attributes matching a query string.
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

  return {
    resolveAttributeName,
    resolveMenuValue,
    resolveQueryFilter,
    searchAttributes,
  };
}

module.exports = { createResolver };
