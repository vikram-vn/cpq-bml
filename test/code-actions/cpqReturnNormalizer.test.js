const assert = require('assert');
const {
    parseCpqReturnTokens,
    formatCanonicalCpqReturn,
    analyzeCpqReturnAtLines
} = require('@/lang/lint/rules/cpqReturnNormalizer');
const { createSbappendSplitActions } = require('@/lang/lint/code-actions/performanceFixes');

function createMockDoc(content) {
    const lines = content.split('\n');
    return {
        lineCount: lines.length,
        lineAt: function(idx) {
            const t = lines[idx] !== undefined ? lines[idx] : '';
            return {
                text: t,
                range: {
                    start: { line: idx, character: 0 },
                    end: { line: idx, character: t.length }
                }
            };
        },
        getText: function(rng) {
            if (!rng) return content;
            return lines[rng.start.line] || '';
        },
        uri: { fsPath: 'c:/test/script.bml' }
    };
}

suite('CPQ Return Normalizer Test Suite', () => {

    test('Case 1: sbappend(sb, "1~var~"); sbappend(sb, "statiVal|") -> Format 1', () => {
        const code = 'sbappend(sb, "1~variableName~");\nsbappend(sb, "statiVal|");\n';
        const doc = createMockDoc(code);
        const res = analyzeCpqReturnAtLines(doc, 0);
        assert.ok(res, 'Should detect split statement');
        assert.strictEqual(res.replacement, 'sbappend(sb, "1~variableName~statiVal", "|");');
    });

    test('Case 2: sbappend(sb, "1", "~variableName~", "statiVal", "|") -> Format 1', () => {
        const code = 'sbappend(sb, "1", "~variableName~", "statiVal", "|");\n';
        const doc = createMockDoc(code);
        const res = analyzeCpqReturnAtLines(doc, 0);
        assert.ok(res, 'Should normalize multi-argument static call');
        assert.strictEqual(res.replacement, 'sbappend(sb, "1~variableName~statiVal", "|");');
    });

    test('Case 3: sbappend(sb, dynamicDocNumber, "~variableName~", "statiVal", "|") -> Format 3 (static val)', () => {
        const code = 'sbappend(sb, dynamicDocNumber, "~variableName~", "statiVal", "|");\n';
        const doc = createMockDoc(code);
        const res = analyzeCpqReturnAtLines(doc, 0);
        assert.ok(res, 'Should normalize dynamic doc with static val');
        assert.strictEqual(res.replacement, 'sbappend(sb, dynamicDocNumber, "~variableName~statiVal", "|");');
    });

    test('Case 4: sbappend(sb, dynamicDocNumber, "~variableName~", dynamicVal, "|") -> already Format 3', () => {
        const parsed = parseCpqReturnTokens(['sb', 'dynamicDocNumber', '"~variableName~"', 'dynamicVal', '"|"']);
        assert.ok(parsed);
        const formatted = formatCanonicalCpqReturn(parsed);
        assert.strictEqual(formatted, 'sbappend(sb, dynamicDocNumber, "~variableName~", dynamicVal, "|");');
    });

    test('Case 5: sbappend(sb, dynamicDocNumber, "~variableName~"); sbappend(sb, dynamicVal, "|"); -> Format 3', () => {
        const code = 'sbappend(sb, dynamicDocNumber, "~variableName~");\nsbappend(sb, dynamicVal, "|");\n';
        const doc = createMockDoc(code);
        const res = analyzeCpqReturnAtLines(doc, 0);
        assert.ok(res, 'Should combine dynamic doc split with dynamic val');
        assert.strictEqual(res.replacement, 'sbappend(sb, dynamicDocNumber, "~variableName~", dynamicVal, "|");');
    });

    test('Case 6: sbappend(sb, dynamicDocNumber, "~variableName~"); sbappend(sb, "staticval", "|"); -> Format 3', () => {
        const code = 'sbappend(sb, dynamicDocNumber, "~variableName~");\nsbappend(sb, "staticval", "|");\n';
        const doc = createMockDoc(code);
        const res = analyzeCpqReturnAtLines(doc, 0);
        assert.ok(res, 'Should combine dynamic doc split with static val');
        assert.strictEqual(res.replacement, 'sbappend(sb, dynamicDocNumber, "~variableName~staticval", "|");');
    });

    test('Case 7: sbappend(sb, dynamicDocNumber); sbappend(sb, "~variableName~", "staticval", "|"); -> Format 3', () => {
        const code = 'sbappend(sb, dynamicDocNumber);\nsbappend(sb, "~variableName~", "staticval", "|");\n';
        const doc = createMockDoc(code);
        const res = analyzeCpqReturnAtLines(doc, 0);
        assert.ok(res, 'Should combine isolated docNum call with return body');
        assert.strictEqual(res.replacement, 'sbappend(sb, dynamicDocNumber, "~variableName~staticval", "|");');
    });

    test('Case 8: sbappend(sb, "1~variableName~"); sbappend(sb, dynamicVal, "|"); -> Format 2', () => {
        const code = 'sbappend(sb, "1~variableName~");\nsbappend(sb, dynamicVal, "|");\n';
        const doc = createMockDoc(code);
        const res = analyzeCpqReturnAtLines(doc, 0);
        assert.ok(res, 'Should combine static doc split with dynamic val into Format 2');
        assert.strictEqual(res.replacement, 'sbappend(sb, "1~variableName~", dynamicVal, "|");');
    });

    test('Case 9: sbappend(sb, "1", "~variableName~", dynamicVal, "|") -> Format 2', () => {
        const code = 'sbappend(sb, "1", "~variableName~", dynamicVal, "|");\n';
        const doc = createMockDoc(code);
        const res = analyzeCpqReturnAtLines(doc, 0);
        assert.ok(res, 'Should combine separated "1" and "~var~" into Format 2');
        assert.strictEqual(res.replacement, 'sbappend(sb, "1~variableName~", dynamicVal, "|");');
    });

    test('Missing delimiter pipe is automatically added', () => {
        const code1 = 'sbappend(sb, "1~status_t~", lineStatus);\n';
        const doc1 = createMockDoc(code1);
        const res1 = analyzeCpqReturnAtLines(doc1, 0);
        assert.ok(res1);
        assert.strictEqual(res1.replacement, 'sbappend(sb, "1~status_t~", lineStatus, "|");');

        const code2 = 'sbappend(sb, docNum, "~status_t~", lineStatus);\n';
        const doc2 = createMockDoc(code2);
        const res2 = analyzeCpqReturnAtLines(doc2, 0);
        assert.ok(res2);
        assert.strictEqual(res2.replacement, 'sbappend(sb, docNum, "~status_t~", lineStatus, "|");');
    });

    test('String concatenation with + is normalized into canonical format', () => {
        const code = 'sbappend(sb, "1~variableName~" + dynamicVal + "|");\n';
        const doc = createMockDoc(code);
        const res = analyzeCpqReturnAtLines(doc, 0);
        assert.ok(res, 'Should normalize concatenated string call');
        assert.strictEqual(res.replacement, 'sbappend(sb, "1~variableName~", dynamicVal, "|");');
    });

    test('createSbappendSplitActions exposes QuickFix code action with canonical title', () => {
        const code = '    sbappend(sb, "1~variableName~");\n    sbappend(sb, "statiVal|");\n';
        const doc = createMockDoc(code);
        const actions = createSbappendSplitActions(doc, { start: { line: 0, character: 4 } });
        const canonicalFix = actions.find(a => a.title.includes('Convert to canonical CPQ return format'));
        assert.ok(canonicalFix, 'Should provide canonical conversion QuickFix');
        assert.strictEqual(
            canonicalFix.edit._edits[0].newText,
            '    sbappend(sb, "1~variableName~statiVal", "|");'
        );
    });

    test('Preserves indentation when converting', () => {
        const code = '        sbappend(sb, dynamicDocNumber, "~var~");\n        sbappend(sb, dynamicVal, "|");\n';
        const doc = createMockDoc(code);
        const res = analyzeCpqReturnAtLines(doc, 0);
        assert.ok(res);
        assert.strictEqual(res.replacement, '        sbappend(sb, dynamicDocNumber, "~var~", dynamicVal, "|");');
    });

    test('Single-quoted strings are normalized to double-quoted CPQ canonical formats', () => {
        const code = "sbappend(sb, '1~myVar~', 'staticVal', '|');\n";
        const doc = createMockDoc(code);
        const res = analyzeCpqReturnAtLines(doc, 0);
        assert.ok(res);
        assert.strictEqual(res.replacement, 'sbappend(sb, "1~myVar~staticVal", "|");');
    });

    test('Split statements without pipe are merged and pipe is appended', () => {
        const code = 'sbappend(sb, docNum, "~myVar~");\nsbappend(sb, dynamicVal);\n';
        const doc = createMockDoc(code);
        const res = analyzeCpqReturnAtLines(doc, 0);
        assert.ok(res);
        assert.strictEqual(res.replacement, 'sbappend(sb, docNum, "~myVar~", dynamicVal, "|");');
    });

    test('Separated tildes across multiple arguments: sbappend(sb, "1", "~", "var", "~", "val", "|")', () => {
        const code = 'sbappend(sb, "1", "~", "myAttr", "~", "myVal", "|");\n';
        const doc = createMockDoc(code);
        const res = analyzeCpqReturnAtLines(doc, 0);
        assert.ok(res);
        assert.strictEqual(res.replacement, 'sbappend(sb, "1~myAttr~myVal", "|");');
    });

    test('Handles member expressions e.g. line._document_number with dynamic value', () => {
        const code = 'sbappend(sb, line._document_number, "~discount_l~", string(disc), "|");\n';
        const doc = createMockDoc(code);
        // Already Format 3
        const res = analyzeCpqReturnAtLines(doc, 0);
        assert.strictEqual(res, null, 'Already canonical Format 3 should not require replacement');
    });
});

