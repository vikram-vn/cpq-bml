const vscode = require('vscode');

function getApiFixes(document, diag, editRange) {
    const fixes = [];

    if (diag.code === 'bml-urldata-invalid-method') {
        const text = document.getText(editRange);
        ['"GET"', '"POST"', '"PUT"', '"DELETE"'].forEach(method => {
            const action = new vscode.CodeAction(`Change method to ${method}`, vscode.CodeActionKind.QuickFix);
            action.edit = new vscode.WorkspaceEdit();
            action.edit.replace(document.uri, editRange, method);
            action.diagnostics = [diag];
            fixes.push(action);
        });
    }
    else if (diag.code === 'bml-urldata-status-unchecked') {
        const lineIndex = editRange.start.line;
        const lineText = document.lineAt(lineIndex).text;
        const varMatch = lineText.match(/^\s*([a-zA-Z_]\w*)\s*=/);
        const resVar = varMatch ? varMatch[1] : 'response';
        const indentMatch = lineText.match(/^\s*/);
        const indent = indentMatch ? indentMatch[0] : '';
        const statusCheckSnippet = `\n${indent}if (containskey(${resVar}, "Status-Code") and get(${resVar}, "Status-Code") == "200 OK") {\n${indent}    // process response\n${indent}}`;

        const action = new vscode.CodeAction("Insert HTTP Status-Code check", vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        const endOfLinePos = new vscode.Position(lineIndex, lineText.length);
        action.edit.insert(document.uri, endOfLinePos, statusCheckSnippet);
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-readxml-error-key-unchecked') {
        const lineIndex = editRange.start.line;
        const lineText = document.lineAt(lineIndex).text;
        const varMatch = lineText.match(/^\s*([a-zA-Z_]\w*)\s*=/);
        const xmlVar = varMatch ? varMatch[1] : 'xmlResult';
        const indentMatch = lineText.match(/^\s*/);
        const indent = indentMatch ? indentMatch[0] : '';
        const errorCheckSnippet = `\n${indent}if (containskey(${xmlVar}, "error")) {\n${indent}    // handle XML parse error\n${indent}}`;

        const action = new vscode.CodeAction("Insert XML error key check", vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        const endOfLinePos = new vscode.Position(lineIndex, lineText.length);
        action.edit.insert(document.uri, endOfLinePos, errorCheckSnippet);
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-logtime-tag-too-long') {
        const text = document.getText(editRange);
        const quote = text.charAt(0);
        if (text.length > 130) {
            const truncated = text.substring(0, 129) + quote;
            const action = new vscode.CodeAction(`Truncate logtime tag to 128 chars (${truncated})`, vscode.CodeActionKind.QuickFix);
            action.edit = new vscode.WorkspaceEdit();
            action.edit.replace(document.uri, editRange, truncated);
            action.diagnostics = [diag];
            fixes.push(action);
        }
    }
    else if (diag.code === 'bml-hmac-invalid-algorithm') {
        ['"HmacSHA256"', '"HmacSHA1"', '"HmacMD5"'].forEach(algo => {
            const action = new vscode.CodeAction(`Replace algorithm with ${algo}`, vscode.CodeActionKind.QuickFix);
            action.edit = new vscode.WorkspaceEdit();
            action.edit.replace(document.uri, editRange, algo);
            action.diagnostics = [diag];
            fixes.push(action);
        });
    }
    else if (diag.code === 'bml-globaldict-ttl-out-of-range') {
        const action = new vscode.CodeAction("Set globaldict TTL to 3600 (1 hour)", vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, editRange, '3600');
        action.diagnostics = [diag];
        fixes.push(action);
    }

    return fixes;
}

module.exports = { getApiFixes };
