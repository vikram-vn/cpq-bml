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
                'for item in range(1, 3) {',
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

        test('Fix All cleans up boolean comparisons, literal casts, duplicate semicolons and canonical types', async () => {
            const content = [
                'user_name = "Sample";;',
                'Boolean is_valid_flag = True;',
                'my_age = integer(25);',
                'if (is_valid_flag == true) {',
                '    query = "SELECT * WHERE is_valid == true";',
                '} elif (is_valid_flag == false) {',
                '    res = "";',
                '}',
                'return user_name;'
            ].join('\n');

            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: content
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const codeActions = await vscode.commands.executeCommand(
                'vscode.executeCodeActionProvider',
                doc.uri,
                new vscode.Range(0, 0, 5, 0)
            );

            const fixAll = codeActions.find(a => a.title.includes('Fix All Safe Style & Naming Issues in File'));
            assert.ok(fixAll, 'Should offer Fix All');

            const applied = await vscode.workspace.applyEdit(fixAll.edit);
            assert.ok(applied, 'Should apply Fix All');

            const updatedText = doc.getText();
            // 1. Duplicate semicolons removed
            assert.ok(updatedText.includes('userName = "Sample";'), 'Duplicate semicolon removed & camelCased');
            assert.ok(!updatedText.includes(';;'), 'No double semicolons should remain');

            // 2. Canonical types & literals lowercased
            assert.ok(updatedText.includes('boolean isValidFlag = true;'), 'Boolean/True lowercased & isValidFlag camelCased');

            // 3. Literal cast integer(25) unwrapped to 25
            assert.ok(updatedText.includes('myAge = 25;'), 'integer(25) unwrapped to 25 and myAge camelCased');

            // 4. Boolean comparisons simplified
            assert.ok(updatedText.includes('if (isValidFlag) {'), 'isValidFlag == true simplified to isValidFlag');
            assert.ok(updatedText.includes('elif (!isValidFlag) {'), 'isValidFlag == false simplified to !isValidFlag');

            // 5. String literal inside quotes untouched
            assert.ok(updatedText.includes('"SELECT * WHERE is_valid == true"'), 'String literals must not be modified');
        });

        test('Refactor menu offers distinct category-level options alongside Master Fix-All', async () => {
            const content = [
                'user_first_name = "Sample";',
                'myItems = string[];',
                'if (true) {}',
                'return user_first_name;'
            ].join('\n');

            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: content
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const codeActions = await vscode.commands.executeCommand(
                'vscode.executeCodeActionProvider',
                doc.uri,
                new vscode.Range(0, 0, 3, 0),
                vscode.CodeActionKind.RefactorRewrite.value
            );

            // Master Fix All
            const masterAction = codeActions.find(a => a.title.includes('Fix All Safe Style & Naming Issues in File'));
            assert.ok(masterAction, 'Should offer Master Fix All in Refactor menu');

            // Category 1: camelCase
            const camelAction = codeActions.find(a => a.title.includes('Convert all variables to camelCase'));
            assert.ok(camelAction, 'Should offer camelCase category in Refactor menu');

            // Category 2: CPQ Type Suffixes
            const typeAction = codeActions.find(a => a.title.includes('Apply CPQ type naming conventions'));
            assert.ok(typeAction, 'Should offer CPQ type naming category in Refactor menu');

            // Category 3: Syntax & Formatting
            const syntaxAction = codeActions.find(a => a.title.includes('Format multi-statement lines & fill empty blocks'));
            assert.ok(syntaxAction, 'Should offer Syntax & Formatting category in Refactor menu');
        });

        test('Fix All comments out empty loops when all statements inside are unused/commented out', async () => {
            const content = [
                'sampleRecordSet = recordset();',
                'for sampleRow in sampleRecordSet {',
                '    isResGetboolean = getboolean(sampleRow, "active");',
                '    resGetint = getint(sampleRow, "lead_time");',
                '    resGetmessage = getmessage(sampleRow);',
                '    isResHaserror = haserror(sampleRow);',
                '}',
                'return "";'
            ].join('\n');

            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: content
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const codeActions = await vscode.commands.executeCommand(
                'vscode.executeCodeActionProvider',
                doc.uri,
                new vscode.Range(0, 0, 7, 0)
            );

            const fixAll = codeActions.find(a => a.title.includes('Fix All Safe Style & Naming Issues in File'));
            assert.ok(fixAll, 'Should offer Fix All');

            const applied = await vscode.workspace.applyEdit(fixAll.edit);
            assert.ok(applied, 'Should apply Fix All');

            const updatedText = doc.getText();
            assert.ok(updatedText.includes('// for sampleRow in sampleRecordSet {'), 'Outer for loop header should be commented out');
            assert.ok(updatedText.includes('// }'), 'Closing brace of loop should be commented out');
        });

        test('Fix All converts direct magic number variables to named constants and Refactor menu offers category', async () => {
            const content = [
                'mRate_16 = 252.00;',
                'total_cost = mRate_16 * 2.0;',
                'return string(total_cost);'
            ].join('\n');

            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: content
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const codeActions = await vscode.commands.executeCommand(
                'vscode.executeCodeActionProvider',
                doc.uri,
                new vscode.Range(0, 0, 3, 0),
                vscode.CodeActionKind.RefactorRewrite.value
            );

            // Refactor Category Action
            const magicCategoryAction = codeActions.find(a => a.title.includes('Convert direct magic number variables to named constants'));
            assert.ok(magicCategoryAction, 'Should offer Magic Numbers category in Refactor menu');

            // Master Fix All
            const fixAll = codeActions.find(a => a.title.includes('Fix All Safe Style & Naming Issues in File'));
            assert.ok(fixAll, 'Should offer Fix All');

            const applied = await vscode.workspace.applyEdit(fixAll.edit);
            assert.ok(applied, 'Should apply Fix All');

            const updatedText = doc.getText();
            assert.ok(updatedText.includes('M_RATE_16 = 252.00;') || updatedText.includes('M_RATE_16_DEFAULT = 252.00;'), 'mRate_16 should be converted to named constant in-place');
            assert.ok(!updatedText.includes('mRate_16 = 252.00;'), 'Old variable name should be replaced');
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

        test('Quick Fix offers next-line suppression bml-lint-disable-next-line', async () => {
            const { getSuppressionFixes } = require('../../app/lang/lint/code-actions/suppressionFixes');
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'unusedVar = 100;\nreturn "";'
            });

            const diag = new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, 9),
                "Unused variable 'unusedVar'",
                vscode.DiagnosticSeverity.Warning
            );
            diag.code = 'bml-unused-variable';

            const fixes = getSuppressionFixes(doc, diag, diag.range);
            const nextLineAction = fixes.find(a => a.title.includes('for next line'));
            assert.ok(nextLineAction, 'Should offer Disable for next line Quick Fix');
        });

        test('Quick Fix inserts stringbuilder initialization for string concat in loop', async () => {
            const { getPerformanceFixes } = require('../../app/lang/lint/code-actions/performanceFixes');
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'for x in items {\n    res = res + x;\n}'
            });

            const diag = new vscode.Diagnostic(
                new vscode.Range(1, 4, 1, 17),
                "Avoid string concatenation inside loop",
                vscode.DiagnosticSeverity.Warning
            );
            diag.code = 'bml-string-concat-in-loop';

            const fixes = getPerformanceFixes(doc, diag, diag.range);
            assert.ok(fixes.length > 0, 'Should return performance quick fix');
            const edit = fixes[0].edit;
            assert.ok(edit, 'Quick fix should have workspace edit');
        });

        test('Quick Fix infers typed return statement based on diagnostic message', async () => {
            const { getQualityFixes } = require('../../app/lang/lint/code-actions/qualityFixes');
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'x = 10;'
            });

            const diag = new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, 6),
                "Missing return statement expecting Integer return type",
                vscode.DiagnosticSeverity.Error
            );
            diag.code = 'bml-missing-return';

            const fixes = getQualityFixes(doc, diag, diag.range);
            assert.ok(fixes.length > 0, 'Should return quality quick fix');
            assert.ok(fixes[0].title.includes('return 0;'), 'Should infer return 0; for Integer');
        });

        test('Quick Fix replaces misspelled words across all occurrences in document', async () => {
            const path = require('path');
            const { getSpellingFixes } = require('../../app/lang/lint/code-actions/spellingFixes');
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: 'caculate = 10;\ntotal = caculate + 5;\nreturn string(caculate);'
            });

            const diag = new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, 8),
                "Misspelled word 'caculate'",
                vscode.DiagnosticSeverity.Warning
            );
            diag.code = 'bml-spelling-error';

            const extPath = path.resolve(__dirname, '../../');
            const fixes = getSpellingFixes(doc, diag, new vscode.Range(0, 0, 0, 8), extPath);
            assert.ok(fixes.length > 0, 'Should return spelling quick fixes');
            assert.ok(fixes[0].title.includes('(all occurrences)'), 'Spelling fix should operate on all occurrences');
        });
    });
}

module.exports = { runStyleCodeActionTests };
