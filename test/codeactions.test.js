const assert = require('assert');
const vscode = require('vscode');
const { lintBMLCustom } = require('../app/lang/lint/lint');
const { activateExtension } = require('./extensionHelper');

suite('BML Code Actions Quick Fix Suite', () => {
    suiteSetup(async () => {
        await activateExtension(vscode);
    });

    test('Quick Fix for NaN replacement', async () => {
        const doc = await vscode.workspace.openTextDocument({
            language: 'bml',
            content: 'x = NaN;'
        });

        // Run the linter to set diagnostics in VS Code
        const diagnostics = [];
        const collection = vscode.languages.createDiagnosticCollection('bml');
        lintBMLCustom(doc, collection, vscode);

        const diags = collection.get(doc.uri);
        const nanDiag = diags.find(d => d.message.includes('constant \'NaN\''));
        assert.ok(nanDiag, 'Should have NaN diagnostic');

        const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, nanDiag.range);
        
        const nanAction = codeActions.find(a => a.title.includes('Replace NaN with jNaN'));
        assert.ok(nanAction, 'Should have Quick Fix to replace NaN with jNaN');
    });

    test('Quick Fix for strtodate replacement', async () => {
        const doc = await vscode.workspace.openTextDocument({
            language: 'bml',
            content: 'd = strtodate("2026-06-20", "%Y-%m-%d");'
        });

        const collection = vscode.languages.createDiagnosticCollection('bml');
        lintBMLCustom(doc, collection, vscode);

        const diags = collection.get(doc.uri);
        const strtodateDiag = diags.find(d => d.message.includes('strtodate'));
        assert.ok(strtodateDiag, 'Should have strtodate diagnostic');

        const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, strtodateDiag.range);
        const strAction = codeActions.find(a => a.title.includes('Replace strtodate with strtojavadate'));
        assert.ok(strAction, 'Should have Quick Fix to replace strtodate with strtojavadate');
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

    test('Quick Fix for gettabledata replacement', async () => {
        const doc = await vscode.workspace.openTextDocument({
            language: 'bml',
            content: 'res = gettabledata("my_table", "col", "val");'
        });

        const collection = vscode.languages.createDiagnosticCollection('bml');
        lintBMLCustom(doc, collection, vscode);

        const diags = collection.get(doc.uri);
        const gettableDiag = diags.find(d => d.message.includes("gettabledata"));
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
        const getpartsDiag = diags.find(d => d.message.includes("getpartsdata"));
        assert.ok(getpartsDiag, 'Should have getpartsdata diagnostic');

        const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, getpartsDiag.range);
        const action = codeActions.find(a => a.title.includes('Replace getpartsdata with bmql'));
        assert.ok(action, 'Should have Quick Fix to replace getpartsdata with bmql');
    });
});
