const { vscode, makeDiagnostic } = require('./shared');

/**
 * General code-quality checks: empty blocks, magic numbers, missing return.
 *
 * Codes: bml-empty-block, bml-magic-number, bml-missing-return
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
            'Design Warning: Empty block detected',
            vscode.DiagnosticSeverity.Warning,
            'bml-empty-block'
        ));
    }

    // Magic Numbers (run on noStringsText to ignore numbers inside strings)
    const magicNumRegex = /\b\d+(?:\.\d+)?\b/g;
    const standardNumbers = new Set(['0', '1', '2', '10', '100', '0.0', '1.0', '2.0']);
    while ((match = magicNumRegex.exec(noStringsText)) !== null) {
        const val = match[0];
        if (standardNumbers.has(val)) {
            continue;
        }

        const index = match.index;
        if (index > 0) {
            const precedingChar = noStringsText[index - 1];
            if (precedingChar === '.' || precedingChar === '_' || /[a-zA-Z]/.test(precedingChar)) {
                continue; // part of property or variable name
            }
        }

        const lineStart = noStringsText.lastIndexOf('\n', index) + 1;
        const linePrefix = noStringsText.substring(lineStart, index);
        if (/\b(?:CONST_[a-zA-Z0-9_]+|[A-Z0-9_]{2,})\s*=\s*$/.test(linePrefix.trim())) {
            continue; // part of constant definition (e.g. CONST_2026 = 2026; or MY_CONST = 2026;)
        }

        const startPos = doc.positionAt(index);
        const endPos = startPos.translate(0, val.length);
        diagnostics.push(makeDiagnostic(
            new vscode.Range(startPos, endPos),
            `Design Info: Magic number '${val}' detected. Consider defining a named constant`,
            vscode.DiagnosticSeverity.Information,
            'bml-magic-number'
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
