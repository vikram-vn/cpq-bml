const assert = require('assert');
const vscode = require('vscode');
const { lintBMLCustom } = require('@/lang/lint/core/lint');
const { activateExtension } = require('@/test/extensionHelper');

function runSuppressionCodeActionTests() {
    suite('BML Line Suppression Code Actions Suite', () => {
        suiteSetup(async () => {
            await activateExtension(vscode);
        });

        test('Universal Quick Fix to disable lint rule for a line', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'if (true) {}\nreturn "";'
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const emptyDiag = diags.find(d => d.code === 'bml-empty-block');
            assert.ok(emptyDiag, 'Should have empty block diagnostic');

            const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, emptyDiag.range);
            const disableAction = codeActions.find(a => a.title.includes("Disable 'bml-empty-block' for this line"));
            assert.ok(disableAction, 'Should offer universal line suppression Quick Fix');

            // Verify no duplicate actions exist per kind
            const qfActions = codeActions.filter(a => a.kind && a.kind.value && a.kind.value.startsWith('quickfix'));
            const qfTitles = qfActions.map(a => a.title);
            const uniqueQfTitles = new Set(qfTitles);
            assert.strictEqual(qfTitles.length, uniqueQfTitles.size, 'Quick Fix action list should not contain duplicate actions');
        });
    });
}

module.exports = { runSuppressionCodeActionTests };
