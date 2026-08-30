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
    else if (diag.code === 'bml-production-print-statement') {
        // Fix 1: Comment out print statement
        const lineIndex = editRange.start.line;
        const line = document.lineAt(lineIndex);
        const lineText = line.text;
        
        const commentAction = new vscode.CodeAction("Comment out print statement before go-live", vscode.CodeActionKind.QuickFix);
        commentAction.edit = new vscode.WorkspaceEdit();
        const indentMatch = lineText.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : '';
        const nonIndent = lineText.slice(indent.length);
        commentAction.edit.replace(document.uri, line.range, `${indent}// ${nonIndent}`);
        commentAction.diagnostics = [diag];
        fixes.push(commentAction);

        // Fix 2: Remove line entirely
        const removeAction = new vscode.CodeAction("Remove print statement", vscode.CodeActionKind.QuickFix);
        removeAction.edit = new vscode.WorkspaceEdit();
        const deleteRange = line.rangeIncludingLineBreak;
        removeAction.edit.delete(document.uri, deleteRange);
        removeAction.diagnostics = [diag];
        fixes.push(removeAction);
    }
    else if (diag.code === 'bml-hardcoded-sitename') {
        const text = document.getText(editRange);
        const action = new vscode.CodeAction("Replace hardcoded domain with '_system_site_name'", vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        // Replace "https://mysite.bigmachines.com/..." with "\"https://\" + _system_site_name + \".bigmachines.com/...\"" or _system_site_name
        const replaced = text.replace(/([a-zA-Z0-9_-]+)(?:\.bigmachines\.com|\.oraclecloud\.com|\.cpq\.oracle\.com)/g, '" + _system_site_name + "');
        // Clean up empty string joins e.g. "" + _system_site_name + ""
        const cleaned = replaced.replace(/^""\s*\+\s*/, '').replace(/\s*\+\s*""$/, '');
        action.edit.replace(document.uri, editRange, cleaned);
        action.diagnostics = [diag];
        fixes.push(action);
    }

    return fixes;
}

module.exports = { getPerformanceFixes };
