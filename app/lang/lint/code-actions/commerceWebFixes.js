const vscode = require('vscode');

/**
 * 100% BML-Accurate Quick Fixes for Commerce, Web Services & StringBuilder:
 * - urldata HTTP method capitalization: "get" -> "GET"
 * - urldata Status-Code check
 * - readxmlsingle error key check: "BM_READXMLSINGLE_ERROR"
 * - generatehmacmessage algorithm: "HmacSHA256"
 * - return sb -> return sbtostring(sb);
 */

function getCommerceWebFixes(document, diag, editRange) {
    const fixes = [];
    if (!diag || !diag.code) return fixes;

    function addFix(title, replacement, isPreferred = false) {
        const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, editRange, replacement);
        if (diag) action.diagnostics = [diag];
        if (isPreferred) action.isPreferred = true;
        fixes.push(action);
    }

    const text = document.getText(editRange);

    // 1. urldata HTTP method capitalization
    if (diag.code === 'bml-urldata-invalid-method') {
        const m = text.match(/(["'])(get|post|put|delete|patch)\1/i);
        if (m) {
            const upperMethod = `${m[1]}${m[2].toUpperCase()}${m[1]}`;
            addFix(`Capitalize HTTP method to ${upperMethod}`, text.replace(m[0], upperMethod), true);
        }
        return fixes;
    }

    // 2. urldata unchecked status code
    if (diag.code === 'bml-urldata-status-unchecked') {
        const m = text.match(/([a-zA-Z_]\w*)\s*=\s*urldata\s*\(/i);
        if (m) {
            const respVar = m[1];
            addFix(`Check 'Status-Code': 'if (get(${respVar}, "Status-Code") == "200 OK")'`, `if (get(${respVar}, "Status-Code") == "200 OK")`, true);
        }
        return fixes;
    }

    // 3. readxml error key check
    if (diag.code === 'bml-readxml-error-key-unchecked') {
        const m = text.match(/([a-zA-Z_]\w*)\s*=\s*readxmlsingle\s*\(/i);
        if (m) {
            const respVar = m[1];
            addFix(`Check XML error key: 'if (not(containskey(${respVar}, "BM_READXMLSINGLE_ERROR")))'`, `if (not(containskey(${respVar}, "BM_READXMLSINGLE_ERROR")))`, true);
        }
        return fixes;
    }

    // 4. Invalid HMAC algorithm
    if (diag.code === 'bml-hmac-invalid-algorithm') {
        let fixed = text;
        fixed = fixed.replace(/["']sha256["']/i, '"HmacSHA256"');
        fixed = fixed.replace(/["']sha1["']/i, '"HmacSHA1"');
        if (fixed !== text) {
            addFix(`Use standard HMAC algorithm name`, fixed, true);
        }
        return fixes;
    }

    // 5. Missing sbtostring: return sb -> return sbtostring(sb);
    if (diag.code === 'bml-missing-sbtostring') {
        const m = text.match(/return\s+([a-zA-Z_]\w*)\s*;/);
        if (m) {
            addFix(`Convert StringBuilder to string: 'return sbtostring(${m[1]});'`, `return sbtostring(${m[1]});`, true);
        }
        return fixes;
    }

    return fixes;
}

module.exports = { getCommerceWebFixes };
