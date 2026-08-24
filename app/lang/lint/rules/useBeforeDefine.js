const fs = require("fs");
const {
  keywords: reservedWords,
  loadBuiltInFunctions,
} = require("./functions");
const { loadSystemVariables } = require("./systemVariables");
const { getAttributeScope } = require("./commerceAttributes");
const { levenshtein } = require("../core/levenshtein");

// Commerce functions have implicit platform bindings (document attributes, etc.)
// this rule can't see from the file's text, so it only runs for util functions
// or for non-commerce attribute symbols.
function isCommerceFunction(metadata) {
  return !!(metadata && metadata.commerceDocument);
}

const _metaGatingCache = new Map();
function readLocalMetadataForGating(bmlFilePath) {
  if (!bmlFilePath) return null;
  if (_metaGatingCache.has(bmlFilePath))
    return _metaGatingCache.get(bmlFilePath);
  try {
    const metaPath = bmlFilePath.replace(/\.bml$/i, "-meta.json");
    if (!fs.existsSync(metaPath)) {
      _metaGatingCache.set(bmlFilePath, null);
      return null;
    }
    const data = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    _metaGatingCache.set(bmlFilePath, data);
    return data;
  } catch (e) {
    _metaGatingCache.set(bmlFilePath, null);
    return null;
  }
}

/**
 * Returns the character index immediately following the end of the statement containing declIndex.
 */
function getStatementEndIndex(noStringsText, declIndex) {
  const semiIdx = noStringsText.indexOf(";", declIndex);
  const nlIdx = noStringsText.indexOf("\n", declIndex);
  if (semiIdx !== -1 && nlIdx !== -1) {
    return Math.min(semiIdx, nlIdx) + 1;
  }
  if (semiIdx !== -1) return semiIdx + 1;
  if (nlIdx !== -1) return nlIdx + 1;
  return noStringsText.length;
}

/**
 * Finds the closest declared variable name for fuzzy "Did you mean ...?" suggestions.
 */
function findClosestDeclaredVariable(name, declaredNames) {
  let minDistance = Infinity;
  let closest = null;
  const nameLower = name.toLowerCase();

  declaredNames.forEach((declName) => {
    const declLower = declName.toLowerCase();
    if (
      declLower.startsWith(nameLower) ||
      nameLower.startsWith(declLower) ||
      declLower.includes(nameLower) ||
      nameLower.includes(declLower)
    ) {
      const dist = levenshtein(nameLower, declLower);
      if (dist < minDistance) {
        minDistance = dist;
        closest = declName;
      }
    } else {
      const dist = levenshtein(nameLower, declLower);
      if (dist <= 3 && dist < minDistance) {
        minDistance = dist;
        closest = declName;
      }
    }
  });

  return closest;
}

