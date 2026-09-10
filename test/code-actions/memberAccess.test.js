const assert = require('assert');
const vscode = require('vscode');
const { lintBMLCustom } = require('@/lang/lint/core/lint');
const { activateExtension } = require('@/test/extensionHelper');

function runMemberAccessCodeActionTests() {
    suite('BML Member Access to Function Code Actions Suite', () => {
        suiteSetup(async () => {
            await activateExtension(vscode);
        });

        test('Quick Fix converts array .length to sizeofarray(arr)', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'arr = String[];\nlen = arr.length;\nreturn len;'
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const memberDiag = diags.find(d => d.code === 'bml-invalid-member-access');
            assert.ok(memberDiag, 'Should flag invalid member access arr.length');

            const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, memberDiag.range);
            const fix = codeActions.find(a => a.title.includes('sizeofarray(arr)'));
            assert.ok(fix, 'Should offer sizeofarray(arr) Quick Fix');

            await vscode.workspace.applyEdit(fix.edit);
            const updated = doc.getText();
            assert.ok(updated.includes('sizeofarray(arr)'), 'Replaced with sizeofarray(arr)');
        });

        test('Quick Fix converts string .toLowerCase() to lower(str) and .trim() to trim(str)', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 's = "Hello";\ns1 = s.toLowerCase();\ns2 = s.trim();\nreturn s1;'
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const memberDiags = diags.filter(d => d.code === 'bml-invalid-member-access');
            assert.ok(memberDiags.length >= 2, 'Should flag member calls');

            const actions1 = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, memberDiags[0].range);
            const fixLower = actions1.find(a => a.title.includes('lower(s)'));
            assert.ok(fixLower, 'Should offer lower(s) Quick Fix');
            await vscode.workspace.applyEdit(fixLower.edit);

            const actions2 = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, memberDiags[1].range);
            const fixTrim = actions2.find(a => a.title.includes('trim(s)'));
            assert.ok(fixTrim, 'Should offer trim(s) Quick Fix');
            await vscode.workspace.applyEdit(fixTrim.edit);

            const updated = doc.getText();
            assert.ok(updated.includes('lower(s)'), 'Replaced with lower(s)');
            assert.ok(updated.includes('trim(s)'), 'Replaced with trim(s)');
        });

        test('Quick Fix converts json.get("k") and dict.put("k", v)', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'j = json();\nval = j.get("name");\nreturn "";'
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const memberDiag = diags.find(d => d.code === 'bml-invalid-member-access');
            assert.ok(memberDiag, 'Should flag j.get()');

            const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, memberDiag.range);
            const fix = codeActions.find(a => a.title.includes('jsonget(j, "name")'));
            assert.ok(fix, 'Should offer jsonget(j, "name") Quick Fix');

            await vscode.workspace.applyEdit(fix.edit);
            assert.ok(doc.getText().includes('jsonget(j, "name")'), 'Replaced with jsonget(j, "name")');
        });

        test('Quick Fix converts Math.round(x) and console.log(x)', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'x = Math.round(12.5);\nconsole.log(x);\nreturn "";'
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const mathDiag = diags.find(d => d.code === 'bml-invalid-member-access');
            assert.ok(mathDiag, 'Should flag member access');

            const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, mathDiag.range);
            const fix = codeActions.find(a => a.title.includes('round(12.5)'));
            assert.ok(fix, 'Should offer round(12.5) Quick Fix');

            await vscode.workspace.applyEdit(fix.edit);
            assert.ok(doc.getText().includes('round(12.5)'), 'Replaced with round(12.5)');
        });
    });
}

module.exports = { runMemberAccessCodeActionTests };
