const vscode = require('vscode');
const {
    toUpperSnakeCase,
    inferConstantCandidateName,
    renameIdentifierInDocument
} = require('@/lang/lint/code-actions/qualityHelpers');
const { getAdvancedQualityFixes } = require('@/lang/lint/code-actions/qualityFixesAdvanced');

function getQualityFixes(document, diag, editRange, extensionPath) {
    const fixes = [];

    if (diag.code === 'bml-empty-block') {
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
    else if (diag.code === 'bml-lonelyIf') {
        const text = document.getText(editRange);
        const action = new vscode.CodeAction("Convert to 'elif'", vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        const replaced = text.replace(/else\s*\{\s*if\s*\(/i, 'elif (');
        action.edit.replace(document.uri, editRange, replaced);
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-missing-return') {
        let retStmt = 'return "";';
        const msg = diag.message || '';
        if (/\b(integer|int)\b/i.test(msg)) retStmt = 'return 0;';
        else if (/\b(float|double)\b/i.test(msg)) retStmt = 'return 0.0;';
        else if (/\bboolean\b/i.test(msg)) retStmt = 'return true;';
        else if (/\bstring\[\]\b/i.test(msg)) retStmt = 'return string[];';
        else if (/\binteger\[\]\b/i.test(msg)) retStmt = 'return integer[];';
        else if (/\bfloat\[\]\b/i.test(msg)) retStmt = 'return float[];';
        else if (/\bdict(?:ionary)?\b/i.test(msg)) retStmt = 'return dict("string");';
        else if (/\bjson\b/i.test(msg)) retStmt = 'return json("{}");';

        const action = new vscode.CodeAction(`Add return statement '${retStmt}'`, vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        const lastLine = document.lineCount > 0 ? document.lineCount - 1 : 0;
        const lastLineText = document.lineAt(lastLine).text;
        const endPos = new vscode.Position(lastLine, lastLineText.length);
        action.edit.insert(document.uri, endPos, `\n${retStmt}\n`);
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
    else if (diag.code === 'bml-unsafe-atoi-atof') {
        const text = document.getText(editRange);
        const match = text.match(/\b(atoi|atof)\s*\(\s*([a-zA-Z_]\w*)\s*\)/);
        if (match) {
            const funcName = match[1];
            const varName = match[2];
            const defaultVal = funcName === 'atoi' ? '0' : '0.0';
            const action = new vscode.CodeAction(`Guard with isnumber(${varName}) check before ${funcName}`, vscode.CodeActionKind.QuickFix);
            action.edit = new vscode.WorkspaceEdit();
            action.edit.replace(document.uri, editRange, `(isnumber(${varName}) ? ${funcName}(${varName}) : ${defaultVal})`);
            action.diagnostics = [diag];
            fixes.push(action);
        }
    }
    else if (diag.code === 'bml-atoi-atof-empty-string' || diag.code === 'bml-atoi-atof-empty-literal') {
        const text = document.getText(editRange);
        const defaultVal = text.includes('atof') ? '0.0' : '0';
        const action = new vscode.CodeAction(`Replace with ${defaultVal}`, vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, editRange, defaultVal);
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-replace-empty-search-string' || diag.code === 'bml-replace-empty-pattern') {
        const action = new vscode.CodeAction("Replace empty search string '' with non-empty pattern \" \"", vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, editRange, document.getText(editRange).replace(/replace\s*\(\s*([^,]+)\s*,\s*["']["']/, 'replace($1, " "'));
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-isnumber-no-args') {
        const action = new vscode.CodeAction("Add string argument to isnumber()", vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, editRange, 'isnumber("0")');
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-sort-invalid-order') {
        const actionAsc = new vscode.CodeAction('Change sortOrder to "asc"', vscode.CodeActionKind.QuickFix);
        actionAsc.edit = new vscode.WorkspaceEdit();
        const text = document.getText(editRange);
        actionAsc.edit.replace(document.uri, editRange, text.replace(/sort\s*\(\s*([^,]+)\s*,\s*["'][^"']*["']/, 'sort($1, "asc"'));
        actionAsc.diagnostics = [diag];
        fixes.push(actionAsc);

        const actionDesc = new vscode.CodeAction('Change sortOrder to "desc"', vscode.CodeActionKind.QuickFix);
        actionDesc.edit = new vscode.WorkspaceEdit();
        actionDesc.edit.replace(document.uri, editRange, text.replace(/sort\s*\(\s*([^,]+)\s*,\s*["'][^"']*["']/, 'sort($1, "desc"'));
        actionDesc.diagnostics = [diag];
        fixes.push(actionDesc);
    }
    else if (diag.code === 'bml-sort-invalid-type') {
        const types = ['text', 'numeric', 'date'];
        const text = document.getText(editRange);
        for (const t of types) {
            const action = new vscode.CodeAction(`Change sortType to "${t}"`, vscode.CodeActionKind.QuickFix);
            action.edit = new vscode.WorkspaceEdit();
            action.edit.replace(document.uri, editRange, text.replace(/(sort\s*\(\s*[^,]+\s*,\s*[^,]+\s*,\s*)["'][^"']*["']/, `$1"${t}"`));
            action.diagnostics = [diag];
            fixes.push(action);
        }
    }
    else if (diag.code === 'bml-negative-array-size') {
        const text = document.getText(editRange);
        const lineText = document.lineAt(editRange.start.line).text;
        const match = text.match(/-\d+/) || lineText.match(/\[\s*(-\d+)\s*\]/);
        const num = match ? (match[1] || match[0]) : '-1';
        const actionZero = new vscode.CodeAction(`Replace ${num} with 0`, vscode.CodeActionKind.QuickFix);
        actionZero.edit = new vscode.WorkspaceEdit();
        if (text.includes('[')) {
            actionZero.edit.replace(document.uri, editRange, text.replace(/\[\s*-\d+\s*\]/, '[0]'));
        } else {
            actionZero.edit.replace(document.uri, editRange, '0');
        }
        actionZero.diagnostics = [diag];
        fixes.push(actionZero);
    }
    else if (diag.code === 'bml-array-negative-index') {
        const text = document.getText(editRange);
        const actionZero = new vscode.CodeAction('Change negative index to 0', vscode.CodeActionKind.QuickFix);
        actionZero.edit = new vscode.WorkspaceEdit();
        actionZero.edit.replace(document.uri, editRange, text.replace(/\[\s*-\d+\s*\]/, '[0]'));
        actionZero.diagnostics = [diag];
        fixes.push(actionZero);
    }
    else if (diag.code === 'bml-array-dimension-error' || diag.code === 'bml-sort-array-dimension') {
        const text = document.getText(editRange);
        const match = text.match(/\b([a-zA-Z_]\w*)\s*\(/);
        if (match) {
            const funcName = match[1];
            const action = new vscode.CodeAction(`Index 2-D array with [0] for ${funcName}()`, vscode.CodeActionKind.QuickFix);
            action.edit = new vscode.WorkspaceEdit();
            action.edit.replace(document.uri, editRange, text.replace(/\(\s*([a-zA-Z_]\w*)/, '($1[0]'));
            action.diagnostics = [diag];
            fixes.push(action);
        }
    }
    else if (diag.code === 'bml-nan-fix') {
        const action = new vscode.CodeAction('Replace NaN with jNaN', vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, editRange, 'jNaN');
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else {
        fixes.push(...getAdvancedQualityFixes(document, diag, editRange, extensionPath));
    }

    return fixes;
}

module.exports = {
    getQualityFixes,
    toUpperSnakeCase,
    inferConstantCandidateName
};
