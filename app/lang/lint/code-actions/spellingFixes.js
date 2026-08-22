const vscode = require('vscode');

function registerSpellingCommands(context) {
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
}

function getSpellingFixes(document, diag, editRange, extensionPath) {
    const fixes = [];

    if (diag.code === 'bml-spelling-error') {
        const word = document.getText(editRange);
        const { getSpellingSuggestions } = require('../../spell-check/spelling');
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

    return fixes;
}

module.exports = { registerSpellingCommands, getSpellingFixes };
