const { getConditionRanges } = require('./conditions');

function isConstantTrue(trimmed) {
    return /^true$/i.test(trimmed);
}

function isConstantFalse(trimmed) {
    return /^false$/i.test(trimmed);
}

// A condition of the form `x == x` / `x <> x` / `x != x`, where both sides are
// the exact same bare identifier or simple dotted path (e.g. line.attr).
// Deliberately excludes function calls on either side - a call's result
// isn't guaranteed identical across two evaluations, so flagging it would be
// a real false-positive risk rather than a safe, conservative inference.
function selfCompareOperand(trimmed) {
    const m = trimmed.match(/^([a-zA-Z_][\w.]*)\s*(==|<>|!=)\s*([a-zA-Z_][\w.]*)$/);
    if (m && m[1] === m[3]) {
        return { name: m[1], operator: m[2] };
    }
    return null;
}

// ESLint's no-constant-condition + no-self-compare, adapted to BML's if/elif
// (there's no while/ternary in BML). Reuses conditions.js's existing
// if/elif/else-if condition-range extraction rather than re-deriving it.
function checkConstantConditions(text, doc, vscode) {
    const diagnostics = [];
    const ranges = getConditionRanges(text);

    for (const [start, end] of ranges) {
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
