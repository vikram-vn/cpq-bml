const assert = require('assert');
const { getPerformanceFixes, buildSbappendSplitFixes, createSbappendSplitActions } = require('@/lang/lint/code-actions/performanceFixes');
const { splitFunctionArgumentsIntoLines, splitConcatenationIntoLines, splitLongStringLiteral } = require('@/lang/lint/code-actions/styleSplitters');
const { checkPerformance, isCpqLineItemArgs } = require('@/lang/lint/rules/performance');
const { getStyleFixes } = require('@/lang/lint/code-actions/styleFixes');
const { MockRange, MockDiagnostic, createMockDoc } = require('@/test/code-actions/helpers');

suite('Multi-argument sbappend Paired Statements Quick Fixes', function() {
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
