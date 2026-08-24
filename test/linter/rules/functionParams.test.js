const assert = require('assert');
const { lintText } = require('../fixtures');
const { parseParameterSignature, splitArgumentsList } = require('../../../app/lang/lint/rules/functionSignature');
const { findClosestBuiltInFunction, loadBuiltInFunctions } = require('../../../app/lang/lint/rules/functions');

suite('BML Linter Test Suite - function signature parsing (functionSignature.js)', () => {
    test('Parses a simple required parameter', () => {
        const result = parseParameterSignature('Float atof(String str)');
        assert.deepStrictEqual(result, { min: 1, max: 1, params: [{ type: 'String', optional: false }] });
    });

    test('Parses individually-bracketed optional parameters', () => {
        const result = parseParameterSignature('Integer find(String str, String substr, [Integer start], [Integer end])');
        assert.strictEqual(result.min, 2);
        assert.strictEqual(result.max, 4);
        assert.deepStrictEqual(result.params.map((p) => p.optional), [false, false, true, true]);
    });

    test('Correctly counts a cascading nested-optional tail (regression: used to under-count required params)', () => {
        // "Date date [, String dateFormat [, String timeZone]]" - naive
        // comma-splitting previously treated ALL three params as optional
        // (min=0) because the first stray "[" flips a single shared
        // "inOptional" flag for every later parameter, including ones
        // before it ever opened.
        const result = parseParameterSignature('String datetostr(Date date [, String dateFormat [, String timeZone]])');
        assert.strictEqual(result.min, 1, 'date is required');
        assert.strictEqual(result.max, 3);
        assert.deepStrictEqual(result.params.map((p) => p.optional), [false, true, true]);
    });

    test('Correctly counts two required params before a nested-optional tail (regression)', () => {
        // "String str, String format [, String timeZone]" - naive splitting
        // flipped requiredCount off as soon as it saw format's trailing "[",
        // undercounting format itself as optional too.
        const result = parseParameterSignature('Date strtodate(String str, String format [, String timeZone])');
        assert.strictEqual(result.min, 2, 'str and format are both required');
        assert.strictEqual(result.max, 3);
    });

    test('Handles a deeply-nested cascading optional tail', () => {
        const result = parseParameterSignature(
            'Dictionary urldata(String url, String httpMethod, [Dictionary headers, [String parameters, [Integer timeout, [Dictionary formData, [Boolean enableLoopback]]]]])'
        );
        assert.strictEqual(result.min, 2);
        assert.strictEqual(result.max, 7);
    });

    test('Extracts array-typed parameters without confusing [] with an optional-group bracket', () => {
        const result = parseParameterSignature('String join(String[] str_array, String delimiter)');
        assert.strictEqual(result.min, 2);
        assert.strictEqual(result.max, 2);
        assert.strictEqual(result.params[0].type, 'String[]');
    });

    test('Treats a bare untyped parameter as unknown-type rather than failing to parse', () => {
        const result = parseParameterSignature('Integer savebom(Integer bsId, Json bomJson [, configurationKey])');
        assert.strictEqual(result.min, 2);
        assert.strictEqual(result.max, 3);
        assert.strictEqual(result.params[2].type, null);
    });

    test('Correctly parses "(or" polymorphic union signatures into an array of types', () => {
        const result = parseParameterSignature('Integer(or Float or Date) max(Integer[](or Float[] or Date[]) arrayIdentifier)');
        assert.deepStrictEqual(result.params, [
            { type: ['Integer[]', 'Float[]', 'Date[]'], optional: false }
        ]);
        assert.strictEqual(result.min, 1);
        assert.strictEqual(result.max, 1);
    });

    test('Falls back to permissive for a signature with an unbalanced paren (put)', () => {
        const result = parseParameterSignature('put(Dictionary dictionaryIdentifier, String(or Integer, Float))key,  value)');
        assert.strictEqual(result.params, null);
    });

    test('Falls back to permissive for a variadic function described with a glued (comma-less) bracket cascade (sbappend)', () => {
        // Oracle's own doc text for sbappend is itself malformed - missing
        // the comma every other cascading signature has right after the
        // bracket opens - which would otherwise make this truly variadic
        // function look like it takes at most 3 fixed-type arguments.
        const result = parseParameterSignature(
            'StringBuilder sbappend(StringBuilder stringBuilder[String string[, String[] stringArray[, StringBuilder stringBuilder]]])'
        );
        assert.strictEqual(result.params, null);
    });

    test('Returns an empty params list for a zero-argument function', () => {
        const result = parseParameterSignature('Date getdate()');
        assert.deepStrictEqual(result, { min: 0, max: 0, params: [] });
    });
});

