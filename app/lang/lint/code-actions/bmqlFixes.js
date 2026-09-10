const vscode = require('vscode');

function getBmqlFixes(document, diag, editRange) {
    const fixes = [];

    if (diag.code === 'bml-bmql-select-star') {
        const text = document.getText(editRange);
        if (text.includes('*')) {
            const action = new vscode.CodeAction("Replace 'SELECT *' with explicit column list placeholder", vscode.CodeActionKind.QuickFix);
            action.edit = new vscode.WorkspaceEdit();
            const replaced = text.replace(/SELECT\s+\*/i, 'SELECT col1, col2');
            action.edit.replace(document.uri, editRange, replaced);
            action.diagnostics = [diag];
            fixes.push(action);
        }
    }
    else if (diag.code === 'bml-bmql-unbounded-mutation' || diag.code === 'bml-bmql-unbounded-delete') {
        const text = document.getText(editRange);
        const action = new vscode.CodeAction("Append safety WHERE clause ('WHERE _document_number = $doc_num')", vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        // Insert WHERE before end quotes if in string
        let replaced = text;
        if (text.endsWith('"') || text.endsWith("'")) {
            const quote = text.slice(-1);
            replaced = text.slice(0, -1) + ' WHERE _document_number = $doc_num' + quote;
        } else {
            replaced = text + ' WHERE _document_number = $doc_num';
        }
        action.edit.replace(document.uri, editRange, replaced);
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-bmql-injection-risk') {
        const text = document.getText(editRange);
        const action = new vscode.CodeAction("Convert dynamic concatenation to $variable substitution", vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        let replaced = text.replace(/["']\s*\+\s*([a-zA-Z_]\w*)\s*\+\s*["']/g, ' $$$1 ');
        replaced = replaced.replace(/["']\s*\+\s*([a-zA-Z_]\w*)/g, ' $$$1"');
        action.edit.replace(document.uri, editRange, replaced);
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-bmql-mutation-error-unchecked') {
        const lineIndex = editRange.start.line;
        const lineText = document.lineAt(lineIndex).text;
        const varMatch = lineText.match(/^\s*([a-zA-Z_]\w*)\s*=/);
        const resVar = varMatch ? varMatch[1] : 'res';
        const indentMatch = lineText.match(/^\s*/);
        const indent = indentMatch ? indentMatch[0] : '';
        const errorCheckSnippet = `\n${indent}if (containskey(${resVar}, "errorMessage")) {\n${indent}    // handle BMQL mutation error: get(${resVar}, "errorMessage")\n${indent}}`;

        const action = new vscode.CodeAction("Insert BMQL mutation error check", vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        const endOfLinePos = new vscode.Position(lineIndex, lineText.length);
        action.edit.insert(document.uri, endOfLinePos, errorCheckSnippet);
        action.diagnostics = [diag];
        action.isPreferred = true;
        fixes.push(action);
    }

    return fixes;
}

module.exports = { getBmqlFixes };
