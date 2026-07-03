const vscode = require('vscode');

function registerBmlCodeActions(context) {
    const extensionPath = context.extensionPath;

    // Register add word commands
    const addUserWordCmd = vscode.commands.registerCommand('cpqBml.spelling.addUserWord', async (word) => {
        const config = vscode.workspace.getConfiguration('cpqBml');
        const userWords = config.get('spelling.userWords', []);
        if (!userWords.includes(word)) {
            await config.update('spelling.userWords', [...userWords, word], vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Added "${word}" to User Settings.`);
        }
    });
    context.subscriptions.push(addUserWordCmd);

    const addWorkspaceWordCmd = vscode.commands.registerCommand('cpqBml.spelling.addWorkspaceWord', async (word) => {
        const config = vscode.workspace.getConfiguration('cpqBml');
        const userWords = config.get('spelling.userWords', []);
        if (!userWords.includes(word)) {
            try {
                await config.update('spelling.userWords', [...userWords, word], vscode.ConfigurationTarget.Workspace);
                vscode.window.showInformationMessage(`Added "${word}" to Workspace Settings.`);
            } catch (e) {
                await config.update('spelling.userWords', [...userWords, word], vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage(`Added "${word}" to User Settings (fallback).`);
            }
        }
    });
    context.subscriptions.push(addWorkspaceWordCmd);

    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider('bml', {
            provideCodeActions(document, range, context) {
                const fixes = [];
                context.diagnostics.forEach(diag => {
                    // Use originalRange (narrow token) for edits; diag.range may have been
                    // expanded to the full line for Error highlighting in lint.js.
                    const editRange = diag.originalRange ?? diag.range;

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
                        const { findClosestBuiltInFunction, loadBuiltInFunctions } = require('./functions');
                        const suggestion = findClosestBuiltInFunction(word, loadBuiltInFunctions(extensionPath));
                        if (suggestion) {
                            const action = new vscode.CodeAction(`Replace with '${suggestion}'`, vscode.CodeActionKind.QuickFix);
                            action.edit = new vscode.WorkspaceEdit();
                            action.edit.replace(document.uri, editRange, suggestion);
                            action.diagnostics = [diag];
                            fixes.push(action);
                        }
                    }
                    else if (diag.code === 'bml-spelling-error') {
                        const word = document.getText(editRange);
                        const { getSpellingSuggestions } = require('../spellCheck/spelling');
                        const suggestions = getSpellingSuggestions(word, extensionPath);
                        suggestions.forEach(suggestion => {
                            const action = new vscode.CodeAction(`Spelling suggestion: "${suggestion}"`, vscode.CodeActionKind.QuickFix);
                            action.edit = new vscode.WorkspaceEdit();
                            action.edit.replace(document.uri, editRange, suggestion);
                            action.diagnostics = [diag];
                            fixes.push(action);
                        });

                        const addUserWordAction = new vscode.CodeAction(`Add "${word}" to User Settings`, vscode.CodeActionKind.QuickFix);
                        addUserWordAction.command = {
                            title: 'Add Word to User Settings',
                            command: 'cpqBml.spelling.addUserWord',
                            arguments: [word]
                        };
                        addUserWordAction.diagnostics = [diag];
                        fixes.push(addUserWordAction);

                        const addWorkspaceWordAction = new vscode.CodeAction(`Add "${word}" to Workspace Settings`, vscode.CodeActionKind.QuickFix);
                        addWorkspaceWordAction.command = {
                            title: 'Add Word to Workspace Settings',
                            command: 'cpqBml.spelling.addWorkspaceWord',
                            arguments: [word]
                        };
                        addWorkspaceWordAction.diagnostics = [diag];
                        fixes.push(addWorkspaceWordAction);
                    }
                });
                return fixes;
            }
        })
    );
}

module.exports = { registerBmlCodeActions };
