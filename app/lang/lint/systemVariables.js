const fs = require("fs");
const path = require("path");
const { levenshtein } = require("./levenshtein");

let systemVariables = null; // Map<lowercaseName, canonicalName>

// __dirname is correct when this file is required directly (plain Node, as
// every test in this repo does) - but esbuild bundles this whole module into
// a single dist/extension.js, and at runtime __dirname for bundled code
// resolves to dist/, not this file's original folder, so a __dirname-relative
// path would resolve outside the repo entirely. extensionPath (threaded down
// from registerBmlLinter via lint.js, same convention as functions.js's
// loadBuiltInFunctions) is the anchor that stays correct regardless of
// bundling; __dirname remains the fallback for the plain-Node/test context.
function loadSystemVariables(extensionPath) {
  if (systemVariables) return systemVariables;
  systemVariables = new Map();
  try {
    const filePath = extensionPath
      ? path.join(
          extensionPath,
          "app",
          "lang",
          "intellisense",
          "bml_variables_api_usage.json",
        )
      : path.resolve(__dirname, "../intellisense/bml_variables_api_usage.json");
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (data) {
        Object.keys(data).forEach((lookupCode) => {
          systemVariables.set(lookupCode.toLowerCase(), lookupCode);
        });
      }
    }
  } catch (e) {
    // Fallback to empty map if the file can't be loaded
  }
  return systemVariables;
}

// Suggests a known system variable only when name is a near-exact typo of it
// (distance <= 2, similar length) - deliberately conservative since BML code
// commonly uses unrelated underscore-prefixed identifiers (commerce attribute
// names like _document_number, _chargeSet_discountAmount) that must never be
// flagged just because they start with an underscore too.
function findClosestSystemVariable(name, extensionPath) {
  const vars = loadSystemVariables(extensionPath);
  const nameLower = name.toLowerCase();
  if (vars.has(nameLower)) return null;

  let best = null;
  let bestDist = Infinity;
  for (const [lower, original] of vars.entries()) {
    if (Math.abs(lower.length - nameLower.length) > 3) continue;
    const dist = levenshtein(nameLower, lower);
    if (dist < bestDist) {
      bestDist = dist;
      best = original;
    }
  }
  return best && bestDist <= 2 ? best : null;
}

// Flags two things using Oracle's predefined CPQ system variable list:
// 1. Assigning to a known system variable (it's platform-provided/read-only;
//    "assigning" to it just creates an unrelated local shadow, silently).
// 2. A bare underscore-prefixed identifier that's a near-exact typo of one.
function checkSystemVariables(cleanText, doc, vscode, extensionPath) {
  const diagnostics = [];
  const vars = loadSystemVariables(extensionPath);
  if (vars.size === 0) return diagnostics;

  const identRegex = /\b(_[a-zA-Z][a-zA-Z0-9_]*)\b/g;
  let match;
  while ((match = identRegex.exec(cleanText)) !== null) {
    const name = match[1];
    const nameLower = name.toLowerCase();
    const matchIndex = match.index;

    // Skip property/attribute access (line._document_number) - only bare
    // references are ever genuine system-variable usages.
    let idx = matchIndex - 1;
    while (idx >= 0 && /\s/.test(cleanText[idx])) idx--;
    if (idx >= 0 && cleanText[idx] === ".") continue;

    const startPos = doc.positionAt(matchIndex);
    const endPos = startPos.translate(0, name.length);
    const range = new vscode.Range(startPos, endPos);

    if (vars.has(nameLower)) {
      let after = matchIndex + name.length;
      while (after < cleanText.length && /\s/.test(cleanText[after])) after++;
      const isAssignment =
        cleanText[after] === "=" && cleanText[after + 1] !== "=";
      if (isAssignment) {
        const diag = new vscode.Diagnostic(
          range,
          `'${name}' is a built-in CPQ system variable (read-only) - assigning to it has no effect on the platform-provided value.`,
          vscode.DiagnosticSeverity.Warning,
        );
        diag.code = "bml-system-variable-readonly";
        diagnostics.push(diag);
      }
    } else {
      const suggestion = findClosestSystemVariable(name, extensionPath);
      if (suggestion) {
        const diag = new vscode.Diagnostic(
          range,
          `Unknown CPQ system variable '${name}' - did you mean '${suggestion}'?`,
          vscode.DiagnosticSeverity.Information,
        );
        diag.code = "bml-system-variable-typo";
        diagnostics.push(diag);
      }
    }
  }

  return diagnostics;
}

module.exports = {
  checkSystemVariables,
  findClosestSystemVariable,
  loadSystemVariables,
};
