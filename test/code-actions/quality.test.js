const assert = require('assert');
const vscode = require('vscode');
const { lintBMLCustom } = require('../../app/lang/lint/lint');
const { activateExtension } = require('../extensionHelper');

function runQualityCodeActionTests() {
    suite('BML Quality Code Actions Suite', () => {
        suiteSetup(async () => {
            await activateExtension(vscode);
        });

        test('Quick Fix for NaN replacement', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'x = NaN;'
            });

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

        test('Quick Fix for magic number extraction', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'x = 0.35;\nreturn "";'
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const magicDiag = diags.find(d => d.code === 'bml-magic-number');
            assert.ok(magicDiag, 'Should have magic number diagnostic');

            const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, magicDiag.range);
            const extractAction = codeActions.find(a => a.title.includes("Extract '0.35' to constant candidate"));
            assert.ok(extractAction, 'Should offer constant extraction Quick Fix');
        });

        test('Quick Fix for empty block and missing return', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'if (true) {}'
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const emptyDiag = diags.find(d => d.code === 'bml-empty-block');
            assert.ok(emptyDiag, 'Should have empty block diagnostic');

            const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, emptyDiag.range);
            const emptyAction = codeActions.find(a => a.title.includes("Add '// TODO: implement' inside block"));
            assert.ok(emptyAction, 'Should offer empty block Quick Fix');

            const returnDiag = diags.find(d => d.code === 'bml-missing-return');
            assert.ok(returnDiag, 'Should have missing return diagnostic');

            const returnCodeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, returnDiag.range);
            const returnAction = returnCodeActions.find(a => a.title.includes('Add return statement'));
            assert.ok(returnAction, 'Should offer missing return Quick Fix');
        });

        test('Quick Fix for string cast of string', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'val = string("test");\nreturn "";'
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const castDiag = diags.find(d => d.code === 'bml-string-cast-of-string');
            assert.ok(castDiag, 'Should have string cast of string diagnostic');

            const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, castDiag.range);
            const castAction = codeActions.find(a => a.title.includes('Unwrap redundant string() cast'));
            assert.ok(castAction, 'Should offer string cast unwrap Quick Fix');
        });

        test('Quick Fix for unknown function "did you mean" suggestion', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'x = atfo("5.0");'
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const unknownDiag = diags.find(d => d.code === 'bml-unknown-function');
            assert.ok(unknownDiag, 'Should have an unknown-function diagnostic for atfo');

            const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, unknownDiag.range);
            const action = codeActions.find(a => a.title.includes("Replace with 'atof'"));
            assert.ok(action, 'Should have a Quick Fix suggesting atof');
        });
    });
}

module.exports = { runQualityCodeActionTests };
