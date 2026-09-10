const assert = require('assert');
const { getMemberAccessFixes } = require('@/lang/lint/code-actions/memberAccessFixes');
const { getFunctionSignatureFixes } = require('@/lang/lint/code-actions/functionSignatureFixes');
const { getTypeCastFixes } = require('@/lang/lint/code-actions/typeCastFixes');
const { getSyntaxFixes } = require('@/lang/lint/code-actions/syntaxFixes');
const { getQualityFixes } = require('@/lang/lint/code-actions/qualityFixes');
const { getBmqlFixes } = require('@/lang/lint/code-actions/bmqlFixes');
const { getPerformanceFixes, buildSbappendSplitFixes, createSbappendSplitActions } = require('@/lang/lint/code-actions/performanceFixes');
const { getStyleFixes } = require('@/lang/lint/code-actions/styleFixes');
const { splitFunctionArgumentsIntoLines, splitConcatenationIntoLines, splitLongStringLiteral } = require('@/lang/lint/code-actions/styleSplitters');
const { checkPerformance, isCpqLineItemArgs } = require('@/lang/lint/rules/performance');

// Mock helper using prototype pattern (no ES6 classes)
function MockPosition(line, character) {
    this.line = line;
    this.character = character;
}
MockPosition.prototype.translate = function(l, c) {
    return new MockPosition(this.line + (l || 0), this.character + (c || 0));
};

function MockRange(startLine, startChar, endLine, endChar) {
    this.start = new MockPosition(startLine, startChar);
    this.end = new MockPosition(endLine, endChar);
}

function MockDiagnostic(range, message, severity, code) {
    this.range = range;
    this.message = message;
    this.severity = severity;
    this.code = code;
}

function createMockDoc(content) {
    const lines = content.split('\n');
    return {
        getText: function(range) {
            if (!range) return content;
            if (range.start.line === range.end.line) {
                return lines[range.start.line].substring(range.start.character, range.end.character);
            }
            return lines[range.start.line].substring(range.start.character);
        },
        lineAt: function(idx) {
            return {
                text: lines[idx],
                range: new MockRange(idx, 0, idx, lines[idx].length)
            };
        },
        uri: { fsPath: '/test/script.bml', toString: function() { return 'file:///test/script.bml'; } }
    };
}

