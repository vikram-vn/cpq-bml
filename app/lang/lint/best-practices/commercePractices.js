const { vscode, makeDiagnostic } = require('./shared');

/**
 * Commerce-process-specific conventions: banned hidden attributes and the
 * '[docNo]~variableName~variableValue|' return-string format.
 *
 * Codes: bml-config-attr-banned, bml-commerce-return-format
 */
function checkCommercePractices(cleanText, noStringsText, doc) {
    const diagnostics = [];

    // _config_attributes / _config_attr_text Ban (run on noStringsText)
    const configAttrsRegex = /\b(_config_attributes|_config_attr_text)\b/gi;
    let match;
    while ((match = configAttrsRegex.exec(noStringsText)) !== null) {
        const attr = match[1];
        const startPos = doc.positionAt(match.index);
        const endPos = startPos.translate(0, attr.length);
        diagnostics.push(makeDiagnostic(
            new vscode.Range(startPos, endPos),
            `Commerce Best Practice: Never use '${attr}' in Commerce BML`,
            vscode.DiagnosticSeverity.Warning,
            'bml-config-attr-banned'
        ));
    }

    // Commerce Return Format Check (run on cleanText lines)
    // The '|' is the separator BETWEEN doc~var~value triplets, not a required
    // terminator - Oracle's own reference library returns single triplets
    // like `return "1~" + histVar + "~msg";` with no pipe, so only a line
    // carrying 2+ triplets' worth of tildes (4 or more) without any '|' is a
    // genuine missing-delimiter bug.
    const lines = cleanText.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const isReturnOrRet = line.trim().startsWith("return ") || line.trim().startsWith("ret =") || line.trim().startsWith("ret=");
        const tildeCount = (line.match(/~/g) || []).length;
        if (isReturnOrRet && tildeCount >= 4 && !line.includes("|")) {
            const startPos = new vscode.Position(i, 0);
            const endPos = new vscode.Position(i, line.length);
            diagnostics.push(makeDiagnostic(
                new vscode.Range(startPos, endPos),
                "Commerce Best Practice: Return information must be formatted as '[docNo]~variableName~variableValue|' (missing '|' delimiter)",
                vscode.DiagnosticSeverity.Warning,
                'bml-commerce-return-format'
            ));
        }
    }

    return diagnostics;
}

module.exports = { checkCommercePractices };
