const vscode = require("vscode");

function getDeclaredVariables(cleanText, doc) {
  const declaredVars = new Map(); // varName -> Array of { index, range, isLoopVar }

  // 1. Find all assignments: varName =
  const varDeclRegex = /\b([a-zA-Z_]\w*)\s*=(?!=)/g;
  let match;
  while ((match = varDeclRegex.exec(cleanText)) !== null) {
    const varName = match[1];
    const matchIndex = match.index;

    // Filter out operators like <=, >=, !=, <>
    let idx = matchIndex - 1;
    while (idx >= 0 && cleanText.charCodeAt(idx) <= 32) {
      idx--;
    }
    if (
      idx >= 0 &&
      (cleanText.charCodeAt(idx) === 60 || // '<'
        cleanText.charCodeAt(idx) === 62 || // '>'
        cleanText.charCodeAt(idx) === 33) // '!'
    ) {
      continue;
    }

    if (!declaredVars.has(varName)) {
      declaredVars.set(varName, []);
    }
    declaredVars.get(varName).push({
      index: matchIndex,
      get range() {
        const startPos = doc.positionAt(matchIndex);
        return new vscode.Range(
          startPos,
          startPos.translate(0, varName.length),
        );
      },
      isLoopVar: false,
    });
  }

  // 2. Find all loop variables: for varName in ...
  const loopRegex = /\bfor\s+([a-zA-Z_]\w*)\s+in\s+/gi;
  while ((match = loopRegex.exec(cleanText)) !== null) {
    const varName = match[1];
    const matchIndex = match.index + match[0].indexOf(varName);

    if (!declaredVars.has(varName)) {
      declaredVars.set(varName, []);
    }
    declaredVars.get(varName).push({
      index: matchIndex,
      get range() {
        const startPos = doc.positionAt(matchIndex);
        return new vscode.Range(
          startPos,
          startPos.translate(0, varName.length),
        );
      },
      isLoopVar: true,
    });
  }

  return declaredVars;
}

const IGNORED_EXACT_NAMES = new Set([
  "dummy", "temp", "unused", "commerce", "util", "cpqjs", "cpqjsready",
  "transaction", "line", "transactionline", "each", "item", "record", "rec", "row", "key"
]);

function isActionBmqlAssignment(cleanText, declIndex) {
  if (!cleanText || declIndex < 0) return false;
  const rhs = cleanText.slice(declIndex, Math.min(cleanText.length, declIndex + 200));
  return /=\s*bmql\s*\(\s*["']\s*(?:UPDATE|MODIFY|INSERT|DELETE)\b/i.test(rhs);
}

function checkVariableDiagnostics(
  noStringsText,
  declaredVars,
  doc,
  cleanText = noStringsText,
  passedVscode,
) {
  const diagnostics = [];
  const vs = passedVscode || vscode;

  const occurrencesByName = new Map();
  const identRegex = /\b[a-zA-Z_]\w*\b/g;
  let identMatch;
  while ((identMatch = identRegex.exec(noStringsText)) !== null) {
    const name = identMatch[0];
    if (!declaredVars.has(name)) continue;
    const idx = identMatch.index;
    let before = idx - 1;
    while (before >= 0 && noStringsText.charCodeAt(before) <= 32) before--;
    if (before >= 0 && noStringsText.charCodeAt(before) === 46) continue; // '.'
    if (!occurrencesByName.has(name)) occurrencesByName.set(name, []);
    occurrencesByName.get(name).push(idx);
  }

  if (cleanText && (cleanText.includes('$') || /bmql/i.test(cleanText))) {
    const bmqlVarRegex = /\$\{?([a-zA-Z_]\w*)\}?\b/g;
    let bmqlMatch;
    while ((bmqlMatch = bmqlVarRegex.exec(cleanText)) !== null) {
      const name = bmqlMatch[1];
      if (!declaredVars.has(name)) continue;
      const idx = bmqlMatch.index + 1;
      if (!occurrencesByName.has(name)) occurrencesByName.set(name, []);
      occurrencesByName.get(name).push(idx);
    }
  }

  declaredVars.forEach((decls, varName) => {
    const occurrences = occurrencesByName.get(varName) || [];
    // Fast path: if occurrences count exceeds declaration count, the variable is definitely referenced
    let isUsed = occurrences.length > decls.length;
    if (!isUsed) {
      decls.sort((a, b) => a.index - b.index);
      const declIndices = new Set(decls.map((d) => d.index));
      isUsed = occurrences.some((index) => !declIndices.has(index));
    }

    if (!isUsed) {
      const isOnlyLoopVar = decls.every((d) => d.isLoopVar);
      if (isOnlyLoopVar) {
        // Loop variables in for-in loops (e.g. for each in rangeArray) are part of
        // loop iteration syntax and are treated as used even if unreferenced in body.
        return;
      }

      const firstDecl = decls[0];
      if (isActionBmqlAssignment(cleanText, firstDecl.index)) {
        // Action BMQL queries (UPDATE, MODIFY, INSERT, DELETE) require assignment in BML syntax
        // but their return value is rarely consumed.
        return;
      }

      const lower = varName.toLowerCase();
      const isIgnoredUnused =
        IGNORED_EXACT_NAMES.has(lower) ||
        lower.startsWith("trigger_") ||
        lower.startsWith("_") ||
        lower.endsWith("_c") ||
        lower.endsWith("_t") ||
        lower.endsWith("_l");
      if (isIgnoredUnused) {
        return;
      }

      const startPos = doc.positionAt(firstDecl.index);
      const endPos = startPos.translate(0, varName.length);
      const range = new vs.Range(startPos, endPos);

      const diag = new vs.Diagnostic(
        range,
        `Unused variable: ${varName}`,
        vs.DiagnosticSeverity.Hint,
      );
      diag.code = "bml-unused-variable";
      if (vs.DiagnosticTag && vs.DiagnosticTag.Unnecessary) diag.tags = [vs.DiagnosticTag.Unnecessary];
      diagnostics.push(diag);
    }
  });

  return diagnostics;
}

module.exports = { getDeclaredVariables, checkVariableDiagnostics };