suite('BML Linter Test Suite - call argument splitting (splitArgumentsList)', () => {
    test('Splits simple comma-separated arguments', () => {
        assert.deepStrictEqual(splitArgumentsList('a, b, c'), ['a', 'b', 'c']);
    });

    test('Does not split on commas nested inside parens, brackets, or braces', () => {
        assert.deepStrictEqual(
            splitArgumentsList('foo(1, 2), string[]{"a", "b"}, dict("x", 1)'),
            ['foo(1, 2)', 'string[]{"a", "b"}', 'dict("x", 1)']
        );
    });

    test('Does not split on a comma inside a string literal', () => {
        assert.deepStrictEqual(splitArgumentsList('"a, b", 5'), ['"a, b"', '5']);
    });

    test('Returns an empty array for whitespace-only input', () => {
        assert.deepStrictEqual(splitArgumentsList('   '), []);
    });
});

suite('BML Linter Test Suite - built-in function argument type checking', () => {
    test('Flags a String literal passed where the signature declares Integer', () => {
        const diagnostics = lintText(`
            x = atoi(5);
            return "";
        `);
        const diag = diagnostics.find((d) => d.code === 'bml-function-arg-type');
        assert.ok(diag, 'Should flag passing an Integer literal to atoi, which expects a String');
        assert.match(diag.message, /Argument 1 to 'atoi' should be String, but got a Integer value\./);
    });

    test('Does not flag a correctly-typed literal argument', () => {
        const diagnostics = lintText(`
            x = atoi("5");
            return "";
        `);
        assert.strictEqual(diagnostics.find((d) => d.code === 'bml-function-arg-type'), undefined);
    });

    test('Allows an Integer literal where a Float parameter is expected (numeric widening)', () => {
        const diagnostics = lintText(`
            x = formatascurrency(5, "USD");
            return "";
        `);
        assert.strictEqual(diagnostics.find((d) => d.code === 'bml-function-arg-type'), undefined);
    });

    test('Does not flag a variable argument (its type cannot be known from the text alone)', () => {
        const diagnostics = lintText(`
            n = someVariable;
            x = atoi(n);
            return "";
        `);
        assert.strictEqual(diagnostics.find((d) => d.code === 'bml-function-arg-type'), undefined);
    });

    test('Does not flag any argument for a polymorphic union-typed built-in like max()', () => {
        const diagnostics = lintText(`
            arr = integer[]{1, 2, 3};
            x = max(arr);
            return "";
        `);
        assert.strictEqual(diagnostics.find((d) => d.code === 'bml-function-arg-type'), undefined);
    });

    test('Does not flag sbappend with more arguments than its (variadic, unparseable) doc signature implies', () => {
        const diagnostics = lintText(`
            sb = stringbuilder();
            sbappend(sb, "a", "b", "c", "d");
            return "";
        `);
        assert.strictEqual(diagnostics.find((d) => d.code === 'bml-function-arg-count'), undefined);
        assert.strictEqual(diagnostics.find((d) => d.code === 'bml-function-arg-type'), undefined);
    });
});

suite('BML Linter Test Suite - "did you mean" suggestion for unknown function calls', () => {
    test('Suggests the closest built-in function name for a near-exact typo', () => {
        const diagnostics = lintText(`
            x = atfo("5.0");
            return "";
        `);
        const diag = diagnostics.find((d) => d.code === 'bml-unknown-function');
        assert.ok(diag, 'atfo is not a real built-in');
        assert.match(diag.message, /did you mean 'atof'\?/);
    });

    test('Does not suggest anything for a name unrelated to any built-in', () => {
        const diagnostics = lintText(`
            x = abo_initializeContext();
            return "";
        `);
        const diag = diagnostics.find((d) => d.code === 'bml-unknown-function');
        assert.ok(diag);
        assert.doesNotMatch(diag.message, /did you mean/);
    });

    test('findClosestBuiltInFunction returns null for an exact match', () => {
        const builtIns = loadBuiltInFunctions();
        assert.strictEqual(findClosestBuiltInFunction('atof', builtIns), null);
    });

    test('findClosestBuiltInFunction returns null when nothing is close enough', () => {
        const builtIns = loadBuiltInFunctions();
        assert.strictEqual(findClosestBuiltInFunction('completelyUnrelatedName', builtIns), null);
    });
});

