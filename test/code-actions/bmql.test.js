const assert = require('assert');
const vscode = require('vscode');
const { lintBMLCustom } = require('../../app/lang/lint/core/lint');
const { activateExtension } = require('../extensionHelper');

function runBmqlCodeActionTests() {
    suite('BML BMQL Code Actions Suite', () => {
        suiteSetup(async () => {
            await activateExtension(vscode);
        });

        test('Quick Fix for gettabledata replacement', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'res = gettabledata("my_table", "col", "val");'
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const gettableDiag = diags.find(d => d.message.includes('gettabledata'));
            assert.ok(gettableDiag, 'Should have gettabledata diagnostic');

            const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, gettableDiag.range);
            const action = codeActions.find(a => a.title.includes('Replace gettabledata with bmql'));
            assert.ok(action, 'Should have Quick Fix to replace gettabledata with bmql');
        });

        test('Quick Fix for getpartsdata replacement', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'res = getpartsdata("my_part");'
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const getpartsDiag = diags.find(d => d.message.includes('getpartsdata'));
            assert.ok(getpartsDiag, 'Should have getpartsdata diagnostic');

            const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, getpartsDiag.range);
            const action = codeActions.find(a => a.title.includes('Replace getpartsdata with bmql'));
            assert.ok(action, 'Should have Quick Fix to replace getpartsdata with bmql');
        });

        test('Quick Fix for BMQL select star', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'res = bmql("SELECT * FROM my_table");\nreturn "";'
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const starDiag = diags.find(d => d.code === 'bml-bmql-select-star');
            assert.ok(starDiag, 'Should have SELECT * diagnostic');

            const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, starDiag.range);
            const starAction = codeActions.find(a => a.title.includes("Replace 'SELECT *'"));
            assert.ok(starAction, 'Should offer SELECT * replacement Quick Fix');
        });

        test('Quick Fix for BMQL unbounded mutation', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'res = bmql("UPDATE my_table SET col = \'val\'");\nreturn "";'
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const mutationDiag = diags.find(d => d.code === 'bml-bmql-unbounded-mutation');
            assert.ok(mutationDiag, 'Should have unbounded mutation diagnostic');

            const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, mutationDiag.range);
            const mutationAction = codeActions.find(a => a.title.includes('Append safety WHERE clause'));
            assert.ok(mutationAction, 'Should offer WHERE clause insertion Quick Fix');
        });
    });
}

module.exports = { runBmqlCodeActionTests };
