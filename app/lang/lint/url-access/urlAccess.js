const { makeDiagnostic, findMatchingParenEnd, splitTopLevelArgs } = require('../best-practices/shared');
const vscode = require('vscode');

function checkUrlAccess(cleanText, noStringsText, doc) {
    const diagnostics = [];
    let match;

    // urldata(url, method) - check HTTP methods (GET, DELETE, PATCH, POST, PUT)
    const allowedHttpMethods = new Set(['GET', 'DELETE', 'PATCH', 'POST', 'PUT']);
    const urldataRegex = /\burldata\s*\(/g;
    while ((match = urldataRegex.exec(cleanText)) !== null) {
        const openParenIndex = match.index + match[0].length - 1;
        const closeParenIndex = findMatchingParenEnd(cleanText, openParenIndex);
        if (closeParenIndex === -1) continue;
        const args = splitTopLevelArgs(cleanText.slice(openParenIndex + 1, closeParenIndex));
        if (args.length >= 2) {
            const methodArg = args[1].trim();
            const literalMatch = /^("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/.exec(methodArg);
            if (literalMatch) {
                const method = literalMatch[1].slice(1, -1);
                if (!allowedHttpMethods.has(method)) {
                    const startPos = doc.positionAt(match.index);
                    const endPos = doc.positionAt(closeParenIndex + 1);
                    diagnostics.push(makeDiagnostic(
                        new vscode.Range(startPos, endPos),
                        `Error: 'urldata()' HTTP method '${method}' is not supported. Supported methods are: GET, DELETE, PATCH, POST, or PUT.`,
                        vscode.DiagnosticSeverity.Error,
                        'bml-urldata-invalid-method'
                    ));
                }
            }
        }
    }

    return diagnostics;
}

module.exports = { checkUrlAccess };
