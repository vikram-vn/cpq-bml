const vscode = require('vscode');

function getUnreachableFixes(document, diag, editRange) {
    const fixes = [];

    if (diag.code === 'bml-unreachable-code') {
        const lineIndex = editRange.start.line;
        const lineText = document.lineAt(lineIndex).text;
        const indentMatch = lineText.match(/^\s*/);
        const indent = indentMatch ? indentMatch[0] : '';

        const commentAction = new vscode.CodeAction("Comment out unreachable code line", vscode.CodeActionKind.QuickFix);
        commentAction.edit = new vscode.WorkspaceEdit();
        const insertPos = new vscode.Position(lineIndex, indent.length);
        commentAction.edit.insert(document.uri, insertPos, '// ');
        commentAction.diagnostics = [diag];
        fixes.push(commentAction);

        const removeAction = new vscode.CodeAction("Remove unreachable code line", vscode.CodeActionKind.QuickFix);
        removeAction.edit = new vscode.WorkspaceEdit();
        const lineRange = document.lineAt(lineIndex).rangeIncludingLineBreak;
        removeAction.edit.delete(document.uri, lineRange);
        removeAction.diagnostics = [diag];
        fixes.push(removeAction);
    }

    return fixes;
}

module.exports = { getUnreachableFixes };
