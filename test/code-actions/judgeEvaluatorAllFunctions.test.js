const assert = require('assert');
const { createMockDoc, MockDiagnostic, MockRange } = require('./helpers');
const { getSmartSignatureFixes } = require('@/lang/lint/code-actions/smartSignatureFixes');
const { checkArray } = require('@/lang/lint/categories/array/array');
const { collectVariableTypes } = require('@/lang/lint/rules/typeCheck');
const { checkFunctionCalls } = require('@/lang/lint/rules/functions');
const { loadBuiltInFunctions } = require('@/lang/lint/rules/functionsBuiltIns');
const { loadBuiltInFunctionsJson } = require('@/lang/intellisense/apiDataLoader');

const mockVscode = {
    workspace: { workspaceFolders: [] },
    Range: MockRange,
    Diagnostic: MockDiagnostic,
    DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 }
};

const data = loadBuiltInFunctionsJson('.');

function isCallableFunction(name) {
    return !name.startsWith('BM_') &&
        name !== 'NaN' &&
        name !== 'jNaN' &&
        !name.includes('...') &&
        !name.includes('[n]') &&
        name !== 'break' &&
        name !== 'continue';
}

suite('Autonomous Judge Evaluation Suite: Individual Function/Method Precision & Complete BML Coverage', function() {

    // =========================================================================
    // MATRIX 5: COMPREHENSIVE INDIVIDUAL CATEGORY DYNAMIC TYPE PRECISION
    // =========================================================================
    suite('Matrix 5: Individual BML Category Dynamic Type Precision & Validation', function() {

        test('5.1 [Dictionary] Dynamic element type inference from dict("float") flags scalar in sort()', function() {
            const code = [
                'rateCard = dict("float");',
                'laborRate = get(rateCard, "labor");',
                'sort(laborRate);'
            ].join('\n');

            const doc = createMockDoc(code);
            const types = collectVariableTypes(code, doc);
            assert.strictEqual(types.get('laborrate').type, 'Float', 'get() on dict("float") must infer Float');

            const diags = checkArray(code, code, doc, types);
            const sortError = diags.find(d => d.code === 'bml-sort-array-dimension');
            assert.ok(sortError, 'sort(laborRate) must flag scalar Float error');
            assert.ok(sortError.message.includes("scalar type 'Float'"));
        });

        test('5.2 [Dictionary] Dynamic array retrieval get(dict, key, "string[]") permits sort()', function() {
            const code = [
                'configDict = dict("anytype");',
                'tags = get(configDict, "tags", "string[]");',
                'sort(tags);'
            ].join('\n');

            const doc = createMockDoc(code);
            const types = collectVariableTypes(code, doc);
            assert.strictEqual(types.get('tags').type, 'String[]', 'get(..., "string[]") must infer String[]');

            const diags = checkArray(code, code, doc, types);
            const sortErrors = diags.filter(d => d.code === 'bml-sort-array-dimension');
            assert.strictEqual(sortErrors.length, 0, 'sort(tags) must produce no errors for String[]');
        });

        test('5.3 [Array Methods] Chained array operations retain 1-D array type without scalar false positive', function() {
            const code = [
                'items = string[];',
                'rev = reverse(items);',
                'ordered = sort(rev);',
                'first = ordered[0];'
            ].join('\n');

            const doc = createMockDoc(code);
            const types = collectVariableTypes(code, doc);
            assert.strictEqual(types.get('rev').type.toLowerCase(), 'string[]', 'reverse(String[]) must infer String[]');
            assert.strictEqual(types.get('ordered').type.toLowerCase(), 'string[]', 'sort(String[]) must infer String[]');

            const diags = checkArray(code, code, doc, types);
            const arrayErrors = diags.filter(d => d.code.startsWith('bml-sort-array'));
            assert.strictEqual(arrayErrors.length, 0, 'Must produce 0 array lint errors across chained operations');
        });

        test('5.4 [JSON] jsonarray operations retain array type and scalar access flags correctly', function() {
            const code = [
                'arr = jsonarray();',
                'jsonarrayappend(arr, "item1");',
                'sort(arr);',
                'obj = json();',
                'sort(obj);'
            ].join('\n');

            const doc = createMockDoc(code);
            const types = collectVariableTypes(code, doc);
            assert.strictEqual(types.get('arr').type, 'JsonArray', 'arr must be JsonArray');
            assert.strictEqual(types.get('obj').type, 'Json', 'obj must be Json');

            const diags = checkArray(code, code, doc, types);
            const objError = diags.find(d => d.range.start.line === 4 && d.code === 'bml-sort-array-dimension');
            assert.ok(objError, 'sort(obj) on Json object must flag scalar error');
            assert.ok(objError.message.includes("scalar type 'Json'"));
        });

        test('5.5 [Math / Number] float() and integer() arithmetic prevents 1-D array confusion', function() {
            const code = [
                'val = round(10.556, 2);',
                'sort(val);'
            ].join('\n');

            const doc = createMockDoc(code);
            const types = collectVariableTypes(code, doc);
            assert.strictEqual(types.get('val').type, 'Float', 'round() must infer Float');

            const diags = checkArray(code, code, doc, types);
            const mathError = diags.find(d => d.code === 'bml-sort-array-dimension');
            assert.ok(mathError, 'sort(val) on Float must flag scalar error');
            assert.ok(mathError.message.includes("scalar type 'Float'"));
        });
    });

    // =========================================================================
    // MATRIX 6: ALL 162 CALLABLE BML FUNCTIONS INDIVIDUAL COMPREHENSIVE COVERAGE
    // =========================================================================
    suite('Matrix 6: Comprehensive Coverage for ALL 162 Callable BML Functions', function() {

        test('6.1 [Universal Argument Count Linting] Every function requiring arguments flags under-argument calls', function() {
            const builtIns = loadBuiltInFunctions('.');
            const callableEntries = Object.keys(data).filter(isCallableFunction);

            const failures = [];
            let tested = 0;

const { checkBmql } = require('@/lang/lint/categories/bmql/bmql');
const { checkDictionary } = require('@/lang/lint/categories/dictionary/dictionary');

            for (const name of callableEntries) {
                const builtIn = builtIns.get(name.toLowerCase());
                if (!builtIn || builtIn.min <= 0) continue;
                tested++;

                const code = `${name}();\n`;
                const doc = createMockDoc(code);

                let diags = [];
                if (name.toLowerCase() === 'bmql') {
                    diags = checkBmql(code, code, doc, mockVscode);
                } else if (name.toLowerCase() === 'dict') {
                    diags = checkDictionary(code, code, doc, mockVscode);
                } else {
                    diags = checkFunctionCalls(code, code, doc, mockVscode, '.');
                }

                const found = diags.find(d =>
                    d.code === 'bml-function-arg-count' ||
                    d.code === 'bml-dict-missing-type'
                );

                if (!found) {
                    failures.push({ name, min: builtIn.min });
                }
            }

            assert.strictEqual(failures.length, 0, `All functions with min > 0 must emit bml-function-arg-count when called with 0 args: ${JSON.stringify(failures)}`);
            assert.strictEqual(tested, 149, 'Must verify all 149 functions with min > 0');
        });

        test('6.2 [Universal Smart Quick Fix Synthesis] Every function requiring arguments produces viable candidate fixes', function() {
            const builtIns = loadBuiltInFunctions('.');
            const callableEntries = Object.keys(data).filter(isCallableFunction);

            const failures = [];
            let tested = 0;

            for (const name of callableEntries) {
                const builtIn = builtIns.get(name.toLowerCase());
                if (!builtIn || builtIn.min <= 0) continue;
                tested++;

                const code = `${name}();\n`;
                const doc = createMockDoc(code);
                const diag = new MockDiagnostic(
                    new MockRange(0, 0, 0, name.length + 2),
                    `${name}() expects at least ${builtIn.min} argument(s), but got 0`,
                    0,
                    'bml-function-arg-count'
                );

                const fixes = getSmartSignatureFixes(doc, diag, diag.range);
                if (!fixes || fixes.length === 0) {
                    failures.push(name);
                } else {
                    const firstFix = fixes[0];
                    assert.ok(firstFix.title, `Fix for ${name} must have a title`);
                    assert.ok(firstFix.edit && firstFix.edit._edits && firstFix.edit._edits.length > 0, `Fix for ${name} must contain text edits`);
                }
            }

            assert.strictEqual(failures.length, 0, `All functions with min > 0 must offer smart quick fixes: ${JSON.stringify(failures)}`);
            assert.strictEqual(tested, 149, 'Must test all 149 functions with min > 0');
        });

        test('6.3 [Zero-Arg Functions - Excess Argument Handling] All 13 zero-argument functions flag excess args and offer removal fix', function() {
            const builtIns = loadBuiltInFunctions('.');
            const callableEntries = Object.keys(data).filter(isCallableFunction);

            const failures = [];
            let tested = 0;

            for (const name of callableEntries) {
                const builtIn = builtIns.get(name.toLowerCase());
                if (!builtIn || builtIn.min !== 0) continue;
                tested++;

                const extraCount = (builtIn.max < 100 ? builtIn.max : 0) + 1;
                const extraArgs = Array(extraCount).fill(0).map((_, i) => `extra${i + 1}`).join(', ');
                const code = `${name}(${extraArgs});\n`;
                const doc = createMockDoc(code);
                const diag = new MockDiagnostic(
                    new MockRange(0, 0, 0, name.length + extraArgs.length + 2),
                    `expects at most ${builtIn.max < 100 ? builtIn.max : 0} argument(s), but got ${extraCount}`,
                    0,
                    'bml-function-arg-count'
                );

                const fixes = getSmartSignatureFixes(doc, diag, diag.range);
                const excessFix = fixes.find(f => f.title.toLowerCase().includes('excess'));
                if (!excessFix) {
                    failures.push(name);
                }
            }

            assert.strictEqual(failures.length, 0, `Zero-arg functions must offer excess argument removal: ${JSON.stringify(failures)}`);
            assert.strictEqual(tested, 13, 'Must test all 13 zero-argument functions');
        });

        test('6.4 [Overloaded Functions - Signature Resolution] setattributevalue, makeurlparam, remove, getconfigattrvalue', function() {
            // setattributevalue 2-arg and 3-arg valid calls produce NO count errors
            const code2 = 'setattributevalue(1, "myVal");\nsetattributevalue(1, "varName", "myVal");\n';
            const doc2 = createMockDoc(code2);
            const diags2 = checkFunctionCalls(code2, code2, doc2, mockVscode, '.');
            const setAttrErrors = diags2.filter(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(setAttrErrors.length, 0, 'Valid 2-arg and 3-arg setattributevalue must produce 0 count errors');

            // makeurlparam 1-arg dict and 2-arg (name, val) produce NO count errors
            const codeUrl = 'd = dict("string");\np1 = makeurlparam(d);\np2 = makeurlparam("user", "john");\n';
            const docUrl = createMockDoc(codeUrl);
            const diagsUrl = checkFunctionCalls(codeUrl, codeUrl, docUrl, mockVscode, '.');
            const urlErrors = diagsUrl.filter(d => d.code === 'bml-function-arg-count' && d.message.includes('makeurlparam'));
            assert.strictEqual(urlErrors.length, 0, 'Valid 1-arg and 2-arg makeurlparam must produce 0 count errors');

            // remove 2-arg on array and 2-arg on dict
            const codeRem = 'arr = string[];\narr = remove(arr, 0);\nd = dict("string");\nres = remove(d, "k");\n';
            const docRem = createMockDoc(codeRem);
            const diagsRem = checkFunctionCalls(codeRem, codeRem, docRem, mockVscode, '.');
            const remErrors = diagsRem.filter(d => d.code === 'bml-function-arg-count' && d.message.includes('remove'));
            assert.strictEqual(remErrors.length, 0, 'Valid remove calls must produce 0 count errors');
        });

        test('6.5 [Argument Type Validation Across Functions] flags incompatible argument types', function() {
            // atoi expects String, passing Boolean true
            const codeType1 = 'n = atoi(true);\n';
            const docType1 = createMockDoc(codeType1);
            const diagsType1 = checkFunctionCalls(codeType1, codeType1, docType1, mockVscode, '.');
            const argTypeErr1 = diagsType1.find(d => d.code === 'bml-function-arg-type');
            assert.ok(argTypeErr1, 'atoi(true) must flag argument type error');
            assert.ok(argTypeErr1.message.includes("should be String, but got a Boolean"));

            // adddays expects Date, passing String "notADate"
            const codeType2 = 'd = adddays("notADate", 5);\n';
            const docType2 = createMockDoc(codeType2);
            const diagsType2 = checkFunctionCalls(codeType2, codeType2, docType2, mockVscode, '.');
            const argTypeErr2 = diagsType2.find(d => d.code === 'bml-function-arg-type');
            assert.ok(argTypeErr2, 'adddays("notADate", 5) must flag argument type error');
            assert.ok(argTypeErr2.message.includes("should be Date, but got a String"));
        });
    });
});
