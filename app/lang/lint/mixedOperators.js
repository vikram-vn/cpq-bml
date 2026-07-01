// Flags AND/OR mixed without grouping parens at the outermost (depth-0) level of a
// condition; a sub-clause already in its own parens is unambiguous and not re-analyzed.
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
            diag.code = 'bml-mixedOperators';
            diagnostics.push(diag);
        }
    }

    return diagnostics;
}

module.exports = { checkMixedOperators, hasMixedAndOrAtTopLevel };
