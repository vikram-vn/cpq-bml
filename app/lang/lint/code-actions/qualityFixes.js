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
    else if (diag.code === 'bml-null-check-required') {
        const varName = document.getText(editRange);
        const lineIndex = editRange.start.line;
        const lineText = document.lineAt(lineIndex).text;
        const indent = lineText.match(/^\s*/)[0];

        const guardAction = new vscode.CodeAction(`Wrap with null check 'if (not(isnull(${varName})))'`, vscode.CodeActionKind.QuickFix);
        guardAction.edit = new vscode.WorkspaceEdit();
        const lineRange = document.lineAt(lineIndex).range;
        const wrappedCode = `${indent}if (not(isnull(${varName}))) {\n    ${lineText.trim()}\n${indent}}`;
        guardAction.edit.replace(document.uri, lineRange, wrappedCode);
        guardAction.diagnostics = [diag];
        fixes.push(guardAction);
    }
    else if (diag.code === 'bml-unused-variable' || diag.code === 'bml-unused-loop-var') {
        const varName = document.getText(editRange);
        const action = new vscode.CodeAction(`Prefix unused variable with '_' ('_${varName}')`, vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, editRange, `_${varName}`);
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-array-negative-index') {
        const idxText = document.getText(editRange);
        const action0 = new vscode.CodeAction(`Replace negative index '${idxText}' with '0' (first element)`, vscode.CodeActionKind.QuickFix);
        action0.edit = new vscode.WorkspaceEdit();
        action0.edit.replace(document.uri, editRange, '0');
        action0.diagnostics = [diag];
        fixes.push(action0);
    }
    else if (diag.code === 'bml-float-equality') {
        const text = document.getText(editRange);
        const m = text.match(/^\s*([a-zA-Z_]\w*)\s*(==|!=|<>)\s*(\d+\.\d+)\s*$/) ||
                  text.match(/^\s*(\d+\.\d+)\s*(==|!=|<>)\s*([a-zA-Z_]\w*)\s*$/);
        if (m) {
            const isLeftVar = /^[a-zA-Z_]/.test(m[1]);
            const varName = isLeftVar ? m[1] : m[3];
            const op = isLeftVar ? m[2] : m[2];
            const floatVal = isLeftVar ? m[3] : m[1];

            const isNotEqual = (op === '!=' || op === '<>');
            const isZero = (parseFloat(floatVal) === 0);

            const compOp = isNotEqual ? '>' : '<=';
            const toleranceCode = isZero
                ? `abs(${varName}) ${compOp} 0.000001`
                : `abs(${varName} - ${floatVal}) ${compOp} 0.000001`;

            const fix1 = new vscode.CodeAction(`Replace with tolerance check '${toleranceCode}'`, vscode.CodeActionKind.QuickFix);
            fix1.edit = new vscode.WorkspaceEdit();
            fix1.edit.replace(document.uri, editRange, toleranceCode);
            fix1.diagnostics = [diag];
            fixes.push(fix1);

            if (isZero && isNotEqual) {
                const gtCode = `${varName} > 0.0`;
                const fix2 = new vscode.CodeAction(`Replace with '${gtCode}'`, vscode.CodeActionKind.QuickFix);
                fix2.edit = new vscode.WorkspaceEdit();
                fix2.edit.replace(document.uri, editRange, gtCode);
                fix2.diagnostics = [diag];
                fixes.push(fix2);
            }
        }
    }
    else if (diag.code === 'bml-undeclared-variable' || diag.code === 'bml-useBeforeDefine') {
        const msg = diag.message;
        const m = msg.match(/Did you mean '([^']+)'\?/);
        if (m) {
            const suggestion = m[1];
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
