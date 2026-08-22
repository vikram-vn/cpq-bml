const vscode = require('vscode');

function getSecurityFixes(document, diag, editRange) {
    const fixes = [];

    if (diag.code === 'bml-hardcoded-credential' || diag.code === 'bml-hardcoded-credentials' || diag.code === 'bml-hardcoded-secret') {
        const action = new vscode.CodeAction("Replace hardcoded secret with context variable '_BM_USER_TOKEN'", vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, editRange, '_BM_USER_TOKEN');
        action.diagnostics = [diag];
        fixes.push(action);
    } else if (diag.code === 'bml-hardcoded-url') {
        const action = new vscode.CodeAction("Extract URL to dynamic configuration table lookup", vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        // Provides a template BMQL lookup snippet
        const lineIndex = editRange.start.line;
        const lineText = document.lineAt(lineIndex).text;
        const indentMatch = lineText.match(/^\s*/);
        const indent = indentMatch ? indentMatch[0] : '';
        const bmqlLookup = `${indent}endpointUrl = "";\n${indent}rs = bmql("SELECT url FROM integration_config WHERE key = 'ENDPOINT_URL'");\n${indent}for rec in rs { endpointUrl = get(rec, "url"); }\n`;
        action.edit.insert(document.uri, new vscode.Position(lineIndex, 0), bmqlLookup);
        action.edit.replace(document.uri, editRange, 'endpointUrl');
        action.diagnostics = [diag];
        fixes.push(action);
    }

    return fixes;
}

module.exports = { getSecurityFixes };
