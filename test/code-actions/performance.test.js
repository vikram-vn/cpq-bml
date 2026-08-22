const assert = require('assert');
const vscode = require('vscode');
const { lintBMLCustom } = require('../../app/lang/lint/lint');
const { activateExtension } = require('../extensionHelper');

function runPerformanceCodeActionTests() {
    suite('BML Performance Code Actions Suite', () => {
        suiteSetup(async () => {
            await activateExtension(vscode);
        });

        test('Quick Fix for string concatenation in loop', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'arr = String[];\nfor item in arr {\n    s = s + item;\n}\nreturn "";'
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const concatDiag = diags.find(d => d.code === 'bml-string-concat-in-loop');
            if (concatDiag) {
                const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, concatDiag.range);
                const concatAction = codeActions.find(a => a.title.includes('Convert to StringBuilder'));
                assert.ok(concatAction, 'Should offer StringBuilder conversion Quick Fix');
            }
        });
    });
}

module.exports = { runPerformanceCodeActionTests };
