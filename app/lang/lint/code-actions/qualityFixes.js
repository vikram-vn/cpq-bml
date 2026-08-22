const vscode = require('vscode');

function getQualityFixes(document, diag, editRange, extensionPath) {
    const fixes = [];

    if (diag.code === 'bml-magic-number') {
        const val = document.getText(editRange);
        const constName = 'CONST_' + val.replace('.', '_');

        const extractAction = new vscode.CodeAction(`Extract '${val}' to constant candidate '${constName}'`, vscode.CodeActionKind.QuickFix);
        extractAction.edit = new vscode.WorkspaceEdit();
        const lineText = document.lineAt(editRange.start.line).text;
        const indentMatch = lineText.match(/^\s*/);
        const indent = indentMatch ? indentMatch[0] : '';
        const decl = `${indent}${constName} = ${val};\n`;
        const lineStartPos = new vscode.Position(editRange.start.line, 0);
        extractAction.edit.insert(document.uri, lineStartPos, decl);
        extractAction.edit.replace(document.uri, editRange, constName);
        extractAction.diagnostics = [diag];
        fixes.push(extractAction);
    }
    else if (diag.code === 'bml-empty-block') {
        const text = document.getText(editRange);
        if (text.includes('{') && text.includes('}')) {
            const action = new vscode.CodeAction("Add '// TODO: implement' inside block", vscode.CodeActionKind.QuickFix);
            action.edit = new vscode.WorkspaceEdit();
            const replaced = text.replace(/\{\s*\}/, '{\n    // TODO: implement\n}');
            action.edit.replace(document.uri, editRange, replaced);
            action.diagnostics = [diag];
            fixes.push(action);
        }
    }
    else if (diag.code === 'bml-missing-return') {
        const action = new vscode.CodeAction("Add return statement 'return \"\";'", vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        const lastLine = document.lineCount > 0 ? document.lineCount - 1 : 0;
        const lastLineText = document.lineAt(lastLine).text;
        const endPos = new vscode.Position(lastLine, lastLineText.length);
        action.edit.insert(document.uri, endPos, '\nreturn "";\n');
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-string-cast-of-string') {
        const text = document.getText(editRange);
        const m = text.match(/string\s*\(\s*(.+?)\s*\)/i);
        if (m) {
            const innerExpr = m[1];
            const action = new vscode.CodeAction(`Unwrap redundant string() cast to ${innerExpr}`, vscode.CodeActionKind.QuickFix);
            action.edit = new vscode.WorkspaceEdit();
            action.edit.replace(document.uri, editRange, innerExpr);
            action.diagnostics = [diag];
            fixes.push(action);
        }
    }
    else if (diag.code === 'bml-atoi-decimal-string') {
        const action = new vscode.CodeAction("Replace 'atoi' with 'atof'", vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, editRange, 'atof');
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-nan-fix') {
        const action = new vscode.CodeAction('Replace NaN with jNaN', vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, editRange, 'jNaN');
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-strtodate-fix') {
        const action = new vscode.CodeAction('Replace strtodate with strtojavadate', vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, editRange, 'strtojavadate');
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-gettabledata-fix') {
        const action = new vscode.CodeAction('Replace gettabledata with bmql', vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, editRange, 'bmql');
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-getpartsdata-fix') {
        const action = new vscode.CodeAction('Replace getpartsdata with bmql', vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, editRange, 'bmql');
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-function-not-found-workspace') {
        const msg = diag.message;
        const match = msg.match(/Did you mean '([^']+)'\?/);
        if (match) {
            const suggestion = match[1];
            const action = new vscode.CodeAction(`Replace with '${suggestion}'`, vscode.CodeActionKind.QuickFix);
            action.edit = new vscode.WorkspaceEdit();
            action.edit.replace(document.uri, editRange, suggestion);
            action.diagnostics = [diag];
            fixes.push(action);
        }
    }
    else if (diag.code === 'bml-unknown-function') {
        const word = document.getText(editRange);
        const { findClosestBuiltInFunction, loadBuiltInFunctions } = require('../functions');
        const suggestion = findClosestBuiltInFunction(word, loadBuiltInFunctions(extensionPath));
        if (suggestion) {
            const action = new vscode.CodeAction(`Replace with '${suggestion}'`, vscode.CodeActionKind.QuickFix);
            action.edit = new vscode.WorkspaceEdit();
            action.edit.replace(document.uri, editRange, suggestion);
            action.diagnostics = [diag];
            fixes.push(action);
        }
    }

    return fixes;
}

module.exports = { getQualityFixes };
