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

    return fixes;
}

module.exports = { getSyntaxFixes };
