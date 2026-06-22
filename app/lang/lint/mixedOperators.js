// ESLint's no-mixed-operators, scoped to BML's logical AND/OR (the classic
// precedence-confusion case - unlike arithmetic operators, where standard
// math precedence is already well understood, AND/OR mixing is the one
// every language's style guide warns about). Only checks the outermost
// (depth-0) level of an if/elif condition - a sub-clause already wrapped in
// its own parens is, by definition, unambiguous regardless of what it mixes
// internally, so it's not re-analyzed.
function hasMixedAndOrAtTopLevel(conditionText) {
    let depth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let sawAnd = false;
    let sawOr = false;

    for (let i = 0; i < conditionText.length; i++) {
        const ch = conditionText[i];
        if (ch === '\\') { i++; continue; }
        if (ch === "'" && !inDoubleQuote) { inSingleQuote = !inSingleQuote; continue; }
        if (ch === '"' && !inSingleQuote) { inDoubleQuote = !inDoubleQuote; continue; }
        if (inSingleQuote || inDoubleQuote) continue;

        if (ch === '(') { depth++; continue; }
        if (ch === ')') { depth = Math.max(0, depth - 1); continue; }
        if (depth !== 0) continue;

        if ((ch === 'a' || ch === 'A') && /^and\b/i.test(conditionText.slice(i)) && (i === 0 || !/[a-zA-Z0-9_]/.test(conditionText[i - 1]))) {
            sawAnd = true;
        } else if ((ch === 'o' || ch === 'O') && /^or\b/i.test(conditionText.slice(i)) && (i === 0 || !/[a-zA-Z0-9_]/.test(conditionText[i - 1]))) {
            sawOr = true;
        }
    }

    return sawAnd && sawOr;
}

// Takes the already-computed condition ranges from lint.js (see
// constantConditions.js's identical note - getConditionRanges ignores
// comments/strings internally, so reusing the one pass already done there
// is equivalent to, and cheaper than, re-deriving it here).
function checkMixedOperators(text, conditionRanges, doc, vscode) {
    const diagnostics = [];

    for (const [start, end] of conditionRanges) {
        const raw = text.slice(start, end).replace(/\s+$/, '');
        if (raw.length < 2 || raw[0] !== '(' || raw[raw.length - 1] !== ')') continue;
        const conditionText = raw.slice(1, -1);

        if (hasMixedAndOrAtTopLevel(conditionText)) {
            const startPos = doc.positionAt(start);
            const endPos = doc.positionAt(start + raw.length);
            const diag = new vscode.Diagnostic(
                new vscode.Range(startPos, endPos),
                `'AND' and 'OR' are mixed without grouping parentheses - BML evaluates 'AND' before 'OR', which may not be what you expect. Add parentheses to make the intended grouping explicit, e.g. '(a AND b) OR c'.`,
                vscode.DiagnosticSeverity.Warning
            );
            diag.code = 'bml-mixed-operators';
            diagnostics.push(diag);
        }
    }

    return diagnostics;
}

module.exports = { checkMixedOperators, hasMixedAndOrAtTopLevel };
