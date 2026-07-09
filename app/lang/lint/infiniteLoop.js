const vscode = require('vscode');

/**
 * Infinite / Empty Loop Checker
 *
 * Flags `for x in arr` where `arr` is assigned an empty array literal
 * (`string[]{}`, `integer[]{}`, `float[]{}`, etc.) and is never reassigned
 * before the loop — meaning the loop body can never execute.
 *
 * Code: bml-empty-loop  Severity: Warning
 */
function checkInfiniteLoop(noStringsText, doc) {
    const diagnostics = [];

    // Find variables assigned empty typed array literals: var = type[]{}  or  type[][]{} etc.
    // The regex matches: varName = <word>[][...]{} with nothing inside braces
    const emptyArrayAssignRegex = /\b([a-zA-Z_]\w*)\s*=\s*(?:string|integer|float|boolean|date)(?:\[\])+\s*\{\s*\}/gi;
    const emptyArrayVars = new Map(); // varName -> last assignment index
    let m;
    while ((m = emptyArrayAssignRegex.exec(noStringsText)) !== null) {
        emptyArrayVars.set(m[1], m.index);
    }

    if (emptyArrayVars.size === 0) return diagnostics;

    // Find all for-loops: for varName in arrayVar { ... }
    const loopRegex = /\bfor\s+([a-zA-Z_]\w*)\s+in\s+([a-zA-Z_]\w*)\s*\{/gi;
    while ((m = loopRegex.exec(noStringsText)) !== null) {
        const loopVar = m[1];
        const arrayVar = m[2];
        const loopIndex = m.index;

        if (!emptyArrayVars.has(arrayVar)) continue;
        const arrayAssignIndex = emptyArrayVars.get(arrayVar);

        // Check if the array variable was reassigned between its empty declaration and this loop
        const betweenText = noStringsText.slice(arrayAssignIndex, loopIndex);
        // A reassignment would be: arrayVar = something (excluding the original empty assign itself)
        const reassignPattern = new RegExp(`\\b${arrayVar}\\s*=(?!=)`, 'g');
        let reassignCount = 0;
        let r;
        while ((r = reassignPattern.exec(betweenText)) !== null) {
            reassignCount++;
        }
        // reassignCount === 1 means only the original empty assignment; > 1 means it was updated
        if (reassignCount > 1) continue;

        const startPos = doc.positionAt(loopIndex);
        const endPos = startPos.translate(0, m[0].length - 1); // up to the opening brace
        const diag = new vscode.Diagnostic(
            new vscode.Range(startPos, endPos),
            `Logic Warning: Loop iterates over '${arrayVar}' which was initialized as an empty array and never populated. The loop body will never execute.`,
            vscode.DiagnosticSeverity.Warning
        );
        diag.code = 'bml-empty-loop';
        diagnostics.push(diag);
    }

    return diagnostics;
}

module.exports = { checkInfiniteLoop };
