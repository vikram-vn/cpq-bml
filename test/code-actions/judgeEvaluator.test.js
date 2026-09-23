const assert = require('assert');
const { createMockDoc, MockDiagnostic, MockRange } = require('./helpers');
const { getSmartSignatureFixes, getBatchSignatureFixes } = require('@/lang/lint/code-actions/smartSignatureFixes');
const { checkArray } = require('@/lang/lint/categories/array/array');
const { inferExpressionType, collectVariableTypes } = require('@/lang/lint/rules/typeCheck');

suite('Autonomous Judge Evaluation Suite: BML Linting & Smart Signature Fixes', function() {

    // =========================================================================
    // MATRIX 1: LINE-LEVEL KNOWLEDGE-DRIVEN PARAMETER SYNTHESIS (bml-function-arg-count)
    // =========================================================================
    suite('Matrix 1: Knowledge-Driven Parameter Synthesis Across BML Categories', function() {

        test('1.1 [String] split(str) synthesizes delimiter options', function() {
            const doc = createMockDoc('tokens = split(dataLine);\n');
            const diag = new MockDiagnostic(new MockRange(0, 9, 0, 24), 'split expects 2 arguments', 0, 'bml-function-arg-count');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const comma = fixes.find(f => f.title.toLowerCase().includes('comma'));
            assert.ok(comma, 'Must synthesize comma delimiter');
            assert.strictEqual(comma.isPreferred, true);
            assert.strictEqual(comma.edit._edits[0].newText, 'dataLine, ","');
        });

        test('1.2 [String] join(arr) synthesizes delimiter options', function() {
            const doc = createMockDoc('csv = join(stringList);\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 22), 'join expects 2 arguments', 0, 'bml-function-arg-count');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const comma = fixes.find(f => f.title.toLowerCase().includes('comma'));
            assert.ok(comma, 'Must synthesize comma delimiter');
            assert.strictEqual(comma.edit._edits[0].newText, 'stringList, ","');
        });

        test('1.3 [String] substring(str, start) synthesizes len(str)', function() {
            const doc = createMockDoc('chunk = substring(payload, 2);\n');
            const diag = new MockDiagnostic(new MockRange(0, 8, 0, 29), 'substring expects 3 arguments', 0, 'bml-function-arg-count');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const lenFix = fixes.find(f => f.title.includes('len(payload)'));
            assert.ok(lenFix, 'Must synthesize len(payload)');
            assert.strictEqual(lenFix.edit._edits[0].newText, 'payload, 2, len(payload)');
        });

        test('1.4 [Array] sort(arr) synthesizes "asc" and "desc"', function() {
            const doc = createMockDoc('res = sort(items);\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 17), 'sort missing order', 0, 'bml-function-arg-count');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const asc = fixes.find(f => f.title.includes('"asc"'));
            const desc = fixes.find(f => f.title.includes('"desc"'));
            assert.ok(asc, 'Must synthesize "asc" option');
            assert.ok(desc, 'Must synthesize "desc" option');
            assert.strictEqual(asc.isPreferred, true);
            assert.strictEqual(asc.edit._edits[0].newText, 'items, "asc"');
        });

        test('1.5 [Dict] get(dict, key) synthesizes valueType with LHS preference (float)', function() {
            const doc = createMockDoc('itemCost = get(rateCard, "laborRate");\n');
            const diag = new MockDiagnostic(new MockRange(0, 11, 0, 37), 'dict("anytype") requires valueType', 0, 'bml-function-arg-count');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const floatFix = fixes.find(f => f.title.includes('"float"'));
            assert.ok(floatFix, 'Must offer "float" valueType');
            assert.strictEqual(floatFix.isPreferred, true, 'float must be preferred for itemCost LHS');
            assert.strictEqual(floatFix.edit._edits[0].newText, 'rateCard, "laborRate", "float"');
        });

        test('1.6 [Dict] get(dict, key) synthesizes valueType with LHS preference (boolean)', function() {
            const doc = createMockDoc('isActive = get(flagDict, "enabled");\n');
            const diag = new MockDiagnostic(new MockRange(0, 11, 0, 35), 'dict("anytype") requires valueType', 0, 'bml-function-arg-count');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const boolFix = fixes.find(f => f.title.includes('"boolean"'));
            assert.ok(boolFix, 'Must offer "boolean" valueType');
            assert.strictEqual(boolFix.isPreferred, true, 'boolean must be preferred for isActive LHS');
        });

        test('1.7 [Math] round(price) synthesizes 2 decimal places for price/currency', function() {
            const doc = createMockDoc('totalTax = round(calculatedTax);\n');
            const diag = new MockDiagnostic(new MockRange(0, 11, 0, 31), 'round expects 2 arguments', 0, 'bml-function-arg-count');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const round2 = fixes.find(f => f.title.includes('2 decimal places'));
            assert.ok(round2, 'Must synthesize 2 decimal places for currency');
            assert.strictEqual(round2.isPreferred, true);
            assert.strictEqual(round2.edit._edits[0].newText, 'calculatedTax, 2');
        });

        test('1.8 [Math] round(count) synthesizes 0 decimal places for non-currency', function() {
            const doc = createMockDoc('finalCount = round(rawItemsCount);\n');
            const diag = new MockDiagnostic(new MockRange(0, 13, 0, 33), 'round expects 2 arguments', 0, 'bml-function-arg-count');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const round0 = fixes.find(f => f.title.includes('0 decimal places'));
            assert.ok(round0, 'Must synthesize 0 decimal places for non-currency');
            assert.strictEqual(round0.isPreferred, true);
            assert.strictEqual(round0.edit._edits[0].newText, 'rawItemsCount, 0');
        });

        test('1.9 [Date] datetostr(d) synthesizes predominant format from document', function() {
            const doc = createMockDoc('logTime = datetostr(t1, "yyyy-MM-dd HH:mm:ss");\ncurDate = datetostr(now);\n');
            const diag = new MockDiagnostic(new MockRange(1, 10, 1, 24), 'datetostr expects format argument', 0, 'bml-function-arg-count');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const fmt = fixes.find(f => f.title.includes('yyyy-MM-dd HH:mm:ss'));
            assert.ok(fmt, 'Must detect and use predominant document date format');
            assert.strictEqual(fmt.edit._edits[0].newText, 'now, "yyyy-MM-dd HH:mm:ss"');
        });

        test('1.10 [Web] urldata(url) synthesizes canonical GET call pattern', function() {
            const doc = createMockDoc('resp = urldata(apiEndpoint);\n');
            const diag = new MockDiagnostic(new MockRange(0, 7, 0, 27), 'urldata missing arguments', 0, 'bml-function-arg-count');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const getWithHeaders = fixes.find(f => f.title.includes('"get", headers'));
            assert.ok(getWithHeaders, 'Must synthesize GET method with headers pattern');
            assert.strictEqual(getWithHeaders.edit._edits[0].newText, 'apiEndpoint, "get", headers');
        });

        test('1.11 [Web] generatehmacmessage(msg, key) synthesizes doc-extracted algorithms', function() {
            const doc = createMockDoc('sig = generatehmacmessage(content, secretKey);\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 45), 'generatehmacmessage expects 3 arguments', 0, 'bml-function-arg-count');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const sha256Fix = fixes.find(f => f.title.includes('"SHA256"'));
            const sha512Fix = fixes.find(f => f.title.includes('"SHA512"'));
            assert.ok(sha256Fix, 'Must extract and synthesize SHA256 from docs');
            assert.ok(sha512Fix, 'Must extract and synthesize SHA512 from docs');
            assert.strictEqual(sha256Fix.isPreferred, true, 'SHA256 must be preferred (Default in docs)');
            assert.strictEqual(sha256Fix.edit._edits[0].newText, 'content, secretKey, "SHA256"');
        });

        test('1.12 [XML] transformxml(xml, xsl) synthesizes error message parameter', function() {
            const doc = createMockDoc('res = transformxml(rawXml, xslPath);\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 35), 'transformxml expects 3 arguments', 0, 'bml-function-arg-count');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const errFix = fixes.find(f => f.title.toLowerCase().includes('error'));
            assert.ok(errFix, 'Must synthesize error message parameter');
        });

        test('1.13 [Template] applytemplate(path, payload, err) synthesizes json parameter', function() {
            const doc = createMockDoc('out = applytemplate(tplPath, dataDict, "Error");\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 48), 'applytemplate expects 4 arguments', 0, 'bml-function-arg-count');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const jsonFix = fixes.find(f => f.title.toLowerCase().includes('json'));
            assert.ok(jsonFix, 'Must synthesize json parameter');
        });

        test('1.14 [Excess Arguments] dynamically removes extraneous arguments', function() {
            const doc = createMockDoc('c = sizeofarray(arr, extra1, extra2);\n');
            const diag = new MockDiagnostic(new MockRange(0, 4, 0, 36), 'sizeofarray expects at most 1 argument, but got 3', 0, 'bml-function-arg-count');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const removeFix = fixes.find(f => f.title.includes('Remove excess'));
            assert.ok(removeFix, 'Must offer excess argument removal');
            assert.strictEqual(removeFix.edit._edits[0].newText, 'arr');
        });

        test('1.15 [JSON] jsonget(json, key, "integer") synthesizes 0 for defaultValue', function() {
            const doc = createMockDoc('val = jsonget(myJson, "count", "integer");\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 42), 'jsonget requires defaultValue', 0, 'bml-function-arg-count');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const defaultZero = fixes.find(f => f.title.includes('Default integer 0'));
            assert.ok(defaultZero, 'Must synthesize 0 as default value matching "integer" valueType');
            assert.strictEqual(defaultZero.isPreferred, true);
            assert.strictEqual(defaultZero.edit._edits[0].newText, 'myJson, "count", "integer", 0');
        });
    });

    // =========================================================================
    // MATRIX 2: LINE-LEVEL SMART ARGUMENT TYPE CONVERSIONS (bml-function-arg-type)
    // =========================================================================
    suite('Matrix 2: Knowledge-Driven Type Conversion Quick Fixes', function() {

        test('2.1 converts Date to String using datetostr', function() {
            const doc = createMockDoc('print(createdDate);\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 17), 'Argument 1 to "print" should be String, but got a Date value.', 0, 'bml-function-arg-type');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const dateToStr = fixes.find(f => f.title.includes('datetostr'));
            assert.ok(dateToStr, 'Must offer datetostr conversion');
            assert.strictEqual(dateToStr.edit._edits[0].newText, 'datetostr(createdDate, "yyyy-MM-dd")');
        });

        test('2.2 converts StringBuilder to String using sbtostring', function() {
            const doc = createMockDoc('print(bufferSb);\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 14), 'Argument 1 to "print" should be String, but got a StringBuilder value.', 0, 'bml-function-arg-type');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const sbFix = fixes.find(f => f.title.includes('sbtostring'));
            assert.ok(sbFix, 'Must offer sbtostring conversion');
            assert.strictEqual(sbFix.edit._edits[0].newText, 'sbtostring(bufferSb)');
        });

        test('2.3 converts Float to Integer and wraps complex expression', function() {
            const doc = createMockDoc('res = range(baseIdx + 1.5);\n');
            const diag = new MockDiagnostic(new MockRange(0, 12, 0, 25), 'Argument 1 to "range" should be Integer, but got a Float value.', 0, 'bml-function-arg-type');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const roundFix = fixes.find(f => f.title.includes('round'));
            assert.ok(roundFix, 'Must offer round conversion');
            assert.strictEqual(roundFix.edit._edits[0].newText, 'round((baseIdx + 1.5), 0)');
        });

        test('2.4 converts String to Integer using atoi', function() {
            const doc = createMockDoc('res = range(qtyStr);\n');
            const diag = new MockDiagnostic(new MockRange(0, 12, 0, 18), 'Argument 1 to "range" should be Integer, but got a String value.', 0, 'bml-function-arg-type');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const atoiFix = fixes.find(f => f.title.includes('atoi'));
            assert.ok(atoiFix, 'Must offer atoi conversion');
            assert.strictEqual(atoiFix.edit._edits[0].newText, 'atoi(qtyStr)');
        });

        test('2.5 converts String to Float using atof', function() {
            const doc = createMockDoc('res = fabs(rateStr);\n');
            const diag = new MockDiagnostic(new MockRange(0, 11, 0, 18), 'Argument 1 to "fabs" should be Float, but got a String value.', 0, 'bml-function-arg-type');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const atofFix = fixes.find(f => f.title.includes('atof'));
            assert.ok(atofFix, 'Must offer atof conversion');
            assert.strictEqual(atofFix.edit._edits[0].newText, 'atof(rateStr)');
        });

        test('2.6 converts String to Date using strtojavadate', function() {
            const doc = createMockDoc('res = datetostr(inputDateStr);\n');
            const diag = new MockDiagnostic(new MockRange(0, 16, 0, 28), 'Argument 1 to "datetostr" should be Date, but got a String value.', 0, 'bml-function-arg-type');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const parseDateFix = fixes.find(f => f.title.includes('strtojavadate'));
            assert.ok(parseDateFix, 'Must offer strtojavadate conversion');
            assert.strictEqual(parseDateFix.edit._edits[0].newText, 'strtojavadate(inputDateStr, "yyyy-MM-dd")');
        });

        test('2.7 converts String to Json using json(str)', function() {
            const doc = createMockDoc('res = jsonpathcheck(rawPayload, "$.id");\n');
            const diag = new MockDiagnostic(new MockRange(0, 20, 0, 30), 'Argument 1 to "jsonpathcheck" should be Json, but got a String value.', 0, 'bml-function-arg-type');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const jsonFix = fixes.find(f => f.title.includes('json(rawPayload)'));
            assert.ok(jsonFix, 'Must offer json parsing');
            assert.strictEqual(jsonFix.edit._edits[0].newText, 'json(rawPayload)');
        });

        test('2.8 converts String to String[] using split', function() {
            const doc = createMockDoc('res = sort(rawTags);\n');
            const diag = new MockDiagnostic(new MockRange(0, 11, 0, 18), 'Argument 1 to "sort" should be String[], but got a String value.', 0, 'bml-function-arg-type');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const splitFix = fixes.find(f => f.title.includes('split'));
            assert.ok(splitFix, 'Must offer split into String[] array');
            assert.strictEqual(splitFix.edit._edits[0].newText, 'split(rawTags, ",")');
        });
    });

    // =========================================================================
    // MATRIX 3: LINTING PRECISION & ARRAY RETURN TYPE PROPAGATION
    // =========================================================================
    suite('Matrix 3: Linting Precision & Chained Array Type Propagation', function() {

        test('3.1 preserves String[] through chained split -> sort -> reverse without scalar error', function() {
            const code = [
                'raw = "apple,banana,cherry";',
                'arr = split(raw, ",");',
                'sorted = sort(arr);',
                'rev = reverse(sorted);',
                'sort(rev);'
            ].join('\n');

            const doc = createMockDoc(code);
            const types = collectVariableTypes(code, doc);

            assert.strictEqual(types.get('arr').type, 'String[]', 'arr must be String[]');
            assert.strictEqual(types.get('sorted').type, 'String[]', 'sorted must propagate String[]');
            assert.strictEqual(types.get('rev').type, 'String[]', 'rev must propagate String[]');

            const diags = checkArray(code, code, doc, types);
            const sortDimErrors = diags.filter(d => d.code === 'bml-sort-array-dimension');
            assert.strictEqual(sortDimErrors.length, 0, 'Must produce 0 sort-array-dimension errors on valid chained arrays');
        });

        test('3.2 infers base element type on array index access: arr[0] -> String', function() {
            const code = [
                'arr = split("a,b", ",");',
                'first = arr[0];'
            ].join('\n');

            const doc = createMockDoc(code);
            const types = collectVariableTypes(code, doc);
            assert.strictEqual(types.get('first').type, 'String', 'first item from String[] must be String');
        });

        test('3.3 correctly flags JSON object as scalar when passed to sort()', function() {
            const code = [
                'j = json("{}");',
                'sort(j);'
            ].join('\n');

            const doc = createMockDoc(code);
            const types = collectVariableTypes(code, doc);
            const diags = checkArray(code, code, doc, types);
            const sortError = diags.find(d => d.code === 'bml-sort-array-dimension');
            assert.ok(sortError, 'Must flag scalar error when json object is passed to sort()');
            assert.ok(sortError.message.includes('expects a 1-D array, but argument 1 is scalar type'));
        });

        test('3.4 correctly flags String scalar when passed to sort()', function() {
            const code = [
                's = "just a string";',
                'sort(s);'
            ].join('\n');

            const doc = createMockDoc(code);
            const types = collectVariableTypes(code, doc);
            const diags = checkArray(code, code, doc, types);
            const sortError = diags.find(d => d.code === 'bml-sort-array-dimension');
            assert.ok(sortError, 'Must flag scalar error when string is passed to sort()');
        });

        test('3.5 allows nested array expressions in sort() without scalar false positives', function() {
            const code = [
                'raw = "alpha,beta,gamma";',
                'items = split(raw, ",");',
                'sort(reverse(items));',
                'sort(split(raw, ","));'
            ].join('\n');

            const doc = createMockDoc(code);
            const types = collectVariableTypes(code, doc);
            const diags = checkArray(code, code, doc, types);
            const sortErrors = diags.filter(d => d.code === 'bml-sort-array-dimension');
            assert.strictEqual(sortErrors.length, 0, 'Must produce 0 sort-array-dimension errors on nested array expressions');
        });

        test('3.6 flags scalar return expression when passed into sort()', function() {
            const code = [
                'sb = stringbuilder();',
                'sort(sbtostring(sb));'
            ].join('\n');

            const doc = createMockDoc(code);
            const types = collectVariableTypes(code, doc);
            const diags = checkArray(code, code, doc, types);
            const sortError = diags.find(d => d.code === 'bml-sort-array-dimension');
            assert.ok(sortError, 'Must flag scalar error when sbtostring() is passed to sort()');
        });

        test('3.7 resolves CPQ system variables and attributes as scalar types in sort()', function() {
            const code = [
                'sort(_site_url);',
                'sort(_transaction_document_number);'
            ].join('\n');

            const doc = createMockDoc(code);
            const types = collectVariableTypes(code, doc);
            const diags = checkArray(code, code, doc, types);
            const sortErrors = diags.filter(d => d.code === 'bml-sort-array-dimension');
            assert.strictEqual(sortErrors.length, 2, 'Must flag 2 scalar errors for system variable and commerce attribute');
            assert.ok(sortErrors[0].message.includes("scalar type 'String'"));
            assert.ok(sortErrors[1].message.includes("scalar type 'String'"));
        });

        test('3.8 correctly infers split() on system variable _site_url as valid 1-D array', function() {
            const code = [
                'parts = split(_site_url, "/");',
                'sort(parts);'
            ].join('\n');

            const doc = createMockDoc(code);
            const types = collectVariableTypes(code, doc);
            const diags = checkArray(code, code, doc, types);
            const sortErrors = diags.filter(d => d.code === 'bml-sort-array-dimension');
            assert.strictEqual(sortErrors.length, 0, 'Must produce 0 sort-array-dimension errors when split on _site_url');
        });
    });

    // =========================================================================
    // MATRIX 4: SCRIPT-LEVEL BATCH QUICK FIXES
    // =========================================================================
    suite('Matrix 4: Script-Level Batch Quick Fixes (Batch & Fix-All)', function() {

        test('4.1 cleans all excess arguments across multiple calls in a file in one batch action', function() {
            const code = [
                'a = len(str1, extra1);',
                'b = sizeofarray(arr1, extra2, extra3);',
                'c = fabs(val1, extra4);'
            ].join('\n');

            const doc = createMockDoc(code);
            const diags = [
                new MockDiagnostic(new MockRange(0, 4, 0, 21), 'len() expects at most 1 argument, but got 2', 0, 'bml-function-arg-count'),
                new MockDiagnostic(new MockRange(1, 4, 1, 37), 'sizeofarray() expects at most 1 argument, but got 3', 0, 'bml-function-arg-count'),
                new MockDiagnostic(new MockRange(2, 4, 2, 22), 'fabs() expects at most 1 argument, but got 2', 0, 'bml-function-arg-count')
            ];

            const batchActions = getBatchSignatureFixes(doc, diags);
            const batchAction = batchActions.find(a => a.title.includes('excess argument'));
            assert.ok(batchAction, 'Must create excess arguments batch action');
            assert.strictEqual(batchAction.edit._edits.length, 3, 'Must contain 3 replacement edits');
            assert.strictEqual(batchAction.edit._edits[0].newText, 'str1');
            assert.strictEqual(batchAction.edit._edits[1].newText, 'arr1');
            assert.strictEqual(batchAction.edit._edits[2].newText, 'val1');
        });

        test('4.2 replaces all unknown/deprecated built-in function names across file in one batch action', function() {
            const code = [
                'v1 = abs(-10.5);',
                'd1 = now();',
                'l1 = log10(100);',
                'b1 = btoa("hello");'
            ].join('\n');

            const doc = createMockDoc(code);
            const diags = [
                new MockDiagnostic(new MockRange(0, 5, 0, 8), "Unknown built-in 'abs'", 1, 'bml-unknown-function'),
                new MockDiagnostic(new MockRange(1, 5, 1, 8), "Unknown built-in 'now'", 1, 'bml-unknown-function'),
                new MockDiagnostic(new MockRange(2, 5, 2, 10), "Unknown built-in 'log10'", 1, 'bml-unknown-function'),
                new MockDiagnostic(new MockRange(3, 5, 3, 9), "Unknown built-in 'btoa'", 1, 'bml-unknown-function')
            ];

            const batchActions = getBatchSignatureFixes(doc, diags);
            const fnBatchAction = batchActions.find(a => a.title.includes('unknown/deprecated built-in function names'));
            assert.ok(fnBatchAction, 'Must create batch action for function names');
            assert.strictEqual(fnBatchAction.edit._edits.length, 4, 'Must replace all 4 function names');
            assert.strictEqual(fnBatchAction.edit._edits[0].newText, 'fabs');
            assert.strictEqual(fnBatchAction.edit._edits[1].newText, 'getdate');
            assert.strictEqual(fnBatchAction.edit._edits[2].newText, 'log');
            assert.strictEqual(fnBatchAction.edit._edits[3].newText, 'encodebase64');
        });
    });
});

