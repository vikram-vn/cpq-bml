const assert = require('assert');
const vscode = require('vscode');
const { lintBMLCustom } = require('../../app/lang/lint/core/lint');
const { activateExtension } = require('../extensionHelper');

function runApiCodeActionTests() {
    suite('BML API Code Actions Suite', () => {
        suiteSetup(async () => {
            await activateExtension(vscode);
        });

        test('Quick Fix for urldata status code check insertion', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'res = urldata("http://example.com", "GET");\nmsg = get(res, "Message");\nreturn "";'
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const statusDiag = diags.find(d => d.code === 'bml-urldata-status-unchecked');
            assert.ok(statusDiag, 'Should have urldata status unchecked diagnostic');

            const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, statusDiag.range);
            const statusAction = codeActions.find(a => a.title.includes('Insert HTTP Status-Code check'));
            assert.ok(statusAction, 'Should offer HTTP status check insertion Quick Fix');
        });

        test('Quick Fix for XML error key check and logtime tag length', async () => {
            const longTag = 'a'.repeat(135);
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: `xmlRes = readxmlsingle("<root/>", "//item");\nnodeVal = get(xmlRes, "node");\nlogtime("${longTag}");\nreturn "";`
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const xmlDiag = diags.find(d => d.code === 'bml-readxml-error-key-unchecked');
            assert.ok(xmlDiag, 'Should have XML error key diagnostic');

            const xmlCodeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, xmlDiag.range);
            const xmlAction = xmlCodeActions.find(a => a.title.includes('Insert XML error key check'));
            assert.ok(xmlAction, 'Should offer XML error check Quick Fix');

            const logtimeDiag = diags.find(d => d.code === 'bml-logtime-tag-too-long');
            assert.ok(logtimeDiag, 'Should have logtime tag too long diagnostic');

            const logtimeCodeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, logtimeDiag.range);
            const logtimeAction = logtimeCodeActions.find(a => a.title.includes('Truncate logtime tag'));
            assert.ok(logtimeAction, 'Should offer logtime tag truncation Quick Fix');
        });
    });
}

module.exports = { runApiCodeActionTests };
