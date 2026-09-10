const assert = require('assert');
const { getSyntaxFixes } = require('@/lang/lint/code-actions/syntaxFixes');
const { getAdvancedQualityFixes } = require('@/lang/lint/code-actions/qualityFixesAdvanced');
const { getDictJsonDateFixes } = require('@/lang/lint/code-actions/dictJsonDateFixes');
const { getStyleFixes } = require('@/lang/lint/code-actions/styleFixes');
const { MockRange, MockDiagnostic, createMockDoc } = require('@/test/code-actions/helpers');

suite('Syntax, Advanced Quality & Naming Conventions Quick Fixes Suite', function() {
    suite('Syntax Quick Fixes', function() {
        test('adds semicolon on bml-missing-semicolon', function() {
            const doc = createMockDoc('x = 10\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 6), 'Missing semicolon', 0, 'bml-missing-semicolon');
            const fixes = getSyntaxFixes(doc, diag, diag.range);
            assert.strictEqual(fixes.length, 1);
            assert.strictEqual(fixes[0].edit._edits[0].newText, ';');
        });

        test('removes duplicate semicolon on bml-consecutive-semicolon', function() {
            const doc = createMockDoc('x = 10;;\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 8), 'Duplicate semicolon', 1, 'bml-consecutive-semicolon');
            const fixes = getSyntaxFixes(doc, diag, diag.range);
            assert.strictEqual(fixes.length, 1);
            assert.strictEqual(fixes[0].edit._edits[0].newText, ';');
        });

        test('replaces = with == on bml-assignment-in-condition', function() {
            const doc = createMockDoc('if (x = 5) {\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 7), 'Assignment in condition', 0, 'bml-assignment-in-condition');
            const fixes = getSyntaxFixes(doc, diag, diag.range);
            assert.strictEqual(fixes.length, 1);
            assert.strictEqual(fixes[0].edit._edits[0].newText, '==');
        });

        test('removes trailing comma on bml-trailing-comma-error', function() {
            const doc = createMockDoc('myArr = string[]{"a", "b",};\n');
            const diag = new MockDiagnostic(new MockRange(0, 25, 0, 26), 'Trailing comma', 0, 'bml-trailing-comma-error');
            const fixes = getSyntaxFixes(doc, diag, diag.range);
            assert.strictEqual(fixes.length, 1);
            assert.strictEqual(fixes[0].edit._edits[0].newText, '');
        });

        test('wraps expression in parentheses on bml-not-without-parens', function() {
            const doc = createMockDoc('if (not x == 5) {\n');
            const diag = new MockDiagnostic(new MockRange(0, 8, 0, 14), 'not without parens', 0, 'bml-not-without-parens');
            const fixes = getSyntaxFixes(doc, diag, diag.range);
            assert.strictEqual(fixes.length, 1);
            assert.strictEqual(fixes[0].edit._edits[0].newText, '(x == 5)');
        });

        test('replaces zero divisor with safe fallback on bml-division-by-zero', function() {
            const doc = createMockDoc('res = num / 0;\n');
            const diag = new MockDiagnostic(new MockRange(0, 12, 0, 13), 'Division by zero', 0, 'bml-division-by-zero');
            const fixes = getSyntaxFixes(doc, diag, diag.range);
            assert.strictEqual(fixes.length, 1);
            assert.strictEqual(fixes[0].edit._edits[0].newText, '1.0');
        });
    });

    suite('Advanced Quality & Math Quick Fixes', function() {
        test('clamps argument to valid domain on bml-math-domain-error', function() {
            const doc = createMockDoc('res = asin(2.5);\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 15), 'Math domain error', 0, 'bml-math-domain-error');
            const fixes = getAdvancedQualityFixes(doc, diag, diag.range, '');
            assert.strictEqual(fixes.length, 1);
            assert.strictEqual(fixes[0].edit._edits[0].newText, 'asin(1.0)');
        });

        test('replaces float equality with fabs tolerance check on bml-float-equality', function() {
            const doc = createMockDoc('if (price == 19.99) {\n');
            const diag = new MockDiagnostic(new MockRange(0, 4, 0, 18), 'Float equality comparison', 1, 'bml-float-equality');
            const fixes = getAdvancedQualityFixes(doc, diag, diag.range, '');
            assert.strictEqual(fixes.length, 1);
            assert.ok(fixes[0].title.includes('fabs'));
            assert.strictEqual(fixes[0].edit._edits[0].newText, 'fabs(price - 19.99) <= 0.000001');
        });

        test('replaces constant conditions and removes duplicate branches', function() {
            const docConst = createMockDoc('if (1 == 1) {\n');
            const diagConst = new MockDiagnostic(new MockRange(0, 4, 0, 10), 'Condition is always true', 1, 'bml-constant-condition');
            const fixesConst = getAdvancedQualityFixes(docConst, diagConst, diagConst.range, '');
            assert.strictEqual(fixesConst[0].edit._edits[0].newText, '(true)');

            const docDup = createMockDoc('if (x > 0) {\n    a = 1;\n} elif (x > 0) {\n    a = 2;\n}\n');
            const diagDup = new MockDiagnostic(new MockRange(2, 8, 2, 13), 'Duplicate branch condition', 1, 'bml-duplicate-branch-condition');
            const fixesDup = getAdvancedQualityFixes(docDup, diagDup, diagDup.range, '');
            assert.strictEqual(fixesDup.length, 1);
            assert.ok(fixesDup[0].title.includes('Remove duplicate elif branch'));
        });

        test('inserts loop processing comment on bml-empty-loop', function() {
            const doc = createMockDoc('for x in list {}\n');
            const diag = new MockDiagnostic(new MockRange(0, 14, 0, 16), 'Empty loop body', 1, 'bml-empty-loop');
            const fixes = getAdvancedQualityFixes(doc, diag, diag.range, '');
            assert.strictEqual(fixes.length, 1);
            assert.ok(fixes[0].edit._edits[0].newText.includes('// TODO: loop processing'));
        });

        test('replaces negative array index with 0 on bml-array-negative-index', function() {
            const doc = createMockDoc('item = arr[-1];\n');
            const diag = new MockDiagnostic(new MockRange(0, 11, 0, 13), 'Negative index', 0, 'bml-array-negative-index');
            const fixes = getAdvancedQualityFixes(doc, diag, diag.range, '');
            assert.strictEqual(fixes.length, 1);
            assert.strictEqual(fixes[0].edit._edits[0].newText, '0');
        });

        test('wraps variable with null check on bml-null-check-required', function() {
            const doc = createMockDoc('len = sizeofarray(data);\n');
            const diag = new MockDiagnostic(new MockRange(0, 18, 0, 22), 'Variable may be null', 1, 'bml-null-check-required');
            const fixes = getAdvancedQualityFixes(doc, diag, diag.range, '');
            assert.strictEqual(fixes.length, 1);
            assert.ok(fixes[0].title.includes('not(isnull(data))'));
        });

        test('replaces string "null" with jsonnull() on bml-jsonput-reserved-literal', function() {
            const doc = createMockDoc('jsonput(j, "key", "null");\n');
            const diag = new MockDiagnostic(new MockRange(0, 18, 0, 24), 'Literal "null" string used in jsonput', 1, 'bml-jsonput-reserved-literal');
            const fixes = getAdvancedQualityFixes(doc, diag, diag.range, '');
            assert.strictEqual(fixes.length, 1);
            assert.strictEqual(fixes[0].edit._edits[0].newText, 'jsonnull()');
        });
    });

    suite('Date Tokens & Naming Conventions Quick Fixes', function() {
        test('corrects date format month and day tokens', function() {
            const docMonth = createMockDoc('s = datetostr(d, "yyyy-mm-dd");\n');
            const diagMonth = new MockDiagnostic(new MockRange(0, 17, 0, 29), 'Invalid month token', 1, 'bml-date-format-month');
            const fixesMonth = getDictJsonDateFixes(docMonth, diagMonth, diagMonth.range);
            assert.strictEqual(fixesMonth[0].edit._edits[0].newText, '"yyyy-MM-dd"');

            const docDay = createMockDoc('s = datetostr(d, "yyyy-MM-DD");\n');
            const diagDay = new MockDiagnostic(new MockRange(0, 17, 0, 29), 'Invalid day token', 1, 'bml-date-format-day');
            const fixesDay = getDictJsonDateFixes(docDay, diagDay, diagDay.range);
            assert.strictEqual(fixesDay[0].edit._edits[0].newText, '"yyyy-MM-dd"');
        });

        test('renames identifiers with CPQ naming conventions', function() {
            const docBool = createMockDoc('active = true;\n');
            const diagBool = new MockDiagnostic(new MockRange(0, 0, 0, 6), 'Boolean should have is/has prefix', 2, 'bml-boolean-naming-prefix');
            const fixesBool = getStyleFixes(docBool, diagBool, diagBool.range);
            assert.ok(fixesBool.length > 0);
            assert.ok(fixesBool[0].title.includes("Rename 'active' to 'isActive'"));

            const docDate = createMockDoc('order = getdate();\n');
            const diagDate = new MockDiagnostic(new MockRange(0, 0, 0, 5), 'Date should have Date suffix', 2, 'bml-date-naming-suffix');
            const fixesDate = getStyleFixes(docDate, diagDate, diagDate.range);
            assert.ok(fixesDate.length > 0);
            assert.ok(fixesDate[0].title.includes("Rename 'order' to 'orderDate'"));

            const docRs = createMockDoc('records = bmql("SELECT x FROM t");\n');
            const diagRs = new MockDiagnostic(new MockRange(0, 0, 0, 7), 'RecordSet should have RecordSet suffix', 2, 'bml-recordset-naming-suffix');
            const fixesRs = getStyleFixes(docRs, diagRs, diagRs.range);
            assert.ok(fixesRs.length > 0);
            assert.ok(fixesRs[0].title.includes("Rename 'records' to 'recordsRecordSet'"));

            const docJson = createMockDoc('payload = json();\n');
            const diagJson = new MockDiagnostic(new MockRange(0, 0, 0, 7), 'Json should have Json suffix', 2, 'bml-json-naming-suffix');
            const fixesJson = getStyleFixes(docJson, diagJson, diagJson.range);
            assert.ok(fixesJson.length > 0);
            assert.ok(fixesJson[0].title.includes("Rename 'payload' to 'payloadJson'"));

            const docSb = createMockDoc('buffer = stringbuilder();\n');
            const diagSb = new MockDiagnostic(new MockRange(0, 0, 0, 6), 'StringBuilder should have Sb suffix', 2, 'bml-stringbuilder-naming-suffix');
            const fixesSb = getStyleFixes(docSb, diagSb, diagSb.range);
            assert.ok(fixesSb.length > 0);
            assert.ok(fixesSb[0].title.includes("Rename 'buffer' to 'bufferSb'"));
        });
    });
});
