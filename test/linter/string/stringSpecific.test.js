const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - String Specific & Edge Tests', () => {
    suite('substring() - 2 and 3 argument overloads', () => {
        test('substring(str, 0) - valid 2 args', () => {
            const diags = lintText('s = substring("Hello World", 6); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });

        test('substring(str, 0, 5) - valid 3 args', () => {
            const diags = lintText('s = substring("Hello World", 0, 5); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });

        test('substring() - 0 args → flags bml-function-arg-count', () => {
            const diags = lintText('s = substring(); return "";');
            const err = diags.find(d => d.code === 'bml-function-arg-count');
            assert.ok(err);
            assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
        });

        test('substring("text") - 1 arg → flags bml-function-arg-count', () => {
            const diags = lintText('s = substring("text"); return "";');
            assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
        });

        test('substring("text", 0, 2, "excess") - 4 args → flags bml-function-arg-count', () => {
            const diags = lintText('s = substring("text", 0, 2, "excess"); return "";');
            assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
        });
    });

    suite('find(), replace(), split(), join() operations', () => {
        test('find("hello", "ll") - 2 args → no error', () => {
            const diags = lintText('idx = find("hello", "ll"); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });

        test('replace("hello", "l", "w") - 3 args → no error', () => {
            const diags = lintText('res = replace("hello", "l", "w"); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });

        test('split("a,b,c", ",") - 2 args → no error', () => {
            const diags = lintText('arr = split("a,b,c", ","); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });

        test('join(arr, "-") - 2 args → no error', () => {
            const diags = lintText('arr = string[]{"a", "b"}; res = join(arr, "-"); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });
    });

    suite('Numeric conversion & formatting (atoi, atof, formatascurrency, getcurrencyvalue)', () => {
        test('atoi("123") / atof("45.67") - valid 1 arg', () => {
            const diags = lintText('i = atoi("123"); f = atof("45.67"); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });

        test('formatascurrency(1234.56, "USD") / getcurrencyvalue("$1,234.56") - valid', () => {
            const diags = lintText('cur = formatascurrency(1234.56, "USD"); val = getcurrencyvalue("$1,234.56"); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });

        test('isnumber("123") / html("<script>") / encodebase64("secret") / decodebase64("c2VjcmV0") - valid', () => {
            const diags = lintText('n = isnumber("123"); h = html("<script>"); enc = encodebase64("secret"); dec = decodebase64("c2VjcmV0"); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });
    });
});
