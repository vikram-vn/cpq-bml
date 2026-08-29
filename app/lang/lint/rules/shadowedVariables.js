const vscode = require('vscode');

/**
 * Shadowed Variable Checker
 *
 * Detects when a `for x in arr` loop variable shadows an outer-scope variable
 * that was already declared/assigned in the same file before the loop.
 *
 * Code: bml-shadowed-variable  Severity: Warning
 */
function checkShadowedVariables(noStringsText, doc, declaredVars) {
    const diagnostics = [];
    if (!noStringsText.includes('for')) return diagnostics;

    const loopRegex = /\bfor\s+([a-zA-Z_]\w*)\s+in\s+/gi;
    let m;
    while ((m = loopRegex.exec(noStringsText)) !== null) {
        const loopVar = m[1];
        const loopIndex = m.index;

        if (declaredVars && declaredVars.has(loopVar)) {
            const decls = declaredVars.get(loopVar);
            const firstNonLoop = decls.find(d => !d.isLoopVar);
            if (firstNonLoop && firstNonLoop.index < loopIndex) {
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
    }

    return diagnostics;
}

module.exports = { checkShadowedVariables };
