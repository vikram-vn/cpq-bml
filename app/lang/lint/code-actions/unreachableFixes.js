const vscode = require('vscode');

function getUnreachableFixes(document, diag, editRange) {
    const fixes = [];

    if (diag.code === 'bml-unreachable-code') {
        const startLine = editRange.start.line;
        const endLine = editRange.end.line;

        const commentAction = new vscode.CodeAction(
            startLine === endLine ? "Comment out unreachable code line" : "Comment out unreachable code block",
            vscode.CodeActionKind.QuickFix
        );
        commentAction.edit = new vscode.WorkspaceEdit();
        for (let l = startLine; l <= endLine; l++) {
            const lineText = document.lineAt(l).text;
            if (!lineText.trim().startsWith('//')) {
                const indentMatch = lineText.match(/^\s*/);
                const indentLen = indentMatch ? indentMatch[0].length : 0;
                commentAction.edit.insert(document.uri, new vscode.Position(l, indentLen), '// ');
            }
        }
        commentAction.diagnostics = [diag];
        fixes.push(commentAction);

        const removeAction = new vscode.CodeAction(
            startLine === endLine ? "Remove unreachable code line" : "Remove unreachable code block",
            vscode.CodeActionKind.QuickFix
        );
        removeAction.edit = new vscode.WorkspaceEdit();
        const startPos = new vscode.Position(startLine, 0);
        const endPos = document.lineAt(endLine).rangeIncludingLineBreak.end;
        removeAction.edit.delete(document.uri, new vscode.Range(startPos, endPos));
        removeAction.diagnostics = [diag];
        fixes.push(removeAction);
    }

    return fixes;
}

module.exports = { getUnreachableFixes };
