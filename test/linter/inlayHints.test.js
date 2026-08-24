const assert = require('assert');
const { extractParamName } = require('../../app/lang/intellisense/inlayHints');
const { collectLocalVariables } = require('../../app/lang/intellisense/bmqlVariableCompletions');

suite('Inlay Hints & BMQL Variable Completions Test Suite', () => {
    test('extracts parameter names cleanly from BML signature labels', () => {
        assert.strictEqual(extractParamName('String url'), 'url');
        assert.strictEqual(extractParamName('Dictionary headers'), 'headers');
        assert.strictEqual(extractParamName('[Boolean enableLoopback]'), 'enableLoopback');
        assert.strictEqual(extractParamName('query'), 'query');
    });

    test('collects local variables in scope and ignores out-of-scope variables', () => {
        const mockLines = [
            'outerVar = "root";',                 // Line 0 (depth 0, in scope)
            'if (true) {',                        // Line 1 (depth 1)
            '    innerVar = "inside_if";',        // Line 2 (depth 1, in scope inside block)
            '}',                                  // Line 3 (block closed)
            'for item in items {',               // Line 4 (depth 1)
            '    loopVar = item;',               // Line 5 (depth 1, in scope inside loop)
            '}'                                   // Line 6 (loop closed)
        ];

        const makeDoc = (lines) => ({
            lineCount: lines.length,
            lineAt(idx) { return { text: lines[idx] }; }
        });

        // 1. Cursor on Line 2 (inside if block): outerVar AND innerVar are in scope
        const varsInsideIf = collectLocalVariables(makeDoc(mockLines), { line: 2, character: 25 });
        const namesInsideIf = varsInsideIf.map(v => v.name);
        assert.ok(namesInsideIf.includes('outerVar'), 'outerVar should be in scope inside if block');
        assert.ok(namesInsideIf.includes('innerVar'), 'innerVar should be in scope inside if block');

        // 2. Cursor on Line 3 (after if block closed): outerVar IS in scope, innerVar IS NOT in scope
        const varsAfterIf = collectLocalVariables(makeDoc(mockLines), { line: 3, character: 1 });
        const namesAfterIf = varsAfterIf.map(v => v.name);
        assert.ok(namesAfterIf.includes('outerVar'), 'outerVar should be in scope after if block');
        assert.strictEqual(namesAfterIf.includes('innerVar'), false, 'innerVar must NOT be in scope after if block ends');

        // 3. Cursor on Line 5 (inside for loop): outerVar, item, loopVar are in scope, innerVar is NOT
        const varsInsideLoop = collectLocalVariables(makeDoc(mockLines), { line: 5, character: 18 });
        const namesInsideLoop = varsInsideLoop.map(v => v.name);
        assert.ok(namesInsideLoop.includes('outerVar'));
        assert.ok(namesInsideLoop.includes('item'));
        assert.ok(namesInsideLoop.includes('loopVar'));
        assert.strictEqual(namesInsideLoop.includes('innerVar'), false);
    });

    test('excludes LHS variable currently being defined on active line from RHS completions (scope2 = sc)', () => {
        const mockLines = [
            'rPrice_28 = getfloat(rRow_28, "price");', // Line 0
            'scope1 = rPrice_28;',                     // Line 1
            '            scope2 = sc'                   // Line 2 (typing RHS for scope2 at pos 23)
        ];

        const doc = {
            lineCount: mockLines.length,
            lineAt(idx) { return { text: mockLines[idx] }; }
        };

        // Cursor at pos 23 (right after '            scope2 = sc')
        const vars = collectLocalVariables(doc, { line: 2, character: 23 });
        const names = vars.map(v => v.name);

        assert.ok(names.includes('rPrice_28'), 'rPrice_28 should be suggested on RHS');
        assert.ok(names.includes('scope1'), 'scope1 should be suggested on RHS');
        assert.strictEqual(names.includes('scope2'), false, 'scope2 MUST NOT suggest itself on RHS of scope2 = sc!');
    });
});
