const assert = require('assert');
const vscode = require('vscode');
const { lintBMLCustom } = require('@/lang/lint/core/lint');
const { activateExtension } = require('@/test/extensionHelper');

function runTypeCastCodeActionTests() {
    suite('BML Type Cast & Dictionary Put Code Actions Suite', () => {
        suiteSetup(async () => {
            await activateExtension(vscode);
        });

        test('Quick Fix casts value on dict put() type mismatch', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'd = dict("string");\nput(d, "k", 123);\nreturn "";'
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const putDiag = diags.find(d => d.code === 'bml-dict-put-type-mismatch');
            assert.ok(putDiag, 'Should flag put type mismatch');

            const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, putDiag.range);
            const fix = codeActions.find(a => a.title.includes('string(123)'));
            assert.ok(fix, 'Should offer string(123) Quick Fix');

            await vscode.workspace.applyEdit(fix.edit);
            assert.ok(doc.getText().includes('string(123)'), 'Replaced with string(123)');
        });

        test('Quick Fix converts values() on anytype dict to keys()', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'd = dict("anytype");\nv = values(d);\nreturn "";'
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const valDiag = diags.find(d => d.code === 'bml-function-arg-type');
            assert.ok(valDiag, 'Should flag values() on anytype dict');

            const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, valDiag.range);
            const fix = codeActions.find(a => a.title.includes('keys(d)'));
            assert.ok(fix, 'Should offer keys(d) Quick Fix');

            await vscode.workspace.applyEdit(fix.edit);
            assert.ok(doc.getText().includes('keys(d)'), 'Replaced with keys(d)');
        });
    });
}

module.exports = { runTypeCastCodeActionTests };
