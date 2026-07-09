const vscode = require('vscode');

/**
 * Shadowed Variable Checker
 *
 * Detects when a `for x in arr` loop variable shadows an outer-scope variable
 * that was already declared/assigned in the same file before the loop.
 *
 * Code: bml-shadowed-variable  Severity: Warning
 */
function checkShadowedVariables(noStringsText, doc) {
    const diagnostics = [];

    // Collect all assignments (outer scope) before each for-loop
    const assignRegex = /\b([a-zA-Z_]\w*)\s*=(?!=)/g;
    const loopRegex = /\bfor\s+([a-zA-Z_]\w*)\s+in\s+/gi;

    // Build a set of all assigned variable names with their first assignment offset
    const assignedVars = new Map(); // varName -> first assignment index
    let m;
    while ((m = assignRegex.exec(noStringsText)) !== null) {
        const name = m[1];
        if (!assignedVars.has(name)) {
            assignedVars.set(name, m.index);
        }
    }

    // Find each for-loop variable and check if it shadows a prior assignment
    while ((m = loopRegex.exec(noStringsText)) !== null) {
        const loopVar = m[1];
        const loopIndex = m.index;

        if (assignedVars.has(loopVar) && assignedVars.get(loopVar) < loopIndex) {
            const varStart = m.index + m[0].indexOf(loopVar);
            const startPos = doc.positionAt(varStart);
            const endPos = startPos.translate(0, loopVar.length);
            const diag = new vscode.Diagnostic(
                new vscode.Range(startPos, endPos),
                `Design Warning: Loop variable '${loopVar}' shadows an outer variable with the same name. Consider renaming the loop variable to avoid confusion.`,
                vscode.DiagnosticSeverity.Warning
            );
            diag.code = 'bml-shadowed-variable';
            diagnostics.push(diag);
        }
    }

    return diagnostics;
}

module.exports = { checkShadowedVariables };
