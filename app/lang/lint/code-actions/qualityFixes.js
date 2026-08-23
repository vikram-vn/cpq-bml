const vscode = require('vscode');

function toUpperSnakeCase(ident) {
    return ident
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .toUpperCase();
}

function inferConstantCandidateName(lineText, charPos, val) {
    const valStr = String(val);
    const safeValFallback = 'CONST_' + valStr.replace(/[^0-9]/g, '_');
    const prefix = lineText.substring(0, charPos);
    const suffix = lineText.substring(charPos + valStr.length);

    // 1. Direct Assignment context: `myVar = <val>` or `float myVar = -<val>`
    const assignMatch = prefix.match(/(?:(?:string|integer|float|boolean|dict|json|jsonarray|date)\s+)?([a-zA-Z_]\w*)\s*=\s*[+-]?\s*$/i);
    if (assignMatch) {
        const varName = assignMatch[1];
        const upper = toUpperSnakeCase(varName);
        if (upper.endsWith('_DEFAULT') || upper.endsWith('_CONST') || upper.endsWith('_LIMIT') || upper.endsWith('_RATE')) {
            return upper;
        }
        return `${upper}_DEFAULT`;
    }

    // 2. Comparison context: `if (totalAmount > <val>)`
    const compMatch = prefix.match(/([a-zA-Z_]\w*)\s*(>|>=|<|<=|==|!=)\s*$/);
    if (compMatch) {
        const varName = compMatch[1];
        const op = compMatch[2];
        const upper = toUpperSnakeCase(varName);
        if (op === '>' || op === '>=') {
            return `${upper}_LIMIT`;
        } else if (op === '<' || op === '<=') {
            return `${upper}_MIN_LIMIT`;
        } else {
            return `${upper}_TARGET`;
        }
    }

    // 3. Right-hand comparison: `<val> < totalAmount`
    const rightCompMatch = suffix.match(/^\s*(>|>=|<|<=|==|!=)\s*([a-zA-Z_]\w*)/);
    if (rightCompMatch) {
        const op = rightCompMatch[1];
        const varName = rightCompMatch[2];
        const upper = toUpperSnakeCase(varName);
        if (op === '<' || op === '<=') {
            return `${upper}_LIMIT`;
        } else if (op === '>' || op === '>=') {
            return `${upper}_MIN_LIMIT`;
        } else {
            return `${upper}_TARGET`;
        }
    }

    return safeValFallback;
}

function renameIdentifierInDocument(document, oldName, newName, edit) {
    const text = document.getText();
    const regex = new RegExp(`\\b${oldName.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'g');
    let match;
    while ((match = regex.exec(text)) !== null) {
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + oldName.length);
        edit.replace(document.uri, new vscode.Range(startPos, endPos), newName);
    }
}

function renameLiteralNumberInDocument(document, val, newName, edit) {
    const text = document.getText();
    const regex = new RegExp(`(?<![a-zA-Z0-9_.])\\b${val.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b(?![a-zA-Z0-9_.])`, 'g');
    let match;
    while ((match = regex.exec(text)) !== null) {
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + val.length);
        edit.replace(document.uri, new vscode.Range(startPos, endPos), newName);
    }
}

function getQualityFixes(document, diag, editRange, extensionPath) {
    const fixes = [];

    if (diag.code === 'bml-magic-number') {
        const val = document.getText(editRange);
        const lineText = document.lineAt(editRange.start.line).text;
        const prefix = lineText.substring(0, editRange.start.character);
        const suffix = lineText.substring(editRange.start.character + val.length);
        const smartName = inferConstantCandidateName(lineText, editRange.start.character, val);
        const fallbackName = 'CONST_' + val.replace(/[^0-9]/g, '_');

        const candidateNames = [smartName];
        if (fallbackName !== smartName) {
            candidateNames.push(fallbackName);
        }

        const directAssignMatch = prefix.match(/(?:(?:string|integer|float|boolean|dict|json|jsonarray|date)\s+)?([a-zA-Z_]\w*)\s*=\s*$/i);
        const isPureAssignment = directAssignMatch && (/^[\s;]*$/.test(suffix));

        const indentMatch = lineText.match(/^\s*/);
        const indent = indentMatch ? indentMatch[0] : '';
        const lineStartPos = new vscode.Position(editRange.start.line, 0);

        for (const constName of candidateNames) {
            const action = new vscode.CodeAction(`Extract '${val}' to constant candidate '${constName}' (all occurrences)`, vscode.CodeActionKind.QuickFix);
            action.edit = new vscode.WorkspaceEdit();

            if (isPureAssignment) {
                const targetVar = directAssignMatch[1];
                renameIdentifierInDocument(document, targetVar, constName, action.edit);
            } else {
                const decl = `${indent}${constName} = ${val};\n`;
                action.edit.insert(document.uri, lineStartPos, decl);
                action.edit.replace(document.uri, editRange, constName);
            }

            action.diagnostics = [diag];
            fixes.push(action);
        }
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
        const action = new vscode.CodeAction(`Replace unsafe empty atoi/atof with default number ${defaultVal}`, vscode.CodeActionKind.QuickFix);
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
        const actionZero = new vscode.CodeAction('Change array size to 0', vscode.CodeActionKind.QuickFix);
        actionZero.edit = new vscode.WorkspaceEdit();
        actionZero.edit.replace(document.uri, editRange, text.replace(/\[\s*-\d+\s*\]/, '[0]'));
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
    else if (diag.code === 'bml-jnan-function-call') {
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
    else if (diag.code === 'bml-lonelyIf') {
        const action = new vscode.CodeAction("Convert 'else { if (...)' to 'elif (...)'", vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        const startLine = document.lineAt(editRange.start.line).text;
        action.edit.replace(document.uri, editRange, 'elif');
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
        const lineText = document.lineAt(editRange.start.line).text;
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

module.exports = {
    getQualityFixes,
    toUpperSnakeCase,
    inferConstantCandidateName
};
