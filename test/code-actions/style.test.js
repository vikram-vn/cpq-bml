const assert = require('assert');
const vscode = require('vscode');
const { lintBMLCustom } = require('../../app/lang/lint/lint');
const { activateExtension } = require('../extensionHelper');

function runStyleCodeActionTests() {
    suite('BML Style Code Actions Suite', () => {
        suiteSetup(async () => {
            await activateExtension(vscode);
        });

        test('Quick Fix for print statement and multiple statements per line', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'print "debugging";\nx = 1; y = 2;\nreturn "";'
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const printDiag = diags.find(d => d.code === 'bml-unguarded-print');
            assert.ok(printDiag, 'Should have print statement diagnostic');

            const printCodeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, printDiag.range);
            const printAction = printCodeActions.find(a => a.title.includes('Comment out print statement'));
            assert.ok(printAction, 'Should offer comment out print Quick Fix');

            const multiDiag = diags.find(d => d.code === 'bml-multiple-statements-per-line');
            assert.ok(multiDiag, 'Should have multiple statements per line diagnostic');

            const multiCodeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, multiDiag.range);
            const multiAction = multiCodeActions.find(a => a.title.includes('Split statements onto new lines'));
            assert.ok(multiAction, 'Should offer split statements Quick Fix');
        });

        test('Quick Fix for unused variables and naming conventions', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'unusedVar = 10;\nmyItems = String[];\nreturn "";'
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const unusedDiag = diags.find(d => d.code === 'bml-unused-variable');
            if (unusedDiag) {
                const unusedCodeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, unusedDiag.range);
                const unusedAction = unusedCodeActions.find(a => a.title.includes("Prefix unused variable with '_'"));
                assert.ok(unusedAction, 'Should offer unused variable prefix Quick Fix');
            }

            const arrayNamingDiag = diags.find(d => d.code === 'bml-array-naming-suffix');
            if (arrayNamingDiag) {
                const arrayCodeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, arrayNamingDiag.range);
                const arrayAction = arrayCodeActions.find(a => a.title.includes("Rename 'myItems' to 'myItemsArray'"));
                assert.ok(arrayAction, 'Should offer array naming suffix Quick Fix');
            }
        });
    });
}

module.exports = { runStyleCodeActionTests };
