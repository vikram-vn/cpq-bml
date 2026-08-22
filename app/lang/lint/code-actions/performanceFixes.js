const vscode = require('vscode');

function getPerformanceFixes(document, diag, editRange) {
    const fixes = [];

    if (diag.code === 'bml-string-concat-in-loop') {
        const text = document.getText(editRange);
        const action = new vscode.CodeAction("Convert to StringBuilder ('sbappend(sb, ...)')", vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        
        // e.g. str = str + val or str += val
        const m = text.match(/([a-zA-Z_]\w*)\s*=\s*\1\s*\+\s*(.+)/);
        if (m) {
            const varName = m[1];
            const addedExpr = m[2].trim();
            const replacement = `sbappend(${varName}_sb, ${addedExpr});`;
            action.edit.replace(document.uri, editRange, replacement);
            action.diagnostics = [diag];
            fixes.push(action);
        }
    }

    return fixes;
}

module.exports = { getPerformanceFixes };
