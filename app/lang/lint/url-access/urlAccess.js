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

    // urldata() returns a Dictionary with a "Status-Code" key even on HTTP
    // error responses or timeouts (e.g. {Status-Code=-1, Error-Message=...})
    // - it never throws. Flag when the result variable is read via get() for
    // something else without ever checking "Status-Code" first.
    // (urldatabyget/urldatabypost are NOT included here - both return a
    // String with their own defaultValue parameter instead, a completely
    // different error convention from urldata()'s Dictionary response.)
    const urldataAssignRegex = /\b([A-Za-z_]\w*)\s*=\s*urldata\s*\(/g;
    while ((match = urldataAssignRegex.exec(cleanText)) !== null) {
        const varName = match[1];
        const openParenIndex = match.index + match[0].length - 1;
        const closeParenIndex = findMatchingParenEnd(cleanText, openParenIndex);
        if (closeParenIndex === -1) continue;

        const statusCheckPattern = new RegExp(`\\bget\\s*\\(\\s*${varName}\\s*,\\s*["']Status-Code["']\\s*\\)`, 'i');
        if (statusCheckPattern.test(cleanText)) continue;

        const otherGetPattern = new RegExp(`\\bget\\s*\\(\\s*${varName}\\s*,\\s*["'](?!Status-Code)[^"']+["']\\s*\\)`, 'i');
        if (!otherGetPattern.test(cleanText)) continue;

        const startPos = doc.positionAt(match.index);
        const endPos = doc.positionAt(closeParenIndex + 1);
        diagnostics.push(makeDiagnostic(
            new vscode.Range(startPos, endPos),
            `Safety Warning: '${varName}' (urldata() result) is read via get() without ever checking get(${varName}, "Status-Code") first. urldata() never throws on HTTP errors or timeouts - failures come back as a normal response (e.g. {Status-Code=-1, Error-Message=...}), so unchecked code silently treats them as success.`,
            vscode.DiagnosticSeverity.Warning,
            'bml-urldata-status-unchecked'
        ));
    }

    return diagnostics;
}

module.exports = { checkUrlAccess };
