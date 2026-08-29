const assert = require('assert');
const vscode = require('vscode');
const { lintBMLCustom } = require('../../app/lang/lint/core/lint');
const { activateExtension } = require('../extensionHelper');

function runSyntaxCodeActionTests() {
    suite('BML Syntax Code Actions Suite', () => {
        suiteSetup(async () => {
            await activateExtension(vscode);
        });

        test('Smart Quick Fix for increment operator ++', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'i++;'
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const opDiag = diags.find(d => d.message.includes('Use var = var + 1'));
            assert.ok(opDiag, 'Should have operator increment diagnostic');

            const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, opDiag.range);
            const incAction = codeActions.find(a => a.title.includes('Replace with i = i + 1'));
            assert.ok(incAction, 'Should have smart Quick Fix for increment');
        });

        test('Smart Quick Fix for compound operator +=', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'total += 10;'
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const opDiag = diags.find(d => d.message.includes('operator not supported'));
            assert.ok(opDiag, 'Should have compound operator diagnostic');

            const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, opDiag.range);
            const compAction = codeActions.find(a => a.title.includes('Replace with total = total + ...'));
            assert.ok(compAction, 'Should have smart Quick Fix for compound operator +=');
        });

        test('Quick Fix for multiple statements per line', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'x = 1; y = 2;\nreturn "";'
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const multiDiag = diags.find(d => d.code === 'bml-multiple-statements-per-line');
            assert.ok(multiDiag, 'Should have multiple statements per line diagnostic');

            const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, multiDiag.range);
            const multiAction = codeActions.find(a => a.title.includes('Split statements onto new lines'));
            assert.ok(multiAction, 'Should offer split statements Quick Fix');
        });
    });
}

module.exports = { runSyntaxCodeActionTests };
