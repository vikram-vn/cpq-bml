const vscode = require('vscode');

function getSyntaxFixes(document, diag, editRange) {
    const fixes = [];

    if (diag.code === 'bml-missing-semicolon') {
        const action = new vscode.CodeAction('Add semicolon', vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.insert(document.uri, editRange.end, ';');
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-assignment-in-condition') {
        const action = new vscode.CodeAction('Replace = with ==', vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, editRange, '==');
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-trailing-comma-error') {
        const action = new vscode.CodeAction('Remove trailing comma', vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, editRange, '');
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-not-without-parens') {
        const exprText = document.getText(editRange);
        const action = new vscode.CodeAction(`Wrap in parentheses: (${exprText})`, vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, editRange, `(${exprText})`);
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-operator-fix') {
        const original = document.getText(editRange);
        const compoundOps = {
            '+=': '+',
            '-=': '-',
            '*=': '*',
            '/=': '/',
            '%=': '%'
        };
        
        if (compoundOps[original] !== undefined) {
            const lineText = document.lineAt(editRange.start.line).text;
            const startChar = editRange.start.character;
            const untrimmedPrefix = lineText.substring(0, startChar);
            const varMatch = /[a-zA-Z_]\w*\s*$/.exec(untrimmedPrefix);
            if (varMatch) {
                const varName = varMatch[0].trim();
                const op = compoundOps[original];
                const replacement = `= ${varName} ${op}`;
                const action = new vscode.CodeAction(`Replace with ${varName} = ${varName} ${op} ...`, vscode.CodeActionKind.QuickFix);
                action.edit = new vscode.WorkspaceEdit();
                action.edit.replace(document.uri, editRange, replacement);
                action.diagnostics = [diag];
                fixes.push(action);
            }
        }
        else if (original === '++' || original === '--') {
            const lineText = document.lineAt(editRange.start.line).text;
            const startChar = editRange.start.character;
            const untrimmedPrefix = lineText.substring(0, startChar);
            const varMatch = /[a-zA-Z_]\w*\s*$/.exec(untrimmedPrefix);
            if (varMatch) {
                const varName = varMatch[0].trim();
                const op = original === '++' ? '+' : '-';
                const fullReplacement = `${varName} = ${varName} ${op} 1`;
                const varStartChar = varMatch.index;
                const replaceRange = new vscode.Range(
                    editRange.start.line, varStartChar,
                    editRange.start.line, startChar + 2
                );
                const action = new vscode.CodeAction(`Replace with ${fullReplacement}`, vscode.CodeActionKind.QuickFix);
                action.edit = new vscode.WorkspaceEdit();
                action.edit.replace(document.uri, replaceRange, fullReplacement);
                action.diagnostics = [diag];
                fixes.push(action);
            }
        }
        else {
            const replacementMap = {
                '===': '==',
                '!==': '<>',
                '!=': '<>',
                '< =': '<=',
                '> =': '>=',
                '&&': 'AND',
                '||': 'OR',
                '!': 'NOT'
            };
            const replacement = replacementMap[original];
            if (replacement) {
                const action = new vscode.CodeAction(`Replace with ${replacement}`, vscode.CodeActionKind.QuickFix);
                action.edit = new vscode.WorkspaceEdit();
                action.edit.replace(document.uri, editRange, replacement);
                action.diagnostics = [diag];
                fixes.push(action);
            }
        }
    }
    else if (diag.code === 'bml-multiple-statements-per-line') {
        const lineIndex = editRange.start.line;
        const lineText = document.lineAt(lineIndex).text;
        const indentMatch = lineText.match(/^\s*/);
        const indent = indentMatch ? indentMatch[0] : '';
        const statements = lineText.split(';').map(s => s.trim()).filter(Boolean);
        if (statements.length > 1) {
            const newLines = statements.map(s => `${indent}${s};`).join('\n');
            const action = new vscode.CodeAction('Split statements onto new lines', vscode.CodeActionKind.QuickFix);
            action.edit = new vscode.WorkspaceEdit();
            action.edit.replace(document.uri, document.lineAt(lineIndex).range, newLines);
            action.diagnostics = [diag];
            fixes.push(action);
        }
    }
    else if (diag.code === 'bml-division-by-zero') {
        const text = document.getText(editRange);
        const action = new vscode.CodeAction("Replace zero divisor with safe fallback ('1.0')", vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        const replaced = text.replace(/0(?:\.0+)?/, '1.0');
        action.edit.replace(document.uri, editRange, replaced);
        action.diagnostics = [diag];
        fixes.push(action);
    }
    else if (diag.code === 'bml-binary-type-mismatch') {
        const lineText = document.lineAt(editRange.start.line).text;
        const opPos = editRange.start.character;
        const op = lineText.substring(opPos, editRange.end.character);

        const isComparison = ['==', '!=', '<>', '<', '>', '<=', '>='].includes(op);
        if (op === '+' || isComparison) {
            const beforeOp = lineText.substring(0, opPos);
            const afterOp = lineText.substring(editRange.end.character);

            const createConversionActions = (operand, range, isStringSide) => {
                const opLower = operand.toLowerCase();
                const actions = [];

                if (!isStringSide) {
                    // Non-string operand: convert to String using string()
                    const titleStr = isComparison
                        ? `Convert number/operand to String for comparison: string(${operand})`
                        : `Convert to String using string(${operand})`;
                    const actionString = new vscode.CodeAction(titleStr, vscode.CodeActionKind.QuickFix);
                    actionString.edit = new vscode.WorkspaceEdit();
                    actionString.edit.replace(document.uri, range, `string(${operand})`);
                    actionString.diagnostics = [diag];
                    actions.push(actionString);

                    if (opLower.includes('json')) {
                        const actionJson = new vscode.CodeAction(`Convert JSON to String using jsontostr(${operand})`, vscode.CodeActionKind.QuickFix);
                        actionJson.edit = new vscode.WorkspaceEdit();
                        actionJson.edit.replace(document.uri, range, `jsontostr(${operand})`);
                        actionJson.diagnostics = [diag];
                        actions.push(actionJson);
                    }

                    if (opLower.includes('dict')) {
                        const actionDict = new vscode.CodeAction(`Convert Dictionary to String using dicttostr(${operand})`, vscode.CodeActionKind.QuickFix);
                        actionDict.edit = new vscode.WorkspaceEdit();
                        actionDict.edit.replace(document.uri, range, `dicttostr(${operand})`);
                        actionDict.diagnostics = [diag];
                        actions.push(actionDict);
                    }

                    if (opLower.includes('date')) {
                        const actionDate = new vscode.CodeAction(`Format Date to String using formatdate(${operand}, "yyyy-MM-dd")`, vscode.CodeActionKind.QuickFix);
                        actionDate.edit = new vscode.WorkspaceEdit();
                        actionDate.edit.replace(document.uri, range, `formatdate(${operand}, "yyyy-MM-dd")`);
                        actionDate.diagnostics = [diag];
                        actions.push(actionDate);
                    }
                } else {
                    // String operand: convert String to Integer/Float using atoi() or atof()
                    const contextText = isComparison ? 'for comparison' : 'for addition';
                    const isLiteral = /^["']/.test(operand);
                    const cleanLiteral = isLiteral ? operand.slice(1, -1) : operand;

                    // If it's a literal non-numeric string like "test", skip atoi/atof
                    if (isLiteral && isNaN(Number(cleanLiteral))) {
                        return actions;
                    }

                    const isDecimal = cleanLiteral.includes('.');
                    if (!isDecimal) {
                        const actionAtoi = new vscode.CodeAction(`Parse String to Integer ${contextText}: atoi(${operand})`, vscode.CodeActionKind.QuickFix);
                        actionAtoi.edit = new vscode.WorkspaceEdit();
                        actionAtoi.edit.replace(document.uri, range, `atoi(${operand})`);
                        actionAtoi.diagnostics = [diag];
                        actions.push(actionAtoi);
                    }

                    if (isDecimal || !isLiteral) {
                        const actionAtof = new vscode.CodeAction(`Parse String to Float ${contextText}: atof(${operand})`, vscode.CodeActionKind.QuickFix);
                        actionAtof.edit = new vscode.WorkspaceEdit();
                        actionAtof.edit.replace(document.uri, range, `atof(${operand})`);
                        actionAtof.diagnostics = [diag];
                        actions.push(actionAtof);
                    }
                }

                return actions;
            };

            const rightMatch = afterOp.match(/^\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[a-zA-Z_]\w*|\d+(?:\.\d+)?)/);
            if (rightMatch) {
                const rightOperand = rightMatch[1];
                const isStr = /^["']/.test(rightOperand) || rightOperand.toLowerCase().includes('str');
                const rightStart = editRange.end.character + afterOp.indexOf(rightOperand);
                const rightRange = new vscode.Range(
                    editRange.start.line, rightStart,
                    editRange.start.line, rightStart + rightOperand.length
                );
                fixes.push(...createConversionActions(rightOperand, rightRange, isStr));
            }

            const leftMatch = beforeOp.match(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[a-zA-Z_]\w*|\d+(?:\.\d+)?)\s*$/);
            if (leftMatch) {
                const leftOperand = leftMatch[1];
                const isStr = /^["']/.test(leftOperand) || leftOperand.toLowerCase().includes('str');
                const leftStart = beforeOp.lastIndexOf(leftOperand);
                const leftRange = new vscode.Range(
                    editRange.start.line, leftStart,
                    editRange.start.line, leftStart + leftOperand.length
                );
                fixes.push(...createConversionActions(leftOperand, leftRange, isStr));
            }
        }
    }

    return fixes;
}

module.exports = { getSyntaxFixes };
