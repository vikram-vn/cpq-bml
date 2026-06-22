function isConstantTrue(trimmed) {
    return /^true$/i.test(trimmed);
}

function isConstantFalse(trimmed) {
    return /^false$/i.test(trimmed);
}

// Matches `x == x` / `x <> x` / `x != x` for bare identifiers/dotted paths only -
// excludes function calls, since a call's result isn't guaranteed identical across evaluations.
function selfCompareOperand(trimmed) {
    const m = trimmed.match(/^([a-zA-Z_][\w.]*)\s*(==|<>|!=)\s*([a-zA-Z_][\w.]*)$/);
    if (m && m[1] === m[3]) {
        return { name: m[1], operator: m[2] };
    }
    return null;
}

// Flags always-true/false if/elif conditions and self-comparisons (BML has no while/ternary).
function checkConstantConditions(text, conditionRanges, doc, vscode) {
    const diagnostics = [];

    for (const [start, end] of conditionRanges) {
        const raw = text.slice(start, end).replace(/\s+$/, '');
        if (raw.length < 2 || raw[0] !== '(' || raw[raw.length - 1] !== ')') continue;
        const conditionText = raw.slice(1, -1);
        const trimmed = conditionText.trim();
        if (!trimmed) continue;

        let message = null;
        if (isConstantTrue(trimmed)) {
            message = `Condition is always true ('${trimmed}') - if this is leftover debug code, remove the condition; otherwise check for a typo.`;
        } else if (isConstantFalse(trimmed)) {
            message = `Condition is always false ('${trimmed}') - this branch can never run.`;
        } else {
            const selfCompare = selfCompareOperand(trimmed);
            if (selfCompare) {
                const alwaysTrue = selfCompare.operator === '==';
                message = `Condition compares '${selfCompare.name}' to itself - this is always ${alwaysTrue ? 'true' : 'false'}. Did you mean to compare against a different variable?`;
            }
        }

        if (message) {
            const startPos = doc.positionAt(start);
            const endPos = doc.positionAt(start + raw.length);
            const diag = new vscode.Diagnostic(
                new vscode.Range(startPos, endPos),
                message,
                vscode.DiagnosticSeverity.Warning
            );
            diag.code = 'bml-constant-condition';
            diagnostics.push(diag);
        }
    }

    return diagnostics;
}

module.exports = { checkConstantConditions, isConstantTrue, isConstantFalse, selfCompareOperand };
