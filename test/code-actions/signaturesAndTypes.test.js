const assert = require('assert');
const { getFunctionSignatureFixes } = require('@/lang/lint/code-actions/functionSignatureFixes');
const { getTypeCastFixes } = require('@/lang/lint/code-actions/typeCastFixes');
const { getSyntaxFixes } = require('@/lang/lint/code-actions/syntaxFixes');
const { getQualityFixes } = require('@/lang/lint/code-actions/qualityFixes');
const { getBmqlFixes } = require('@/lang/lint/code-actions/bmqlFixes');
const { MockRange, MockDiagnostic, createMockDoc } = require('@/test/code-actions/helpers');

suite('Function Signatures, Type Casting & Syntax Safety Fixes', function() {
    suite('2. Function Signature & Smart Type Casting Fixes', function() {
        test('wraps argument in string() when built-in expects String but gets Integer', function() {
            const doc = createMockDoc('append(myArr, 42);\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 6), "Argument 2 to 'append' should be String, but got a Integer value.", 0, 'bml-function-arg-type');
            const fixes = getFunctionSignatureFixes(doc, diag, diag.range);
            assert.ok(fixes.length > 0, 'Should return signature fixes');
            const fixStr = fixes.find(function(f) { return f.title.includes('string(42)'); });
            assert.ok(fixStr, 'Should offer string(42) wrapper');
        });

        test('wraps argument in atoi() when built-in expects Integer but gets String', function() {
            const doc = createMockDoc('round(numStr, 2);\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 5), "Argument 1 to 'round' should be Float, but got a String value.", 0, 'bml-function-arg-type');
            const fixes = getFunctionSignatureFixes(doc, diag, diag.range);
            assert.ok(fixes.length > 0, 'Should offer signature fixes');
            const fixAtof = fixes.find(function(f) { return f.title.includes('atof(numStr)'); });
            assert.ok(fixAtof, 'Should offer atof(numStr) wrapper');
        });

        test('adds valueType parameter to get() on dict("anytype")', function() {
            const doc = createMockDoc('res = get(myDict, "key");\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 24), "For 'dict(\"anytype\")', 'get()' requires 3 arguments including the valueType parameter, but got 2.", 0, 'bml-function-arg-count');
            const fixes = getFunctionSignatureFixes(doc, diag, diag.range);
            assert.ok(fixes.length > 0, 'Should offer valueType choices');
            const fixStringParam = fixes.find(function(f) { return f.title.includes('"string" valueType parameter'); });
            assert.ok(fixStringParam, 'Should offer "string" parameter');
        });
    });

    suite('3. Type Cast & Dictionary Value Consistency Fixes', function() {
        test('casts value on dict put() type mismatch', function() {
            const doc = createMockDoc('put(dictStr, "k", 100);\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 22), "Type mismatch: Cannot insert 'Integer' value into 'dictStr' declared as dict(\"string\"). Expected 'string'.", 0, 'bml-dict-put-type-mismatch');
            const fixes = getTypeCastFixes(doc, diag, diag.range);
            assert.ok(fixes.length > 0, 'Should return dict put type fix');
            assert.ok(fixes[0].title.includes('string(100)'), 'Should offer string(100) cast');
        });

        test('casts expression on return type mismatch', function() {
            const doc = createMockDoc('return 123;\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 10), "Return type mismatch: Function metadata specifies 'String', but return statement returns 'Integer'.", 0, 'bml-return-type-mismatch');
            const fixes = getTypeCastFixes(doc, diag, diag.range);
            assert.ok(fixes.length > 0, 'Should return return-type fix');
            assert.ok(fixes[0].title.includes('string(123)'), 'Should offer string(123) return cast');
        });

        test('replaces values() with keys() on anytype dictionary', function() {
            const doc = createMockDoc('allVals = values(anyDict);\n');
            const diag = new MockDiagnostic(new MockRange(0, 10, 0, 25), "Function 'values()' does not support 'anytype' dictionaries.", 0, 'bml-dict-values-unsupported-type');
            const fixes = getTypeCastFixes(doc, diag, diag.range);
            assert.ok(fixes.length > 0, 'Should return values fix');
            assert.ok(fixes[0].title.includes('keys(anyDict)'), 'Should offer keys(anyDict)');
        });
    });

    suite('4. Syntax, Quality & BMQL Error Safety Fixes', function() {
        test('replaces system variable typo with suggested name', function() {
            const doc = createMockDoc('site = _system_site_nam;\n');
            const diag = new MockDiagnostic(new MockRange(0, 7, 0, 23), "Unknown CPQ system variable '_system_site_nam' - did you mean '_system_site_name'?", 2, 'bml-system-variable-typo');
            const fixes = getSyntaxFixes(doc, diag, diag.range);
            const typoFix = fixes.find(function(f) { return f.title.includes('_system_site_name'); });
            assert.ok(typoFix, 'Should offer _system_site_name');
        });

        test('appends closing quote on unclosed string', function() {
            const doc = createMockDoc('msg = "hello world\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 18), "Unclosed string literal", 0, 'bml-unclosed-string');
            const fixes = getSyntaxFixes(doc, diag, diag.range);
            const closeFix = fixes.find(function(f) { return f.title.includes('Close string literal'); });
            assert.ok(closeFix, 'Should offer close string literal');
        });

        test('guards split array access with sizeofarray check', function() {
            const doc = createMockDoc('firstPart = parts[0];\n');
            const diag = new MockDiagnostic(new MockRange(0, 12, 0, 20), "Safety Warning: Check size before access", 1, 'bml-unchecked-split-access');
            const fixes = getQualityFixes(doc, diag, diag.range, '/');
            const guardFix = fixes.find(function(f) { return f.title.includes('sizeofarray(parts) > 0'); });
            assert.ok(guardFix, 'Should offer sizeofarray guard');
        });

        test('extracts function call to variable before for-in loop', function() {
            const doc = createMockDoc('for line in getLines() {\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 24), "Loop on function call", 1, 'bml-for-in-function-call');
            const fixes = getQualityFixes(doc, diag, diag.range, '/');
            const extractFix = fixes.find(function(f) { return f.title.includes('line_list'); });
            assert.ok(extractFix, 'Should extract to temporary variable');
        });

        test('inserts BMQL mutation error check on unhandled mutation', function() {
            const doc = createMockDoc('mutationRes = bmql("UPDATE ... ");\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 34), "Mutation error unchecked", 1, 'bml-bmql-mutation-error-unchecked');
            const fixes = getBmqlFixes(doc, diag, diag.range);
            const errFix = fixes.find(function(f) { return f.title.includes('BMQL mutation error check'); });
            assert.ok(errFix, 'Should offer BMQL error check');
        });
    });
});
