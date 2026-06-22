// Excludes function calls deliberately - `isnumber(x) == true;` could plausibly be
// intentionally discarding a side-effect-free result, unlike a bare comparison.
const BARE_COMPARISON = /^([a-zA-Z_][\w.]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|-?\d+(?:\.\d+)?)\s*(==|<>|!=|<=|>=|<|>)\s*([a-zA-Z_][\w.]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|-?\d+(?:\.\d+)?)$/;

const LEADING_KEYWORD = /^(if|elif|else|for|return|break|continue)\b/i;

// Flags a standalone comparison statement with no assignment/call - almost always a
// typo for '=' or a forgotten 'if'.
function checkUnusedExpressions(cleanText, doc, vscode) {
    const diagnostics = [];
    let lastEnd = 0;
    let depth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;

    for (let i = 0; i < cleanText.length; i++) {
        const ch = cleanText[i];
        if (ch === '\\') { i++; continue; }
        if (ch === "'" && !inDoubleQuote) { inSingleQuote = !inSingleQuote; continue; }
        if (ch === '"' && !inSingleQuote) { inDoubleQuote = !inDoubleQuote; continue; }
        if (inSingleQuote || inDoubleQuote) continue;

        if (ch === '(' || ch === '[' || ch === '{') { depth++; continue; }
        if (ch === ')' || ch === ']' || ch === '}') { depth = Math.max(0, depth - 1); continue; }
        if (ch === ';' && depth === 0) {
            const stmt = cleanText.slice(lastEnd, i);
            const trimmed = stmt.trim();

            if (trimmed && !LEADING_KEYWORD.test(trimmed) && BARE_COMPARISON.test(trimmed)) {
                const stmtStart = lastEnd + stmt.indexOf(trimmed);
                const startPos = doc.positionAt(stmtStart);
                const endPos = doc.positionAt(stmtStart + trimmed.length);
                const diag = new vscode.Diagnostic(
                    new vscode.Range(startPos, endPos),
                    `Expression has no effect: this is just a comparison, not an assignment or condition - did you mean '=' or wrap it in 'if'?`,
                    vscode.DiagnosticSeverity.Warning
                );
                diag.code = 'bml-unused-expression';
                diagnostics.push(diag);
            }
            lastEnd = i + 1;
        }
    }

    return diagnostics;
}

module.exports = { checkUnusedExpressions, BARE_COMPARISON };
