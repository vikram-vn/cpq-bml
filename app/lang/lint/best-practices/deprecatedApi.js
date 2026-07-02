const { vscode, makeDiagnostic } = require('./shared');

/**
 * Deprecated BML functions and constants.
 *
 * Codes: bml-strtodate-fix, bml-gettabledata-fix, bml-getpartsdata-fix, bml-nan-fix
 */
function checkDeprecatedApi(cleanText, noStringsText, doc) {
    const diagnostics = [];

    // Deprecated methods (run on noStringsText to ignore calls inside strings/comments)
    const deprecatedRegex = /\b(strtodate|gettabledata|getpartsdata)\b/g;
    let match;
    while ((match = deprecatedRegex.exec(noStringsText)) !== null) {
        const name = match[1];
        const startPos = doc.positionAt(match.index);
        const endPos = startPos.translate(0, name.length);

        let message = '';
        let severity = vscode.DiagnosticSeverity.Warning;
        let code = '';
        if (name === 'strtodate') {
            message = `Deprecated function 'strtodate'. Use 'strtojavadate' instead`;
            code = 'bml-strtodate-fix';
        } else {
            message = `Deprecated function '${name}'. Use 'bmql' instead to avoid SQL injection vulnerability`;
            severity = vscode.DiagnosticSeverity.Error; // SQL vulnerability is High risk
            code = name === 'gettabledata' ? 'bml-gettabledata-fix' : 'bml-getpartsdata-fix';
        }

        diagnostics.push(makeDiagnostic(new vscode.Range(startPos, endPos), message, severity, code));
    }

    // Oracle Constants: NaN vs jNaN (run on noStringsText)
    const nanRegex = /\bNaN\b/g;
    while ((match = nanRegex.exec(noStringsText)) !== null) {
        const startPos = doc.positionAt(match.index);
        const endPos = startPos.translate(0, 3);
        diagnostics.push(makeDiagnostic(
            new vscode.Range(startPos, endPos),
            "Deprecated constant 'NaN'. Use 'jNaN' instead for Java compatibility",
            vscode.DiagnosticSeverity.Warning,
            'bml-nan-fix'
        ));
    }

    return diagnostics;
}

module.exports = { checkDeprecatedApi };
