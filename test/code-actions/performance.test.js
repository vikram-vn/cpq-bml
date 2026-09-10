const assert = require('assert');
const vscode = require('vscode');
const { lintBMLCustom } = require('@/lang/lint/core/lint');
const { activateExtension } = require('@/test/extensionHelper');

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

        test('Diagnostic and Quick Fix for multi-argument sbappend splits into pairs', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'sb = stringbuilder();\nsbappend(sb,doc,value,doc1,value2,doc3,value3);\nreturn sbtostring(sb);'
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const sbDiag = diags.find(d => d.code === 'bml-sbappend-multiple-args');
            assert.ok(sbDiag, 'Should flag multi-argument sbappend statement');

            const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, sbDiag.range);
            const pairedAction = codeActions.find(a => a.title.includes("Split 'sbappend' into paired statements"));
            assert.ok(pairedAction, "Should offer paired split Quick Fix");

            await vscode.workspace.applyEdit(pairedAction.edit);

            const updatedText = doc.getText();
            assert.ok(updatedText.includes('sbappend(sb, doc, value);\n'), 'Contains first paired sbappend');
            assert.ok(updatedText.includes('sbappend(sb, doc1, value2);\n'), 'Contains second paired sbappend');
            assert.ok(updatedText.includes('sbappend(sb, doc3, value3);'), 'Contains third paired sbappend');
        });

        test('Quick Fix for multi-argument sbappend preserves indentation and handles odd arguments', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'sb = stringbuilder();\n    sbappend(sb, a, b, c, d, e);\nreturn sbtostring(sb);'
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const sbDiag = diags.find(d => d.code === 'bml-sbappend-multiple-args');
            assert.ok(sbDiag, 'Should flag multi-argument sbappend statement');

            const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, sbDiag.range);
            const pairedAction = codeActions.find(a => a.title.includes("Split 'sbappend' into paired statements"));
            const singleAction = codeActions.find(a => a.title.includes("Split 'sbappend' into individual statements"));
            assert.ok(pairedAction, "Should offer paired split Quick Fix");
            assert.ok(singleAction, "Should offer single statement refactoring");

            await vscode.workspace.applyEdit(pairedAction.edit);

            const updatedText = doc.getText();
            assert.ok(updatedText.includes('    sbappend(sb, a, b);\n'), 'Preserves indentation on pair 1');
            assert.ok(updatedText.includes('    sbappend(sb, c, d);\n'), 'Preserves indentation on pair 2');
            assert.ok(updatedText.includes('    sbappend(sb, e);'), 'Preserves indentation on leftover single');
        });
    });
}

module.exports = { runPerformanceCodeActionTests };
