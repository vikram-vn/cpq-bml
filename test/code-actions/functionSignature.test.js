const assert = require('assert');
const vscode = require('vscode');
const { lintBMLCustom } = require('@/lang/lint/core/lint');
const { activateExtension } = require('@/test/extensionHelper');

function runFunctionSignatureCodeActionTests() {
    suite('BML Function Signature Code Actions Suite', () => {
        suiteSetup(async () => {
            await activateExtension(vscode);
        });

        test('Quick Fix wraps argument in string() when String is expected', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'arr = String[];\nnum = 100;\nappend(arr, num);\nreturn "";'
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const argTypeDiag = diags.find(d => d.code === 'bml-function-arg-type');
            assert.ok(argTypeDiag, 'Should flag argument type mismatch');

            const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, argTypeDiag.range);
            const fix = codeActions.find(a => a.title.includes('string(num)'));
            assert.ok(fix, 'Should offer string(num) Quick Fix');

            await vscode.workspace.applyEdit(fix.edit);
            assert.ok(doc.getText().includes('string(num)'), 'Replaced with string(num)');
        });

        test('Quick Fix offers valueType parameter for dict("anytype") get()', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'd = dict("anytype");\nval = get(d, "key");\nreturn "";'
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const countDiag = diags.find(d => d.code === 'bml-function-arg-count');
            assert.ok(countDiag, 'Should flag missing 3rd arg on anytype get()');

            const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, countDiag.range);
            const fix = codeActions.find(a => a.title.includes('"string" valueType parameter'));
            assert.ok(fix, 'Should offer "string" parameter Quick Fix');

            await vscode.workspace.applyEdit(fix.edit);
            assert.ok(doc.getText().includes('get(d, "key", "string")'), 'Replaced with get(d, "key", "string")');
        });
    });
}

module.exports = { runFunctionSignatureCodeActionTests };
