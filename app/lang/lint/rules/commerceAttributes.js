const vscode = require("vscode");
const { loadJson } = require("../../intellisense/apiDataLoader");
const { makeDiagnostic } = require("../categories/best-practices/shared");

let attributesMap = null; // Map<lowercaseName, { canonicalName, scope }>

function loadAttributeMetadata(extensionPath) {
  if (attributesMap && attributesMap.size > 0) return attributesMap;
  attributesMap = new Map();
  try {
    const data = loadJson("bml-attributes-api-usage", extensionPath);
    if (data) {
      Object.entries(data).forEach(([key, val]) => {
        const scope = val.scope ? val.scope.toLowerCase() : "";
        attributesMap.set(key.toLowerCase(), {
          canonicalName: key,
          scope: scope.includes("line")
            ? "line"
            : scope.includes("transaction")
              ? "transaction"
              : "unknown",
        });
      });
    }
  } catch (e) {
    // Fallback to empty map
  }
  return attributesMap;
}

const _scopeCache = new Map();
function getAttributeScope(attrName, extensionPath) {
  const attrLower = attrName.toLowerCase();
  const cached = _scopeCache.get(attrLower);
  if (cached !== undefined) return cached;

  // Check naming convention suffix/prefix first
  if (attrLower.endsWith("_t") || attrLower.startsWith("_transaction_")) {
    _scopeCache.set(attrLower, "transaction");
    return "transaction";
  }
  if (attrLower.endsWith("_l") || attrLower.startsWith("_line_")) {
    _scopeCache.set(attrLower, "line");
    return "line";
  }

  // Fall back to bml-attributes-api-usage lookup table
  const metaMap = loadAttributeMetadata(extensionPath);
  if (metaMap.has(attrLower)) {
    const entry = metaMap.get(attrLower);
    if (entry.scope !== "unknown") {
      _scopeCache.set(attrLower, entry.scope);
      return entry.scope;
    }
  }

  _scopeCache.set(attrLower, "unknown");
  return "unknown";
}

/**
 * Commerce Attribute Scope Checker
 * Differentiates between transaction.<attr> (Header Level) and line.<attr> (Line Item Level)
 * Code: bml-commerce-attribute-scope-mismatch
 */
function checkCommerceAttributes(
  cleanText,
  noStringsText,
  doc,
  vscodeModule,
  extensionPath,
) {
  const diagnostics = [];

  // Extract loop variable names bound to line items or transactions
  const lineLoopVars = new Set();
  const transactionLoopVars = new Set();

  const forLoopRegex = /\bfor\s+([a-zA-Z_]\w*)\s+in\s+([a-zA-Z_]\w*)\b/gi;
  let forMatch;
  while ((forMatch = forLoopRegex.exec(noStringsText)) !== null) {
    const loopVar = forMatch[1].toLowerCase();
    const collectionVar = forMatch[2].toLowerCase();

    // Line item collections: _line_items, line_items, lineArray, lineDict, etc.
    if (
      collectionVar === "_line_items" ||
      collectionVar === "line_items" ||
      collectionVar === "_lines" ||
      collectionVar === "lines" ||
      collectionVar.includes("lineitem") ||
      collectionVar.includes("line_item") ||
      collectionVar.includes("transactionline") ||
      collectionVar.includes("transaction_line") ||
      collectionVar.includes("linearray") ||
      collectionVar.includes("line_array") ||
      collectionVar.includes("linedict") ||
      collectionVar.includes("line_dict") ||
      collectionVar.includes("linelist") ||
      collectionVar.includes("line_list")
    ) {
      lineLoopVars.add(loopVar);
    } else if (
      (collectionVar.includes("transaction") ||
        collectionVar.includes("header") ||
        collectionVar.includes("quote")) &&
      !collectionVar.includes("line")
    ) {
      transactionLoopVars.add(loopVar);
    }
  }

  // Pattern 1: get(varName, "attribute_name")
  const getCallRegex =
    /\bget\s*\(\s*([a-zA-Z_]\w*)\s*,\s*["']([a-zA-Z0-9_]+)["']\s*\)/g;
  let match;

  while ((match = getCallRegex.exec(cleanText)) !== null) {
    const varName = match[1];
    const attrName = match[2];
    const varLower = varName.toLowerCase();
    const attrScope = getAttributeScope(attrName, extensionPath);

    if (attrScope === "unknown") continue;

    // Determine object scope (transaction vs line)
    const isTransactionVar =
      transactionLoopVars.has(varLower) ||
      [
        "transaction",
        "transactionrow",
        "trans",
        "transrecord",
        "header",
        "quote",
        "parentrecord",
      ].includes(varLower) ||
      (varLower.includes("transaction") && !varLower.includes("line"));
    const isLineVar =
      lineLoopVars.has(varLower) ||
      ["line", "linerow", "lineitem", "linerecord", "row", "item"].includes(
        varLower,
      ) ||
      (varLower.includes("line") &&
        !varLower.includes("items") &&
        !varLower.includes("array") &&
        !varLower.includes("list"));

    if (isTransactionVar && attrScope === "line") {
      const startPos = doc.positionAt(match.index);
      const endPos = doc.positionAt(match.index + match[0].length);
      diagnostics.push(
        makeDiagnostic(
          new vscode.Range(startPos, endPos),
          `Commerce Attribute Scope Error: '${attrName}' is a Line Item level attribute, but is accessed on Transaction object '${varName}'. Line-level attributes must be read from line items inside _line_items.`,
          vscode.DiagnosticSeverity.Warning,
          "bml-commerce-attribute-scope-mismatch",
        ),
      );
    }
  }

  // Pattern 2: Dot notation obj.attrName
  const dotAccessRegex = /\b([a-zA-Z_]\w*)\.([a-zA-Z0-9_]+)\b/g;
  while ((match = dotAccessRegex.exec(noStringsText)) !== null) {
    const varName = match[1];
    const attrName = match[2];
    const varLower = varName.toLowerCase();

    // Skip keywords, system objects like CPQJS, util, dict, json, etc.
    if (
      ["util", "cpqjs", "math", "json", "dict", "bmql", "string"].includes(
        varLower,
      )
    )
      continue;

    const attrScope = getAttributeScope(attrName, extensionPath);
    if (attrScope === "unknown") continue;

    const isTransactionVar =
      transactionLoopVars.has(varLower) ||
      [
        "transaction",
        "transactionrow",
        "trans",
        "transrecord",
        "header",
        "quote",
        "parentrecord",
      ].includes(varLower) ||
      (varLower.includes("transaction") && !varLower.includes("line"));

    if (isTransactionVar && attrScope === "line") {
      const startPos = doc.positionAt(match.index);
      const endPos = doc.positionAt(match.index + match[0].length);
      diagnostics.push(
        makeDiagnostic(
          new vscode.Range(startPos, endPos),
          `Commerce Attribute Scope Error: '${attrName}' is a Line Item level attribute, but is accessed on Transaction object '${varName}'. Line-level attributes must be read from line items inside _line_items.`,
          vscode.DiagnosticSeverity.Warning,
          "bml-commerce-attribute-scope-mismatch",
        ),
      );
    }
  }

  return diagnostics;
}

module.exports = { checkCommerceAttributes, getAttributeScope };