function checkUseBeforeDefine(
  noStringsText,
  doc,
  vscode,
  declaredVars,
  extensionPath,
  cleanText = noStringsText,
) {
  const diagnostics = [];

  const systemVars = loadSystemVariables(extensionPath);
  const builtIns = loadBuiltInFunctions(extensionPath);

  const metadata = readLocalMetadataForGating(doc.uri && doc.uri.fsPath);
  const isCommerce = isCommerceFunction(metadata);

  const ignoredCache = new Map();
  const isIgnoredSymbol = (nameLower) => {
    const cached = ignoredCache.get(nameLower);
    if (cached !== undefined) return cached;

    let result = false;
    if (
      reservedWords.has(nameLower) ||
      systemVars.has(nameLower) ||
      builtIns.has(nameLower)
    ) {
      result = true;
    } else if (
      nameLower === "commerce" ||
      nameLower === "util" ||
      nameLower === "transaction" ||
      nameLower === "line" ||
      nameLower === "transactionline" ||
      nameLower === "cpqjs" ||
      nameLower === "cpqjsready" ||
      nameLower === "nan" ||
      nameLower === "jnan"
    ) {
      result = true;
    } else if (
      nameLower.startsWith("_") ||
      nameLower.startsWith("bm_") ||
      nameLower.startsWith("_c_") ||
      nameLower.startsWith("_t_") ||
      nameLower.startsWith("_l_")
    ) {
      result = true;
    } else if (
      nameLower.endsWith("_c") ||
      nameLower.endsWith("_t") ||
      nameLower.endsWith("_l")
    ) {
      result = true;
    } else if (isCommerce) {
      const attrScope = getAttributeScope(nameLower, extensionPath);
      if (attrScope !== "unknown") result = true;
    }

    ignoredCache.set(nameLower, result);
    return result;
  };

  const declaredNames = new Set();
  const earliestAvailableReadByName = new Map();
  const declSitesByName = new Map();
  const suggestionCache = new Map();

  declaredVars.forEach((decls, varName) => {
    declaredNames.add(varName);
    declSitesByName.set(varName, new Set(decls.map((d) => d.index)));

    const stmtEnds = decls.map((d) =>
      getStatementEndIndex(noStringsText, d.index),
    );
    earliestAvailableReadByName.set(varName, Math.min(...stmtEnds));
  });

  // 1. Bare code identifier references in noStringsText
  const identRegex = /\b([a-zA-Z_]\w*)\b/g;
  let match;
  while ((match = identRegex.exec(noStringsText)) !== null) {
    const name = match[1];
    const idx = match.index;

    // Fast path for valid declared variables that are already in scope
    const earliestAvailable = earliestAvailableReadByName.get(name);
    if (earliestAvailable !== undefined && earliestAvailable <= idx) {
      continue;
    }

    const nameLower = name.toLowerCase();
    if (isIgnoredSymbol(nameLower)) continue;

    // Dotted member/attribute access, not a bare variable read.
    let before = idx - 1;
    while (before >= 0 && noStringsText.charCodeAt(before) <= 32) before--;
    if (before >= 0 && noStringsText.charCodeAt(before) === 46) continue; // '.'

    // Function-call name, not a variable read.
    let after = idx + name.length;
    while (
      after < noStringsText.length &&
      noStringsText.charCodeAt(after) <= 32
    )
      after++;
    if (after < noStringsText.length && noStringsText.charCodeAt(after) === 40)
      continue; // '('

    // This occurrence is itself a declaration site (LHS), not a read.
    const sites = declSitesByName.get(name);
    if (sites && sites.has(idx)) continue;

    if (earliestAvailable !== undefined && earliestAvailable > idx) {
      const startPos = doc.positionAt(idx);
      const endPos = startPos.translate(0, name.length);
      const diag = new vscode.Diagnostic(
        new vscode.Range(startPos, endPos),
        `'${name}' is read here before its initial assignment statement completes - this will read an uninitialized value.`,
        vscode.DiagnosticSeverity.Warning,
      );
      diag.code = "bml-useBeforeDefine";
      diagnostics.push(diag);
    } else if (earliestAvailable === undefined) {
      const startPos = doc.positionAt(idx);
      const endPos = startPos.translate(0, name.length);
      let suggestion = suggestionCache.get(name);
      if (suggestion === undefined) {
        suggestion = findClosestDeclaredVariable(name, declaredNames);
        suggestionCache.set(name, suggestion);
      }
      const suggestionText = suggestion ? ` Did you mean '${suggestion}'?` : "";
      const diag = new vscode.Diagnostic(
        new vscode.Range(startPos, endPos),
        `'${name}' is read here but is never defined in this function.${suggestionText}`,
        vscode.DiagnosticSeverity.Warning,
      );
      diag.code = "bml-undeclared-variable";
      diagnostics.push(diag);
    }
  }

  // 2. BMQL dynamic variable references ($varName) inside string literals in cleanText
  if (cleanText && cleanText.includes("$")) {
    const bmqlVarRegex = /\$([a-zA-Z_]\w*)\b/g;
    let bmqlMatch;
    while ((bmqlMatch = bmqlVarRegex.exec(cleanText)) !== null) {
      const name = bmqlMatch[1];
      const idx = bmqlMatch.index + 1;

      const earliestAvailable = earliestAvailableReadByName.get(name);
      if (earliestAvailable !== undefined && earliestAvailable <= idx) continue;

      const nameLower = name.toLowerCase();
      if (isIgnoredSymbol(nameLower)) continue;

      const startPos = doc.positionAt(idx);
      const endPos = startPos.translate(0, name.length);

      if (earliestAvailable !== undefined && earliestAvailable > idx) {
        const diag = new vscode.Diagnostic(
          new vscode.Range(startPos, endPos),
          `'${name}' is referenced in BMQL query as '$${name}' here, but isn't assigned until later in this file.`,
          vscode.DiagnosticSeverity.Warning,
        );
        diag.code = "bml-useBeforeDefine";
        diagnostics.push(diag);
      } else if (earliestAvailable === undefined) {
        let suggestion = suggestionCache.get(name);
        if (suggestion === undefined) {
          suggestion = findClosestDeclaredVariable(name, declaredNames);
          suggestionCache.set(name, suggestion);
        }
        const suggestionText = suggestion
          ? ` Did you mean '${suggestion}'?`
          : "";
        const diag = new vscode.Diagnostic(
          new vscode.Range(startPos, endPos),
          `'${name}' is referenced in BMQL query as '$${name}' here, but variable '${name}' is never defined in this function.${suggestionText}`,
          vscode.DiagnosticSeverity.Warning,
        );
        diag.code = "bml-undeclared-variable";
        diagnostics.push(diag);
      }
    }
  }

  return diagnostics;
}

module.exports = { checkUseBeforeDefine, isCommerceFunction };
