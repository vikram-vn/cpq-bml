const assert = require('assert');
const vscode = require('vscode');
const { lintBMLCustom } = require('../../app/lang/lint/core/lint');
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

        test('Diagnostic and Quick Fix for production print statements', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'x = 10;\nprint(x);\nreturn "";'
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const printDiag = diags.find(d => d.code === 'bml-production-print-statement');
            assert.ok(printDiag, 'Should flag production print statement');

            const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, printDiag.range);
            const commentAction = codeActions.find(a => a.title.includes('Comment out print statement'));
            const removeAction = codeActions.find(a => a.title.includes('Remove print statement'));
            assert.ok(commentAction, 'Should offer comment-out print Quick Fix');
            assert.ok(removeAction, 'Should offer remove print Quick Fix');
        });

        test('Diagnostic and Quick Fix for hardcoded site domains', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'url = "https://mysite.bigmachines.com/rest/v18/data";\nreturn url;'
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const siteDiag = diags.find(d => d.code === 'bml-hardcoded-sitename');
            assert.ok(siteDiag, 'Should flag hardcoded site domain');

            const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, siteDiag.range);
            const replaceAction = codeActions.find(a => a.title.includes('_system_site_name'));
            assert.ok(replaceAction, 'Should offer replace with _system_site_name Quick Fix');
        });
    });
}

module.exports = { runPerformanceCodeActionTests };
