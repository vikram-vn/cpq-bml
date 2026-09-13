const { vscode, makeDiagnostic } = require('@/lang/lint/categories/best-practices/shared');

/**
 * General code-quality checks: empty blocks, missing return.
 *
 * Codes: bml-empty-block, bml-missing-return
 */
function checkCodeQuality(cleanText, noStringsText, doc) {
    const diagnostics = [];

    // Empty Blocks (run on noStringsText)
    const emptyBlockRegex = /\b(if|elif)\s*\(.*?\)\s*\{\s*\}|\bfor\s*(?:\(.*?\)|[^{]*?)\s*\{\s*\}|\belse\s*\{\s*\}/gi;
    let match;
    while ((match = emptyBlockRegex.exec(noStringsText)) !== null) {
        const startPos = doc.positionAt(match.index);
        const endPos = doc.positionAt(match.index + match[0].length);
        diagnostics.push(makeDiagnostic(
            new vscode.Range(startPos, endPos),
            'Syntax Error: Empty block detected',
            vscode.DiagnosticSeverity.Error,
            'bml-empty-block'
        ));
    }

    // Missing Return Statement Check (run on noStringsText to ignore return in strings/comments)
    if (!/\breturn\b/.test(noStringsText)) {
        const startPos = new vscode.Position(0, 0);
        const endLineText = doc.lineCount > 0 ? doc.lineAt(0).text : '';
        const endPos = new vscode.Position(0, Math.max(1, endLineText.length));
        const range = new vscode.Range(startPos, endPos);
        diagnostics.push(makeDiagnostic(
            range,
            "Script is missing a return statement",
            vscode.DiagnosticSeverity.Error,
            'bml-missing-return'
        ));
    }

    return diagnostics;
}

module.exports = { checkCodeQuality };
