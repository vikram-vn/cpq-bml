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

    // Hardcoded credentials: a variable whose name suggests a secret
    // (password/apikey/token/secret/credential) assigned a non-trivial
    // string literal directly, rather than read from a System Variable,
    // Data Table, or secret store. Only matches a literal immediately after
    // '=' (a function call like getvalue("sysPassword") won't match, since
    // '(' isn't a quote character).
    const credentialRegex = /\b(\w*(?:password|passwd|pwd|api[_-]?key|secret|token|credential)\w*)\s*=\s*["']([^"']*)["']/gi;
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

    return diagnostics;
}

module.exports = { checkSecurity };
