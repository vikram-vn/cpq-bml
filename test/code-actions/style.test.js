const assert = require('assert');
const vscode = require('vscode');
const { lintBMLCustom } = require('../../app/lang/lint/core/lint');
const { activateExtension } = require('../extensionHelper');
const { runStyleAdvancedCodeActionTests } = require('./styleAdvanced.test');

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
                const commentAction = unusedCodeActions.find(a => a.title.includes("Comment out unused variable"));
                assert.ok(commentAction, 'Should offer comment out unused variable Quick Fix');
                const removeAction = unusedCodeActions.find(a => a.title.includes("Remove unused variable"));
                assert.ok(removeAction, 'Should offer remove unused variable Quick Fix');
            }

            const arrayNamingDiag = diags.find(d => d.code === 'bml-array-naming-suffix');
            if (arrayNamingDiag) {
                const arrayCodeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, arrayNamingDiag.range);
                const arrayAction = arrayCodeActions.find(a => a.title.includes("Rename 'myItems' to 'myItemsArray'"));
                assert.ok(arrayAction, 'Should offer array naming suffix Quick Fix');
            }
        });

        test('Quick Fix renames all strict matching occurrences of dictionary variable', async () => {
            const content = [
                'dictAnytype = dict("anytype");',
                'put(dictAnytype, "any_key1", "mixed_str");',
                'put(dictAnytype, "any_key2", 123.45);',
                'valDictAnytype = get(dictAnytype, "any_key1");',
                'return "";'
            ].join('\n');

            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: content
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const dictNamingDiag = diags.find(d => d.code === 'bml-dict-naming-suffix');
            assert.ok(dictNamingDiag, 'Should flag dict naming suffix');

            const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, dictNamingDiag.range);
            const dictAction = codeActions.find(a => a.title.includes("Rename 'dictAnytype' to 'dictAnytypeDict'"));
            assert.ok(dictAction, 'Should offer dict naming suffix Quick Fix');

            // Apply workspace edit and verify all 4 strict occurrences of dictAnytype were renamed
            const applied = await vscode.workspace.applyEdit(dictAction.edit);
            assert.ok(applied, 'Should apply rename edit');

            const updatedText = doc.getText();
            assert.ok(updatedText.includes('dictAnytypeDict = dict("anytype");'), 'Declaration should be renamed');
            assert.ok(updatedText.includes('put(dictAnytypeDict, "any_key1", "mixed_str");'), 'put call 1 should be renamed');
            assert.ok(updatedText.includes('put(dictAnytypeDict, "any_key2", 123.45);'), 'put call 2 should be renamed');
            assert.ok(updatedText.includes('valDictAnytype = get(dictAnytypeDict, "any_key1");'), 'get call should be renamed without mutating valDictAnytype');
        });

        test('Quick Fix converts snake_case variables to camelCase (line-level and file-level)', async () => {
            const content = [
                'val__user_job_title = "Architect";',
                'print(val__user_job_title);',
                'other_user_department = "Engineering";',
                'print(other_user_department);',
                'return "";'
            ].join('\n');

            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: content
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const camelDiag = diags.find(d => d.code === 'bml-variable-camelcase' && d.message.includes('val__user_job_title'));
            assert.ok(camelDiag, 'Should flag val__user_job_title for camelCase');

            const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, camelDiag.range);
            
            // 1. Check Line-level action
            const lineAction = codeActions.find(a => a.title.includes("Convert 'val__user_job_title' to camelCase 'valUserJobTitle'"));
            assert.ok(lineAction, 'Should offer line-level camelCase Quick Fix');

            // 2. Check File-level action
            const fileAction = codeActions.find(a => a.title.includes('Convert all underscore variables to camelCase in entire file'));
            assert.ok(fileAction, 'Should offer file-level camelCase Quick Fix');

            // Apply file-level action and verify all underscore variables are converted
            const applied = await vscode.workspace.applyEdit(fileAction.edit);
            assert.ok(applied, 'Should apply file-level edit');

            const updatedText = doc.getText();
            assert.ok(updatedText.includes('valUserJobTitle = "Architect";'), 'val__user_job_title should be converted to valUserJobTitle');
            assert.ok(updatedText.includes('print(valUserJobTitle);'), 'print(val__user_job_title) should be converted');
            assert.ok(updatedText.includes('otherUserDepartment = "Engineering";'), 'other_user_department should be converted to otherUserDepartment');
            assert.ok(updatedText.includes('print(otherUserDepartment);'), 'print(other_user_department) should be converted');
        });

        test('Quick Fix bundled Fix All Safe Style & Naming Issues in File', async () => {
            const content = [
                'user_name = string("Sample");',
                'myItems = string[];',
                'myAttributes = dict("string");',
                'if (true) {}',
                'return "";'
            ].join('\n');

            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: content
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            assert.ok(diags.length >= 3, 'Should have multiple style/syntax diags');

            const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, new vscode.Range(0, 0, 5, 0));
            const fixAllAction = codeActions.find(a => a.title.includes('Fix All Safe Style & Naming Issues in File'));
            assert.ok(fixAllAction, 'Should offer Fix All Safe Style & Naming Issues in File Quick Fix');

            const applied = await vscode.workspace.applyEdit(fixAllAction.edit);
            assert.ok(applied, 'Should apply Fix All edit');

            const updatedText = doc.getText();
            assert.ok(updatedText.includes('userName = "Sample";'), 'Should camelCase variable and remove redundant string cast');
            assert.ok(updatedText.includes('myItemsArray = string[];'), 'Should add Array suffix');
            assert.ok(updatedText.includes('myAttributesDict = dict("string");'), 'Should add Dict suffix');
            assert.ok(updatedText.includes('// TODO: implement'), 'Should fill empty block with TODO');
        });

        test('Quick Fix renames variable referenced in 10+ places across loops, conditionals and assignments', async () => {
            const content = [
                'val__user_job_title = "Architect";',
                'res1 = val__user_job_title;',
                'res2 = val__user_job_title;',
                'if (val__user_job_title == "Architect") {',
                '    res3 = val__user_job_title;',
                '} elif (val__user_job_title == "Engineer") {',
                '    res4 = val__user_job_title;',
                '}',
                'items = range(1, 3);',
                'for item in items {',
                '    res5 = val__user_job_title + string(item);',
                '}',
                'print(val__user_job_title);',
                'return val__user_job_title;'
            ].join('\n');

            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: content
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const camelDiag = diags.find(d => d.code === 'bml-variable-camelcase');
            assert.ok(camelDiag, 'Should flag val__user_job_title');

            const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, camelDiag.range);
            const lineAction = codeActions.find(a => a.title.includes("Convert 'val__user_job_title' to camelCase 'valUserJobTitle'"));
            assert.ok(lineAction, 'Should offer line-level camelCase Quick Fix');

            const applied = await vscode.workspace.applyEdit(lineAction.edit);
            assert.ok(applied, 'Should apply rename edit');

            const updatedText = doc.getText();
            assert.strictEqual(updatedText.includes('val__user_job_title'), false, 'Should have ZERO occurrences of old snake_case variable');
            
            // Count occurrences of new camelCase variable
            const matches = updatedText.match(/\bvalUserJobTitle\b/g);
            assert.strictEqual(matches ? matches.length : 0, 10, 'All 10 occurrences in file should be replaced with valUserJobTitle');
        });

        test('Quick Fix bundled Fix All handles booleans, unused variables, and statement cleanups', async () => {
            const content = [
                'is_ready_flag = true;',
                'unused_helper = 99;',
                'a = 1; b = 2;',
                'print(a + b);',
                'return is_ready_flag ? "Y" : "N";'
            ].join('\n');

            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: content
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            assert.ok(diags.length >= 2, 'Should have diagnostics');

            const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, new vscode.Range(0, 0, 5, 0));
            const fixAllAction = codeActions.find(a => a.title.includes('Fix All Safe Style & Naming Issues in File'));
            assert.ok(fixAllAction, 'Should offer Fix All');

            const applied = await vscode.workspace.applyEdit(fixAllAction.edit);
            assert.ok(applied, 'Should apply Fix All');

            const updatedText = doc.getText();
            assert.ok(updatedText.includes('isReadyFlag = true;'), 'is_ready_flag should be camelCased');
            assert.ok(updatedText.includes('return isReadyFlag ? "Y" : "N";'), 'return reference should be updated');
            assert.ok(updatedText.includes('// UNUSED_HELPER') || updatedText.includes('// unusedHelper') || updatedText.includes('// unused_helper'), 'unused_helper should be commented out');
            assert.ok(updatedText.includes('a = 1;') && updatedText.includes('b = 2;'), 'Both statements should be present');
            assert.ok(!updatedText.includes('a = 1; b = 2;'), 'Statements should no longer be on same line');
        });

        test('Quick Fix comments out all assignments to unused variables and their empty if/elif/else blocks', async () => {
            const content = [
                'mEval49 = "DEFAULT";',
                'if (M_ID49_DEFAULT > 40 AND M_RATE49_DEFAULT > 600.0) {',
                '    mEval49 = "PLATINUM";',
                '} elif (M_ID49_DEFAULT > 20 OR M_RATE49_DEFAULT > 300.0) {',
                '    mEval49 = "GOLD";',
                '} else {',
                '    mEval49 = "SILVER";',
                '}',
                'return "";'
            ].join('\n');

            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: content
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const unusedDiag = diags.find(d => d.code === 'bml-unused-variable');
            assert.ok(unusedDiag, 'Should flag mEval49 as unused variable');

            const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, unusedDiag.range);
            const unusedAction = codeActions.find(a => a.title.includes('Comment out all unused variable statements'));
            assert.ok(unusedAction, 'Should offer unused variable action');

            const applied = await vscode.workspace.applyEdit(unusedAction.edit);
            assert.ok(applied, 'Should apply unused variable edit');

            const updatedText = doc.getText();
            assert.ok(updatedText.includes('// mEval49 = "DEFAULT";'), 'Should comment out initial assignment');
            assert.ok(updatedText.includes('// if (M_ID49_DEFAULT'), 'Should comment out if statement header');
            assert.ok(updatedText.includes('// mEval49 = "PLATINUM";'), 'Should comment out PLATINUM assignment');
            assert.ok(updatedText.includes('// } elif (M_ID49_DEFAULT'), 'Should comment out elif header');
            assert.ok(updatedText.includes('// } else {'), 'Should comment out else header');
            assert.ok(updatedText.includes('// mEval49 = "SILVER";'), 'Should comment out SILVER assignment');
        });

        test('Quick Fix handles transitive unused variable chains and container operations', async () => {
            const content = [
                'mEval50 = "DEFAULT";',
                'if (M_ID_50_DEFAULT > 40) {',
                '    mEval50 = "PLATINUM";',
                '    mE = mEval50;',
                '    test = mE;',
                '}',
                'unusedDict = dict("string");',
                'put(unusedDict, "k", "v");',
                'return "";'
            ].join('\n');

            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: content
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const unusedDiag = diags.find(d => d.code === 'bml-unused-variable');
            assert.ok(unusedDiag, 'Should flag unused variables');

            const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, unusedDiag.range);
            const unusedAction = codeActions.find(a => a.title.includes('Comment out all unused variable statements'));
            assert.ok(unusedAction, 'Should offer unused variable action');

            const applied = await vscode.workspace.applyEdit(unusedAction.edit);
            assert.ok(applied, 'Should apply unused variable edit');

            const updatedText = doc.getText();
            assert.ok(updatedText.includes('// mEval50 = "DEFAULT";'), 'Should comment out mEval50 assignment');
            assert.ok(updatedText.includes('// if (M_ID_50_DEFAULT'), 'Should comment out if header');
            assert.ok(updatedText.includes('// mE = mEval50;'), 'Should comment out mE assignment');
            assert.ok(updatedText.includes('// test = mE;'), 'Should comment out test assignment');
            assert.ok(updatedText.includes('// unusedDict = dict("string");'), 'Should comment out unusedDict assignment');
            assert.ok(updatedText.includes('// put(unusedDict'), 'Should comment out container put call');
        });

        test('Refactor menu action (Ctrl+Shift+R) offers file-level safe refactor', async () => {
            const content = [
                'user_first_name = "Sample";',
                'return user_first_name;'
            ].join('\n');

            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: content
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            // Request CodeActions with Refactor kind (simulating Ctrl+Shift+R / context menu Refactor...)
            const codeActions = await vscode.commands.executeCommand(
                'vscode.executeCodeActionProvider',
                doc.uri,
                new vscode.Range(0, 0, 1, 0),
                vscode.CodeActionKind.RefactorRewrite.value
            );

            const refactorAction = codeActions.find(a => 
                a.kind && (a.kind.value.startsWith('refactor') || a.kind.value === vscode.CodeActionKind.RefactorRewrite.value)
            );
            assert.ok(refactorAction, 'Should offer Refactor action in Refactor... menu');
            assert.ok(refactorAction.title.includes('Fix All Safe Style & Naming Issues in File'), 'Refactor action should have descriptive title');
        });

        test('Quick Fix offers _system_user_token option for hardcoded credentials', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'authToken = "secret1234567890abcdef";\nreturn authToken;'
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const secDiag = diags.find(d => d.code === 'bml-hardcoded-credential' || d.code === 'bml-hardcoded-secret');
            if (secDiag) {
                const actions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, secDiag.range);
                const sysTokenAction = actions.find(a => a.title.includes('_system_user_token'));
                assert.ok(sysTokenAction, 'Should offer _system_user_token Quick Fix');
            }
        });
    });

    runStyleAdvancedCodeActionTests();
}

module.exports = { runStyleCodeActionTests };
