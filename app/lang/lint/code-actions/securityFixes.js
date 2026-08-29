const vscode = require('vscode');

function getSecurityFixes(document, diag, editRange) {
    const fixes = [];

    if (diag.code === 'bml-hardcoded-credential' || diag.code === 'bml-hardcoded-credentials' || diag.code === 'bml-hardcoded-secret') {
        const action1 = new vscode.CodeAction("Replace hardcoded secret with context variable '_BM_USER_TOKEN'", vscode.CodeActionKind.QuickFix);
        action1.edit = new vscode.WorkspaceEdit();
        action1.edit.replace(document.uri, editRange, '_BM_USER_TOKEN');
        action1.diagnostics = [diag];
        fixes.push(action1);

        const action2 = new vscode.CodeAction("Replace hardcoded secret with system variable '_system_user_token'", vscode.CodeActionKind.QuickFix);
        action2.edit = new vscode.WorkspaceEdit();
        action2.edit.replace(document.uri, editRange, '_system_user_token');
        action2.diagnostics = [diag];
        fixes.push(action2);
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
    } else if (diag.code === 'bml-log-sensitive-data') {
        const text = document.getText(editRange);
        const action = new vscode.CodeAction(`Mask sensitive variable '${text}' with '[REDACTED]'`, vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, editRange, '"[REDACTED]"');
        action.diagnostics = [diag];
        fixes.push(action);
    }

    return fixes;
}

module.exports = { getSecurityFixes };
