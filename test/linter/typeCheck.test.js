const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('./fixtures');
const { inferLiteralType } = require('../../app/lang/lint/typeCheck');

suite('BML Linter Test Suite - variable type consistency', () => {
    test('Flags reassigning an Integer-typed variable to a String literal', () => {
        const diagnostics = lintText(`
            test = 1;
            test = "2";
            return "";
        `);

        const diag = diagnostics.find(d => d.code === 'bml-type-mismatch');
        assert.ok(diag, 'Should flag the type mismatch');
        assert.ok(diag.message.includes('Integer') && diag.message.includes('String'));
        assert.strictEqual(diag.range.start.line, 2);
        assert.strictEqual(diag.severity, vscode.DiagnosticSeverity.Error);
    });

    test('Flags reassigning a String-typed variable to a Boolean literal', () => {
        const diagnostics = lintText(`
            flag = "yes";
            flag = true;
            return "";
        `);

        const diag = diagnostics.find(d => d.code === 'bml-type-mismatch');
        assert.ok(diag, 'Should flag String -> Boolean mismatch');
    });

    test('Does not flag repeated assignment of the same type', () => {
        const diagnostics = lintText(`
            count = 1;
            count = 2;
            count = 3;
            return "";
        `);

        const diag = diagnostics.find(d => d.code === 'bml-type-mismatch');
        assert.strictEqual(diag, undefined, 'Same-type reassignment is normal and should not be flagged');
    });

    test('Does not flag when the later assignment is not a plain literal', () => {
        const diagnostics = lintText(`
            value = 1;
            value = atoi(someInput);
            value = value + 1;
            return "";
        `);

        const diag = diagnostics.find(d => d.code === 'bml-type-mismatch');
        assert.strictEqual(diag, undefined, 'Function calls and expressions are not type-inferred - conservatively skipped');
    });

    test('Does not flag a comparison that looks like assignment from behind', () => {
        const diagnostics = lintText(`
            x = 1;
            if (x <= "2") {
                return "";
            }
            return "";
        `);

        const diag = diagnostics.find(d => d.code === 'bml-type-mismatch');
        assert.strictEqual(diag, undefined, '<= should never be mistaken for an assignment');
    });

    test('inferLiteralType returns null for anything that is not a bare literal', () => {
        assert.strictEqual(inferLiteralType('atoi(x)'), null);
        assert.strictEqual(inferLiteralType('x + 1'), null);
        assert.strictEqual(inferLiteralType('"a" + "b"'), null);
        assert.strictEqual(inferLiteralType('someVar'), null);
    });

    test('inferLiteralType correctly identifies each literal type', () => {
        assert.strictEqual(inferLiteralType('"hello"'), 'String');
        assert.strictEqual(inferLiteralType("'hello'"), 'String');
        assert.strictEqual(inferLiteralType('true'), 'Boolean');
        assert.strictEqual(inferLiteralType('FALSE'), 'Boolean');
        assert.strictEqual(inferLiteralType('42'), 'Integer');
        assert.strictEqual(inferLiteralType('-7'), 'Integer');
        assert.strictEqual(inferLiteralType('3.14'), 'Float');
    });

    test('inferLiteralType identifies typed array literals and bare declarations', () => {
        assert.strictEqual(inferLiteralType('string[]{"a", "b"}'), 'string[]');
        assert.strictEqual(inferLiteralType('Integer[]{1, 2, 3}'), 'integer[]');
        assert.strictEqual(inferLiteralType('string[][]{{"a"}, {"b"}}'), 'string[][]');
        assert.strictEqual(inferLiteralType('boolean[]'), 'boolean[]');
        assert.strictEqual(inferLiteralType('Date[]'), 'date[]');
    });

    test('inferLiteralType identifies type-named constructor calls', () => {
        assert.strictEqual(inferLiteralType('dict()'), 'Dictionary');
        assert.strictEqual(inferLiteralType('json()'), 'Json');
        assert.strictEqual(inferLiteralType('jsonarray()'), 'JsonArray');
        assert.strictEqual(inferLiteralType('bytearray()'), 'ByteArray');
        assert.strictEqual(inferLiteralType('stringbuilder()'), 'StringBuilder');
        assert.strictEqual(inferLiteralType('recordset()'), 'RecordSet');
        // Constructor calls with nested calls as arguments are not "unambiguous" - skipped.
        assert.strictEqual(inferLiteralType('dict("a", lookupSomething())'), null);
    });

    test('Flags reassigning a typed-array variable to a different element type', () => {
        const diagnostics = lintText(`
            list = string[]{"a", "b"};
            list = integer[]{1, 2};
            return "";
        `);

        const diag = diagnostics.find(d => d.code === 'bml-type-mismatch');
        assert.ok(diag, 'Should flag string[] -> integer[] mismatch');
        assert.ok(diag.message.includes('string[]') && diag.message.includes('integer[]'));
    });

    test('Flags reassigning a Dictionary-typed variable to a Json literal', () => {
        const diagnostics = lintText(`
            data = dict();
            data = json();
            return "";
        `);

        const diag = diagnostics.find(d => d.code === 'bml-type-mismatch');
        assert.ok(diag, 'Should flag Dictionary -> Json mismatch');
    });

    test('Does not flag repeated same-shape array or constructor reassignment', () => {
        const diagnostics = lintText(`
            list = string[]{"a"};
            list = string[]{"b", "c"};
            data = dict();
            data = dict("k", "v");
            return "";
        `);

        const diag = diagnostics.find(d => d.code === 'bml-type-mismatch');
        assert.strictEqual(diag, undefined);
    });
});