suite('BML Linter Test Suite - function-call diagnostic codes', () => {
    test('Unknown bare function call carries the bml-unknown-function code', () => {
        const diagnostics = lintText(`
            x = nonExistentFunc();
            return "";
        `);
        const diag = diagnostics.find((d) => d.message.includes("Unknown built-in function or variable 'nonExistentFunc'"));
        assert.strictEqual(diag.code, 'bml-unknown-function');
    });

    test('Built-in argument-count mismatch carries the bml-function-arg-count code', () => {
        const diagnostics = lintText(`
            x = atof("5.0", "extra");
            return "";
        `);
        const diag = diagnostics.find((d) => d.message.includes("function 'atof' expects"));
        assert.strictEqual(diag.code, 'bml-function-arg-count');
    });
});

suite('BML Linter Test Suite - workspace function parameter and spelling checks', () => {
    setup(() => {
        const { getWorkspaceFunctionsCached } = require('../../../app/lang/lint/rules/functions');
        const vscode = require('vscode');
        const wsFunctions = getWorkspaceFunctionsCached(vscode);
        wsFunctions.clear();
        wsFunctions.set('util.calculate_discount', {
            name: 'calculate_discount',
            namespace: 'util',
            parameterCount: 2,
            params: [
                { name: 'price', type: 'Float' },
                { name: 'discountPercent', type: 'Integer' }
            ]
        });
        wsFunctions.set('commerce.get_price', {
            name: 'get_price',
            namespace: 'commerce',
            parameterCount: 1,
            params: [
                { name: 'partNumber', type: 'String' }
            ]
        });
    });

    test('Flags correct argument count and types for workspace function', () => {
        const diagnostics = lintText(`
            x = util.calculate_discount(100.0, 10);
            return "";
        `);
        assert.strictEqual(diagnostics.filter(d => d.code === 'bml-function-arg-count' || d.code === 'bml-function-arg-type').length, 0);
    });

    test('Flags incorrect argument count for workspace function', () => {
        const diagnostics = lintText(`
            x = util.calculate_discount(100.0);
            return "";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
        assert.ok(diag);
        assert.match(diag.message, /Function 'util.calculate_discount' expects 2 argument\(s\), but got 1\./);
    });

    test('Flags incorrect argument type for workspace function', () => {
        const diagnostics = lintText(`
            x = util.calculate_discount("100.0", 10);
            return "";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-function-arg-type');
        assert.ok(diag);
        assert.match(diag.message, /Argument 1 to 'util.calculate_discount' should be Float, but got a String value\./);
    });

    test('Suggests closest workspace function for misspelled name', () => {
        const diagnostics = lintText(`
            x = util.calculate_discont(100.0, 10);
            return "";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-function-not-found-workspace');
        assert.ok(diag);
        assert.match(diag.message, /Function 'util.calculate_discont' not found in the workspace library\. Did you mean 'util.calculate_discount'\?/);
    });

    test('Validates overloaded built-in function signature (get)', () => {
        let diagnostics = lintText(`
            d = dict("string");
            x = get(d, "key");
            return "";
        `);
        assert.strictEqual(diagnostics.filter(d => d.code === 'bml-function-arg-count').length, 0);

        diagnostics = lintText(`
            d = dict("string");
            x = get(d, "key", "String");
            return "";
        `);
        assert.strictEqual(diagnostics.filter(d => d.code === 'bml-function-arg-count').length, 0);

        diagnostics = lintText(`
            d = dict("string");
            x = get(d);
            return "";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-function-arg-count');
        assert.ok(diag);
        assert.match(diag.message, /expects 2 or 3 argument\(s\), but got 1\./);
    });

    test('Validates union type compatibility (append)', () => {
        let diagnostics = lintText(`
            arr = integer[];
            x = append(arr, 123);
            return "";
        `);
        assert.strictEqual(diagnostics.filter(d => d.code === 'bml-function-arg-type').length, 0);

        diagnostics = lintText(`
            arr = string[];
            x = append(arr, "test");
            return "";
        `);
        assert.strictEqual(diagnostics.filter(d => d.code === 'bml-function-arg-type').length, 0);

        diagnostics = lintText(`
            arr = string[];
            x = append(arr, 123);
            return "";
        `);
        assert.strictEqual(diagnostics.filter(d => d.code === 'bml-function-arg-type').length, 1);
    });
});

