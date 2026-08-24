const assert = require('assert');
const vscode = require('vscode');
const { getSyntaxFixes } = require('../../app/lang/lint/code-actions/syntaxFixes');
const { getQualityFixes } = require('../../app/lang/lint/code-actions/qualityFixes');
const { getApiFixes } = require('../../app/lang/lint/code-actions/apiFixes');

suite('Comprehensive Quick Fixes Test Suite', () => {
    const createMockDocument = (lineText) => ({
        lineCount: 1,
        getText(range) {
            return lineText.substring(range.start.character, range.end.character);
        },
        lineAt(lineIndex) {
            return { text: lineText, range: new vscode.Range(0, 0, 0, lineText.length) };
        },
        uri: vscode.Uri.file('/mock/test.bml')
    });

    // 1. Binary Operators & Type Mismatches
    suite('1. Binary Syntax & Type Mismatch Quick Fixes', () => {
        test('bml-binary-type-mismatch: String + Integer concatenation', () => {
            const lineText = 'mCode_31 = "REF_MOD_" + 31;';
            const doc = createMockDocument(lineText);
            const opPos = lineText.indexOf('+');
            const diag = new vscode.Diagnostic(
                new vscode.Range(0, opPos, 0, opPos + 1),
                "Type mismatch: Cannot combine 'String' and 'Integer' using '+'.",
                vscode.DiagnosticSeverity.Error
            );
            diag.code = 'bml-binary-type-mismatch';

            const fixes = getSyntaxFixes(doc, diag, diag.range);
            assert.ok(fixes.some(f => f.title.includes('string(31)')), 'Should recommend wrapping right operand with string()');
        });

        test('bml-binary-type-mismatch: Integer + String parsing (numeric string literal)', () => {
            const lineText = 'testval = 10 + "10";';
            const doc = createMockDocument(lineText);
            const opPos = lineText.indexOf('+');
            const diag = new vscode.Diagnostic(
                new vscode.Range(0, opPos, 0, opPos + 1),
                "Type mismatch: Cannot combine 'Integer' and 'String' using '+'.",
                vscode.DiagnosticSeverity.Error
            );
            diag.code = 'bml-binary-type-mismatch';

            const fixes = getSyntaxFixes(doc, diag, diag.range);
            assert.ok(fixes.some(f => f.title.includes('atoi("10")')), 'Should offer atoi("10") for numeric string literal');
            assert.ok(fixes.some(f => f.title.includes('string(10)')), 'Should offer string(10) for string concatenation');
        });

        test('bml-binary-type-mismatch: Non-numeric string suppresses atoi', () => {
            const lineText = 'if ("test" == 1) { print 1; }';
            const doc = createMockDocument(lineText);
            const opPos = lineText.indexOf('==');
            const diag = new vscode.Diagnostic(
                new vscode.Range(0, opPos, 0, opPos + 2),
                "Type mismatch: Cannot compare 'String' and 'Integer'.",
                vscode.DiagnosticSeverity.Error
            );
            diag.code = 'bml-binary-type-mismatch';

            const fixes = getSyntaxFixes(doc, diag, diag.range);
            assert.ok(!fixes.some(f => f.title.includes('atoi("test")')), 'Should NOT offer atoi("test") for non-digit string literal');
            assert.ok(fixes.some(f => f.title.includes('string(1)')), 'Should offer string(1) for string comparison');
        });
    });

    // 2. String Utilities
    suite('2. String Linter Quick Fixes', () => {
        test('bml-unsafe-atoi-atof: Guard unsafe string parsing variable', () => {
            const lineText = 'num = atoi(strVar);';
            const doc = createMockDocument(lineText);
            const diag = new vscode.Diagnostic(
                new vscode.Range(0, 6, 0, 18),
                "Unsafe atoi() call on variable 'strVar'. Wrap with isnumber().",
                vscode.DiagnosticSeverity.Warning
            );
            diag.code = 'bml-unsafe-atoi-atof';

            const fixes = getQualityFixes(doc, diag, diag.range, '');
            assert.ok(fixes.some(f => f.title.includes('isnumber(strVar)')), 'Should offer isnumber guard snippet');
        });

        test('bml-atoi-atof-empty-string: Replace empty string atoi("") with default 0', () => {
            const lineText = 'num = atoi("");';
            const doc = createMockDocument(lineText);
            const diag = new vscode.Diagnostic(
                new vscode.Range(0, 6, 0, 14),
                "Passing empty string to atoi() throws a runtime exception.",
                vscode.DiagnosticSeverity.Error
            );
            diag.code = 'bml-atoi-atof-empty-string';

            const fixes = getQualityFixes(doc, diag, diag.range, '');
            assert.ok(fixes.some(f => f.title.includes('Replace with 0')), 'Should offer replacement with 0');
        });

        test('bml-string-cast-of-string: Unwrap redundant string("literal")', () => {
            const lineText = 'val = string("hello");';
            const doc = createMockDocument(lineText);
            const diag = new vscode.Diagnostic(
                new vscode.Range(0, 6, 0, 21),
                "Redundant string() cast of String literal.",
                vscode.DiagnosticSeverity.Warning
            );
            diag.code = 'bml-string-cast-of-string';

            const fixes = getQualityFixes(doc, diag, diag.range, '');
            assert.ok(fixes.some(f => f.title.includes('"hello"')), 'Should unwrap redundant string() call');
        });
    });

    // 3. Array Utilities
    suite('3. Array Linter Quick Fixes', () => {
        test('bml-sort-invalid-order: Change invalid sort order to asc/desc', () => {
            const lineText = 'sort(arr, "invalid");';
            const doc = createMockDocument(lineText);
            const diag = new vscode.Diagnostic(
                new vscode.Range(0, 10, 0, 19),
                "Invalid sort order parameter.",
                vscode.DiagnosticSeverity.Error
            );
            diag.code = 'bml-sort-invalid-order';

            const fixes = getQualityFixes(doc, diag, diag.range, '');
            const titles = fixes.map(f => f.title);
            assert.ok(titles.some(t => t.includes('"asc"')), 'Should offer "asc" quick fix');
            assert.ok(titles.some(t => t.includes('"desc"')), 'Should offer "desc" quick fix');
        });

        test('bml-negative-array-size: Change negative size String[-5] to String[0]', () => {
            const lineText = 'arr = String[-5];';
            const doc = createMockDocument(lineText);
            const diag = new vscode.Diagnostic(
                new vscode.Range(0, 13, 0, 15),
                "Negative array size -5.",
                vscode.DiagnosticSeverity.Error
            );
            diag.code = 'bml-negative-array-size';

            const fixes = getQualityFixes(doc, diag, diag.range, '');
            assert.ok(fixes.some(f => f.title.includes('Replace -5 with 0')), 'Should offer 0 size replacement');
        });
    });

    // 4. Date Formatting & Functions
    suite('4. Date Linter Quick Fixes', () => {
        test('bml-strtodate-fix: Replace deprecated strtodate with strtojavadate', () => {
            const lineText = 'd = strtodate(s, "yyyy-MM-dd");';
            const doc = createMockDocument(lineText);
            const diag = new vscode.Diagnostic(
                new vscode.Range(0, 4, 0, 13),
                "Deprecated function 'strtodate'. Use 'strtojavadate'.",
                vscode.DiagnosticSeverity.Hint
            );
            diag.code = 'bml-strtodate-fix';

            const fixes = getQualityFixes(doc, diag, diag.range, '');
            assert.ok(fixes.some(f => f.title.includes('strtojavadate')), 'Should offer strtojavadate replacement');
        });

        test('bml-date-format-year: Replace YYYY with yyyy', () => {
            const lineText = 'fmt = formatdate(d, "YYYY-MM-dd");';
            const doc = createMockDocument(lineText);
            const diag = new vscode.Diagnostic(
                new vscode.Range(0, 20, 0, 32),
                "Pattern YYYY uses Week Year instead of Year.",
                vscode.DiagnosticSeverity.Warning
            );
            diag.code = 'bml-date-format-year';

            const fixes = getQualityFixes(doc, diag, diag.range, '');
            assert.ok(fixes.some(f => f.title.includes('yyyy')), 'Should replace YYYY with yyyy');
        });
    });

    // 5. Conditionals
    suite('5. Conditional Quick Fixes', () => {
        test('bml-lonelyIf: Convert else { if (...) to elif (...)', () => {
            const lineText = 'else { if (x > 0) {';
            const doc = createMockDocument(lineText);
            const diag = new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, 19),
                "Single 'if' statement inside 'else' block can be collapsed to 'elif'.",
                vscode.DiagnosticSeverity.Warning
            );
            diag.code = 'bml-lonelyIf';

            const fixes = getQualityFixes(doc, diag, diag.range, '');
            assert.ok(fixes.some(f => f.title.includes('elif')), 'Should offer collapsing to elif');
        });
    });

    // 6. Dictionary
    suite('6. Dictionary Quick Fixes', () => {
        test('bml-dict-missing-type: Add dict type parameter', () => {
            const lineText = 'd = dict();';
            const doc = createMockDocument(lineText);
            const diag = new vscode.Diagnostic(
                new vscode.Range(0, 4, 0, 10),
                "Missing dictionary type parameter.",
                vscode.DiagnosticSeverity.Error
            );
            diag.code = 'bml-dict-missing-type';

            const fixes = getQualityFixes(doc, diag, diag.range, '');
            const titles = fixes.map(f => f.title);
            assert.ok(titles.some(t => t.includes('"string"')), 'Should offer dict("string")');
            assert.ok(titles.some(t => t.includes('"anytype"')), 'Should offer dict("anytype")');
        });
    });

    // 7. Direct DB & BMQL
    suite('7. Direct DB & BMQL Quick Fixes', () => {
        test('bml-gettabledata-fix: Replace gettabledata with bmql', () => {
            const lineText = 'res = gettabledata("table");';
            const doc = createMockDocument(lineText);
            const diag = new vscode.Diagnostic(
                new vscode.Range(0, 6, 0, 19),
                "Deprecated 'gettabledata'. Use 'bmql'.",
                vscode.DiagnosticSeverity.Hint
            );
            diag.code = 'bml-gettabledata-fix';

            const fixes = getQualityFixes(doc, diag, diag.range, '');
            assert.ok(fixes.some(f => f.title.includes('Replace gettabledata with bmql')), 'Should offer bmql replacement');
        });
    });

    // 8. JSON
    suite('8. JSON Quick Fixes', () => {
        test('bml-json-get-throws-without-default: Add 4th default value argument', () => {
            const lineText = 'val = jsonget(jObj, "key", "integer");';
            const doc = createMockDocument(lineText);
            const diag = new vscode.Diagnostic(
                new vscode.Range(0, 6, 0, 37),
                "jsonget() with 3 arguments throws if key is missing.",
                vscode.DiagnosticSeverity.Warning
            );
            diag.code = 'bml-json-get-throws-without-default';

            const fixes = getQualityFixes(doc, diag, diag.range, '');
            assert.ok(fixes.some(f => f.title.includes("Add default value argument '0'")), 'Should offer default argument 0');
        });

        test('bml-jsonput-reserved-literal: Replace string "null" with jsonnull()', () => {
            const lineText = 'jsonput(jObj, "key", "null");';
            const doc = createMockDocument(lineText);
            const diag = new vscode.Diagnostic(
                new vscode.Range(0, 21, 0, 27),
                "jsonput() with string 'null' stores reserved JSON null.",
                vscode.DiagnosticSeverity.Warning
            );
            diag.code = 'bml-jsonput-reserved-literal';

            const fixes = getQualityFixes(doc, diag, diag.range, '');
            assert.ok(fixes.some(f => f.title.includes('Replace string "null" with jsonnull()')), 'Should offer jsonnull() replacement');
        });
    });

    // 9. Math
    suite('9. Math Quick Fixes', () => {
        test('bml-jnan-function-call: Remove parentheses from jNaN()', () => {
            const lineText = 'val = jNaN();';
            const doc = createMockDocument(lineText);
            const diag = new vscode.Diagnostic(
                new vscode.Range(0, 6, 0, 12),
                "jNaN is a constant, not a function.",
                vscode.DiagnosticSeverity.Error
            );
            diag.code = 'bml-jnan-function-call';

            const fixes = getQualityFixes(doc, diag, diag.range, '');
            assert.ok(fixes.some(f => f.title.includes('Remove parentheses')), 'Should recommend removing parentheses');
        });

        test('bml-math-domain-error: Clamp acos(2.0) to acos(1.0)', () => {
            const lineText = 'angle = acos(2.0);';
            const doc = createMockDocument(lineText);
            const diag = new vscode.Diagnostic(
                new vscode.Range(0, 8, 0, 17),
                "acos() argument is outside valid domain [-1, 1].",
                vscode.DiagnosticSeverity.Warning
            );
            diag.code = 'bml-math-domain-error';

            const fixes = getQualityFixes(doc, diag, diag.range, '');
            assert.ok(fixes.some(f => f.title.includes('acos(1.0)')), 'Should clamp argument to 1.0');
        });

        test('bml-float-equality: Add abs() precision tolerance check', () => {
            const lineText = 'if (rPrice_29 <> 0.0) {';
            const doc = createMockDocument(lineText);
            const startIdx = lineText.indexOf('rPrice_29');
            const endIdx = startIdx + 'rPrice_29 <> 0.0'.length;
            const diag = new vscode.Diagnostic(
                new vscode.Range(0, startIdx, 0, endIdx),
                "Direct float comparison precision warning.",
                vscode.DiagnosticSeverity.Warning
            );
            diag.code = 'bml-float-equality';

            const fixes = getQualityFixes(doc, diag, diag.range, '');
            assert.ok(fixes.some(f => f.title.includes('abs(rPrice_29) > 0.000001')), 'Should offer abs() tolerance quick fix');
        });
    });

    // 10. URL Access, XML, and Others
    suite('10. URL Access, XML & Other Utilities Quick Fixes', () => {
        test('bml-urldata-invalid-method: Offer valid HTTP methods for urldata', () => {
            const lineText = 'res = urldata("http://api.com", "INVALID");';
            const doc = createMockDocument(lineText);
            const diag = new vscode.Diagnostic(
                new vscode.Range(0, 32, 0, 41),
                "HTTP method INVALID is not supported.",
                vscode.DiagnosticSeverity.Error
            );
            diag.code = 'bml-urldata-invalid-method';

            const fixes = getApiFixes(doc, diag, diag.range);
            const titles = fixes.map(f => f.title);
            assert.ok(titles.some(t => t.includes('"GET"')), 'Should offer "GET" method');
            assert.ok(titles.some(t => t.includes('"POST"')), 'Should offer "POST" method');
        });

        test('bml-urldata-status-unchecked: Insert HTTP Status-Code check guard', () => {
            const lineText = 'res = urldata("http://api.com", "GET");';
            const doc = createMockDocument(lineText);
            const diag = new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, lineText.length),
                "urldata() result read without checking Status-Code first.",
                vscode.DiagnosticSeverity.Warning
            );
            diag.code = 'bml-urldata-status-unchecked';

            const fixes = getApiFixes(doc, diag, diag.range);
            assert.ok(fixes.some(f => f.title.includes('Insert HTTP Status-Code check')), 'Should offer Status-Code check snippet');
        });

        test('bml-readxml-error-key-unchecked: Insert XML error key check snippet', () => {
            const lineText = 'xmlRes = readxmlsingle(xmlStr);';
            const doc = createMockDocument(lineText);
            const diag = new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, lineText.length),
                "readxmlsingle() result unchecked for error key.",
                vscode.DiagnosticSeverity.Warning
            );
            diag.code = 'bml-readxml-error-key-unchecked';

            const fixes = getApiFixes(doc, diag, diag.range);
            assert.ok(fixes.some(f => f.title.includes('Insert XML error key check')), 'Should offer XML error check snippet');
        });

        test('bml-hmac-invalid-algorithm: Offer valid HMAC algorithm names', () => {
            const lineText = 'res = generatehmacmessage("msg", "key", "SHA-256");';
            const doc = createMockDocument(lineText);
            const diag = new vscode.Diagnostic(
                new vscode.Range(0, 40, 0, 49),
                "Algorithm SHA-256 is not valid.",
                vscode.DiagnosticSeverity.Error
            );
            diag.code = 'bml-hmac-invalid-algorithm';

            const fixes = getApiFixes(doc, diag, diag.range);
            assert.ok(fixes.some(f => f.title.includes('"HmacSHA256"')), 'Should offer HmacSHA256 algorithm');
        });

        test('bml-globaldict-ttl-out-of-range: Fix globaldict TTL to 3600', () => {
            const lineText = 'globaldictset("key", "val", -5);';
            const doc = createMockDocument(lineText);
            const diag = new vscode.Diagnostic(
                new vscode.Range(0, 28, 0, 30),
                "TTL -5 is outside documented range.",
                vscode.DiagnosticSeverity.Warning
            );
            diag.code = 'bml-globaldict-ttl-out-of-range';

            const fixes = getApiFixes(doc, diag, diag.range);
            assert.ok(fixes.some(f => f.title.includes('Set globaldict TTL to 3600')), 'Should offer 3600 TTL fix');
        });

        test('bml-undeclared-variable: Suggest fuzzy matched variable name replacement', () => {
            const lineText = 'append(categories_48, "SW");';
            const doc = createMockDocument(lineText);
            const startIdx = lineText.indexOf('categories_48');
            const endIdx = startIdx + 'categories_48'.length;
            const diag = new vscode.Diagnostic(
                new vscode.Range(0, startIdx, 0, endIdx),
                "'categories_48' is read here but is never defined in this function. Did you mean 'categories_48List'?",
                vscode.DiagnosticSeverity.Warning
            );
            diag.code = 'bml-undeclared-variable';

            const fixes = getQualityFixes(doc, diag, diag.range, '');
            assert.strictEqual(fixes.length, 1);
            assert.strictEqual(fixes[0].title, "Replace with 'categories_48List'");
        });
    });
});
