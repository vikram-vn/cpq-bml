const assert = require('assert');
const { getStringArrayFixes } = require('@/lang/lint/code-actions/stringArrayFixes');
const { getDictJsonDateFixes } = require('@/lang/lint/code-actions/dictJsonDateFixes');
const { getCommerceWebFixes } = require('@/lang/lint/code-actions/commerceWebFixes');
const { MockRange, MockDiagnostic, createMockDoc } = require('@/test/code-actions/helpers');

suite('100% BML Core Language Quick Fixes Suite', function() {
    suite('6. 100% BML String & Array Quick Fixes Suite', function() {
        test('swaps arguments for join(delim, arr) to canonical join(arr, delim)', function() {
            const doc = createMockDoc('res = join(",", sampleArr);\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 26), 'Join expects array first', 1, 'bml-join-swapped-args');
            const fixes = getStringArrayFixes(doc, diag, diag.range);
            const fix = fixes.find(f => f.title.includes('Swap arguments'));
            assert.ok(fix, 'Should offer argument swap');
            assert.strictEqual(fix.edit._edits[0].newText, 'join(sampleArr, ",")');
        });

        test('unwraps redundant string() on existing String variable', function() {
            const doc = createMockDoc('res = string(strVal);\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 20), 'Redundant string() call', 1, 'bml-string-cast-of-string');
            const fixes = getStringArrayFixes(doc, diag, diag.range);
            const fix = fixes.find(f => f.title.includes('Remove redundant'));
            assert.ok(fix, 'Should offer unwrapping');
            assert.strictEqual(fix.edit._edits[0].newText, 'strVal');
        });

        test('replaces empty atoi("") and atof("") with 0 and 0.0', function() {
            const doc1 = createMockDoc('n = atoi("");\n');
            const diag1 = new MockDiagnostic(new MockRange(0, 4, 0, 12), 'Empty string throws exception in atoi', 0, 'bml-atoi-atof-empty-literal');
            const fixes1 = getStringArrayFixes(doc1, diag1, diag1.range);
            assert.strictEqual(fixes1[0].edit._edits[0].newText, '0');

            const doc2 = createMockDoc('f = atof("");\n');
            const diag2 = new MockDiagnostic(new MockRange(0, 4, 0, 12), 'Empty string throws exception in atof', 0, 'bml-atoi-atof-empty-literal');
            const fixes2 = getStringArrayFixes(doc2, diag2, diag2.range);
            assert.strictEqual(fixes2[0].edit._edits[0].newText, '0.0');
        });

        test('assigns append result: append(arr, x) -> arr = append(arr, x);', function() {
            const doc = createMockDoc('append(myArray, "newVal");\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 26), 'Unassigned append result', 1, 'bml-unassigned-append');
            const fixes = getStringArrayFixes(doc, diag, diag.range);
            const fix = fixes.find(f => f.title.includes('Assign append result'));
            assert.ok(fix, 'Should offer assignment fix');
            assert.strictEqual(fix.edit._edits[0].newText, 'myArray = append(myArray, "newVal");');
        });

        test('converts invalid sort order "ascending" to "asc"', function() {
            const doc = createMockDoc('sort(myArray, "ascending");\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 27), 'Sort order must be "asc" or "desc"', 0, 'bml-sort-invalid-order');
            const fixes = getStringArrayFixes(doc, diag, diag.range);
            assert.strictEqual(fixes[0].edit._edits[0].newText, 'sort(myArray, "asc");');
        });

        test('converts sizeofarray(arr) == 0 to isempty(arr)', function() {
            const doc = createMockDoc('if (sizeofarray(myArr) == 0) {\n');
            const diag = new MockDiagnostic(new MockRange(0, 4, 0, 27), 'Use isempty(arr)', 1, 'bml-sizeofarray-zero-check');
            const fixes = getStringArrayFixes(doc, diag, diag.range);
            assert.strictEqual(fixes[0].edit._edits[0].newText, 'isempty(myArr)');
        });
    });

    suite('7. 100% BML Dictionary, JSON, Date & Math Quick Fixes Suite', function() {
        test('initializes missing dictionary type in dict()', function() {
            const doc = createMockDoc('d = dict();\n');
            const diag = new MockDiagnostic(new MockRange(0, 4, 0, 10), 'dict requires type parameter', 0, 'bml-dict-missing-type');
            const fixes = getDictJsonDateFixes(doc, diag, diag.range);
            assert.ok(fixes.length >= 2, 'Should offer string and anytype options');
            assert.strictEqual(fixes[0].edit._edits[0].newText, 'dict("string")');
        });

        test('corrects invalid dictionary type names', function() {
            const doc = createMockDoc('d = dict("int");\n');
            const diag = new MockDiagnostic(new MockRange(0, 4, 0, 15), 'Invalid dict type', 0, 'bml-dict-invalid-type');
            const fixes = getDictJsonDateFixes(doc, diag, diag.range);
            assert.strictEqual(fixes[0].edit._edits[0].newText, 'dict("integer")');
        });

        test('adds 3rd valueType argument for get() on anytype dictionary', function() {
            const doc = createMockDoc('val = get(anyDict, "key1");\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 26), 'get on anytype dictionary requires valueType parameter', 0, 'bml-dict-anytype-get-type');
            const fixes = getDictJsonDateFixes(doc, diag, diag.range);
            const strFix = fixes.find(f => f.title.includes('"string"'));
            assert.ok(strFix, 'Should offer string type');
            assert.strictEqual(strFix.edit._edits[0].newText, 'get(anyDict, "key1", "string")');
        });

        test('adds safe default value to jsonget', function() {
            const doc = createMockDoc('val = jsonget(myJson, "status");\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 31), 'jsonget throws if key is not found without default value', 1, 'bml-json-get-throws-without-default');
            const fixes = getDictJsonDateFixes(doc, diag, diag.range);
            assert.strictEqual(fixes[0].edit._edits[0].newText, 'jsonget(myJson, "status", "string", "")');
        });

        test('prepends root $ to JSONPath query without root', function() {
            const doc = createMockDoc('val = jsonpathgetsingle(myJson, "store.book[0]");\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 48), 'JSONPath must start with $', 0, 'bml-jsonpath-missing-root');
            const fixes = getDictJsonDateFixes(doc, diag, diag.range);
            assert.strictEqual(fixes[0].edit._edits[0].newText, 'jsonpathgetsingle(myJson, "$.store.book[0]")');
        });

        test('replaces deprecated strtodate with strtojavadate', function() {
            const doc = createMockDoc('d = strtodate("2026-09-10", "yyyy-MM-dd");\n');
            const diag = new MockDiagnostic(new MockRange(0, 4, 0, 41), 'strtodate is deprecated', 1, 'bml-strtodate-fix');
            const fixes = getDictJsonDateFixes(doc, diag, diag.range);
            assert.strictEqual(fixes[0].edit._edits[0].newText, 'strtojavadate("2026-09-10", "yyyy-MM-dd")');
        });

        test('corrects Date format specifiers YYYY to yyyy and DD to dd', function() {
            const doc = createMockDoc('fmt = "YYYY-MM-DD";\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 18), 'Use yyyy for year', 1, 'bml-date-format-year');
            const fixes = getDictJsonDateFixes(doc, diag, diag.range);
            assert.strictEqual(fixes[0].edit._edits[0].newText, '"yyyy-MM-DD"');
        });

        test('converts direct date comparison d1 < d2 to comparedates(d1, d2) == -1', function() {
            const doc = createMockDoc('if (dateA < dateB) {\n');
            const diag = new MockDiagnostic(new MockRange(0, 4, 0, 17), 'Direct date comparison is invalid in BML', 0, 'bml-direct-date-comparison');
            const fixes = getDictJsonDateFixes(doc, diag, diag.range);
            assert.strictEqual(fixes[0].edit._edits[0].newText, 'comparedates(dateA, dateB) == -1');
        });

        test('converts direct date arithmetic d + 5 to adddays(d, 5)', function() {
            const doc = createMockDoc('nextDate = startDate + 5;\n');
            const diag = new MockDiagnostic(new MockRange(0, 11, 0, 24), 'Direct date arithmetic is invalid in BML', 0, 'bml-date-arithmetic');
            const fixes = getDictJsonDateFixes(doc, diag, diag.range);
            assert.strictEqual(fixes[0].edit._edits[0].newText, 'adddays(startDate, 5)');
        });

        test('converts deprecated NaN to jNaN and fixes jNaN() function call', function() {
            const doc1 = createMockDoc('x = NaN;\n');
            const diag1 = new MockDiagnostic(new MockRange(0, 4, 0, 7), 'NaN is deprecated, use jNaN', 1, 'bml-nan-fix');
            const fixes1 = getDictJsonDateFixes(doc1, diag1, diag1.range);
            assert.strictEqual(fixes1[0].edit._edits[0].newText, 'jNaN');

            const doc2 = createMockDoc('x = jNaN();\n');
            const diag2 = new MockDiagnostic(new MockRange(0, 4, 0, 10), 'jNaN is a constant, not a function', 0, 'bml-jnan-function-call');
            const fixes2 = getDictJsonDateFixes(doc2, diag2, diag2.range);
            assert.strictEqual(fixes2[0].edit._edits[0].newText, 'jNaN');
        });

        test('converts x == jNaN to isnan(x)', function() {
            const doc = createMockDoc('if (myNum == jNaN) {\n');
            const diag = new MockDiagnostic(new MockRange(0, 4, 0, 17), 'NaN comparison must use isnan', 0, 'bml-jnan-equality');
            const fixes = getDictJsonDateFixes(doc, diag, diag.range);
            assert.strictEqual(fixes[0].edit._edits[0].newText, 'isnan(myNum)');
        });

        test('supplies decimal places to round(x) -> round(x, 0)', function() {
            const doc = createMockDoc('r = round(12.34);\n');
            const diag = new MockDiagnostic(new MockRange(0, 4, 0, 16), 'round requires decimal places', 0, 'bml-round-missing-decimal');
            const fixes = getDictJsonDateFixes(doc, diag, diag.range);
            assert.strictEqual(fixes[0].edit._edits[0].newText, 'round(12.34, 0)');
        });
    });

    suite('8. 100% BML Commerce, Web Services & Return Safety Quick Fixes Suite', function() {
        test('capitalizes HTTP method in urldata to "GET"', function() {
            const doc = createMockDoc('resp = urldata("https://example.com", "get");\n');
            const diag = new MockDiagnostic(new MockRange(0, 7, 0, 44), 'HTTP method must be uppercase', 0, 'bml-urldata-invalid-method');
            const fixes = getCommerceWebFixes(doc, diag, diag.range);
            assert.strictEqual(fixes[0].edit._edits[0].newText, 'urldata("https://example.com", "GET")');
        });

        test('adds Status-Code check for urldata response dictionary', function() {
            const doc = createMockDoc('response = urldata("https://example.com", "GET");\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 48), 'Unchecked response status', 1, 'bml-urldata-status-unchecked');
            const fixes = getCommerceWebFixes(doc, diag, diag.range);
            assert.strictEqual(fixes[0].edit._edits[0].newText, 'if (get(response, "Status-Code") == "200 OK")');
        });

        test('adds BM_READXMLSINGLE_ERROR check for readxmlsingle response', function() {
            const doc = createMockDoc('xmlRes = readxmlsingle(xmlStr, xpaths);\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 39), 'Unchecked readxml error', 1, 'bml-readxml-error-key-unchecked');
            const fixes = getCommerceWebFixes(doc, diag, diag.range);
            assert.strictEqual(fixes[0].edit._edits[0].newText, 'if (not(containskey(xmlRes, "BM_READXMLSINGLE_ERROR")))');
        });

        test('replaces invalid HMAC algorithm with HmacSHA256', function() {
            const doc = createMockDoc('sig = generatehmacmessage("key", "msg", "sha256");\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 49), 'Invalid HMAC algorithm name', 0, 'bml-hmac-invalid-algorithm');
            const fixes = getCommerceWebFixes(doc, diag, diag.range);
            assert.strictEqual(fixes[0].edit._edits[0].newText, 'generatehmacmessage("key", "msg", "HmacSHA256")');
        });

        test('wraps return sb with sbtostring(sb)', function() {
            const doc = createMockDoc('return resultSb;\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 16), 'Cannot return StringBuilder directly', 0, 'bml-missing-sbtostring');
            const fixes = getCommerceWebFixes(doc, diag, diag.range);
            assert.strictEqual(fixes[0].edit._edits[0].newText, 'return sbtostring(resultSb);');
        });
    });

});
