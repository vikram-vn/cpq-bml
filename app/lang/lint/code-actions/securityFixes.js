const vscode = require('vscode');

function getSecurityFixes(document, diag, editRange) {
    const fixes = [];

    if (diag.code === 'bml-hardcoded-credentials' || diag.code === 'bml-hardcoded-secret') {
        const action = new vscode.CodeAction("Replace hardcoded secret with context variable '_BM_USER_TOKEN'", vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, editRange, '_BM_USER_TOKEN');
        action.diagnostics = [diag];
        fixes.push(action);
    }

    return fixes;
}

module.exports = { getSecurityFixes };
