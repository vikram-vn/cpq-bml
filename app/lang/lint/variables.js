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
    while (idx >= 0 && /\s/.test(cleanText[idx])) {
      idx--;
    }
    if (
      idx >= 0 &&
      (cleanText[idx] === "<" ||
        cleanText[idx] === ">" ||
        cleanText[idx] === "!")
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

function checkVariableDiagnostics(
  noStringsText,
  declaredVars,
  doc,
  cleanText = noStringsText,
) {
  const diagnostics = [];

  // Find all blocks { ... } to help with shadowing
  const blocks = [];
  const stack = [];
  for (let i = 0; i < noStringsText.length; i++) {
    if (noStringsText[i] === "{") {
      stack.push({ start: i });
    } else if (noStringsText[i] === "}") {
      if (stack.length > 0) {
        const block = stack.pop();
        block.end = i + 1;
        blocks.push(block);
      }
    }
  }

  const occurrencesByName = new Map();
  const identRegex = /\b[a-zA-Z_]\w*\b/g;
  let identMatch;
  while ((identMatch = identRegex.exec(noStringsText)) !== null) {
    const idx = identMatch.index;
    let before = idx - 1;
    while (before >= 0 && /\s/.test(noStringsText[before])) before--;
    if (before >= 0 && noStringsText[before] === ".") continue;
    const name = identMatch[0];
    if (!occurrencesByName.has(name)) occurrencesByName.set(name, []);
    occurrencesByName.get(name).push(idx);
  }

  if (cleanText) {
    const bmqlVarRegex = /\$([a-zA-Z_]\w*)\b/g;
    let bmqlMatch;
    while ((bmqlMatch = bmqlVarRegex.exec(cleanText)) !== null) {
      const name = bmqlMatch[1];
      const idx = bmqlMatch.index + 1;
      if (!occurrencesByName.has(name)) occurrencesByName.set(name, []);
      occurrencesByName.get(name).push(idx);
    }
  }

  declaredVars.forEach((decls, varName) => {
    decls.sort((a, b) => a.index - b.index);

    const declIndices = new Set(decls.map((d) => d.index));
    const occurrences = occurrencesByName.get(varName) || [];
    const isUsed = occurrences.some((index) => !declIndices.has(index));

    if (!isUsed) {
      const isIgnoredUnused =
        varName.toLowerCase() === "dummy" ||
        varName.toLowerCase() === "temp" ||
        varName.toLowerCase().startsWith("trigger_") ||
        varName.toLowerCase() === "unused" ||
        varName.toLowerCase() === "commerce" ||
        varName.toLowerCase() === "util" ||
        varName.toLowerCase() === "transaction" ||
        varName.toLowerCase() === "line" ||
        varName.toLowerCase().startsWith("_") ||
        varName.toLowerCase().endsWith("_c") ||
        varName.toLowerCase().endsWith("_t") ||
        varName.toLowerCase().endsWith("_l");
      if (isIgnoredUnused) {
        return;
      }

      const firstDecl = decls[0];
      const isOnlyLoopVar = decls.every((d) => d.isLoopVar);
      const startPos = doc.positionAt(firstDecl.index);
      const endPos = startPos.translate(0, varName.length);
      const range = new vscode.Range(startPos, endPos);

      if (isOnlyLoopVar) {
        const diag = new vscode.Diagnostic(
          range,
          `Unused loop variable: '${varName}' is never referenced inside its loop body.`,
          vscode.DiagnosticSeverity.Information,
        );
        diag.code = "bml-unused-loop-var";
        diag.tags = [vscode.DiagnosticTag.Unnecessary];
        diagnostics.push(diag);
      } else {
        const diag = new vscode.Diagnostic(
          range,
          `Unused variable: ${varName}`,
          vscode.DiagnosticSeverity.Hint,
        );
        diag.code = "bml-unused-variable";
        diag.tags = [vscode.DiagnosticTag.Unnecessary];
        diagnostics.push(diag);
      }
    }
  });

  return diagnostics;
}

module.exports = { getDeclaredVariables, checkVariableDiagnostics };
