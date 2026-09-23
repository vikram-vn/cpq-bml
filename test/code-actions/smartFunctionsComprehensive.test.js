const assert = require('assert');
const { checkArray } = require('@/lang/lint/categories/array/array');
const { getSmartSignatureFixes } = require('@/lang/lint/code-actions/smartSignatureFixes');
const { getMemberAccessFixes } = require('@/lang/lint/code-actions/memberAccessFixes');
const { MockRange, MockDiagnostic, createMockDoc } = require('@/test/code-actions/helpers');

suite('Smart Linting & Comprehensive BML Quick Fixes Suite', function() {

    // =========================================================================
    // 1. SMART 1-D ARRAY LINTING (BML Methods Returning Arrays)
    // =========================================================================
    suite('1. Smart 1-D Array Linting from BML Method Returns', function() {
        test('sort(var) produces NO error when var is assigned from append()', function() {
            const doc = createMockDoc('myArr = append(existingArr, "newItem");\nsorted = sort(myArr);\n');
            const diags = checkArray(doc.getText(), doc.getText(), doc);
            const sortDiag = diags.find(d => d.code === 'bml-sort-array-dimension');
            assert.strictEqual(sortDiag, undefined, 'append() returns Array, sort() must accept it without 1-D error');
        });

        test('sort(var) produces NO error when var is assigned from reverse()', function() {
            const doc = createMockDoc('reversedList = reverse(sourceList);\nsorted = sort(reversedList);\n');
            const diags = checkArray(doc.getText(), doc.getText(), doc);
            const sortDiag = diags.find(d => d.code === 'bml-sort-array-dimension');
            assert.strictEqual(sortDiag, undefined, 'reverse() returns Array, sort() must accept it');
        });

        test('sort(var) produces NO error when var is assigned from sort()', function() {
            const doc = createMockDoc('intermediate = sort(sourceList, "desc");\nfinalList = sort(intermediate);\n');
            const diags = checkArray(doc.getText(), doc.getText(), doc);
            const sortDiag = diags.find(d => d.code === 'bml-sort-array-dimension');
            assert.strictEqual(sortDiag, undefined, 'sort() returns Array, sort() must accept it');
        });

        test('sort(var) produces NO error when var is assigned from keys()', function() {
            const doc = createMockDoc('dictKeys = keys(myDict);\nsortedKeys = sort(dictKeys);\n');
            const diags = checkArray(doc.getText(), doc.getText(), doc);
            const sortDiag = diags.find(d => d.code === 'bml-sort-array-dimension');
            assert.strictEqual(sortDiag, undefined, 'keys() returns String[], sort() must accept it');
        });

        test('sort(var) produces NO error when var is assigned from values()', function() {
            const doc = createMockDoc('dictVals = values(myDict);\nsortedVals = sort(dictVals);\n');
            const diags = checkArray(doc.getText(), doc.getText(), doc);
            const sortDiag = diags.find(d => d.code === 'bml-sort-array-dimension');
            assert.strictEqual(sortDiag, undefined, 'values() returns Array, sort() must accept it');
        });

        test('sort(var) produces NO error when var is assigned from split()', function() {
            const doc = createMockDoc('tokens = split(rawText, ",");\nsortedTokens = sort(tokens);\n');
            const diags = checkArray(doc.getText(), doc.getText(), doc);
            const sortDiag = diags.find(d => d.code === 'bml-sort-array-dimension');
            assert.strictEqual(sortDiag, undefined, 'split() returns String[], sort() must accept it');
        });

        test('sort(var) produces NO error when var is assigned from range()', function() {
            const doc = createMockDoc('indices = range(10);\nsortedIndices = sort(indices);\n');
            const diags = checkArray(doc.getText(), doc.getText(), doc);
            const sortDiag = diags.find(d => d.code === 'bml-sort-array-dimension');
            assert.strictEqual(sortDiag, undefined, 'range() returns Integer[], sort() must accept it');
        });

        test('sort(var) properly emits error when var is assigned a scalar Integer', function() {
            const doc = createMockDoc('myNum = 42;\nsorted = sort(myNum);\n');
            const diags = checkArray(doc.getText(), doc.getText(), doc);
            const sortDiag = diags.find(d => d.code === 'bml-sort-array-dimension');
            assert.ok(sortDiag, 'Should flag scalar type error on sort(Integer)');
            assert.ok(sortDiag.message.includes('expects a 1-D array, but argument 1 is scalar type'));
        });

        test('sort(var) properly emits error when var is assigned a scalar String', function() {
            const doc = createMockDoc('myStr = "hello world";\nsorted = sort(myStr);\n');
            const diags = checkArray(doc.getText(), doc.getText(), doc);
            const sortDiag = diags.find(d => d.code === 'bml-sort-array-dimension');
            assert.ok(sortDiag, 'Should flag scalar type error on sort(String)');
            assert.ok(sortDiag.message.includes('expects a 1-D array, but argument 1 is scalar type'));
        });
    });

    // =========================================================================
    // 2. SMART LHS-AWARE TYPE INFERENCE (bml-function-arg-count)
    // =========================================================================
    suite('2. Smart LHS-Aware Type Inference for get() & jsonget()', function() {
        test('infers "float" for price/currency LHS variables', function() {
            const doc = createMockDoc('unitPrice = get(configDict, "price");\n');
            const diag = new MockDiagnostic(new MockRange(0, 12, 0, 36), 'dict("anytype") requires valueType', 0, 'bml-function-arg-count');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const floatFix = fixes.find(f => f.title.includes('"float"'));
            assert.ok(floatFix, 'Should offer float quick fix');
            assert.strictEqual(floatFix.isPreferred, true, 'float should be preferred for unitPrice');
            assert.strictEqual(floatFix.edit._edits[0].newText, 'configDict, "price", "float"');
        });

        test('infers "integer" for quantity/counter LHS variables', function() {
            const doc = createMockDoc('itemQty = get(paramsDict, "qty");\n');
            const diag = new MockDiagnostic(new MockRange(0, 10, 0, 32), 'dict("anytype") requires valueType', 0, 'bml-function-arg-count');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const intFix = fixes.find(f => f.title.includes('"integer"'));
            assert.ok(intFix, 'Should offer integer quick fix');
            assert.strictEqual(intFix.isPreferred, true, 'integer should be preferred for itemQty');
            assert.strictEqual(intFix.edit._edits[0].newText, 'paramsDict, "qty", "integer"');
        });

        test('infers "boolean" for flag/is* LHS variables', function() {
            const doc = createMockDoc('isValid = get(statusDict, "valid");\n');
            const diag = new MockDiagnostic(new MockRange(0, 10, 0, 34), 'dict("anytype") requires valueType', 0, 'bml-function-arg-count');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const boolFix = fixes.find(f => f.title.includes('"boolean"'));
            assert.ok(boolFix, 'Should offer boolean quick fix');
            assert.strictEqual(boolFix.isPreferred, true, 'boolean should be preferred for isValid');
            assert.strictEqual(boolFix.edit._edits[0].newText, 'statusDict, "valid", "boolean"');
        });

        test('infers "string" for name/description LHS variables', function() {
            const doc = createMockDoc('customerName = get(accountDict, "name");\n');
            const diag = new MockDiagnostic(new MockRange(0, 15, 0, 39), 'dict("anytype") requires valueType', 0, 'bml-function-arg-count');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const strFix = fixes.find(f => f.title.includes('"string"'));
            assert.ok(strFix, 'Should offer string quick fix');
            assert.strictEqual(strFix.isPreferred, true, 'string should be preferred for customerName');
            assert.strictEqual(strFix.edit._edits[0].newText, 'accountDict, "name", "string"');
        });
    });

    // =========================================================================
    // 3. SMART PARAMETER COMPLETION FOR BUILT-IN FUNCTIONS
    // =========================================================================
    suite('3. Smart Parameter Completion for Missing Arguments', function() {
        test('smartly completes round(x) with 2 decimal places for price/currency', function() {
            const doc = createMockDoc('finalPrice = round(calculatedTotal);\n');
            const diag = new MockDiagnostic(new MockRange(0, 13, 0, 35), 'round expects 2 arguments', 0, 'bml-function-arg-count');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const round2 = fixes.find(f => f.title.includes('2 decimal places'));
            assert.ok(round2, 'Should offer 2 decimal places');
            assert.strictEqual(round2.isPreferred, true, '2 decimal places should be preferred for currency/total');
            assert.strictEqual(round2.edit._edits[0].newText, 'calculatedTotal, 2');
        });

        test('smartly completes split(s) with standard delimiter options', function() {
            const doc = createMockDoc('parts = split(csvData);\n');
            const diag = new MockDiagnostic(new MockRange(0, 8, 0, 22), 'split expects 2 arguments', 0, 'bml-function-arg-count');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const commaFix = fixes.find(f => f.title.includes('comma'));
            assert.ok(commaFix, 'Should offer comma delimiter');
            assert.strictEqual(commaFix.isPreferred, true);
            assert.strictEqual(commaFix.edit._edits[0].newText, 'csvData, ","');
        });

        test('smartly completes join(arr) with delimiter', function() {
            const doc = createMockDoc('res = join(items);\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 17), 'join expects 2 arguments', 0, 'bml-function-arg-count');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const joinFix = fixes.find(f => f.title.includes('comma'));
            assert.ok(joinFix, 'Should offer join comma');
            assert.strictEqual(joinFix.edit._edits[0].newText, 'items, ","');
        });

        test('smartly completes datetostr(d) with document-predominant format', function() {
            const doc = createMockDoc('other = datetostr(d1, "yyyy-MM-dd HH:mm:ss");\nres = datetostr(currentDate);\n');
            const diag = new MockDiagnostic(new MockRange(1, 6, 1, 28), 'datetostr expects format argument', 0, 'bml-function-arg-count');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const fmtFix = fixes.find(f => f.title.includes('yyyy-MM-dd HH:mm:ss'));
            assert.ok(fmtFix, 'Should detect and use document format');
            assert.strictEqual(fmtFix.edit._edits[0].newText, 'currentDate, "yyyy-MM-dd HH:mm:ss"');
        });

        test('smartly completes substring(s, start) with len(s)', function() {
            const doc = createMockDoc('tail = substring(code, 4);\n');
            const diag = new MockDiagnostic(new MockRange(0, 7, 0, 25), 'substring expects 3 arguments', 0, 'bml-function-arg-count');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const lenFix = fixes.find(f => f.title.includes('len(code)'));
            assert.ok(lenFix, 'Should offer len(code) completion');
            assert.strictEqual(lenFix.edit._edits[0].newText, 'code, 4, len(code)');
        });

        test('smartly completes sort(arr) with "asc"', function() {
            const doc = createMockDoc('res = sort(lines);\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 17), 'sort missing order', 0, 'bml-function-arg-count');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const ascFix = fixes.find(f => f.title.includes('"asc"'));
            assert.ok(ascFix, 'Should offer "asc" completion');
            assert.strictEqual(ascFix.edit._edits[0].newText, 'lines, "asc"');
        });

        test('smartly completes urldata(url) with method and headers', function() {
            const doc = createMockDoc('resp = urldata(endpoint);\n');
            const diag = new MockDiagnostic(new MockRange(0, 7, 0, 24), 'urldata missing arguments', 0, 'bml-function-arg-count');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const urlFix = fixes.find(f => f.title.includes('"get", headers'));
            assert.ok(urlFix, 'Should offer GET with headers');
            assert.strictEqual(urlFix.edit._edits[0].newText, 'endpoint, "get", headers');
        });

        test('removes excess arguments when function receives too many', function() {
            const doc = createMockDoc('res = len(myStr, extraArg);\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 26), 'len() expects at most 1 argument, but got 2', 0, 'bml-function-arg-count');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const removeFix = fixes.find(f => f.title.includes('Remove excess'));
            assert.ok(removeFix, 'Should offer removing excess argument');
            assert.strictEqual(removeFix.edit._edits[0].newText, 'myStr');
        });
    });

    // =========================================================================
    // 4. SMART EXPRESSION-PRESERVING ARGUMENT TYPE CONVERSIONS
    // =========================================================================
    suite('4. Smart Expression-Preserving Type Conversions', function() {
        test('converts Date to String using datetostr when String expected', function() {
            const doc = createMockDoc('printMsg(entryDate);\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 19), "Argument 1 to 'printMsg' should be String, but got a Date value", 0, 'bml-function-arg-type');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const dateFix = fixes.find(f => f.title.includes('datetostr'));
            assert.ok(dateFix, 'Should offer datetostr conversion');
            assert.strictEqual(dateFix.edit._edits[0].newText, 'datetostr(entryDate, "yyyy-MM-dd")');
        });

        test('converts StringBuilder to String using sbtostring when String expected', function() {
            const doc = createMockDoc('logMessage(bufferSb);\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 20), "Argument 1 to 'logMessage' should be String, but got a StringBuilder value", 0, 'bml-function-arg-type');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const sbFix = fixes.find(f => f.title.includes('sbtostring'));
            assert.ok(sbFix, 'Should offer sbtostring conversion');
            assert.strictEqual(sbFix.edit._edits[0].newText, 'sbtostring(bufferSb)');
        });

        test('converts JsonArray to String using jsonarraytostr when String expected', function() {
            const doc = createMockDoc('sendData(itemsJa);\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 18), "Argument 1 to 'sendData' should be String, but got a JsonArray value", 0, 'bml-function-arg-type');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const jaFix = fixes.find(f => f.title.includes('jsonarraytostr'));
            assert.ok(jaFix, 'Should offer jsonarraytostr conversion');
            assert.strictEqual(jaFix.edit._edits[0].newText, 'jsonarraytostr(itemsJa)');
        });

        test('converts Array to String using join when String expected', function() {
            const doc = createMockDoc('display(skuList);\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 16), "Argument 1 to 'display' should be String, but got a Array value", 0, 'bml-function-arg-type');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const joinFix = fixes.find(f => f.title.includes('join'));
            assert.ok(joinFix, 'Should offer join conversion');
            assert.strictEqual(joinFix.edit._edits[0].newText, 'join(skuList, ",")');
        });

        test('converts Float to Integer with round and wraps complex binary expression', function() {
            const doc = createMockDoc('allocate(baseUnits * 1.5);\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 25), "Argument 1 to 'allocate' should be Integer, but got a Float value", 0, 'bml-function-arg-type');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const roundFix = fixes.find(f => f.title.includes('round'));
            assert.ok(roundFix, 'Should offer round conversion');
            assert.strictEqual(roundFix.edit._edits[0].newText, 'round((baseUnits * 1.5), 0)');
        });

        test('converts String to Date using strtojavadate when Date expected', function() {
            const doc = createMockDoc('setExpiry(dateStr);\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 18), "Argument 1 to 'setExpiry' should be Date, but got a String value", 0, 'bml-function-arg-type');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const dateFix = fixes.find(f => f.title.includes('strtojavadate'));
            assert.ok(dateFix, 'Should offer strtojavadate conversion');
            assert.strictEqual(dateFix.edit._edits[0].newText, 'strtojavadate(dateStr, "yyyy-MM-dd")');
        });

        test('converts String to String[] using split when String[] expected', function() {
            const doc = createMockDoc('processItems(csvLine);\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 21), "Argument 1 to 'processItems' should be String[], but got a String value", 0, 'bml-function-arg-type');
            const fixes = getSmartSignatureFixes(doc, diag, diag.range);
            const splitFix = fixes.find(f => f.title.includes('split'));
            assert.ok(splitFix, 'Should offer split conversion');
            assert.strictEqual(splitFix.edit._edits[0].newText, 'split(csvLine, ",")');
        });
    });

    // =========================================================================
    // 5. SMART STATEMENT VS EXPRESSION CONTEXT MEMBER ACCESS FIXES
    // =========================================================================
    suite('5. Smart Statement vs Expression Member Access Fixes', function() {
        test('arr.push() in statement context emits mutating assignment', function() {
            const doc = createMockDoc('lines.push(newLine);\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 20), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes = getMemberAccessFixes(doc, diag, diag.range);
            const appendFix = fixes.find(f => f.title.includes("lines = append"));
            assert.ok(appendFix, 'Statement context must assign append result');
            assert.strictEqual(appendFix.edit._edits[0].newText, 'lines = append(lines, newLine)');
        });

        test('arr.push() in inline expression context emits function call without assignment', function() {
            const doc = createMockDoc('count = len(lines.push(newLine));\n');
            const diag = new MockDiagnostic(new MockRange(0, 12, 0, 32), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes = getMemberAccessFixes(doc, diag, diag.range);
            const appendFix = fixes.find(f => f.title.includes("'append(lines, newLine)'"));
            assert.ok(appendFix, 'Inline expression context must not assign');
            assert.strictEqual(appendFix.edit._edits[0].newText, 'append(lines, newLine)');
        });

        test('arr.reverse() in statement context emits mutating assignment', function() {
            const doc = createMockDoc('lines.reverse();\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 16), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes = getMemberAccessFixes(doc, diag, diag.range);
            assert.strictEqual(fixes[0].edit._edits[0].newText, 'lines = reverse(lines)');
        });

        test('arr.sort() in statement context emits mutating assignment', function() {
            const doc = createMockDoc('lines.sort();\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 13), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes = getMemberAccessFixes(doc, diag, diag.range);
            assert.strictEqual(fixes[0].edit._edits[0].newText, 'lines = sort(lines, "asc")');
        });
    });
});
