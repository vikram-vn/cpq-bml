const vscode = require('vscode');

function getStyleFixes(document, diag, editRange) {
    const fixes = [];

    if (diag.code === 'bml-unguarded-print') {
        const lineIndex = editRange.start.line;
        const lineText = document.lineAt(lineIndex).text;
        const indentMatch = lineText.match(/^\s*/);
        const indent = indentMatch ? indentMatch[0] : '';
        const action = new vscode.CodeAction('Comment out print statement', vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        const insertPos = new vscode.Position(lineIndex, indent.length);
        action.edit.insert(document.uri, insertPos, '// ');
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-array-naming-suffix' || diag.code === 'bml-dict-naming-suffix' || diag.code === 'bml-recordset-naming-suffix') {
        const name = document.getText(editRange);
        let suffix = 'Array';
        if (diag.code === 'bml-dict-naming-suffix') suffix = 'Dict';
        if (diag.code === 'bml-recordset-naming-suffix') suffix = 'RecordSet';
        const newName = name + suffix;
        const action = new vscode.CodeAction(`Rename '${name}' to '${newName}'`, vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, editRange, newName);
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-boolean-naming-prefix') {
        const name = document.getText(editRange);
        const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
        const newName = 'is' + capitalized;
        const action = new vscode.CodeAction(`Rename '${name}' to '${newName}'`, vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, editRange, newName);
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-unused-variable' || diag.code === 'bml-unused-loop-var') {
        const name = document.getText(editRange);
        const newName = '_' + name;
        const action = new vscode.CodeAction(`Prefix unused variable with '_' (${newName})`, vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, editRange, newName);
        action.diagnostics = [diag];
        fixes.push(action);
    }

    return fixes;
}

module.exports = { getStyleFixes };
