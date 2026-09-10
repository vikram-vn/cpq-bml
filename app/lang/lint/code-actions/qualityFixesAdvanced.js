const vscode = require('vscode');

function getAdvancedQualityFixes(document, diag, editRange, extensionPath) {
    const fixes = [];

    if (diag.code === 'bml-jnan-function-call') {
        const action = new vscode.CodeAction("Remove parentheses: 'jNaN' is a constant, not a function", vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, editRange, 'jNaN');
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-math-domain-error') {
        const text = document.getText(editRange);
        const match = text.match(/\b(acos|asin)\s*\(\s*(-?\d+(?:\.\d+)?)\s*\)/);
        if (match) {
            const funcName = match[1];
            const val = parseFloat(match[2]);
            const clampedVal = val > 1.0 ? '1.0' : '-1.0';
            const action = new vscode.CodeAction(`Clamp argument to valid domain [-1, 1]: ${funcName}(${clampedVal})`, vscode.CodeActionKind.QuickFix);
            action.edit = new vscode.WorkspaceEdit();
            action.edit.replace(document.uri, editRange, `${funcName}(${clampedVal})`);
            action.diagnostics = [diag];
            fixes.push(action);
        }
    }
    else if (diag.code === 'bml-strtodate-fix') {
        const action = new vscode.CodeAction('Replace strtodate with strtojavadate', vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, editRange, 'strtojavadate');
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-date-format-year') {
        const text = document.getText(editRange);
        const action = new vscode.CodeAction("Fix year format: replace 'YYYY' with 'yyyy'", vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, editRange, text.replace(/YYYY/g, 'yyyy'));
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-date-format-day') {
        const text = document.getText(editRange);
        const action = new vscode.CodeAction("Fix day format: replace 'DD' with 'dd'", vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, editRange, text.replace(/DD/g, 'dd'));
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-date-format-month') {
        const text = document.getText(editRange);
        const action = new vscode.CodeAction("Fix month format: replace 'mm' with 'MM'", vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, editRange, text.replace(/mm/g, 'MM'));
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-constant-condition') {
        const msg = diag.message;
        if (msg.includes('always true')) {
            const action = new vscode.CodeAction("Replace condition with 'true'", vscode.CodeActionKind.QuickFix);
            action.edit = new vscode.WorkspaceEdit();
            action.edit.replace(document.uri, editRange, '(true)');
            action.diagnostics = [diag];
            fixes.push(action);
        } else if (msg.includes('always false')) {
            const action = new vscode.CodeAction("Replace condition with 'false'", vscode.CodeActionKind.QuickFix);
            action.edit = new vscode.WorkspaceEdit();
            action.edit.replace(document.uri, editRange, '(false)');
            action.diagnostics = [diag];
            fixes.push(action);
        } else if (msg.includes('compares')) {
            const text = document.getText(editRange);
            const m = text.match(/^([a-zA-Z_][\w.]*)\s*(==|<>|!=)\s*([a-zA-Z_][\w.]*)$/);
            if (m) {
                const varName = m[1];
                const action = new vscode.CodeAction(`Fix self-comparison of '${varName}'`, vscode.CodeActionKind.QuickFix);
                action.edit = new vscode.WorkspaceEdit();
                action.edit.replace(document.uri, editRange, `${varName} == targetVal`);
                action.diagnostics = [diag];
                fixes.push(action);
            }
        }
    }
    else if (diag.code === 'bml-duplicate-branch-condition') {
        const action = new vscode.CodeAction("Remove duplicate elif branch", vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.delete(document.uri, new vscode.Range(editRange.start.line, 0, editRange.start.line + 1, 0));
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-dict-missing-type') {
        const actionStr = new vscode.CodeAction('Change dict() to dict("string")', vscode.CodeActionKind.QuickFix);
        actionStr.edit = new vscode.WorkspaceEdit();
        actionStr.edit.replace(document.uri, editRange, 'dict("string")');
        actionStr.diagnostics = [diag];
        fixes.push(actionStr);

        const actionAny = new vscode.CodeAction('Change dict() to dict("anytype")', vscode.CodeActionKind.QuickFix);
        actionAny.edit = new vscode.WorkspaceEdit();
        actionAny.edit.replace(document.uri, editRange, 'dict("anytype")');
        actionAny.diagnostics = [diag];
        fixes.push(actionAny);
    }
    else if (diag.code === 'bml-dict-invalid-type') {
        const actionStr = new vscode.CodeAction('Replace invalid type with "string"', vscode.CodeActionKind.QuickFix);
        actionStr.edit = new vscode.WorkspaceEdit();
        actionStr.edit.replace(document.uri, editRange, 'dict("string")');
        actionStr.diagnostics = [diag];
        fixes.push(actionStr);

        const actionAny = new vscode.CodeAction('Replace invalid type with "anytype"', vscode.CodeActionKind.QuickFix);
        actionAny.edit = new vscode.WorkspaceEdit();
        actionAny.edit.replace(document.uri, editRange, 'dict("anytype")');
        actionAny.diagnostics = [diag];
        fixes.push(actionAny);
    }
    else if (diag.code === 'bml-json-get-throws-without-default') {
        const text = document.getText(editRange);
        let defaultVal = '0';
        if (/float/i.test(text)) defaultVal = '0.0';
        else if (/boolean/i.test(text)) defaultVal = 'false';

        const action = new vscode.CodeAction(`Add default value argument '${defaultVal}' to prevent runtime exception`, vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, editRange, text.replace(/\)$/, `, ${defaultVal})`));
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-jsonput-reserved-literal') {
        const text = document.getText(editRange);
        if (text.includes('"null"') || text.includes("'null'")) {
            const action = new vscode.CodeAction('Replace string "null" with jsonnull()', vscode.CodeActionKind.QuickFix);
            action.edit = new vscode.WorkspaceEdit();
            action.edit.replace(document.uri, editRange, text.replace(/["']null["']/, 'jsonnull()'));
            action.diagnostics = [diag];
            fixes.push(action);
        }
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
        const { findClosestBuiltInFunction, loadBuiltInFunctions } = require('@/lang/lint/rules/functions');
        const suggestion = findClosestBuiltInFunction(word, loadBuiltInFunctions(extensionPath));
        if (suggestion) {
            const action = new vscode.CodeAction(`Replace with '${suggestion}'`, vscode.CodeActionKind.QuickFix);
            action.edit = new vscode.WorkspaceEdit();
            action.edit.replace(document.uri, editRange, suggestion);
            action.diagnostics = [diag];
            fixes.push(action);
        }
        if (word.toLowerCase() === 'length') {
            const arrAction = new vscode.CodeAction(`Replace with 'sizeofarray' (for arrays)`, vscode.CodeActionKind.QuickFix);
            arrAction.edit = new vscode.WorkspaceEdit();
            arrAction.edit.replace(document.uri, editRange, 'sizeofarray');
            arrAction.diagnostics = [diag];
            fixes.push(arrAction);
        } else if (word.toLowerCase() === 'indexof') {
            const arrAction = new vscode.CodeAction(`Replace with 'findinarray' (for arrays)`, vscode.CodeActionKind.QuickFix);
            arrAction.edit = new vscode.WorkspaceEdit();
            arrAction.edit.replace(document.uri, editRange, 'findinarray');
            arrAction.diagnostics = [diag];
            fixes.push(arrAction);
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
        const lineIndex = editRange.start.line;
        const lineText = document.lineAt(lineIndex).text;
        const indentMatch = lineText.match(/^\s*/);
        const indent = indentMatch ? indentMatch[0] : '';

        const commentAction = new vscode.CodeAction(`Comment out unused variable '${varName}' statement`, vscode.CodeActionKind.QuickFix);
        commentAction.edit = new vscode.WorkspaceEdit();
        const commentedLine = `${indent}// ${lineText.trim()}`;
        commentAction.edit.replace(document.uri, document.lineAt(lineIndex).range, commentedLine);
        commentAction.diagnostics = [diag];
        fixes.push(commentAction);

        const removeAction = new vscode.CodeAction(`Remove unused variable '${varName}' statement`, vscode.CodeActionKind.QuickFix);
        removeAction.edit = new vscode.WorkspaceEdit();
        const lineRangeWithBreak = document.lineAt(lineIndex).rangeIncludingLineBreak;
        removeAction.edit.delete(document.uri, lineRangeWithBreak);
        removeAction.diagnostics = [diag];
        fixes.push(removeAction);
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
            const op = m[2];
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
    else if (diag.code === 'bml-unchecked-split-access') {
        const line = document.lineAt(editRange.start.line);
        const lineText = line.text;
        const indentMatch = lineText.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : '';
        const m = lineText.match(/([a-zA-Z_]\w*)\[\s*(\d+)\s*\]/);
        if (m) {
            const arrVar = m[1];
            const idx = parseInt(m[2], 10);
            const action = new vscode.CodeAction(`Guard with 'if (sizeofarray(${arrVar}) > ${idx})'`, vscode.CodeActionKind.QuickFix);
            action.edit = new vscode.WorkspaceEdit();
            const wrapped = `${indent}if (sizeofarray(${arrVar}) > ${idx}) {\n    ${lineText.trim()}\n${indent}}`;
            action.edit.replace(document.uri, line.range, wrapped);
            action.diagnostics = [diag];
            action.isPreferred = true;
            fixes.push(action);
        }
    }
    else if (diag.code === 'bml-for-in-function-call') {
        const line = document.lineAt(editRange.start.line);
        const lineText = line.text;
        const indentMatch = lineText.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : '';
        const m = lineText.match(/\bfor\s+([a-zA-Z_]\w*)\s+in\s+([a-zA-Z_]\w*\s*\([^)]*\))\s*\{/i);
        if (m) {
            const loopVar = m[1];
            const callExpr = m[2];
            const tempVar = `${loopVar}_list`;
            const action = new vscode.CodeAction(`Extract function call to temporary variable '${tempVar}'`, vscode.CodeActionKind.QuickFix);
            action.edit = new vscode.WorkspaceEdit();
            const replacement = `${indent}${tempVar} = ${callExpr};\n${indent}for ${loopVar} in ${tempVar} {`;
            action.edit.replace(document.uri, line.range, replacement);
            action.diagnostics = [diag];
            action.isPreferred = true;
            fixes.push(action);
        }
    }
    else if (diag.code === 'bml-empty-loop') {
        const text = document.getText(editRange);
        const action = new vscode.CodeAction("Add '// TODO: loop processing' inside loop", vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        const replaced = text.replace(/\{\s*\}/, '{\n    // TODO: loop processing\n}');
        action.edit.replace(document.uri, editRange, replaced);
        action.diagnostics = [diag];
        fixes.push(action);
    }

    return fixes;
}

module.exports = {
    getAdvancedQualityFixes
};
