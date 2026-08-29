const assert = require('assert');
const vscode = require('vscode');
const { lintBMLCustom } = require('../../app/lang/lint/core/lint');
const { activateExtension } = require('../extensionHelper');

function runUnreachableCodeActionTests() {
    suite('BML Unreachable Code Actions Suite', () => {
        suiteSetup(async () => {
            await activateExtension(vscode);
        });

        test('Quick Fix for unreachable code', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'return "";\nx = 5;'
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const unreachDiag = diags.find(d => d.code === 'bml-unreachable-code');
            assert.ok(unreachDiag, 'Should have unreachable code diagnostic');

            const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, unreachDiag.range);
            const commentAction = codeActions.find(a => a.title.includes('Comment out unreachable code line'));
            assert.ok(commentAction, 'Should offer comment out unreachable code Quick Fix');

            const removeAction = codeActions.find(a => a.title.includes('Remove unreachable code line'));
            assert.ok(removeAction, 'Should offer remove unreachable code Quick Fix');
        });
    });
}

module.exports = { runUnreachableCodeActionTests };
