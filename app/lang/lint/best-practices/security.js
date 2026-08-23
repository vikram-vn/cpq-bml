const { vscode, makeDiagnostic } = require('./shared');

// Common placeholder values that look like a secret but aren't one - avoid
// flagging boilerplate/template code that hasn't been filled in yet.
const PLACEHOLDER_VALUES = new Set([
    'changeme', 'change_me', 'todo', 'test', 'dummy', 'sample', 'example',
    'placeholder', 'xxx', 'xxxx', 'password', 'secret', 'none', 'null', 'na',
]);

/**
 * Security-sensitive literals: hardcoded URLs and hardcoded credentials.
 *
 * Codes: bml-hardcoded-url, bml-hardcoded-credential
 */
function checkSecurity(cleanText, noStringsText, doc) {
    const diagnostics = [];

    // Hardcoded URLs check (run on cleanText string literals)
    if (cleanText.includes('http://') || cleanText.includes('https://')) {
        const urlRegex = /"(https?:\/\/[^\s"]+)"|'(https?:\/\/[^\s']+)'/gi;
        let match;
        while ((match = urlRegex.exec(cleanText)) !== null) {
            const url = match[1] || match[2];
            if (url && url.length > 8 && !url.endsWith('://')) {
                if (url.includes('w3.org') || url.includes('schema.org')) {
                    continue;
                }
                const startPos = doc.positionAt(match.index);
                const endPos = doc.positionAt(match.index + match[0].length);
                diagnostics.push(makeDiagnostic(
                    new vscode.Range(startPos, endPos),
                    "Design Warning: Hardcoded URL detected. Consider using a dynamic configuration, Data Table, or System Variable to avoid environment-specific issues.",
                    vscode.DiagnosticSeverity.Warning,
                    'bml-hardcoded-url'
                ));
            }
        }
    }

    // Hardcoded credentials
    const lowerClean = cleanText.toLowerCase();
    if (lowerClean.includes('password') || lowerClean.includes('passwd') || lowerClean.includes('pwd') || lowerClean.includes('api') || lowerClean.includes('secret') || lowerClean.includes('token') || lowerClean.includes('credential')) {
        const credentialRegex = /\b(\w*(?:password|passwd|pwd|api[_-]?key|secret|token|credential)\w*)\s*=\s*["']([^"']*)["']/gi;
        let match;
        while ((match = credentialRegex.exec(cleanText)) !== null) {
            const varName = match[1];
            const value = match[2];
            if (value.length < 4) continue; // empty/placeholder init, e.g. password = "";
            if (PLACEHOLDER_VALUES.has(value.toLowerCase())) continue;
            if (/^[<{].*[>}]$/.test(value.trim())) continue; // <YOUR_KEY_HERE>, {{token}}

            const startPos = doc.positionAt(match.index);
            const endPos = doc.positionAt(match.index + match[0].length);
            diagnostics.push(makeDiagnostic(
                new vscode.Range(startPos, endPos),
                `Security Warning: '${varName}' looks like a hardcoded credential. Store secrets in a System Variable or secure configuration instead of a literal in source.`,
                vscode.DiagnosticSeverity.Warning,
                'bml-hardcoded-credential'
            ));
        }
    }

    // Sensitive data logging check: print() or logtime() passing sensitive variables
    const sensitiveLogRegex = /\b(?:print|logtime)\s*\([^)]*\b(\w*(?:password|passwd|pwd|api[_-]?key|secret|token|credential|_bm_user_token)\w*)\b[^)]*\)/gi;
    let match;
    while ((match = sensitiveLogRegex.exec(cleanText)) !== null) {
        const varName = match[1];
        const startPos = doc.positionAt(match.index);
        const endPos = doc.positionAt(match.index + match[0].length);
        diagnostics.push(makeDiagnostic(
            new vscode.Range(startPos, endPos),
            `Security Warning: Sensitive variable '${varName}' is logged via print()/logtime(). Avoid writing credentials or tokens to execution logs.`,
            vscode.DiagnosticSeverity.Warning,
            'bml-log-sensitive-data'
        ));
    }

    return diagnostics;
}

module.exports = { checkSecurity };