suite('BML Comprehensive Quick Fixes Unit Tests', function() {
    suite('1. Member Access to Canonical BML Function Fixes', function() {
        test('converts arr.length to sizeofarray(arr) and str.length to len(str)', function() {
            const doc = createMockDoc('len = arr.length;\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 16), "BML Syntax Error: Member access 'arr.length' is not supported", 0, 'bml-invalid-member-access');
            const fixes = getMemberAccessFixes(doc, diag, diag.range);
            assert.ok(fixes.length >= 2, 'Should offer multiple candidate conversions');
            const fixArray = fixes.find(function(f) { return f.title.includes('sizeofarray(arr)'); });
            const fixStr = fixes.find(function(f) { return f.title.includes('len(arr)'); });
            assert.ok(fixArray, 'Should offer sizeofarray(arr)');
            assert.ok(fixStr, 'Should offer len(arr)');
        });

        test('converts str.toLowerCase() to lower(str) and str.trim() to trim(str)', function() {
            const doc = createMockDoc('s1 = name.toLowerCase();\ns2 = name.trim();\n');
            const diag1 = new MockDiagnostic(new MockRange(0, 5, 0, 23), "Member access", 0, 'bml-invalid-member-access');
            const fixes1 = getMemberAccessFixes(doc, diag1, diag1.range);
            const fixLower = fixes1.find(function(f) { return f.title.includes('lower(name)'); });
            assert.ok(fixLower, 'Should offer lower(name)');

            const diag2 = new MockDiagnostic(new MockRange(1, 5, 1, 16), "Member access", 0, 'bml-invalid-member-access');
            const fixes2 = getMemberAccessFixes(doc, diag2, diag2.range);
            const fixTrim = fixes2.find(function(f) { return f.title.includes('trim(name)'); });
            assert.ok(fixTrim, 'Should offer trim(name)');
        });

        test('converts json.get("k") to jsonget(json, "k") and dict.get("k") to get(dict, "k")', function() {
            const doc = createMockDoc('val = myObj.get("sku");\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 22), "Member access", 0, 'bml-invalid-member-access');
            const fixes = getMemberAccessFixes(doc, diag, diag.range);
            const fixJson = fixes.find(function(f) { return f.title.includes('jsonget(myObj, "sku")'); });
            const fixDict = fixes.find(function(f) { return f.title.includes('get(myObj, "sku")'); });
            assert.ok(fixJson, 'Should offer jsonget');
            assert.ok(fixDict, 'Should offer get');
        });

        test('converts json.put("k", v) and dict.put("k", v)', function() {
            const doc = createMockDoc('myObj.put("sku", 123);\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 21), "Member access", 0, 'bml-invalid-member-access');
            const fixes = getMemberAccessFixes(doc, diag, diag.range);
            const fixJson = fixes.find(function(f) { return f.title.includes('jsonput(myObj, "sku", 123)'); });
            const fixDict = fixes.find(function(f) { return f.title.includes('put(myObj, "sku", 123)'); });
            assert.ok(fixJson, 'Should offer jsonput');
            assert.ok(fixDict, 'Should offer put');
        });

        test('converts arr.push(item) to append() and Math.round(x) to round(x)', function() {
            const doc = createMockDoc('items.push("abc");\nval = Math.round(4.5);\n');
            const diag1 = new MockDiagnostic(new MockRange(0, 0, 0, 17), "Member access", 0, 'bml-invalid-member-access');
            const fixes1 = getMemberAccessFixes(doc, diag1, diag1.range);
            const fixPush = fixes1.find(function(f) { return f.title.includes('items = append(items, "abc")'); });
            assert.ok(fixPush, 'Should offer append assignment');

            const diag2 = new MockDiagnostic(new MockRange(1, 6, 1, 21), "Member access", 0, 'bml-invalid-member-access');
            const fixes2 = getMemberAccessFixes(doc, diag2, diag2.range);
            const fixMath = fixes2.find(function(f) { return f.title.includes('round(4.5)'); });
            assert.ok(fixMath, 'Should offer round(4.5)');
        });
    });

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

    suite('5. Multi-argument sbappend Paired Statements Quick Fixes (without splitting lines)', function() {
        test('moves sbappend(sb,doc,value,doc1,value2,doc3,value3); to 3 paired statements', function() {
            const doc = createMockDoc('sbappend(sb,doc,value,doc1,value2,doc3,value3);\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 48), 'Multiple sbappend args', 3, 'bml-sbappend-multiple-args');
            const fixes = getPerformanceFixes(doc, diag, diag.range);
            assert.strictEqual(fixes.length, 1);
            const fix = fixes[0];
            assert.ok(fix.title.includes("Split 'sbappend' into paired statements"));
            assert.strictEqual(fix.isPreferred, true);
            const replaced = fix.edit._edits[0].newText;
            assert.strictEqual(
                replaced,
                'sbappend(sb, doc, value);\nsbappend(sb, doc1, value2);\nsbappend(sb, doc3, value3);'
            );
        });

        test('moves sbappend with 4 items to 2 paired statements', function() {
            const doc = createMockDoc('sbappend(sb, k1, v1, k2, v2);\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 29), 'Multiple sbappend args', 3, 'bml-sbappend-multiple-args');
            const fixes = getPerformanceFixes(doc, diag, diag.range);
            assert.strictEqual(fixes.length, 1);
            const replaced = fixes[0].edit._edits[0].newText;
            assert.strictEqual(
                replaced,
                'sbappend(sb, k1, v1);\nsbappend(sb, k2, v2);'
            );
        });

        test('handles odd number of items with trailing single statement', function() {
            const doc = createMockDoc('sbappend(sb, k1, v1, k2, v2, k3);\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 33), 'Multiple sbappend args', 3, 'bml-sbappend-multiple-args');
            const fixes = getPerformanceFixes(doc, diag, diag.range);
            assert.strictEqual(fixes.length, 1);
            const replaced = fixes[0].edit._edits[0].newText;
            assert.strictEqual(
                replaced,
                'sbappend(sb, k1, v1);\nsbappend(sb, k2, v2);\nsbappend(sb, k3);'
            );
        });

        test('handles 3 items (odd) with 1 pair and 1 trailing statement', function() {
            const doc = createMockDoc('sbappend(sb, a, b, c);\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 22), 'Multiple sbappend args', 3, 'bml-sbappend-multiple-args');
            const fixes = getPerformanceFixes(doc, diag, diag.range);
            assert.strictEqual(fixes.length, 1);
            const replaced = fixes[0].edit._edits[0].newText;
            assert.strictEqual(
                replaced,
                'sbappend(sb, a, b);\nsbappend(sb, c);'
            );
        });

        test('does not split when sbappend already has only 2 items (single pair)', function() {
            const doc = createMockDoc('sbappend(sb, a, b);\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 19), 'Single pair', 3, 'bml-sbappend-multiple-args');
            const fixes = getPerformanceFixes(doc, diag, diag.range);
            assert.strictEqual(fixes.length, 0);
        });

        test('handles string arguments containing semicolons and commas without breaking', function() {
            const doc = createMockDoc('sbappend(sb, "doc;1", "val,1", "doc;2", "val,2");\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 49), 'Multiple sbappend args', 3, 'bml-sbappend-multiple-args');
            const fixes = getPerformanceFixes(doc, diag, diag.range);
            assert.strictEqual(fixes.length, 1);
            const replaced = fixes[0].edit._edits[0].newText;
            assert.strictEqual(
                replaced,
                'sbappend(sb, "doc;1", "val,1");\nsbappend(sb, "doc;2", "val,2");'
            );
        });

        test('handles nested function calls in arguments', function() {
            const doc = createMockDoc('sbappend(sb, doc, get(d, "k1"), doc1, get(d, "k2"));\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 52), 'Multiple sbappend args', 3, 'bml-sbappend-multiple-args');
            const fixes = getPerformanceFixes(doc, diag, diag.range);
            assert.strictEqual(fixes.length, 1);
            const replaced = fixes[0].edit._edits[0].newText;
            assert.strictEqual(
                replaced,
                'sbappend(sb, doc, get(d, "k1"));\nsbappend(sb, doc1, get(d, "k2"));'
            );
        });

        test('preserves indentation on all generated statements', function() {
            const doc = createMockDoc('    sbappend(sb,doc,value,doc1,value2,doc3,value3);\n');
            const diag = new MockDiagnostic(new MockRange(0, 4, 0, 52), 'Multiple sbappend args', 3, 'bml-sbappend-multiple-args');
            const fixes = getPerformanceFixes(doc, diag, diag.range);
            assert.strictEqual(fixes.length, 1);
            const replaced = fixes[0].edit._edits[0].newText;
            assert.strictEqual(
                replaced,
                'sbappend(sb, doc, value);\n    sbappend(sb, doc1, value2);\n    sbappend(sb, doc3, value3);'
            );
        });

        test('bml-line-too-long on sbappend line offers paired statements and does NOT offer line splitting', function() {
            const doc = createMockDoc('sbappend(sb, "long_key_name_one", "long_value_name_one", "long_key_name_two", "long_value_name_two");\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 102), 'Line too long', 1, 'bml-line-too-long');
            const fixes = getStyleFixes(doc, diag, diag.range);
            const pairedFix = fixes.find(function(f) { return f.title.includes("Split 'sbappend' into paired statements"); });
            const splitLinesFix = fixes.find(function(f) { return f.title.includes('Split arguments across multiple lines'); });
            assert.ok(pairedFix, 'Should offer paired sbappend Quick Fix');
            assert.strictEqual(splitLinesFix, undefined, 'Should NOT offer splitting arguments across multiple lines');
        });

        test('splitFunctionArgumentsIntoLines returns null for sbappend to prevent splitting lines', function() {
            const res = splitFunctionArgumentsIntoLines('sbappend(sb, doc, value, doc1, value2);');
            assert.strictEqual(res, null, 'Should return null for sbappend so function arguments are never broken across lines');
        });

        test('splitConcatenationIntoLines and splitLongStringLiteral return null for sbappend', function() {
            const concatRes = splitConcatenationIntoLines('sbappend(sb, "prefix_" + varName + "_suffix", val, "|");');
            assert.strictEqual(concatRes, null, 'Should return null for sbappend with concatenation');
            const strRes = splitLongStringLiteral('sbappend(sb, "This is an extremely long string literal that would otherwise be chunked across lines", val, "|");');
            assert.strictEqual(strRes, null, 'Should return null for sbappend with long string literal');
        });

        test('bml-line-too-long on canonical sbappend never offers split to multi lines', function() {
            const line = 'sbappend(sb, "1~finalContractValue_t~", string(round(targetContractPrice + marginDollars)) + "_extra_suffix_here_to_make_it_exceed_maximum_allowed_length_limit", "|");';
            const doc = createMockDoc(line + '\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, line.length), 'Line too long', 1, 'bml-line-too-long');
            const fixes = getStyleFixes(doc, diag, diag.range);
            const multiLineFix = fixes.find(function(f) {
                return f.title.includes('multiple lines') || f.title.includes('onto new lines');
            });
            assert.strictEqual(multiLineFix, undefined, 'Should never offer multi-line splitting Quick Fix on sbappend');
        });

        test('combines split sbappend statements into canonical CPQ line item format with pipe', function() {
            const doc = createMockDoc(
                'sbappend(sb, serviceDocNum, "~extendedNetPrice_l~");\n' +
                'sbappend(sb, string(SVC_FINAL_PRICE_DEFAULT), "|");\n'
            );
            const actions = createSbappendSplitActions(doc, new MockRange(0, 0, 0, 40));
            const combineFix = actions.find(function(a) {
                return a.title.includes('Combine into CPQ line item format');
            });
            assert.ok(combineFix, 'Should offer CPQ line item combine fix');
            assert.strictEqual(
                combineFix.edit._edits[0].newText,
                'sbappend(sb, serviceDocNum, "~extendedNetPrice_l~", string(SVC_FINAL_PRICE_DEFAULT), "|");'
            );
        });

        test('combines split sbappend statements when pipe is missing, automatically adding pipe', function() {
            const doc = createMockDoc(
                'sbappend(sb, serviceDocNum, "~netPrice_l~");\n' +
                'sbappend(sb, string(SVC_NET_DEFAULT));\n'
            );
            const actions = createSbappendSplitActions(doc, new MockRange(0, 0, 0, 40));
            const combineFix = actions.find(function(a) {
                return a.title.includes('Combine into CPQ line item format');
            });
            assert.ok(combineFix, 'Should offer CPQ line item combine fix with auto-added pipe');
            assert.strictEqual(
                combineFix.edit._edits[0].newText,
                'sbappend(sb, serviceDocNum, "~netPrice_l~", string(SVC_NET_DEFAULT), "|");'
            );
        });

        test('does not split canonical CPQ line item format into pairs', function() {
            const doc = createMockDoc('sbappend(sb, serviceDocNum, "~extendedNetPrice_l~", string(SVC_FINAL_PRICE_DEFAULT), "|");\n');
            const fixes = buildSbappendSplitFixes(doc, new MockRange(0, 0, 0, 80));
            assert.strictEqual(fixes.length, 0, 'Should not split canonical CPQ line item format');
        });

        test('adds delimiter pipe to single sbappend line item statement when pipe is missing', function() {
            const doc = createMockDoc('sbappend(sb, serviceDocNum, "~extendedNetPrice_l~", string(SVC_FINAL_PRICE_DEFAULT));\n');
            const actions = createSbappendSplitActions(doc, new MockRange(0, 0, 0, 80));
            const addPipeFix = actions.find(function(a) {
                return a.title.includes('Add CPQ delimiter pipe');
            });
            assert.ok(addPipeFix, 'Should offer to add missing CPQ delimiter pipe');
            assert.strictEqual(
                addPipeFix.edit._edits[0].newText,
                'sbappend(sb, serviceDocNum, "~extendedNetPrice_l~", string(SVC_FINAL_PRICE_DEFAULT), "|");'
            );
        });

        test('does not split static string CPQ line item format with embedded docNum and pipe', function() {
            const doc = createMockDoc('sbappend(sb, "1~finalContractValue_t~", fcvStr, "|");\n');
            const fixes = buildSbappendSplitFixes(doc, new MockRange(0, 0, 0, 80));
            assert.strictEqual(fixes.length, 0, 'Should not split static CPQ line item format with embedded docNum');
        });

        test('does not split static string CPQ line item format with omitted docNum and pipe', function() {
            const doc = createMockDoc('sbappend(sb, "~estimatedContractValue_t~", fcvStr, "|");\n');
            const fixes = buildSbappendSplitFixes(doc, new MockRange(0, 0, 0, 80));
            assert.strictEqual(fixes.length, 0, 'Should not split static CPQ line item format with omitted docNum');
        });

        test('does not split dynamic variable CPQ line item format with pipe', function() {
            const doc = createMockDoc('sbappend(sb, "1~", serviceAttrsArray[typeIndex], "~", string(serviceTypeTotal), "|");\n');
            const fixes = buildSbappendSplitFixes(doc, new MockRange(0, 0, 0, 100));
            assert.strictEqual(fixes.length, 0, 'Should not split dynamic CPQ line item format with pipe');
        });

        test('does not split dynamic variable CPQ line item format with separated docNum and pipe', function() {
            const doc = createMockDoc('sbappend(sb, docNum, "~", dynamicVar, "~", val, "|");\n');
            const fixes = buildSbappendSplitFixes(doc, new MockRange(0, 0, 0, 80));
            assert.strictEqual(fixes.length, 0, 'Should not split dynamic CPQ line item format with separated docNum');
        });

        test('isCpqLineItemArgs correctly identifies static and dynamic CPQ formats', function() {
            assert.strictEqual(isCpqLineItemArgs(['sb', '"1~finalContractValue_t~"', 'fcvStr', '"|"']), true);
            assert.strictEqual(isCpqLineItemArgs(['sb', '"~estimatedContractValue_t~"', 'fcvStr', '"|"']), true);
            assert.strictEqual(isCpqLineItemArgs(['sb', '"1~"', 'serviceAttrsArray[typeIndex]', '"~"', 'string(serviceTypeTotal)', '"|"']), true);
            assert.strictEqual(isCpqLineItemArgs(['sb', 'docNum', '"~"', 'dynamicVar', '"~"', 'val', '"|"']), true);
            assert.strictEqual(isCpqLineItemArgs(['sb', 'serviceDocNum', '"~extendedNetPrice_l~"', 'val', '"|"']), true);
            assert.strictEqual(isCpqLineItemArgs(['sb', 'serviceDocNum', '"~netPrice_l~"', 'val']), true);
            assert.strictEqual(isCpqLineItemArgs(['sb', 'k1', 'v1', 'k2', 'v2']), false);
            assert.strictEqual(isCpqLineItemArgs(['sb', 'doc', 'value', 'doc1', 'value2', 'doc3', 'value3']), false);
        });

        test('checkPerformance does not flag accepted static and dynamic CPQ line item formats', function() {
            const code = [
                'sb = stringbuilder();',
                'sbappend(sb, "~estimatedContractValue_t~", fcvStr, "|");',
                'sbappend(sb, "1~finalContractValue_t~", fcvStr, "|");',
                'sbappend(sb, "1~totalSum_t~", string(alignedCon), "|");',
                'sbappend(sb, "1~fcv_upper_t~", string(round(targetContractPrice + marginDollars)), "|");',
                'sbappend(sb, "1~", serviceAttrsArray[typeIndex], "~", string(serviceTypeTotal), "|");',
                'sbappend(sb, docNum, "~", dynamicVar, "~", val, "|");',
                'return sbtostring(sb);'
            ].join('\n');
            const doc = createMockDoc(code);
            const diags = checkPerformance(code, code, doc);
            const sbDiags = diags.filter(function(d) { return d.code === 'bml-sbappend-multiple-args'; });
            assert.strictEqual(sbDiags.length, 0, 'Should not flag canonical CPQ line item formats with bml-sbappend-multiple-args');
        });

        test('combines split sbappend statements with embedded docNum attribute', function() {
            const doc = createMockDoc(
                'sbappend(sb, "1~priceChangeFlag_t~");\n' +
                'sbappend(sb, changeFlag, "|");\n'
            );
            const actions = createSbappendSplitActions(doc, new MockRange(0, 0, 0, 40));
            const combineFix = actions.find(function(a) {
                return a.title.includes('Combine into CPQ line item format');
            });
            assert.ok(combineFix, 'Should offer CPQ line item combine fix for embedded docNum');
            assert.strictEqual(
                combineFix.edit._edits[0].newText,
                'sbappend(sb, "1~priceChangeFlag_t~", changeFlag, "|");'
            );
        });

        test('does not mistreat leading delimiter pipe as docNum when combining', function() {
            const doc = createMockDoc(
                'sbappend(sb, "|", "1~priceChangeFlag_t~");\n' +
                'sbappend(sb, changeFlag, "|");\n'
            );
            const actions = createSbappendSplitActions(doc, new MockRange(0, 0, 0, 40));
            const badCombineFix = actions.find(function(a) {
                return a.title.includes('sbappend(sb, "|", "1~priceChangeFlag_t~"');
            });
            assert.strictEqual(badCombineFix, undefined, 'Must not generate invalid combination with pipe as docNum');
        });

        test('adds delimiter pipe to single static sbappend line item statement with embedded docNum', function() {
            const doc = createMockDoc('sbappend(sb, "1~finalContractValue_t~", fcvStr);\n');
            const actions = createSbappendSplitActions(doc, new MockRange(0, 0, 0, 60));
            const addPipeFix = actions.find(function(a) {
                return a.title.includes('Add CPQ delimiter pipe');
            });
            assert.ok(addPipeFix, 'Should offer to add missing CPQ delimiter pipe for embedded docNum statement');
            assert.strictEqual(
                addPipeFix.edit._edits[0].newText,
                'sbappend(sb, "1~finalContractValue_t~", fcvStr, "|");'
            );
        });

        test('adds delimiter pipe to single dynamic sbappend line item statement', function() {
            const doc = createMockDoc('sbappend(sb, "1~", serviceAttrsArray[typeIndex], "~", string(serviceTypeTotal));\n');
            const actions = createSbappendSplitActions(doc, new MockRange(0, 0, 0, 90));
            const addPipeFix = actions.find(function(a) {
                return a.title.includes('Add CPQ delimiter pipe');
            });
            assert.ok(addPipeFix, 'Should offer to add missing CPQ delimiter pipe for dynamic statement');
            assert.strictEqual(
                addPipeFix.edit._edits[0].newText,
                'sbappend(sb, "1~", serviceAttrsArray[typeIndex], "~", string(serviceTypeTotal), "|");'
            );
        });
    });
});
