const assert = require('assert');
const vscode = require('vscode');
const path = require('path');
const { lintBMLCustom } = require('../../app/lang/lint/core/lint');
const { getQualityFixes } = require('../../app/lang/lint/code-actions/qualityFixes');
const { getSpellingFixes } = require('../../app/lang/lint/code-actions/spellingFixes');
const { getPerformanceFixes } = require('../../app/lang/lint/code-actions/performanceFixes');
const { getStyleFixes } = require('../../app/lang/lint/code-actions/styleFixes');

function runStyleAdvancedCodeActionTests() {
    suite('BML Style Advanced Code Actions Suite', () => {
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
            assert.ok(updatedText.includes('userName = "Sample";'), 'Duplicate semicolon cleaned and variable camelCased');
            assert.ok(!updatedText.includes(';;'), 'No double semicolons');
            assert.ok(updatedText.includes('boolean isValidFlag = true;'), 'Boolean type and literal normalized to lowercase boolean');
            assert.ok(updatedText.includes('myAge = 25;'), 'Redundant integer(25) simplified');
            assert.ok(updatedText.includes('if (isValidFlag) {'), 'is_valid_flag == true simplified to isValidFlag');
            assert.ok(updatedText.includes('elif (NOT(isValidFlag)) {') || updatedText.includes('elif (!isValidFlag) {') || updatedText.includes('elif (not(isValidFlag)) {'), 'is_valid_flag == false simplified');
            assert.ok(updatedText.includes('query = "SELECT * WHERE is_valid == true";'), 'BMQL literal untouched');
        });

        test('Quick Fix converts compound assignment operators (+=, -=, *=, /=) to standard BML assignments', async () => {
            const content = [
                'total_amount = 100;',
                'total_amount += 50;',
                'item_count = 10;',
                'item_count -= 2;',
                'factor = 2.5;',
                'factor *= 1.5;',
                'ratio = 10.0;',
                'ratio /= 2.0;',
                'return string(total_amount);'
            ].join('\n');

            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: content
            });

            const collection = vscode.languages.createDiagnosticCollection('bml');
            lintBMLCustom(doc, collection, vscode);

            const diags = collection.get(doc.uri);
            const opDiags = diags.filter(d => d.code === 'bml-operator-fix' || d.code === 'bml-compound-assignment');
            assert.ok(opDiags.length >= 4, 'Should detect all 4 compound assignment operators');

            for (const diag of opDiags) {
                const codeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', doc.uri, diag.range);
                const fixAction = codeActions.find(a => a.title.includes('Replace with'));
                assert.ok(fixAction, 'Should offer compound assignment operator replacement');
                const applied = await vscode.workspace.applyEdit(fixAction.edit);
                assert.ok(applied, 'Should apply compound assignment operator replacement');
            }

            const updatedText = doc.getText();
            assert.ok(updatedText.includes('total_amount = total_amount + 50;'), '+= should be converted');
            assert.ok(updatedText.includes('item_count = item_count - 2;'), '-= should be converted');
            assert.ok(updatedText.includes('factor = factor * 1.5;'), '*= should be converted');
            assert.ok(updatedText.includes('ratio = ratio / 2.0;'), '/= should be converted');
        });

        test('Quick Fix handles string concatenation inside loop performance warning', async () => {
            const content = [
                'res = "";',
                'items = string[]{"a", "b"};',
                'for item in items {',
                '    res = res + item;',
                '}',
                'return res;'
            ].join('\n');

            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: content
            });

            const diag = new vscode.Diagnostic(
                new vscode.Range(3, 4, 3, 21),
                "Performance Warning: Inefficient string concatenation in loop",
                vscode.DiagnosticSeverity.Warning
            );
            diag.code = 'bml-string-concat-in-loop';

            const fixes = getPerformanceFixes(doc, diag, diag.range);
            assert.ok(fixes.length > 0, 'Should return performance quick fix');
            const edit = fixes[0].edit;
            assert.ok(edit, 'Quick fix should have workspace edit');
        });

        test('Quick Fix infers typed return statement based on diagnostic message', async () => {
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

        test('Quick Fix for bml-line-too-long on long string concatenation', async () => {
            const content = 'outputLogMessage = outputLogMessage + "<br/>First segment of information" + firstSegmentValue + "<br/>Second segment of information" + secondSegmentValue;';
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: content
            });

            const diag = new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, content.length),
                `Style Warning: Line exceeds 200 characters of code (${content.length} chars). Consider breaking it into multiple lines.`,
                vscode.DiagnosticSeverity.Warning
            );
            diag.code = 'bml-line-too-long';

            const fixes = getStyleFixes(doc, diag, diag.range);
            assert.ok(fixes.length > 0, 'Should return style quick fix for line too long');
            const concatAction = fixes.find(a => a.title.includes('Split string concatenation across multiple lines'));
            assert.ok(concatAction, 'Should offer split string concatenation quick fix');
            assert.ok(concatAction.edit, 'Action should have edit');
        });

        test('Quick Fix for bml-line-too-long on long string literal', async () => {
            const content = 'detailedDescription = "The quick brown fox jumps over the lazy dog repeatedly while exploring the fascinating forest landscapes and enjoying the refreshing morning sunshine.";';
            const doc = await vscode.workspace.openTextDocument({
                language: 'bml',
                content: content
            });

            const diag = new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, content.length),
                `Style Warning: Line exceeds 200 characters of code (${content.length} chars). Consider breaking it into multiple lines.`,
                vscode.DiagnosticSeverity.Warning
            );
            diag.code = 'bml-line-too-long';

            const fixes = getStyleFixes(doc, diag, diag.range);
            assert.ok(fixes.length > 0, 'Should return style quick fix for long string');
            const stringAction = fixes.find(a => a.title.includes('Split long string literal across multiple lines'));
            assert.ok(stringAction, 'Should offer split long string literal quick fix');
        });
    });
}

module.exports = { runStyleAdvancedCodeActionTests };
