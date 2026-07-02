const vscode = require('vscode');

// All diagnostics carry a stable .code so they can be targeted individually
// by inline suppression comments (// bml-lint-disable-line <code>) and by
// codeActions.js's quick fixes.
function makeDiagnostic(range, message, severity, code) {
    const diag = new vscode.Diagnostic(range, message, severity);
    diag.code = code;
    return diag;
}

module.exports = { vscode, makeDiagnostic };
