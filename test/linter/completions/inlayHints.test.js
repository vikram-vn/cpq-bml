const assert = require('assert');
const { extractParamName, shouldSuppressHint, resolveParamNames, isInsideCommentOrString } = require('../../../app/lang/intellisense/inlayHints');
const { collectLocalVariables } = require('../../../app/lang/intellisense/bmqlVariableCompletions');

suite('Inlay Hints & BMQL Variable Completions Test Suite', () => {
    test('extracts parameter names cleanly from BML signature labels', () => {
        assert.strictEqual(extractParamName('String url'), 'url');
        assert.strictEqual(extractParamName('Dictionary headers'), 'headers');
        assert.strictEqual(extractParamName('[Boolean enableLoopback]'), 'enableLoopback');
        assert.strictEqual(extractParamName('query'), 'query');
    });

    test('resolves curated, idiomatic BML parameter names', () => {
        // replace: oldValue, newValue instead of old, new
        const replaceParams = resolveParamNames('replace', 3, {});
        assert.deepStrictEqual(replaceParams, ['str', 'oldValue', 'newValue', 'maxCount']);

        // Math functions: dividend, divisor, base, exponent
        assert.deepStrictEqual(resolveParamNames('fmod', 2, {}), ['dividend', 'divisor']);
        assert.deepStrictEqual(resolveParamNames('pow', 2, {}), ['base', 'exponent']);
        assert.deepStrictEqual(resolveParamNames('hypot', 2, {}), ['a', 'b']);

        // Array functions: array, element
        assert.deepStrictEqual(resolveParamNames('append', 2, {}), ['array', 'element']);
        assert.deepStrictEqual(resolveParamNames('findinarray', 2, {}), ['array', 'element']);

        // JSON & Dict
        assert.deepStrictEqual(resolveParamNames('jsonarrayget', 2, {}), ['jsonArray', 'index', 'returnType']);
        assert.deepStrictEqual(resolveParamNames('getfloat', 2, {}), ['record', 'fieldName']);
    });

    test('dynamically handles variadic BML functions (sbappend, stringbuilder, gettabledata)', () => {
        // sbappend with 2 args (sb, val)
        assert.deepStrictEqual(resolveParamNames('sbappend', 2, {}), ['stringBuilder', 'value']);

        // sbappend with 4 args (sb, val1, val2, val3)
        assert.deepStrictEqual(resolveParamNames('sbappend', 4, {}), ['stringBuilder', 'value1', 'value2', 'value3']);

        // stringbuilder with 3 args (val1, val2, val3)
        assert.deepStrictEqual(resolveParamNames('stringbuilder', 3, {}), ['value1', 'value2', 'value3']);

        // gettabledata with table, cols, and where clauses
        assert.deepStrictEqual(resolveParamNames('gettabledata', 4, {}), ['tableName', 'selectColumns', 'whereColumn', 'whereValue']);
        assert.deepStrictEqual(resolveParamNames('gettabledata', 6, {}), ['tableName', 'selectColumns', 'whereColumn1', 'whereValue1', 'whereColumn2', 'whereValue2']);
    });

    test('suppresses inlay hint when argument matches parameter name', () => {
        // Suppress matching names
        assert.strictEqual(shouldSuppressHint('record', 'record', true), true);
        assert.strictEqual(shouldSuppressHint('fieldName', '"fieldName"', true), true);
        assert.strictEqual(shouldSuppressHint('url', 'url', true), true);
        assert.strictEqual(shouldSuppressHint('headers', '_headers', true), true);

        // Do not suppress differing names
        assert.strictEqual(shouldSuppressHint('array', 'categories50Array', true), false);
        assert.strictEqual(shouldSuppressHint('fieldName', '"price"', true), false);
        assert.strictEqual(shouldSuppressHint('record', 'rRow_50', true), false);

        // Do not suppress if setting is false
        assert.strictEqual(shouldSuppressHint('record', 'record', false), false);
    });

    test('ignores function calls inside comments and string literals', () => {
        const text1 = '// resReplace = replace(sampleStr, "BML", "EXT");';
        const callPos1 = text1.indexOf('replace');
        assert.strictEqual(isInsideCommentOrString(text1, callPos1), true, 'Single line comment should be detected');

        const text2 = '/* \n resSplit = split(str, " "); \n */';
        const callPos2 = text2.indexOf('split');
        assert.strictEqual(isInsideCommentOrString(text2, callPos2), true, 'Block comment should be detected');

        const text3 = 'codeStr = "replace(a, b)";';
        const callPos3 = text3.indexOf('replace');
        assert.strictEqual(isInsideCommentOrString(text3, callPos3), true, 'String literal should be detected');

        const text4 = 'resReplace = replace(sampleStr, "BML", "EXT");';
        const callPos4 = text4.indexOf('replace');
        assert.strictEqual(isInsideCommentOrString(text4, callPos4), false, 'Normal active code should not be detected as comment');
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
