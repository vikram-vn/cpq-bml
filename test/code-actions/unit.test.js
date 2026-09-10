const assert = require('assert');
const { getMemberAccessFixes } = require('@/lang/lint/code-actions/memberAccessFixes');
const { getFunctionSignatureFixes } = require('@/lang/lint/code-actions/functionSignatureFixes');
const { getTypeCastFixes } = require('@/lang/lint/code-actions/typeCastFixes');
const { getSyntaxFixes } = require('@/lang/lint/code-actions/syntaxFixes');
const { getQualityFixes } = require('@/lang/lint/code-actions/qualityFixes');
const { getBmqlFixes } = require('@/lang/lint/code-actions/bmqlFixes');
const { getPerformanceFixes, buildSbappendSplitFixes, createSbappendSplitActions } = require('@/lang/lint/code-actions/performanceFixes');
const { getStyleFixes } = require('@/lang/lint/code-actions/styleFixes');
const { getStringArrayFixes } = require('@/lang/lint/code-actions/stringArrayFixes');
const { getDictJsonDateFixes } = require('@/lang/lint/code-actions/dictJsonDateFixes');
const { getCommerceWebFixes } = require('@/lang/lint/code-actions/commerceWebFixes');
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

    suite('9. Expanded Member Access to Canonical BML Functions Suite', function() {
        test('converts Date member access to canonical BML functions', function() {
            const doc = createMockDoc('d2 = myDate.addDays(5);\n');
            const diag = new MockDiagnostic(new MockRange(0, 5, 0, 22), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes = getMemberAccessFixes(doc, diag, diag.range);
            const fix = fixes.find(f => f.title.includes('adddays(myDate, 5)'));
            assert.ok(fix, 'Should offer adddays fix');
            assert.strictEqual(fix.edit._edits[0].newText, 'adddays(myDate, 5)');
        });

        test('converts Date getTime() to getcurrenttimeinmillis()', function() {
            const doc = createMockDoc('ms = myDate.getTime();\n');
            const diag = new MockDiagnostic(new MockRange(0, 5, 0, 21), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes = getMemberAccessFixes(doc, diag, diag.range);
            const fix = fixes.find(f => f.title.includes('getcurrenttimeinmillis()'));
            assert.ok(fix, 'Should offer getcurrenttimeinmillis fix');
            assert.strictEqual(fix.edit._edits[0].newText, 'getcurrenttimeinmillis()');
        });

        test('converts Integer.parseInt(s) to atoi(s)', function() {
            const doc = createMockDoc('num = Integer.parseInt(strVal);\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 30), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes = getMemberAccessFixes(doc, diag, diag.range);
            const fix = fixes.find(f => f.title.includes('atoi(strVal)'));
            assert.ok(fix, 'Should offer atoi fix');
            assert.strictEqual(fix.edit._edits[0].newText, 'atoi(strVal)');
        });

        test('converts JSON.parse(s) to json(s) and JSON.stringify(o) to jsontostr(o)', function() {
            const doc1 = createMockDoc('j = JSON.parse(rawText);\n');
            const diag1 = new MockDiagnostic(new MockRange(0, 4, 0, 23), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes1 = getMemberAccessFixes(doc1, diag1, diag1.range);
            const fix1 = fixes1.find(f => f.title.includes('json(rawText)'));
            assert.ok(fix1, 'Should offer json(rawText)');
            assert.strictEqual(fix1.edit._edits[0].newText, 'json(rawText)');

            const doc2 = createMockDoc('s = JSON.stringify(myJson);\n');
            const diag2 = new MockDiagnostic(new MockRange(0, 4, 0, 26), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes2 = getMemberAccessFixes(doc2, diag2, diag2.range);
            const fix2 = fixes2.find(f => f.title.includes('jsontostr(myJson)'));
            assert.ok(fix2, 'Should offer jsontostr(myJson)');
            assert.strictEqual(fix2.edit._edits[0].newText, 'jsontostr(myJson)');
        });

        test('converts array pop() to remove(arr, sizeofarray(arr) - 1)', function() {
            const doc = createMockDoc('myArr.pop();\n');
            const diag = new MockDiagnostic(new MockRange(0, 0, 0, 11), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes = getMemberAccessFixes(doc, diag, diag.range);
            const fix = fixes.find(f => f.title.includes('remove(myArr, sizeofarray(myArr) - 1)'));
            assert.ok(fix, 'Should offer pop to remove fix');
            assert.strictEqual(fix.edit._edits[0].newText, 'myArr = remove(myArr, sizeofarray(myArr) - 1)');
        });

        test('converts string strip() to trim(s)', function() {
            const doc = createMockDoc('clean = myStr.strip();\n');
            const diag = new MockDiagnostic(new MockRange(0, 8, 0, 21), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes = getMemberAccessFixes(doc, diag, diag.range);
            const fix = fixes.find(f => f.title.includes('trim(myStr)'));
            assert.ok(fix, 'Should offer trim fix');
            assert.strictEqual(fix.edit._edits[0].newText, 'trim(myStr)');
        });
    });

    suite('10. Extended Mathematical, Utility & Encoding Member Accesses Suite', function() {
        test('converts Math.log(x) to ln(x) for natural log and log(x) for base-10', function() {
            const doc = createMockDoc('val = Math.log(x);\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 17), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes = getMemberAccessFixes(doc, diag, diag.range);
            const fixLn = fixes.find(f => f.title.includes('ln(x)'));
            const fixLog = fixes.find(f => f.title.includes('log(x)'));
            assert.ok(fixLn, 'Should offer ln(x) fix');
            assert.ok(fixLog, 'Should offer log(x) fix');
            assert.strictEqual(fixLn.edit._edits[0].newText, 'ln(x)');
            assert.strictEqual(fixLog.edit._edits[0].newText, 'log(x)');
        });

        test('converts Math.abs(x) to fabs(x) strictly (BML only supports fabs)', function() {
            const doc = createMockDoc('v = Math.abs(num);\n');
            const diag = new MockDiagnostic(new MockRange(0, 4, 0, 17), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes = getMemberAccessFixes(doc, diag, diag.range);
            const fixFabs = fixes.find(f => f.title.includes('fabs(num)'));
            const fixAbs = fixes.find(f => f.title.includes("Use BML 'abs("));
            assert.ok(fixFabs, 'Should offer fabs(num) fix');
            assert.strictEqual(fixAbs, undefined, 'Should NOT offer abs because BML only supports fabs');
            assert.strictEqual(fixFabs.edit._edits[0].newText, 'fabs(num)');
        });

        test('converts Math.floor(x) to atoi(string(x)) or round(x - 0.5, 0)', function() {
            const doc = createMockDoc('f = Math.floor(num);\n');
            const diag = new MockDiagnostic(new MockRange(0, 4, 0, 19), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes = getMemberAccessFixes(doc, diag, diag.range);
            const fixAtoi = fixes.find(f => f.title.includes('atoi(string(num))'));
            const fixRound = fixes.find(f => f.title.includes('round(num - 0.5, 0)'));
            assert.ok(fixAtoi, 'Should offer atoi(string) fix');
            assert.ok(fixRound, 'Should offer round fix');
            assert.strictEqual(fixAtoi.edit._edits[0].newText, 'atoi(string(num))');
            assert.strictEqual(fixRound.edit._edits[0].newText, 'round(num - 0.5, 0)');
        });

        test('converts UUID.randomUUID() to generateuuid()', function() {
            const doc = createMockDoc('id = UUID.randomUUID();\n');
            const diag = new MockDiagnostic(new MockRange(0, 5, 0, 22), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes = getMemberAccessFixes(doc, diag, diag.range);
            const fix = fixes.find(f => f.title.includes('generateuuid()'));
            assert.ok(fix, 'Should offer generateuuid fix');
            assert.strictEqual(fix.edit._edits[0].newText, 'generateuuid()');
        });

        test('converts Base64 encode and decode to encodebase64 and decodebase64', function() {
            const doc1 = createMockDoc('enc = Base64.encode(text);\n');
            const diag1 = new MockDiagnostic(new MockRange(0, 6, 0, 25), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes1 = getMemberAccessFixes(doc1, diag1, diag1.range);
            const fix1 = fixes1.find(f => f.title.includes('encodebase64(text)'));
            assert.ok(fix1, 'Should offer encodebase64 fix');
            assert.strictEqual(fix1.edit._edits[0].newText, 'encodebase64(text)');

            const doc2 = createMockDoc('dec = Base64.decode(b64);\n');
            const diag2 = new MockDiagnostic(new MockRange(0, 6, 0, 24), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes2 = getMemberAccessFixes(doc2, diag2, diag2.range);
            const fix2 = fixes2.find(f => f.title.includes('decodebase64(b64)'));
            assert.ok(fix2, 'Should offer decodebase64 fix');
            assert.strictEqual(fix2.edit._edits[0].newText, 'decodebase64(b64)');
        });

        test('converts URLEncoder.encode(s) to makeurlparam(s)', function() {
            const doc = createMockDoc('param = URLEncoder.encode(query);\n');
            const diag = new MockDiagnostic(new MockRange(0, 8, 0, 32), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes = getMemberAccessFixes(doc, diag, diag.range);
            const fix = fixes.find(f => f.title.includes('makeurlparam(query)'));
            assert.ok(fix, 'Should offer makeurlparam fix');
            assert.strictEqual(fix.edit._edits[0].newText, 'makeurlparam(query)');
        });

        test('converts String.format(...) to format(...) and num.formatAsCurrency() to formatascurrency(num)', function() {
            const doc1 = createMockDoc('msg = String.format("Hello %s", name);\n');
            const diag1 = new MockDiagnostic(new MockRange(0, 6, 0, 38), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes1 = getMemberAccessFixes(doc1, diag1, diag1.range);
            const fix1 = fixes1.find(f => f.title.includes('format("Hello %s", name)'));
            assert.ok(fix1, 'Should offer format fix');
            assert.strictEqual(fix1.edit._edits[0].newText, 'format("Hello %s", name)');

            const doc2 = createMockDoc('c = price.formatAsCurrency();\n');
            const diag2 = new MockDiagnostic(new MockRange(0, 4, 0, 28), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes2 = getMemberAccessFixes(doc2, diag2, diag2.range);
            const fix2 = fixes2.find(f => f.title.includes('formatascurrency(price)'));
            assert.ok(fix2, 'Should offer formatascurrency fix');
            assert.strictEqual(fix2.edit._edits[0].newText, 'formatascurrency(price)');
        });
    });

    suite('11. Enterprise CPQ Domain, Session, BOM & Commerce Member Accesses Suite', function() {
        test('converts session.get, session.set, session.remove to usersession functions', function() {
            const docGet = createMockDoc('token = session.get("auth");\n');
            const diagGet = new MockDiagnostic(new MockRange(0, 8, 0, 27), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesGet = getMemberAccessFixes(docGet, diagGet, diagGet.range);
            const fixGet = fixesGet.find(f => f.title.includes('usersessionget("auth")'));
            assert.ok(fixGet, 'Should offer usersessionget fix');
            assert.strictEqual(fixGet.edit._edits[0].newText, 'usersessionget("auth")');

            const docSet = createMockDoc('session.set("user", u);\n');
            const diagSet = new MockDiagnostic(new MockRange(0, 0, 0, 22), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesSet = getMemberAccessFixes(docSet, diagSet, diagSet.range);
            const fixSet = fixesSet.find(f => f.title.includes('usersessionset("user", u)'));
            assert.ok(fixSet, 'Should offer usersessionset fix');
            assert.strictEqual(fixSet.edit._edits[0].newText, 'usersessionset("user", u)');

            const docRem = createMockDoc('session.remove("user");\n');
            const diagRem = new MockDiagnostic(new MockRange(0, 0, 0, 22), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesRem = getMemberAccessFixes(docRem, diagRem, diagRem.range);
            const fixRem = fixesRem.find(f => f.title.includes('usersessionremove("user")'));
            assert.ok(fixRem, 'Should offer usersessionremove fix');
            assert.strictEqual(fixRem.edit._edits[0].newText, 'usersessionremove("user")');
        });

        test('converts global.get, global.set, global.remove to globaldict functions', function() {
            const docGet = createMockDoc('cached = global.get("rate");\n');
            const diagGet = new MockDiagnostic(new MockRange(0, 9, 0, 27), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesGet = getMemberAccessFixes(docGet, diagGet, diagGet.range);
            const fixGet = fixesGet.find(f => f.title.includes('globaldictget("rate")'));
            assert.ok(fixGet, 'Should offer globaldictget fix');
            assert.strictEqual(fixGet.edit._edits[0].newText, 'globaldictget("rate")');

            const docSet = createMockDoc('global.set("rate", 1.25);\n');
            const diagSet = new MockDiagnostic(new MockRange(0, 0, 0, 24), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesSet = getMemberAccessFixes(docSet, diagSet, diagSet.range);
            const fixSet = fixesSet.find(f => f.title.includes('globaldictset("rate", 1.25)'));
            assert.ok(fixSet, 'Should offer globaldictset fix');
            assert.strictEqual(fixSet.edit._edits[0].newText, 'globaldictset("rate", 1.25)');
        });

        test('converts context.getAttribute and setAttribute to CPQ config functions', function() {
            const docGet = createMockDoc('val = context.getAttribute("lineCount");\n');
            const diagGet = new MockDiagnostic(new MockRange(0, 6, 0, 39), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesGet = getMemberAccessFixes(docGet, diagGet, diagGet.range);
            const fixGet = fixesGet.find(f => f.title.includes('getconfigattrvalue("lineCount")'));
            assert.ok(fixGet, 'Should offer getconfigattrvalue fix');
            assert.strictEqual(fixGet.edit._edits[0].newText, 'getconfigattrvalue("lineCount")');

            const docSet = createMockDoc('context.setAttribute("lineCount", 5);\n');
            const diagSet = new MockDiagnostic(new MockRange(0, 0, 0, 36), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesSet = getMemberAccessFixes(docSet, diagSet, diagSet.range);
            const fixSet = fixesSet.find(f => f.title.includes('setattributevalue("lineCount", 5)'));
            assert.ok(fixSet, 'Should offer setattributevalue fix');
            assert.strictEqual(fixSet.edit._edits[0].newText, 'setattributevalue("lineCount", 5)');
        });

        test('converts bom operations: bom.get(), bom.apply(), bom.save(), bom.calculateDelta()', function() {
            const doc = createMockDoc('b = bom.get();\n');
            const diag = new MockDiagnostic(new MockRange(0, 4, 0, 13), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixes = getMemberAccessFixes(doc, diag, diag.range);
            const fix = fixes.find(f => f.title.includes('getbom()'));
            assert.ok(fix, 'Should offer getbom fix');
            assert.strictEqual(fix.edit._edits[0].newText, 'getbom()');

            const docApply = createMockDoc('bom.apply();\n');
            const diagApply = new MockDiagnostic(new MockRange(0, 0, 0, 11), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesApply = getMemberAccessFixes(docApply, diagApply, diagApply.range);
            const fixApply = fixesApply.find(f => f.title.includes('applybom()'));
            assert.ok(fixApply, 'Should offer applybom fix');
            assert.strictEqual(fixApply.edit._edits[0].newText, 'applybom()');

            const docSave = createMockDoc('bom.save();\n');
            const diagSave = new MockDiagnostic(new MockRange(0, 0, 0, 10), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesSave = getMemberAccessFixes(docSave, diagSave, diagSave.range);
            const fixSave = fixesSave.find(f => f.title.includes('savebom()'));
            assert.ok(fixSave, 'Should offer savebom fix');
            assert.strictEqual(fixSave.edit._edits[0].newText, 'savebom()');

            const docDelta = createMockDoc('d = bom.calculateDelta(priorBom);\n');
            const diagDelta = new MockDiagnostic(new MockRange(0, 4, 0, 32), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesDelta = getMemberAccessFixes(docDelta, diagDelta, diagDelta.range);
            const fixDelta = fixesDelta.find(f => f.title.includes('calculatedeltabom(priorBom)'));
            assert.ok(fixDelta, 'Should offer calculatedeltabom fix');
            assert.strictEqual(fixDelta.edit._edits[0].newText, 'calculatedeltabom(priorBom)');
        });

        test('converts transaction and parts methods to canonical commerce functions', function() {
            const docGet = createMockDoc('t = transaction.get();\n');
            const diagGet = new MockDiagnostic(new MockRange(0, 4, 0, 21), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesGet = getMemberAccessFixes(docGet, diagGet, diagGet.range);
            const fixGet = fixesGet.find(f => f.title.includes('gettransaction()'));
            assert.ok(fixGet, 'Should offer gettransaction fix');
            assert.strictEqual(fixGet.edit._edits[0].newText, 'gettransaction()');

            const docAdd = createMockDoc('transaction.add(lines);\n');
            const diagAdd = new MockDiagnostic(new MockRange(0, 0, 0, 22), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesAdd = getMemberAccessFixes(docAdd, diagAdd, diagAdd.range);
            const fixAdd = fixesAdd.find(f => f.title.includes('addtotransaction(lines)'));
            assert.ok(fixAdd, 'Should offer addtotransaction fix');
            assert.strictEqual(fixAdd.edit._edits[0].newText, 'addtotransaction(lines)');

            const docParts = createMockDoc('parts.addToTransaction();\n');
            const diagParts = new MockDiagnostic(new MockRange(0, 0, 0, 24), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesParts = getMemberAccessFixes(docParts, diagParts, diagParts.range);
            const fixParts = fixesParts.find(f => f.title.includes('addpartstotransaction(parts)'));
            assert.ok(fixParts, 'Should offer addpartstotransaction fix');

            const docOld = createMockDoc('prev = status.getOldValue();\n');
            const diagOld = new MockDiagnostic(new MockRange(0, 7, 0, 26), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesOld = getMemberAccessFixes(docOld, diagOld, diagOld.range);
            const fixOld = fixesOld.find(f => f.title.includes('getoldvalue("status")'));
            assert.ok(fixOld, 'Should offer getoldvalue fix');
            assert.strictEqual(fixOld.edit._edits[0].newText, 'getoldvalue("status")');
        });

        test('converts XML member operations: xml.transform, removeNode, appendNode', function() {
            const docTrans = createMockDoc('res = xmlDoc.transform(xslSheet);\n');
            const diagTrans = new MockDiagnostic(new MockRange(0, 6, 0, 33), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesTrans = getMemberAccessFixes(docTrans, diagTrans, diagTrans.range);
            const fixTrans = fixesTrans.find(f => f.title.includes('transformxml(xmlDoc, xslSheet)'));
            assert.ok(fixTrans, 'Should offer transformxml fix');
            assert.strictEqual(fixTrans.edit._edits[0].newText, 'transformxml(xmlDoc, xslSheet)');

            const docRem = createMockDoc('xmlDoc.removeNode("//item");\n');
            const diagRem = new MockDiagnostic(new MockRange(0, 0, 0, 27), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesRem = getMemberAccessFixes(docRem, diagRem, diagRem.range);
            const fixRem = fixesRem.find(f => f.title.includes('removexmlnode(xmlDoc, "//item")'));
            assert.ok(fixRem, 'Should offer removexmlnode fix');
            assert.strictEqual(fixRem.edit._edits[0].newText, 'removexmlnode(xmlDoc, "//item")');

            const docApp = createMockDoc('xmlDoc.appendNode("/root", "<node/>");\n');
            const diagApp = new MockDiagnostic(new MockRange(0, 0, 0, 37), 'Invalid member access', 0, 'bml-invalid-member-access');
            const fixesApp = getMemberAccessFixes(docApp, diagApp, diagApp.range);
            const fixApp = fixesApp.find(f => f.title.includes('appendxmlnode(xmlDoc, "/root", "<node/>")'));
            assert.ok(fixApp, 'Should offer appendxmlnode fix');
            assert.strictEqual(fixApp.edit._edits[0].newText, 'appendxmlnode(xmlDoc, "/root", "<node/>")');
        });
    });

    suite('12. Invalid Built-in Function Names to Canonical BML Quick Fixes Suite', function() {
        test('autocorrects abs() to fabs() (BML only supports fabs)', function() {
            const doc = createMockDoc('val = abs(-5.5);\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 9), "Unknown built-in function or variable 'abs' - did you mean 'fabs'?", 1, 'bml-unknown-function');
            const fixes = getQualityFixes(doc, diag, diag.range, '');
            const fix = fixes.find(f => f.title.includes("'fabs'"));
            assert.ok(fix, 'Should offer fabs replacement');
            assert.strictEqual(fix.edit._edits[0].newText, 'fabs');
        });

        test('autocorrects now() and today() to getdate()', function() {
            const docNow = createMockDoc('cur = now();\n');
            const diagNow = new MockDiagnostic(new MockRange(0, 6, 0, 9), "Unknown built-in function or variable 'now'", 1, 'bml-unknown-function');
            const fixesNow = getQualityFixes(docNow, diagNow, diagNow.range, '');
            const fixNow = fixesNow.find(f => f.title.includes("'getdate'"));
            assert.ok(fixNow, 'Should offer getdate replacement for now()');
            assert.strictEqual(fixNow.edit._edits[0].newText, 'getdate');

            const docToday = createMockDoc('d = today();\n');
            const diagToday = new MockDiagnostic(new MockRange(0, 4, 0, 9), "Unknown built-in function or variable 'today'", 1, 'bml-unknown-function');
            const fixesToday = getQualityFixes(docToday, diagToday, diagToday.range, '');
            const fixToday = fixesToday.find(f => f.title.includes("'getdate'"));
            assert.ok(fixToday, 'Should offer getdate replacement for today()');
            assert.strictEqual(fixToday.edit._edits[0].newText, 'getdate');
        });

        test('autocorrects log10() to log()', function() {
            const doc = createMockDoc('l = log10(100);\n');
            const diag = new MockDiagnostic(new MockRange(0, 4, 0, 9), "Unknown built-in function or variable 'log10'", 1, 'bml-unknown-function');
            const fixes = getQualityFixes(doc, diag, diag.range, '');
            const fix = fixes.find(f => f.title.includes("'log'"));
            assert.ok(fix, 'Should offer log replacement for log10()');
            assert.strictEqual(fix.edit._edits[0].newText, 'log');
        });

        test('autocorrects length() to len() or sizeofarray()', function() {
            const doc = createMockDoc('n = length(item);\n');
            const diag = new MockDiagnostic(new MockRange(0, 4, 0, 10), "Unknown built-in function or variable 'length'", 1, 'bml-unknown-function');
            const fixes = getQualityFixes(doc, diag, diag.range, '');
            const fixLen = fixes.find(f => f.title.includes("'len'"));
            const fixArr = fixes.find(f => f.title.includes("'sizeofarray'"));
            assert.ok(fixLen, 'Should offer len replacement');
            assert.ok(fixArr, 'Should offer sizeofarray replacement');
            assert.strictEqual(fixLen.edit._edits[0].newText, 'len');
            assert.strictEqual(fixArr.edit._edits[0].newText, 'sizeofarray');
        });

        test('autocorrects indexof() to find() or findinarray()', function() {
            const doc = createMockDoc('idx = indexof(data, "sub");\n');
            const diag = new MockDiagnostic(new MockRange(0, 6, 0, 13), "Unknown built-in function or variable 'indexof'", 1, 'bml-unknown-function');
            const fixes = getQualityFixes(doc, diag, diag.range, '');
            const fixFind = fixes.find(f => f.title.includes("'find'"));
            const fixArr = fixes.find(f => f.title.includes("'findinarray'"));
            assert.ok(fixFind, 'Should offer find replacement');
            assert.ok(fixArr, 'Should offer findinarray replacement');
            assert.strictEqual(fixFind.edit._edits[0].newText, 'find');
            assert.strictEqual(fixArr.edit._edits[0].newText, 'findinarray');
        });

        test('autocorrects btoa() and atob() to encodebase64() and decodebase64()', function() {
            const docBtoa = createMockDoc('enc = btoa(str);\n');
            const diagBtoa = new MockDiagnostic(new MockRange(0, 6, 0, 10), "Unknown built-in function or variable 'btoa'", 1, 'bml-unknown-function');
            const fixesBtoa = getQualityFixes(docBtoa, diagBtoa, diagBtoa.range, '');
            const fixBtoa = fixesBtoa.find(f => f.title.includes("'encodebase64'"));
            assert.ok(fixBtoa, 'Should offer encodebase64 replacement');
            assert.strictEqual(fixBtoa.edit._edits[0].newText, 'encodebase64');

            const docAtob = createMockDoc('dec = atob(enc);\n');
            const diagAtob = new MockDiagnostic(new MockRange(0, 6, 0, 10), "Unknown built-in function or variable 'atob'", 1, 'bml-unknown-function');
            const fixesAtob = getQualityFixes(docAtob, diagAtob, diagAtob.range, '');
            const fixAtob = fixesAtob.find(f => f.title.includes("'decodebase64'"));
            assert.ok(fixAtob, 'Should offer decodebase64 replacement');
            assert.strictEqual(fixAtob.edit._edits[0].newText, 'decodebase64');
        });
    });
});
