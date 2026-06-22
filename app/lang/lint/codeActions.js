const vscode = require('vscode');

function registerBmlCodeActions(context) {
    // Captured here, before provideCodeActions' own (differently-typed)
    // 'context' parameter below shadows this outer ExtensionContext name -
    // threaded through to getSpellingSuggestions the same way lint/index.js
    // threads it to checkSpelling (see that file's comment for why).
    const extensionPath = context.extensionPath;

    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider('bml', {
            provideCodeActions(document, range, context) {
                const fixes = [];
                context.diagnostics.forEach(diag => {
                    if (diag.code === 'bml-missing-semicolon') {
                        const action = new vscode.CodeAction('Add semicolon', vscode.CodeActionKind.QuickFix);
                        action.edit = new vscode.WorkspaceEdit();
                        action.edit.insert(document.uri, diag.range.end, ';');
                        action.diagnostics = [diag];
                        fixes.push(action);
                    }
                    else if (diag.code === 'bml-assignment-in-condition') {
                        const action = new vscode.CodeAction('Replace = with ==', vscode.CodeActionKind.QuickFix);
                        action.edit = new vscode.WorkspaceEdit();
                        action.edit.replace(document.uri, diag.range, '==');
                        action.diagnostics = [diag];
                        fixes.push(action);
                    }
                    else if (diag.code === 'bml-nan-fix') {
                        const action = new vscode.CodeAction('Replace NaN with jNaN', vscode.CodeActionKind.QuickFix);
                        action.edit = new vscode.WorkspaceEdit();
                        action.edit.replace(document.uri, diag.range, 'jNaN');
                        action.diagnostics = [diag];
                        fixes.push(action);
                    }
                    else if (diag.code === 'bml-strtodate-fix') {
                        const action = new vscode.CodeAction('Replace strtodate with strtojavadate', vscode.CodeActionKind.QuickFix);
                        action.edit = new vscode.WorkspaceEdit();
                        action.edit.replace(document.uri, diag.range, 'strtojavadate');
                        action.diagnostics = [diag];
                        fixes.push(action);
                    }
                    else if (diag.code === 'bml-gettabledata-fix') {
                        const action = new vscode.CodeAction('Replace gettabledata with bmql', vscode.CodeActionKind.QuickFix);
                        action.edit = new vscode.WorkspaceEdit();
                        action.edit.replace(document.uri, diag.range, 'bmql');
                        action.diagnostics = [diag];
                        fixes.push(action);
                    }
                    else if (diag.code === 'bml-getpartsdata-fix') {
                        const action = new vscode.CodeAction('Replace getpartsdata with bmql', vscode.CodeActionKind.QuickFix);
                        action.edit = new vscode.WorkspaceEdit();
                        action.edit.replace(document.uri, diag.range, 'bmql');
                        action.diagnostics = [diag];
                        fixes.push(action);
                    }
                    else if (diag.code === 'bml-operator-fix') {
                        const original = document.getText(diag.range);
                        
                        const compoundOps = {
                            '+=': '+',
                            '-=': '-',
                            '*=': '*',
                            '/=': '/',
                            '%=': '%'
                        };
                        
                        if (compoundOps[original] !== undefined) {
                            const lineText = document.lineAt(diag.range.start.line).text;
                            const startChar = diag.range.start.character;
                            const untrimmedPrefix = lineText.substring(0, startChar);
                            const varMatch = /[a-zA-Z_]\w*\s*$/.exec(untrimmedPrefix);
                            if (varMatch) {
                                const varName = varMatch[0].trim();
                                const op = compoundOps[original];
                                const replacement = `= ${varName} ${op}`;
                                const action = new vscode.CodeAction(`Replace with ${varName} = ${varName} ${op} ...`, vscode.CodeActionKind.QuickFix);
                                action.edit = new vscode.WorkspaceEdit();
                                action.edit.replace(document.uri, diag.range, replacement);
                                action.diagnostics = [diag];
                                fixes.push(action);
                            }
                        }
                        else if (original === '++' || original === '--') {
                            const lineText = document.lineAt(diag.range.start.line).text;
                            const startChar = diag.range.start.character;
                            const untrimmedPrefix = lineText.substring(0, startChar);
                            const varMatch = /[a-zA-Z_]\w*\s*$/.exec(untrimmedPrefix);
                            if (varMatch) {
                                const varName = varMatch[0].trim();
                                const op = original === '++' ? '+' : '-';
                                const fullReplacement = `${varName} = ${varName} ${op} 1`;
                                const varStartChar = varMatch.index;
                                const replaceRange = new vscode.Range(
                                    diag.range.start.line, varStartChar,
                                    diag.range.start.line, startChar + 2
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
                                action.edit.replace(document.uri, diag.range, replacement);
                                action.diagnostics = [diag];
                                fixes.push(action);
                            }
                        }
                    }
                    else if (diag.code === 'bml-spelling-error') {
                        const word = document.getText(diag.range);
                        const { getSpellingSuggestions } = require('../spellCheck/spelling');
                        const suggestions = getSpellingSuggestions(word, extensionPath);
                        suggestions.forEach(suggestion => {
                            const action = new vscode.CodeAction(`Spelling suggestion: "${suggestion}"`, vscode.CodeActionKind.QuickFix);
                            action.edit = new vscode.WorkspaceEdit();
                            action.edit.replace(document.uri, diag.range, suggestion);
                            action.diagnostics = [diag];
                            fixes.push(action);
                        });
                    }
                });
                return fixes;
            }
        })
    );
}

module.exports = { registerBmlCodeActions };
