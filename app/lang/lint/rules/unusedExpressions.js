const BARE_COMPARISON =
  /^([a-zA-Z_][\w.]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|-?\d+(?:\.\d+)?)\s*(==|<>|!=|<=|>=|<|>)\s*([a-zA-Z_][\w.]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|-?\d+(?:\.\d+)?)$/;

const LEADING_KEYWORD = /^(if|elif|else|for|return|break|continue)\b/i;

// Built-in procedures and functions in Oracle CPQ BML that are valid as standalone statements
// because they mutate arguments in-place or perform system/session/transaction/database actions.
const ALLOWED_PROCEDURES = new Set([
  // Array mutations
  "append",
  "remove",
  "sort",
  "reverse",
  // Dict mutations
  "put",
  // JSON mutations
  "jsonput",
  "jsonremove",
  "jsonarrayappend",
  "jsonarrayremove",
  "jsonpathset",
  "jsonpathremove",
  // StringBuilder mutations
  "sbappend",
  // System / Session / Error
  "throwerror",
  "logtime",
  "usersessionset",
  "usersessionremove",
  "globaldictset",
  "globaldictremove",
  "setattributevalue",
  "importtransactiondata",
  // Transaction / BOM mutations
  "addtotransaction",
  "addpartstotransaction",
  "applybom",
  "applytemplate",
  "savebom",
  "saveconfigbom",
  "calculateconfiguration",
  "calculatedeltabom",
  "configureabo",
  "validatequoteforagreement",
  // HTTP Web service invocations (can be invoked without reading return value)
  "urldata",
  "urldatabyget",
  "urldatabypost",
  "urldatabypostasync",
  "urlmultipartbypost",
  "invoke",
  // Database / BMQL execution
  "bmql",
]);

function hasTopLevelAssignment(code) {
  let parenDepth = 0;
  let bracketDepth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (ch === "\\") {
      i++;
      continue;
    }
    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }
    if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }
    if (inSingleQuote || inDoubleQuote) continue;

    if (ch === "(") {
      parenDepth++;
      continue;
    }
    if (ch === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }
    if (ch === "[") {
      bracketDepth++;
      continue;
    }
    if (ch === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }

    if (parenDepth === 0 && bracketDepth === 0) {
      if (ch === "=") {
        let prev = i - 1;
        while (prev >= 0 && /\s/.test(code[prev])) prev--;
        const prevChar = prev >= 0 ? code[prev] : "";
        const nextChar = i + 1 < code.length ? code[i + 1] : "";

        if (
          prevChar !== "!" &&
          prevChar !== "<" &&
          prevChar !== ">" &&
          prevChar !== "=" &&
          prevChar !== "+" &&
          prevChar !== "-" &&
          prevChar !== "*" &&
          prevChar !== "/" &&
          prevChar !== "%" &&
          nextChar !== "="
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Flags standalone expressions and non-void function calls without assignment
 * (e.g. `integer(12.2);`, `x == 5;`, `atof("1.0");`).
 * In Oracle CPQ BML, statements must be assignments, control flow, print statements,
 * or procedure calls. Expressions returning a value must be assigned to a variable.
 */
function checkUnusedExpressions(cleanText, doc, vscode) {
  const diagnostics = [];
  let lastEnd = 0;
  let depth = 0;
  let arrayBraceDepth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < cleanText.length; i++) {
    const ch = cleanText[i];
    if (ch === "\\") {
      i++;
      continue;
    }
    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }
    if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }
    if (inSingleQuote || inDoubleQuote) continue;

    if (ch === "(" || ch === "[") {
      depth++;
      continue;
    }
    if (ch === ")" || ch === "]") {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (depth === 0) {
      if (ch === "{") {
        let prev = i - 1;
        while (prev >= 0 && /\s/.test(cleanText[prev])) prev--;
        if (prev >= 0 && cleanText[prev] === "]") {
          arrayBraceDepth++;
        } else {
          lastEnd = i + 1;
        }
        continue;
      }
      if (ch === "}") {
        if (arrayBraceDepth > 0) {
          arrayBraceDepth--;
        } else {
          lastEnd = i + 1;
        }
        continue;
      }
      if (ch === ";" && arrayBraceDepth === 0) {
        const stmt = cleanText.slice(lastEnd, i);
        const trimmed = stmt.trim();

        if (trimmed) {
          if (
            !LEADING_KEYWORD.test(trimmed) &&
            !/^print\b/i.test(trimmed) &&
            !hasTopLevelAssignment(trimmed) &&
            !/^(util|commerce|cpqjs)\.[a-zA-Z_]\w*\s*\(/i.test(trimmed)
          ) {
            const callMatch = trimmed.match(/^([a-zA-Z_]\w*)\s*\(/);
            if (
              callMatch &&
              ALLOWED_PROCEDURES.has(callMatch[1].toLowerCase())
            ) {
              // Valid procedure call (e.g. append, put, throwerror)
            } else {
              const stmtStart = lastEnd + stmt.indexOf(trimmed);
              const startPos = doc.positionAt(stmtStart);
              const endPos = doc.positionAt(stmtStart + trimmed.length);

              let message;
              if (callMatch) {
                message = `Statement has no effect: function '${callMatch[1]}' returns a value and must be assigned to a variable (e.g. 'test = ${trimmed};') or used in an expression.`;
              } else if (BARE_COMPARISON.test(trimmed)) {
                message = `Expression has no effect: this is just a comparison, not an assignment or condition - did you mean '=' or wrap it in 'if'?`;
              } else {
                message = `Statement has no effect: expression '${trimmed}' must be assigned to a variable or part of a valid statement.`;
              }

              const diag = new vscode.Diagnostic(
                new vscode.Range(startPos, endPos),
                message,
                vscode.DiagnosticSeverity.Error,
              );
              diag.code = "bml-unused-expression";
              diagnostics.push(diag);
            }
          }
        }
        lastEnd = i + 1;
      }
    }
  }

  return diagnostics;
}

module.exports = {
  checkUnusedExpressions,
  BARE_COMPARISON,
  ALLOWED_PROCEDURES,
  hasTopLevelAssignment,
};
