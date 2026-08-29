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

            const fullDocText = document.getText();
            if (!fullDocText.includes(`${varName}_sb`)) {
                const lineIndex = editRange.start.line;
                const lineText = document.lineAt(lineIndex).text;
                const indentMatch = lineText.match(/^\s*/);
                const indent = indentMatch ? indentMatch[0] : '';
                action.edit.insert(document.uri, new vscode.Position(lineIndex, 0), `${indent}${varName}_sb = stringbuilder();\n`);
            }

            action.diagnostics = [diag];
            fixes.push(action);
        }
    }
    else if (diag.code === 'bml-bmql-in-loop') {
        const action = new vscode.CodeAction("Add comment marker to batch query outside loop", vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        const lineIndex = editRange.start.line;
        const lineText = document.lineAt(lineIndex).text;
        const indent = lineText.match(/^\s*/)[0];
        const lineStartPos = new vscode.Position(lineIndex, 0);
        action.edit.insert(document.uri, lineStartPos, `${indent}// OPTIMIZATION: batch BMQL query outside of loop to prevent N+1 queries\n`);
        action.diagnostics = [diag];
        fixes.push(action);
    }

    return fixes;
}

module.exports = { getPerformanceFixes };
